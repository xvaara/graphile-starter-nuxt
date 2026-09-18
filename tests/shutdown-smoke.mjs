import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const origin = process.env.SMOKE_ORIGIN || 'http://localhost:4313'
const address = new URL(origin)
assert.ok(['localhost', '127.0.0.1'].includes(address.hostname), 'shutdown smoke runs only a local child process')
const server = spawn(process.execPath, ['--env-file=.env', '.output/server/index.mjs'], {
  env: {
    ...process.env,
    NODE_ENV: 'production', GRAPHILE_ENV: 'production',
    NITRO_HOST: address.hostname, NITRO_PORT: address.port || '4313',
    NUXT_PUBLIC_ROOT_URL: origin,
    // A passing exit must come from released resources, not process.exit().
    NITRO_SHUTDOWN_NO_FORCE_EXIT: '1',
    NITRO_SHUTDOWN_TIMEOUT: '10000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
server.stdout.on('data', data => { output += data })
server.stderr.on('data', data => { output += data })
const exited = new Promise((resolve, reject) => {
  server.once('error', reject)
  server.once('exit', (code, signal) => resolve({ code, signal }))
})
async function runAuthSmoke() {
  const child = spawn(process.execPath, ['--env-file=.env', 'tests/auth-smoke.mjs'], {
    env: { ...process.env, SMOKE_ORIGIN: origin }, stdio: 'inherit',
  })
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', resolve)
  })
  assert.equal(code, 0, 'live authentication and subscription smoke succeeds before shutdown')
}
try {
  const deadline = Date.now() + 30000
  while (!output.includes('Listening on')) {
    assert.equal(server.exitCode, null, 'production server remains alive during startup')
    assert.ok(Date.now() < deadline, 'production server starts within 30 seconds')
    await delay(100)
  }
  await runAuthSmoke()
  const start = Date.now()
  server.kill('SIGTERM')
  const controller = new AbortController()
  const result = await Promise.race([
    exited,
    delay(7000, undefined, { signal: controller.signal }),
  ]).finally(() => controller.abort())
  assert.ok(result, 'server exits within 7 seconds')
  assert.deepEqual(result, { code: 0, signal: null })
  assert.doesNotMatch(output, /shutdown timeout|force exiting|Called end on pool more than once/i)
  console.log(`PASS: production exits naturally after authenticated subscription use (${Date.now() - start} ms); no forced exit or double pool teardown`)
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGKILL')
    await exited
  }
}
