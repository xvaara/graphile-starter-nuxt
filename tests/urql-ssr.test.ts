import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@urql/core'
import { buildSchema } from 'graphql'
import { grafastExchange } from '../server/graphserv/grafastExchange'
import type { PostGraphileInstance } from 'postgraphile'
import type { H3Event } from 'h3'

test('direct SSR exchange executes against each request schema', async () => {
  const makeClient = (name: string) => {
    const pgl = {
      getResolvedPreset: () => ({}),
      getSchema: async () => buildSchema(`type Query { ${name}: String }`),
    } as unknown as PostGraphileInstance
    return createClient({ url: '/api/graphql', exchanges: [grafastExchange(pgl, { h3v1: { event: {} as H3Event } })] })
  }
  const first = await makeClient('first').query('{ first }', {}).toPromise()
  assert.equal(first.error, undefined)
  assert.deepEqual({ ...first.data }, { first: null })
  const second = await makeClient('second').query('{ second }', {}).toPromise()
  assert.equal(second.error, undefined)
  assert.deepEqual({ ...second.data }, { second: null })
})

test('direct SSR exchange reports schema failures instead of hanging', async () => {
  const pgl = {
    getResolvedPreset: () => ({}),
    getSchema: async () => { throw new Error('Schema unavailable') },
  } as unknown as PostGraphileInstance
  const client = createClient({ url: '/api/graphql', exchanges: [grafastExchange(pgl, { h3v1: { event: {} as H3Event } })] })
  const result = await client.query('{ hello }', {}).toPromise()
  assert.equal(result.error?.networkError?.message, 'Schema unavailable')
})

test('direct SSR applies production depth/introspection policy and GraphQL specified rules', async (t) => {
  const original = { NODE_ENV: process.env.NODE_ENV, GRAPHQL_DEPTH_LIMIT: process.env.GRAPHQL_DEPTH_LIMIT, GRAPHQL_ALLOW_INTROSPECTION: process.env.GRAPHQL_ALLOW_INTROSPECTION }
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key)
      else process.env[key] = value
    }
  })
  process.env.NODE_ENV = 'production'
  delete process.env.GRAPHQL_DEPTH_LIMIT
  delete process.env.GRAPHQL_ALLOW_INTROSPECTION
  const schema = buildSchema('type Query { item: Item } type Item { child: Item value: String }')
  const pgl = { getResolvedPreset: () => ({}), getSchema: async () => schema } as unknown as PostGraphileInstance
  const query = (document: string) => createClient({ url: '/api/graphql', exchanges: [grafastExchange(pgl, { h3v1: { event: {} as H3Event } })] }).query(document, {}).toPromise()
  const denied = await query('{ __schema { queryType { name } } }')
  assert.match(denied.error!.graphQLErrors[0]!.message, /introspection/i)
  assert.equal(denied.error?.networkError, undefined)
  assert.equal((await query('{ __typename }')).data.__typename, 'Query')
  let selection = 'value'
  for (let i = 0; i < 16; i++) selection = `child { ${selection} }`
  assert.match((await query(`{ item { ${selection} } }`)).error!.message, /depth.*16/i)
  process.env.GRAPHQL_DEPTH_LIMIT = '3'
  const fragment = 'query { item { ...Outer } } fragment Inner on Item { child { value } } fragment Outer on Item { ... on Item { child { ...Inner } } }'
  assert.match((await query(fragment)).error!.message, /depth.*3/i)
  const cycle = await query('query { item { ...A } } fragment A on Item { ...B } fragment B on Item { ...A }')
  assert.match(cycle.error!.message, /within itself|cycle/i)
  assert.match((await query('{ missing }')).error!.message, /Cannot query field/)
  process.env.GRAPHQL_ALLOW_INTROSPECTION = 'true'
  assert.equal((await query('{ __type(name:"Item") { name } }')).error, undefined)
  process.env.NODE_ENV = 'development'
  delete process.env.GRAPHQL_ALLOW_INTROSPECTION
  assert.equal((await query(fragment)).error, undefined)
  assert.equal((await query('{ __schema { queryType { name } } }')).error, undefined)
})
