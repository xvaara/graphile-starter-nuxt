import assert from 'node:assert/strict'
import { test } from 'node:test'

// Import only the task with Nodemailer's JSON transport; never start a worker or send mail.
process.env.NODE_ENV = 'test'
process.env.LEGAL_TEXT = 'Smoke test legal text'
process.env.EMAIL_FROM = 'smoke@example.invalid'
process.env.PROJECT_NAME = 'Smoke test'

const templates = ['account_activity', 'delete_account', 'organization_invite', 'password_reset', 'password_reset_unregistered', 'verify_email']
for (const template of templates) {
  test(`MJML 5 renders ${template} through the email task without delivery`, async () => {
    const { default: task } = await import('../worker/tasks/send_email')
    globalThis.TEST_EMAILS.length = 0
    await task({
      options: { to: 'recipient@example.invalid', subject: 'Render smoke test' },
      template: `${template}.mjml`,
      variables: {
        verifyLink: 'https://example.invalid/reset', token: 'smoke-token',
        deleteAccountLink: 'https://example.invalid/delete', link: 'https://example.invalid/invite',
        url: 'https://example.invalid/register', organizationName: 'Smoke organization',
        actionDescription: 'Smoke activity',
      },
    }, {} as Parameters<typeof task>[1])
    assert.equal(globalThis.TEST_EMAILS.length, 1)
    const email = JSON.parse(globalThis.TEST_EMAILS[0].message)
    assert.match(email.html, /Smoke test/)
    assert.match(email.text, /Smoke test/)
  })
}
