#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { resolve } from 'node:path'

const ENVFILE = resolve(import.meta.dirname, '../.env')

if (!fs.existsSync(ENVFILE)) {
  console.error('🛠️  Please run \'bun setup\' before running \'bun start\'')
  process.exit(1)
}

spawn('bun', ['dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    npm_config_loglevel: 'silent',
  },
  shell: true,
}).on('error', (err) => {
  console.error('Failed to start development server:', err)
  process.exit(1)
})
