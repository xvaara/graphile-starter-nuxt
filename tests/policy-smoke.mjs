import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from 'graphql-ws'
import WebSocket from 'ws'

// Uses the existing database read-only. Start only the built app, never workers/migrations.
const origin = 'http://localhost:4312'
const directory = await mkdtemp(join(tmpdir(), 'preset-policy-'))
const serverDir = join(directory, 'output/server')
await cp(resolve('.output'), join(directory, 'output'), { recursive: true })
const tagsPath = join(serverDir, 'tags.jsonc')
const tags = await readFile(tagsPath, 'utf8')
assert.equal(tags, await readFile('db/tags.jsonc', 'utf8'), 'build packages exact smart tags')
const env = { ...process.env, NODE_ENV: 'production', PORT: '4312', HOST: '127.0.0.1', ENABLE_GRAPHIQL: '1' }
for (const key of ['GRAPHILE_TAGS_FILE', 'GRAPHQL_DEPTH_LIMIT', 'GRAPHQL_ALLOW_INTROSPECTION']) delete env[key]
let child
let log = ''
async function stop() {
  if (!child || child.exitCode !== null)
    return
  const exit = once(child, 'exit')
  child.kill('SIGINT')
  const result = await Promise.race([exit, delay(8000).then(() => null)])
  if (!result) {
    child.kill('SIGKILL')
    assert.fail('Standalone server did not shut down cleanly within 8 seconds')
  }
  assert.equal(result[0], 0, 'standalone shutdown exit code')
}
async function start(overrides = {}, expectFailure = false) {
  log = ''
  child = spawn(process.execPath, [join(serverDir, 'index.mjs')], { cwd: directory, env: { ...env, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (data) => {
    log += data
  })
  child.stderr.on('data', (data) => {
    log += data
  })
  if (expectFailure) {
    const result = await Promise.race([once(child, 'exit'), delay(8000).then(() => null)])
    assert.ok(result, 'invalid tags must terminate startup instead of retrying')
    assert.notEqual(result[0], 0)
    assert.match(log, /Cannot load valid smart tags|must be an absolute file path/)
    return
  }
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, 'standalone process exited before readiness')
    try {
      if ((await fetch(origin, { signal: AbortSignal.timeout(2000) })).ok)
        return
    }
    catch {}
    await delay(200)
  }
  assert.fail('Standalone server did not become ready')
}
function ssrCache(html) {
  const encoded = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(encoded, 'SSR serializes Nuxt hydration data')
  const values = JSON.parse(encoded)
  const payload = values.find(value => value && typeof value === 'object' && Object.hasOwn(value, '__apollo_ssr__'))
  assert.ok(payload, 'SSR serializes Apollo cache')
  return values[payload.__apollo_ssr__]
}
async function transports() {
  const response = await fetch(origin)
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.ok(Object.hasOwn(ssrCache(html), 'ROOT_QUERY'), 'normal direct SSR executes and caches application query')
  const csrf = html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1]
  assert.ok(csrf, 'SSR supplies CSRF token')
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const ws = createClient({ url: `${origin.replace(/^http/, 'ws')}/api/graphql/ws`, webSocketImpl: class extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: { cookie } })
    }
  }, lazyCloseTimeout: 1000, retryAttempts: 0 })
  return {
    async http(query) {
      console.log('Checking HTTP', query.slice(0, 60))
      const response = await fetch(`${origin}/api/graphql`, { signal: AbortSignal.timeout(10000), method: 'POST', headers: { 'content-type': 'application/json', cookie, 'csrf-token': csrf }, body: JSON.stringify({ query }) })
      assert.notEqual(response.status, 403, 'HTTP policy requests pass CSRF validation')
      return response.json()
    },
    ws(query) {
      console.log('Checking WS', query.slice(0, 60))
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WebSocket policy request timed out')), 10000)
        ws.subscribe({ query }, {
          next(result) {
            clearTimeout(timer)
            resolve(result)
          },
          error(errors) {
            clearTimeout(timer)
            Array.isArray(errors) ? resolve({ errors }) : reject(errors)
          },
          complete() {
            clearTimeout(timer)
            reject(new Error('WebSocket completed without a result'))
          },
        })
      })
    },
    dispose: () => ws.dispose(),
  }
}
function nested(depth) {
  const fields = Array.from({ length: depth - 2 }, (_, i) => ['organizationMemberships', 'nodes', 'user'][i % 3])
  return `{currentUser{${fields.map(field => `${field}{`).join('')}__typename${'}'.repeat(fields.length)}}}`
}
async function check({ allow = false, limit = 16 } = {}) {
  const transport = await transports()
  try {
    for (const send of [transport.http, transport.ws]) {
      for (const query of ['{__schema{queryType{name}}}', '{__type(name:"Query"){name}}']) {
        const result = await send(query)
        if (allow)
          assert.equal(result.errors, undefined)
        else assert.ok(result.errors?.some(error => /introspection/i.test(error.message)))
      }
      assert.equal((await send('{__typename}')).data.__typename, 'Query')
      assert.equal((await send(nested(limit))).errors, undefined, `depth ${limit} accepted`)
      assert.ok((await send(nested(limit + 1))).errors?.some(error => /depth.*exceeds/i.test(error.message)), `depth ${limit + 1} blocked`)
      const body = nested(limit + 1).slice('{currentUser{'.length, -2)
      const fragmented = `query {currentUser {...Deep}} fragment Deep on User {${body}}`
      assert.ok((await send(fragmented)).errors?.some(error => /depth.*exceeds/i.test(error.message)), 'named fragments cannot bypass depth')
      assert.ok((await send(`{currentUser{... on User {${body}}}}`)).errors?.some(error => /depth.*exceeds/i.test(error.message)), 'inline fragments cannot bypass depth')
      assert.ok((await send('query{currentUser{...A}} fragment A on User{...B} fragment B on User{...A}')).errors?.some(error => /within itself/i.test(error.message)), 'cyclic fragments rejected')
      assert.ok((await send('{query{__typename}}')).errors?.some(error => /Cannot query field "query"/.test(error.message)))
    }
    if (allow) {
      const result = await transport.http('{q:__type(name:"Query"){fields{name}} m:__type(name:"Mutation"){fields{name}}}')
      assert.equal(result.errors, undefined)
      const queries = result.data.q.fields.map(field => field.name)
      const mutations = result.data.m.fields.map(field => field.name)
      for (const field of ['query', 'users', 'userEmails', 'currentSessionId', 'currentUserId']) assert.ok(!queries.includes(field), `smart-tag/root omission ${field}`)
      for (const field of ['updateUserByUsername', 'deleteUserByUsername', 'updateOrganizationBySlug', 'deleteOrganizationBySlug']) assert.ok(!mutations.includes(field), `unique-key mutation omitted: ${field}`)
      for (const field of ['updateUser', 'updateOrganization', 'deleteUserEmail', 'deleteUserAuthentication']) assert.ok(mutations.includes(field), `primary-key mutation retained: ${field}`)
    }
  }
  finally { await transport.dispose() }
}
try {
  await start()
  await check()
  await stop()
  console.log('PASS: isolated production artifact, HTTP/WS default depth16, fragment limits, introspection blocked, typename allowed, clean shutdown')
  await start({ GRAPHQL_ALLOW_INTROSPECTION: 'true', GRAPHQL_DEPTH_LIMIT: '6' })
  await check({ allow: true, limit: 6 })
  await stop()
  console.log('PASS: runtime introspection opt-in, depth override6, schema omissions and primary-key mutations')
  await start({ GRAPHQL_ALLOW_INTROSPECTION: 'TRUE', GRAPHQL_DEPTH_LIMIT: '0' })
  await check()
  await stop()
  console.log('PASS: exact introspection opt-in and invalid depth fallback')
  await start({ GRAPHQL_DEPTH_LIMIT: '1' })
  const strictSSR = await fetch(origin)
  assert.equal(strictSSR.status, 200, 'Vue Apollo renders despite GraphQL validation errors')
  assert.deepEqual(ssrCache(await strictSSR.text()), {}, 'strict depth rejection leaves real direct SSR cache empty')
  await stop()
  console.log('PASS: real direct SSR depth enforcement')
  for (const NODE_ENV of ['development', 'test']) {
    await start({ NODE_ENV })
    const transport = await transports()
    try {
      for (const send of [transport.http, transport.ws]) {
        assert.equal((await send('{__schema{queryType{name}}}')).errors, undefined)
        assert.equal((await send(nested(20))).errors, undefined)
      }
    }
    finally { await transport.dispose() }
    await stop()
  }
  console.log('PASS: development/test HTTP and WS allow introspection and deeper operations')
  await rm(tagsPath)
  await start({}, true)
  await writeFile(tagsPath, '{')
  await start({}, true)
  await writeFile(tagsPath, tags)
  await start({ GRAPHILE_TAGS_FILE: join(directory, 'missing.jsonc') }, true)
  await start({ GRAPHILE_TAGS_FILE: 'db/tags.jsonc' }, true)
  const override = join(directory, 'override.jsonc')
  await writeFile(override, tags)
  await start({ GRAPHILE_TAGS_FILE: override })
  await check()
  await stop()
  console.log('PASS: missing/malformed packaged tags and bad overrides fail startup, valid absolute override starts')
}
catch (error) {
  await writeFile('/tmp/preset-policy-server-failure.log', log)
  throw error
}
finally {
  await stop()
  await rm(directory, { recursive: true, force: true })
}
