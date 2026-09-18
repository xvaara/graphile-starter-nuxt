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
const origin = 'http://localhost:4311'
const directory = await mkdtemp(join(tmpdir(), 'apollo-policy-'))
const serverDir = join(directory, 'output/server')
await cp(resolve('.output'), join(directory, 'output'), { recursive: true })
const tagsPath = join(serverDir, 'tags.jsonc')
const tags = await readFile(tagsPath, 'utf8')
const env = { ...process.env, NODE_ENV: 'production', PORT: '4311', NITRO_PORT: '4311', HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1', ENABLE_GRAPHIQL: '1', NITRO_SHUTDOWN_NO_FORCE_EXIT: '1', NITRO_SHUTDOWN_TIMEOUT: '10000' }
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
  assert.doesNotMatch(log, /shutdown timeout|force exiting|Called end on pool more than once/i)
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
    assert.doesNotMatch(log, /Listening on/)
    assert.match(log, /Cannot load valid smart tags|must be an absolute file path/)
    return
  }
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, 'standalone process exited before readiness')
    if (log.includes('Listening on'))
      return
    await delay(200)
  }
  assert.fail('Standalone server did not become ready')
}
function apolloCache(html) {
  const encoded = html.match(/id="__NUXT_DATA__"[^>]*>(.*?)<\/script>/)?.[1]
  assert.ok(encoded)
  const payload = JSON.parse(encoded)
  const metadata = payload.find(value => value && Object.hasOwn(value, '__apollo_ssr__'))
  assert.ok(metadata)
  return payload[metadata.__apollo_ssr__]
}
async function transports() {
  const response = await fetch(origin)
  const html = await response.text()
  assert.ok(Object.hasOwn(apolloCache(html), 'ROOT_QUERY'), 'normal SSR executes and serializes the shared user query')
  const csrf = html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1]
  assert.ok(csrf)
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const ws = createClient({ url: `${origin.replace(/^http/, 'ws')}/api/graphql/ws`, webSocketImpl: class extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: { cookie } })
    }
  }, lazyCloseTimeout: 1000, retryAttempts: 0 })
  return {
    async http(query) {
      const response = await fetch(`${origin}/api/graphql`, { signal: AbortSignal.timeout(10000), method: 'POST', headers: { 'content-type': 'application/json', 'csrf-token': csrf, cookie }, body: JSON.stringify({ query }) })
      return response.json()
    },
    ws(query) {
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
async function check({ allow = false, limit = 16, depthLimited = true } = {}) {
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
      const body = nested(limit + 1).slice('{currentUser{'.length, -2)
      for (const query of [nested(limit + 1), `query {currentUser {...Deep}} fragment Deep on User {${body}}`, `{currentUser{... on User {${body}}}}`]) {
        const result = await send(query)
        if (depthLimited)
          assert.ok(result.errors?.some(error => /depth.*exceeds/i.test(error.message)), 'fields and fragments obey depth limit')
        else assert.equal(result.errors, undefined, 'development/test does not apply production depth policy')
      }
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
  for (const NODE_ENV of ['development', 'test']) {
    await start({ NODE_ENV })
    await check({ allow: true, depthLimited: false })
    await stop()
  }
  await start({ GRAPHQL_DEPTH_LIMIT: '1' })
  const strictResponse = await fetch(origin)
  assert.equal(strictResponse.status, 200, 'Vue Apollo renders the public page when its query fails')
  assert.deepEqual(apolloCache(await strictResponse.text()), {}, 'depth-rejected real SSR query cannot populate the hydration cache')
  await stop()
  console.log('PASS: runtime development/test policy and actual application SSR depth enforcement')
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
  await writeFile('/tmp/apollo-policy-server-failure.log', log)
  throw error
}
finally {
  await stop()
  await rm(directory, { recursive: true, force: true })
}
