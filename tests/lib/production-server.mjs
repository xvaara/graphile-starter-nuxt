import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

export async function startServer({ entry, cwd, envFile, environment = {} }) {
  const inherited = { ...process.env }
  for (const key of ['GRAPHILE_TAGS_FILE', 'GRAPHQL_DEPTH_LIMIT', 'GRAPHQL_ALLOW_INTROSPECTION']) delete inherited[key]
  const processHandle = spawn(process.execPath, [`--env-file=${envFile}`, entry], {
    cwd,
    env: {
      ...inherited, NODE_ENV: 'production', GRAPHILE_ENV: 'production',
      NITRO_HOST: '127.0.0.1', NITRO_PORT: '4313', NUXT_PUBLIC_ROOT_URL: 'http://localhost:4313',
      NITRO_SHUTDOWN_NO_FORCE_EXIT: '1', NITRO_SHUTDOWN_TIMEOUT: '10000',
      ...environment,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  processHandle.stdout.on('data', value => { output += value })
  processHandle.stderr.on('data', value => { output += value })
  const exited = new Promise((resolve, reject) => {
    processHandle.once('error', reject)
    processHandle.once('exit', (code, signal) => resolve({ code, signal }))
  })
  async function stop() {
    if (processHandle.exitCode !== null || processHandle.signalCode !== null) return
    processHandle.kill('SIGTERM')
    const controller = new AbortController()
    try {
      const result = await Promise.race([exited, delay(7000, null, { signal: controller.signal })])
      assert.ok(result, 'server exits naturally within 7 seconds')
      assert.deepEqual(result, { code: 0, signal: null })
      assert.doesNotMatch(output, /shutdown timeout|force exiting|Called end on pool more than once/i)
    } finally {
      controller.abort()
      if (processHandle.exitCode === null && processHandle.signalCode === null) {
        processHandle.kill('SIGKILL')
        await exited
      }
    }
  }
  return {
    stop,
    async ready() {
      const deadline = Date.now() + 30000
      while (!output.includes('Listening on')) {
        assert.equal(processHandle.exitCode, null, 'server must not exit during valid startup')
        assert.ok(Date.now() < deadline, 'server starts in 30 seconds')
        await delay(100)
      }
    },
    async expectStartupFailure() {
      const controller = new AbortController()
      try {
        const result = await Promise.race([exited, delay(7000, null, { signal: controller.signal })])
        assert.ok(result, 'invalid tags must fail startup immediately rather than retrying')
        assert.notEqual(result.code, 0)
        assert.doesNotMatch(output, /Listening on/, 'invalid tags must fail before accepting requests')
        assert.match(output, /smart.tags|tags.jsonc|GRAPHILE_TAGS_FILE/i)
      } finally { controller.abort() }
    },
  }
}
