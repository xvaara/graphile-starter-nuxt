import type { H3Event } from 'h3'
import type { PostGraphileInstance } from 'postgraphile'
import assert from 'node:assert/strict'
import process from 'node:process'
import { test } from 'node:test'
import { ApolloClient, gql, InMemoryCache } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { buildSchema, GraphQLError } from 'graphql'
import { getCodeFromError } from '../app/utils/usePgError'
import { GraphileApolloLink } from '../server/graphserv/GraphileApolloLink'

test('SSR link runs Grafast request context and variables without HTTP', async () => {
  const event = { context: { marker: 'request-one' } } as H3Event
  const schema = buildSchema('type Query { greeting(name: String!): String! }')
  schema.getQueryType()!.getFields().greeting!.resolve = (_root, args, context) => `${context.marker}:${args.name}`
  const pgl = {
    getSchema: () => schema,
    getResolvedPreset: () => ({
      plugins: [],
      grafast: { context: (ctx: Grafast.RequestContext) => ({ marker: ctx.h3v1?.event.context.marker }) },
    }),
  } as unknown as PostGraphileInstance
  const client = new ApolloClient({ cache: new InMemoryCache(), ssrMode: true, link: new GraphileApolloLink({ pgl, event }) })
  try {
    const result = await client.query({ query: gql`query Greeting($name: String!) { greeting(name: $name) }`, variables: { name: 'Ada' } })
    assert.deepEqual(result.data, { greeting: 'request-one:Ada' })
    assert.ok(client.extract().ROOT_QUERY)
  }
  finally { client.stop() }
})

test('Apollo 4 GraphQL errors retain Postgres error codes', () => {
  const error = new CombinedGraphQLErrors({ errors: [new GraphQLError('Incorrect username/password', { extensions: { exception: { code: 'CREDS', message: 'Incorrect username/password' } } })] })
  assert.equal(getCodeFromError(error), 'CREDS')
  assert.equal(getCodeFromError(new Error('Network unavailable')), null)
  assert.equal(getCodeFromError(null), null)
})

test('Direct SSR enforces production policy before context or execution', async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, GRAPHQL_ALLOW_INTROSPECTION: process.env.GRAPHQL_ALLOW_INTROSPECTION, GRAPHQL_DEPTH_LIMIT: process.env.GRAPHQL_DEPTH_LIMIT }
  let contexts = 0
  const schema = buildSchema('type Query { node: Node } type Node { child: Node value: String }')
  const pgl = {
    getSchema: () => schema,
    getResolvedPreset: () => ({ plugins: [], grafast: { context: () => {
      contexts++
      return {}
    } } }),
  } as unknown as PostGraphileInstance
  const client = new ApolloClient({ cache: new InMemoryCache(), ssrMode: true, link: new GraphileApolloLink({ pgl, event: {} as H3Event }) })
  const query = (text: string) => client.query({ query: gql(text), fetchPolicy: 'no-cache' })
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.GRAPHQL_ALLOW_INTROSPECTION
    process.env.GRAPHQL_DEPTH_LIMIT = '2'
    await assert.rejects(query('{ __schema { queryType { name } } }'), /introspection/i)
    await assert.rejects(query('{ node { ...Deep } } fragment Deep on Node { child { value } }'), /depth 3.*2/)
    await assert.rejects(query('{ nonexistent }'), /Cannot query field/)
    assert.equal(contexts, 0, 'rejected SSR documents cannot invoke request context or execution')
    assert.equal((await query('{ __typename }')).data?.__typename, 'Query')
    assert.equal((await query('{ node { value } }')).data?.node, null)
    process.env.GRAPHQL_ALLOW_INTROSPECTION = 'true'
    assert.ok((await query('{ __type(name: "Node") { name } }')).data)
    process.env.NODE_ENV = 'development'
    delete process.env.GRAPHQL_ALLOW_INTROSPECTION
    assert.ok((await query('{ __schema { queryType { name } } }')).data)
    assert.equal((await query('{ node { child { value } } }')).data?.node, null)
  }
  finally {
    client.stop()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined)
        delete process.env[key]
      else process.env[key] = value
    }
  }
})
