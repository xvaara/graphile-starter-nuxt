import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildSchema } from 'graphql'
import * as documents from '../app/graphql/graphql'
import { validateGraphQLDocument } from '../server/graphile/graphqlPolicy'

test('all client-preset operations satisfy the schema and production GraphQL policy', () => {
  const schema = buildSchema(readFileSync(new URL('../data/schema.graphql', import.meta.url), 'utf8'))
  const operations = Object.entries(documents).filter(([, document]) =>
    document.definitions.some(definition => definition.kind === 'OperationDefinition'),
  )
  assert.ok(operations.length > 0, 'codegen emits application operations')
  for (const [name, document] of operations) {
    const errors = validateGraphQLDocument(schema, document, { NODE_ENV: 'production' })
    assert.deepEqual(errors.map(error => error.message), [], name)
  }
})
