import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stripEmptyIconStyles } from '../server/utils/stripEmptyIconStyles'

test('remove only Iconify empty SVG styles without changing actual styles or other elements', () => {
  assert.equal(stripEmptyIconStyles('<svg class="icon" style="" aria-hidden="true"><path /></svg>'), '<svg class="icon" aria-hidden="true"><path /></svg>')
  const untouched = '<svg style="color:red"></svg><div style=""></div><span>style=""</span>'
  assert.equal(stripEmptyIconStyles(untouched), untouched)
})
