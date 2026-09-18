import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createClient } from 'graphql-ws'
import WebSocket from 'ws'
import { chromium } from 'playwright'

// Run explicitly against the app, never through the historical database-reset scripts.
const origin = process.env.SMOKE_ORIGIN || 'http://localhost:4313'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const username = `smoke_${randomUUID().replaceAll('-', '').slice(0, 16)}`
const email = `${username}@example.invalid`
const password = randomUUID()
const organizationSlug = `preset-${randomUUID().replaceAll('-', '').slice(0, 12)}`
const cookieJar = new Map()
let cookie = ''
let csrf = ''
function rememberCookies(response) {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0]
    const separator = pair.indexOf('=')
    cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
  cookie = [...cookieJar].map(([key, value]) => `${key}=${value}`).join('; ')
}
let userId
const emailIds = []
async function graphql(query, variables = {}) {
  const response = await fetch(`${origin}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie, 'csrf-token': csrf },
    body: JSON.stringify({ query, variables }),
  })
  rememberCookies(response)
  const result = await response.json()
  assert.equal(response.status, 200)
  return result
}
try {
  const page = await fetch(origin)
  rememberCookies(page)
  const initialHtml = await page.text()
  csrf = initialHtml.match(/name="csrf-token" content="([^"]+)"/)?.[1]
  assert.ok(csrf, 'SSR supplies CSRF token')
  assert.deepEqual((await graphql('{currentUser{id}}')).data, { currentUser: null })
  const registration = await graphql('mutation($username:String!,$email:String!,$password:String!){register(input:{username:$username,email:$email,password:$password}){user{id username}}}', { username, email, password })
  assert.equal(registration.errors, undefined, JSON.stringify(registration.errors))
  userId = registration.data.register.user.id
  assert.equal(registration.data.register.user.username, username)
  assert.ok(cookie)
  assert.equal((await graphql('{currentUser{id username}}')).data.currentUser.id, userId)
  const html = await (await fetch(origin, { headers: { cookie } })).text()
  assert.ok(html.includes(username), 'authenticated SSR must contain fixture user')
  assert.ok(html.includes('__URQL_DATA__'), 'SSR includes URQL hydration cache')
  const anonymousHtml = await (await fetch(origin)).text()
  assert.ok(!anonymousHtml.includes(username), 'a subsequent anonymous SSR request cannot inherit user state')
  assert.equal((await graphql('mutation{logout{success}}')).data.logout.success, true)
  assert.equal((await graphql('{currentUser{id}}')).data.currentUser, null)
  const login = await graphql('mutation($username:String!,$password:String!){login(input:{username:$username,password:$password}){user{id username}}}', { username, password })
  assert.equal(login.errors, undefined, JSON.stringify(login.errors))
  assert.equal(login.data.login.user.id, userId, 'login payload resolves newly authenticated user')
  assert.equal((await graphql('{currentUser{id}}')).data.currentUser.id, userId)
  const ws = createClient({ url: `${origin.replace(/^http/, 'ws')}/api/graphql/ws`, webSocketImpl: class extends WebSocket { constructor(url, protocols) { super(url, protocols, { headers: { cookie } }) } }, retryAttempts: 0 })
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket query timed out')), 10000)
      ws.subscribe({ query: '{currentUser{id}}' }, {
        next(result) { try { assert.equal(result.errors, undefined, JSON.stringify(result.errors)); assert.equal(result.data.currentUser.id, userId); resolve() } catch (error) { reject(error) } finally { clearTimeout(timeout) } },
        error(error) { clearTimeout(timeout); reject(error) }, complete() {},
      })
    })
  }
  finally { await ws.dispose() }
  const notifications = createClient({ url: `${origin.replace(/^http/, 'ws')}/api/graphql/ws`, webSocketImpl: class extends WebSocket { constructor(url, protocols) { super(url, protocols, { headers: { cookie } }) } }, retryAttempts: 0 })
  try {
    await new Promise((resolve, reject) => {
      let unsubscribe = () => {}
      const finish = error => { clearInterval(notify); clearTimeout(timeout); unsubscribe(); error ? reject(error) : resolve() }
      const timeout = setTimeout(() => finish(new Error('Subscription notification timed out')), 10000)
      const notify = setInterval(() => {
        pool.query('select pg_notify($1, $2)', [`graphql:user:${userId}`, JSON.stringify({ event: 'smoke', subject: userId })]).catch(finish)
      }, 200)
      unsubscribe = notifications.subscribe({ query: 'subscription{currentUserUpdated{event user{id username}}}' }, {
        next(result) { try { assert.equal(result.errors, undefined, JSON.stringify(result.errors)); assert.equal(result.data.currentUserUpdated.user.id, userId); assert.equal(result.data.currentUserUpdated.event, 'smoke'); finish() } catch (error) { finish(error) } },
        error: finish, complete() {},
      })
    })
  } finally { await notifications.dispose() }

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(`${origin}/login`, { waitUntil: 'networkidle' })
    await page.locator('input[autocomplete="username"]').fill(username)
    await page.locator('input[autocomplete="current-password"]').fill(password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL(origin + '/')
    await page.getByRole('button', { name: username, exact: true }).waitFor()
    await page.goto(`${origin}/settings/emails`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Email addresses' }).waitFor()
    await page.locator('li').filter({ hasText: email }).waitFor()
    await page.goto(`${origin}/create-organization`, { waitUntil: 'networkidle' })
    await page.getByPlaceholder('Organization name', { exact: true }).fill(organizationSlug)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.waitForURL(`${origin}/o/${organizationSlug}`)
    await page.getByRole('heading', { name: organizationSlug, exact: true }).waitFor()
    await page.getByRole('link', { name: 'Organization Settings', exact: true }).click()
    await page.getByRole('heading', { name: 'Organization Settings', exact: true }).waitFor()
    assert.equal(await page.getByPlaceholder('Organization name', { exact: true }).inputValue(), organizationSlug)
    await page.getByRole('tab', { name: 'Members', exact: true }).click()
    await page.getByRole('heading', { name: 'Existing members', exact: true }).waitFor()
    await page.locator('li').filter({ hasText: username }).filter({ hasText: 'owner and billing contact' }).waitFor()
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: username, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await page.getByRole('link', { name: 'Login', exact: true }).waitFor()
    assert.deepEqual(errors, [], 'authenticated browser flow has no JavaScript or hydration errors')
  } finally { await browser.close() }
  assert.equal((await graphql('mutation{logout{success}}')).data.logout.success, true)
  console.log('PASS: auth/SSR isolation, WebSocket query/subscription, browser login/reload/logout, masked email fragments, organization creation and nested member fragments')
}
finally {
  // Scope cleanup to this run's unique fixture and its queued jobs, including jobs created by delete triggers.
  const users = await pool.query('select id from app_public.users where username=$1', [username])
  const ids = users.rows.map(row => row.id)
  if (ids.length) {
    const organizations = await pool.query('select o.id from app_public.organizations o join app_public.organization_memberships m on m.organization_id=o.id where o.slug=$1 and m.user_id=any($2::uuid[])', [organizationSlug, ids])
    const organizationIds = organizations.rows.map(row => row.id)
    await pool.query('delete from app_public.organizations where id=any($1::uuid[])', [organizationIds])
    const emails = await pool.query('select id from app_public.user_emails where user_id=any($1::uuid[])', [ids])
    emailIds.push(...emails.rows.map(row => row.id))
    await pool.query('delete from app_public.users where id=any($1::uuid[])', [ids])
    const identifiers = [...ids, ...emailIds, ...organizationIds]
    await pool.query("delete from graphile_worker._private_jobs where payload->>'user_id'=any($1::text[]) or payload->>'id'=any($1::text[]) or payload->>'organization_id'=any($1::text[]) or payload->>'email'=$2", [identifiers, email])
  }
  await pool.end()
}
