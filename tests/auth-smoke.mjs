import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createClient } from 'graphql-ws'
import { Pool } from 'pg'
import WebSocket from 'ws'

// Run explicitly against the app, never through the historical database-reset scripts.
const origin = process.env.SMOKE_ORIGIN || 'http://localhost:4311'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const username = `smoke_${randomUUID().replaceAll('-', '').slice(0, 16)}`
const email = `${username}@example.invalid`
const password = randomUUID()
const cookies = new Map()
let csrf = ''
function remember(response) {
  for (const value of response.headers.getSetCookie()) {
    const [name, ...parts] = value.split(';')[0].split('=')
    cookies.set(name, parts.join('='))
  }
}
function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
}
let userId
const emailIds = []
async function graphql(query, variables = {}) {
  const response = await fetch(`${origin}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cookie': cookieHeader(), 'csrf-token': csrf },
    body: JSON.stringify({ query, variables }),
  })
  remember(response)
  const result = await response.json()
  assert.equal(response.status, 200)
  return result
}
try {
  const initial = await fetch(origin)
  remember(initial)
  const initialHtml = await initial.text()
  csrf = initialHtml.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1] ?? ''
  assert.ok(csrf, 'SSR supplies CSRF token')
  const rejected = await fetch(`${origin}/api/graphql`, { method: 'POST', headers: { 'content-type': 'application/json', 'cookie': cookieHeader() }, body: JSON.stringify({ query: '{currentUser{id}}' }) })
  assert.equal(rejected.status, 403, 'POST without CSRF token is rejected')
  assert.deepEqual((await graphql('{currentUser{id}}')).data, { currentUser: null })
  const registration = await graphql('mutation($username:String!,$email:String!,$password:String!){register(input:{username:$username,email:$email,password:$password}){user{id username}}}', { username, email, password })
  assert.equal(registration.errors, undefined, JSON.stringify(registration.errors))
  userId = registration.data.register.user.id
  assert.equal(registration.data.register.user.username, username)
  assert.ok(cookieHeader())
  assert.equal((await graphql('{currentUser{id username}}')).data.currentUser.id, userId)
  const html = await (await fetch(origin, { headers: { cookie: cookieHeader() } })).text()
  assert.ok(html.includes(username), 'authenticated SSR must contain fixture user')
  assert.ok(html.includes('__apollo_ssr__'), 'SSR includes Apollo hydration cache')
  assert.ok(!(await (await fetch(origin)).text()).includes(username), 'SSR cache is isolated between requests')
  assert.equal((await graphql('mutation{logout{success}}')).data.logout.success, true)
  assert.equal((await graphql('{currentUser{id}}')).data.currentUser, null)
  const login = await graphql('mutation($username:String!,$password:String!){login(input:{username:$username,password:$password}){user{id username}}}', { username, password })
  assert.equal(login.errors, undefined, JSON.stringify(login.errors))
  assert.equal(login.data.login.user.id, userId, 'login payload resolves newly authenticated user')
  assert.equal((await graphql('{currentUser{id}}')).data.currentUser.id, userId)
  const ws = createClient({ url: `${origin.replace(/^http/, 'ws')}/api/graphql/ws`, webSocketImpl: class extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: { cookie: cookieHeader() } })
    }
  }, retryAttempts: 0 })
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket query timed out')), 10000)
      ws.subscribe({ query: '{currentUser{id}}' }, {
        next(result) {
          try {
            assert.equal(result.errors, undefined, JSON.stringify(result.errors))
            assert.equal(result.data.currentUser.id, userId)
            resolve()
          }
          catch (error) { reject(error) }
          finally { clearTimeout(timeout) }
        },
        error(error) {
          clearTimeout(timeout)
          reject(error)
        },
        complete() {},
      })
    })
    await new Promise((resolve, reject) => {
      let interval
      const timeout = setTimeout(() => finish(new Error('Live subscription timed out')), 10000)
      let dispose
      function finish(error) {
        clearTimeout(timeout)
        clearInterval(interval)
        dispose?.()
        if (error)
          reject(error)
        else resolve()
      }
      dispose = ws.subscribe({ query: 'subscription{currentUserUpdated{user{id username} event}}' }, {
        next(result) {
          try {
            assert.equal(result.errors, undefined, JSON.stringify(result.errors))
            assert.equal(result.data.currentUserUpdated.user.id, userId)
            assert.equal(result.data.currentUserUpdated.event, 'smoke')
            finish()
          }
          catch (error) { finish(error) }
        },
        error: finish,
        complete() {},
      })
      interval = setInterval(() => {
        pool.query('select pg_notify($1, $2)', [`graphql:user:${userId}`, JSON.stringify({ event: 'smoke', subject: userId })]).catch(finish)
      }, 100)
    })
  }
  finally { await ws.dispose() }
  assert.equal((await graphql('mutation{logout{success}}')).data.logout.success, true)

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (/hydration.*mismatch/i.test(message.text()))
        errors.push(message.text())
    })
    let subscriptionPayloads = 0
    page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      if (String(payload).includes('currentUserUpdated'))
        subscriptionPayloads++
    }))
    await page.goto(origin)
    await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
    await page.getByRole('heading', { name: 'Welcome to the Nuxt GraphQL Starter' }).waitFor()
    await page.getByRole('link', { name: 'Login', exact: true }).click()
    await page.getByPlaceholder('username', { exact: true }).fill(username)
    await page.getByPlaceholder('••••••••', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.getByRole('button', { name: username, exact: true }).waitFor()
    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      if (subscriptionPayloads)
        break
      await pool.query('select pg_notify($1, $2)', [`graphql:user:${userId}`, JSON.stringify({ event: 'browser-smoke', subject: userId })])
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(subscriptionPayloads > 0, 'browser subscription survives navigation through login layout')
    await page.reload()
    await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
    await page.getByRole('button', { name: username, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await page.getByRole('link', { name: 'Login', exact: true }).waitFor()
    assert.deepEqual(errors, [], 'no browser hydration or runtime errors')
  }
  finally { await browser.close() }
  console.log('PASS: anonymous query, register payload/cookie, authenticated query/SSR/cache, logout, login payload, authenticated WebSocket query/subscription, browser login/reload/logout')
}
finally {
  // Scope cleanup to this run's unique fixture and its queued jobs, including jobs created by delete triggers.
  const users = await pool.query('select id from app_public.users where username=$1', [username])
  const ids = users.rows.map(row => row.id)
  if (ids.length) {
    const emails = await pool.query('select id from app_public.user_emails where user_id=any($1::uuid[])', [ids])
    emailIds.push(...emails.rows.map(row => row.id))
    await pool.query('delete from app_public.users where id=any($1::uuid[])', [ids])
    const identifiers = [...ids, ...emailIds]
    await pool.query('delete from graphile_worker._private_jobs where payload->>\'user_id\'=any($1::text[]) or payload->>\'id\'=any($1::text[]) or payload->>\'email\'=$2', [identifiers, email])
  }
  await pool.end()
}
