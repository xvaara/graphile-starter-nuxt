import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const origin = process.env.SMOKE_ORIGIN || 'http://localhost:4313'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  const denied = await fetch(`${origin}/api/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'mutation{logout{success}}' }) })
  assert.equal(denied.status, 403, 'CSRF middleware rejects an unprotected mutation')
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const home = await page.goto(origin, { waitUntil: 'networkidle' })
  if (process.env.SMOKE_PRODUCTION === '1') {
    const csp = home.headers()['content-security-policy']
    assert.match(csp, /style-src 'self' 'nonce-/)
    assert.ok(!csp.includes("'unsafe-inline'"), 'production keeps strict inline-content restrictions')
  }
  await page.getByRole('heading', { name: 'Welcome to the Nuxt GraphQL Starter' }).waitFor()
  await page.getByRole('link', { name: 'Login', exact: true }).click()
  await page.getByRole('heading', { name: 'Welcome Back' }).waitFor()
  await page.locator('input[autocomplete="username"]').fill('nonexistent_upgrade_smoke')
  await page.locator('input[autocomplete="current-password"]').fill('invalid-smoke-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.getByText('Login failed', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await page.waitForURL('**/forgot')
  await page.goto(`${origin}/settings`, { waitUntil: 'networkidle' })
  assert.match(page.url(), /\/login\?returnTo=/)
  assert.deepEqual(errors, [], 'browser must hydrate and navigate without JavaScript errors')
  console.log('PASS: browser hydration, client navigation, CSRF-protected invalid login feedback, password-reset link and protected route redirect')
} finally {
  await browser.close()
}
