import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createClient } from 'graphql-ws'
import WebSocket from 'ws'
import { startServer } from './lib/production-server.mjs'
import { schemaShapeQuery, userQuery } from './lib/policy-queries.mjs'

const origin = 'http://localhost:4313'
const temporary = await mkdtemp(join(tmpdir(), 'main-policy-'))
const output = join(temporary, 'deployment')
const cwd = join(temporary, 'unrelated-cwd')
await cp('.output', output, { recursive: true, dereference: true })
await mkdir(cwd)
const entry = join(output, 'server/index.mjs')
const tags = join(output, 'server/tags.jsonc')
const originalTags = await readFile(tags, 'utf8')
assert.equal(originalTags, await readFile('db/tags.jsonc', 'utf8'), 'build packages exact smart tags')
const options = { entry, cwd, envFile: resolve('.env') }

async function requests() {
  const response = await fetch(origin)
  assert.equal(response.status, 200, 'direct SSR accepts normal application operations')
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const html = await response.text()
  assert.match(html, /__URQL_DATA__/)
  const csrf = html.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  assert.ok(csrf)
  async function http(query) {
    const result = await fetch(`${origin}/api/graphql`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie, 'csrf-token': csrf },
      body: JSON.stringify({ query }),
    })
    return result.json()
  }
  async function ws(query) {
    const client = createClient({
      url: `${origin.replace(/^http/, 'ws')}/api/graphql/ws`, retryAttempts: 0,
      webSocketImpl: class extends WebSocket { constructor(url, protocols) { super(url, protocols, { headers: { cookie } }) } },
    })
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket validation timed out')), 5000)
        client.subscribe({ query }, {
          next(value) { clearTimeout(timeout); resolve(value) },
          error(errors) { clearTimeout(timeout); Array.isArray(errors) ? resolve({ errors }) : reject(errors) },
          complete() {},
        })
      })
    } finally { await client.dispose() }
  }
  return { http, ws }
}
function expectRejected(result, reason) {
  assert.ok(result.errors?.length, reason)
  assert.equal(result.data, undefined, 'rejected operation never executes')
  assert.match(result.errors.map(error => error.message).join(' '), reason)
}
async function verifyPolicy(environment, { introspection, maxDepth }) {
  const server = await startServer({ ...options, environment })
  try {
    await server.ready()
    const { http, ws } = await requests()
    for (const request of [http, ws]) {
      assert.equal((await request('{ __typename }')).data.__typename, 'Query')
      for (const query of ['{ __schema { queryType { name } } }', '{ __type(name:"User") { name } }']) {
        const result = await request(query)
        if (introspection) assert.equal(result.errors, undefined, JSON.stringify(result.errors))
        else expectRejected(result, /introspection/i)
      }
      // Forward named and inline fragments must have the same depth as field nesting.
      for (const fragments of [false, true]) {
        const level = maxDepth === 6 ? 2 : 5
        const result = await request(userQuery(level, fragments))
        if (maxDepth) expectRejected(result, /depth.*maximum/i)
        else assert.equal(result.errors, undefined, JSON.stringify(result.errors))
      }
      const shallow = await request(userQuery(1))
      assert.equal(shallow.errors, undefined, JSON.stringify(shallow.errors))
      const cycle = await request('query { currentUser { ...A } } fragment A on User { ...B } fragment B on User { ...A }')
      expectRejected(cycle, /within itself|cycle/i)
      expectRejected(await request('{ query { __typename } }'), /Cannot query field "query"/)
      expectRejected(await request('{ users { totalCount } }'), /Cannot query field "users"/)
    }
    if (introspection) {
      const result = await http(schemaShapeQuery)
      assert.equal(result.errors, undefined, JSON.stringify(result.errors))
      const queryFields = result.data.queryType.fields.map(field => field.name)
      const mutations = result.data.mutationType.fields.map(field => field.name)
      for (const name of ['query', 'users', 'currentSessionId', 'currentUserId']) assert.ok(!queryFields.includes(name), `smart tags/root plugin omit ${name}`)
      for (const name of ['updateUser', 'updateOrganization', 'deleteUserEmail', 'deleteUserAuthentication']) assert.ok(mutations.includes(name), `primary key mutation ${name} remains`)
      for (const name of ['updateUserByUsername', 'deleteUserByUsername', 'updateOrganizationBySlug', 'deleteOrganizationBySlug']) assert.ok(!mutations.includes(name), `unique-key mutation ${name} stays omitted`)
      assert.ok(result.data.userInput.inputFields.some(field => field.name === 'id'))
    }
  } finally { await server.stop() }
}
try {
  await verifyPolicy({}, { introspection: false, maxDepth: 16 })
  await verifyPolicy({ GRAPHQL_DEPTH_LIMIT: '6' }, { introspection: false, maxDepth: 6 })
  await verifyPolicy({ GRAPHQL_DEPTH_LIMIT: '0' }, { introspection: false, maxDepth: 16 })
  await verifyPolicy({ GRAPHQL_ALLOW_INTROSPECTION: 'true' }, { introspection: true, maxDepth: 16 })
  await verifyPolicy({ NODE_ENV: 'test' }, { introspection: true, maxDepth: null })
  await verifyPolicy({ NODE_ENV: 'development' }, { introspection: true, maxDepth: null })
  // This very low limit rejects the real app's direct SSR query too.
  const strictSsr = await startServer({ ...options, environment: { GRAPHQL_DEPTH_LIMIT: '1' } })
  try { await strictSsr.ready(); assert.equal((await fetch(origin)).status, 500) }
  finally { await strictSsr.stop() }
  for (const environment of [{ GRAPHILE_TAGS_FILE: join(temporary, 'missing.jsonc') }, { GRAPHILE_TAGS_FILE: 'tags.jsonc' }, { GRAPHILE_TAGS_FILE: '' }]) {
    const server = await startServer({ ...options, environment })
    try { await server.expectStartupFailure() } finally { await server.stop() }
  }
  for (const contents of ['{ broken', '{ "version": 2, "config": {} }']) {
    await writeFile(tags, contents)
    const server = await startServer(options)
    try { await server.expectStartupFailure() } finally { await server.stop() }
  }
  const override = join(temporary, 'explicit-tags.jsonc')
  await writeFile(override, originalTags)
  await rename(tags, tags + '.hidden')
  await verifyPolicy({ GRAPHILE_TAGS_FILE: override }, { introspection: false, maxDepth: 16 })
  const missing = await startServer(options)
  try { await missing.expectStartupFailure() } finally { await missing.stop() }
  console.log('PASS: isolated standalone output from unrelated cwd; production/default/override/dev/test HTTP+WS policy; direct SSR enforcement; schema omissions; fatal missing/invalid tags')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
