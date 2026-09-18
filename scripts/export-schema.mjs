import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { buildClientSchema, getIntrospectionQuery, lexicographicSortSchema, printSchema } from 'graphql'

// Introspect a running app. This never runs migrations or watches the database.
const origin = process.env.SMOKE_ORIGIN || 'http://localhost:3000'
const page = await fetch(origin)
assert.ok(page.ok, `SSR failed: ${page.status}`)
const cookie = page.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
const csrf = (await page.text()).match(/<meta name="csrf-token" content="([^"]+)"/)?.[1]
const response = await fetch(`${origin}/api/graphql`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie, ...(csrf && { 'csrf-token': csrf }) },
  body: JSON.stringify({ query: getIntrospectionQuery() }),
})
const result = await response.json()
assert.equal(response.status, 200)
assert.equal(result.errors, undefined, JSON.stringify(result.errors))
await writeFile(new URL('../data/schema.graphql', import.meta.url), `${printSchema(lexicographicSortSchema(buildClientSchema(result.data)))}\n`)
console.log('Exported schema from the running GraphQL API')
