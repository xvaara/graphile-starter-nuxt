import assert from 'node:assert/strict'

const origin = process.env.SMOKE_ORIGIN || 'http://localhost:3000'
const response = await fetch(`${origin}/api/ruru`)
assert.equal(response.status, 200, 'enable the playground with ENABLE_GRAPHIQL=1')
const html = await response.text()
assert.match(html, /["']?endpoint["']?\s*:\s*["']\/api\/graphql["']/, 'Ruru targets the GraphQL API')
const encoded = html.match(/RURU_CONFIG\.initialHeaders = (.*?);<\/script>/)?.[1]
const headers = encoded ? JSON.parse(JSON.parse(encoded)) : {}
const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
const query = await fetch(`${origin}/api/graphql`, {
  method: 'POST',
  headers: { ...headers, cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ query: '{ currentUser { id } }' }),
})
assert.equal(query.status, 200)
assert.equal((await query.json()).data.currentUser, null)
console.log('PASS: Ruru endpoint and generated headers accepted by GraphQL')
