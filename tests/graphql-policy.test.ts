import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSchema, parse, validate } from 'postgraphile/graphql'
import { depthLimitRule } from '../server/graphile/DepthLimitPlugin'
import { getGraphQLPolicy, validateGraphQLDocument } from '../server/graphile/graphqlPolicy'

const schema = buildSchema('type Query { item: Item } type Item { child: Item value: String }')
test('production rule selection enforces default16, strict positive integers and explicit introspection opt-in', () => {
  for (const raw of [undefined, '', '0', '-1', 'NaN', '3.2', '4oops', 'Infinity', '9007199254740992']) {
    assert.equal(getGraphQLPolicy({ NODE_ENV: 'production', GRAPHQL_DEPTH_LIMIT: raw }).maxDepth, 16)
  }
  assert.equal(getGraphQLPolicy({ NODE_ENV: 'production', GRAPHQL_DEPTH_LIMIT: '6' }).maxDepth, 6)
  const query = parse('{ __schema { queryType { name } } }')
  assert.ok(validateGraphQLDocument(schema, query, { NODE_ENV: 'production' }).length)
  assert.ok(validateGraphQLDocument(schema, query, { NODE_ENV: 'production', GRAPHQL_ALLOW_INTROSPECTION: 'false' }).length)
  assert.ok(validateGraphQLDocument(schema, query, { NODE_ENV: 'production', GRAPHQL_ALLOW_INTROSPECTION: 'TRUE' }).length)
  for (const env of [{ NODE_ENV: 'production', GRAPHQL_ALLOW_INTROSPECTION: 'true' }, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }]) {
    assert.equal(validateGraphQLDocument(schema, query, env).length, 0)
  }
  assert.equal(validateGraphQLDocument(schema, parse('{ __typename }'), { NODE_ENV: 'production' }).length, 0)
})
test('depth counts leaves but not inline/named fragments and handles forward declarations', () => {
  const variants = ['{item{child{value}}}', '{item{... on Item{child{... on Item{value}}}}}', 'query{item{...A}} fragment B on Item{value} fragment A on Item{child{...B}}']
  for (const source of variants) {
    assert.equal(validate(schema, parse(source), [depthLimitRule(3)]).length, 0)
    assert.match(validate(schema, parse(source), [depthLimitRule(2)])[0]!.message, /depth 3/)
  }
})
test('fragment cycles terminate and are rejected by standard validation', () => {
  const source = parse('query{item{...A}} fragment A on Item{...B} fragment B on Item{...A}')
  assert.doesNotThrow(() => validate(schema, source, [depthLimitRule(16)]))
  assert.match(validateGraphQLDocument(schema, source, { NODE_ENV: 'production' }).map(error => error.message).join(' '), /within itself/)
})
test('shared fragment DAG is memoized rather than expanded exponentially', { timeout: 1000 }, () => {
  const fragments = ['fragment F0 on Item { value }']
  for (let i = 1; i < 30; i++) fragments.push(`fragment F${i} on Item { ...F${i - 1} ...F${i - 1} }`)
  const document = parse(`query { item { ...F29 } } ${fragments.join(' ')}`)
  assert.equal(validate(schema, document, [depthLimitRule(2)]).length, 0)
})
