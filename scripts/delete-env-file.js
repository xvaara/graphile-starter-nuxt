#!/usr/bin/env node
import fs from 'node:fs'
import { resolve } from 'node:path'

try {
  fs.unlinkSync(resolve(import.meta.dirname, '../.env'))
}
catch (err) {
  if (err.code !== 'ENOENT')
    throw err
}
