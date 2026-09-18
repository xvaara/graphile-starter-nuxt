import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'

// Disable Nitro's forced process exit so leaked pool/subscriber handles are observable.
const server = spawn(process.execPath, ['--env-file=.env', '.output/server/index.mjs'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: '4312', HOST: '127.0.0.1', NITRO_SHUTDOWN_NO_FORCE_EXIT: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
server.stdout.on('data', data => output += data)
server.stderr.on('data', data => output += data)
const exit = once(server, 'exit')
try {
  let ready = false
  for (let attempt = 0; attempt < 50; attempt++) {
    assert.equal(server.exitCode, null, 'production server exited during startup')
    try {
      ready = (await fetch('http://127.0.0.1:4312', { signal: AbortSignal.timeout(2000) })).ok
    }
    catch {}
    if (ready)
      break
    await delay(100)
  }
  assert.ok(ready, 'production server becomes ready')
  const smoke = spawn(process.execPath, ['--env-file=.env', 'tests/auth-smoke.mjs'], {
    env: { ...process.env, SMOKE_ORIGIN: 'http://127.0.0.1:4312' },
    stdio: 'inherit',
  })
  const [smokeCode] = await once(smoke, 'exit')
  assert.equal(smokeCode, 0, 'auth and live subscription smoke passes before shutdown')
  const started = Date.now()
  server.kill('SIGTERM')
  const timer = new AbortController()
  const result = await Promise.race([exit, delay(5000, 'timeout', { signal: timer.signal })])
  timer.abort()
  assert.notEqual(result, 'timeout', 'server must exit naturally after SIGTERM without leaked database clients')
  assert.equal(result[0], 0)
  assert.ok(!output.includes('Graceful shutdown timeout'))
  console.log(`PASS: normal shutdown after live subscription use in ${Date.now() - started}ms`)
}
finally {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGKILL')
    await exit
  }
}
