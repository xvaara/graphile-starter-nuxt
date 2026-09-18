import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'

// Direct invocation with an in-memory transport: no database, worker, SMTP, or real recipient.
process.env.NODE_ENV = 'test'
process.env.LEGAL_TEXT = 'Smoke test legal text'
process.env.EMAIL_FROM = 'sender@example.invalid'
process.env.PROJECT_NAME = 'Smoke project'
const { default: sendEmail } = await import('../worker/tasks/send_email.ts')
const templates = (await readdir(new URL('../worker/templates/', import.meta.url))).filter(name => name.endsWith('.mjml'))
for (const template of templates) {
  await sendEmail({
    options: { to: 'recipient@example.invalid', subject: 'Template smoke test' },
    template,
    variables: { actionDescription: 'Smoke action', organizationName: 'Smoke organization', link: 'https://example.invalid/invite', verifyLink: 'https://example.invalid/verify', deleteAccountLink: 'https://example.invalid/delete', token: 'smoke-token', url: 'https://example.invalid' },
  })
  const message = JSON.parse(globalThis.TEST_EMAILS.at(-1).message)
  assert.ok(message.html.includes('Smoke project'))
  assert.ok(message.text.includes('Smoke project'))
  assert.ok(!message.html.includes('[['))
}
console.log(`PASS: ${templates.length} MJML templates render to HTML/plain text using JSON transport`)
