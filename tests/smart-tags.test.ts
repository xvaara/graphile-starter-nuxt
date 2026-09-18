import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { findSmartTagsFile, loadSmartTagsFile, parseSmartTags } from '../server/graphile/smartTagsFile'

const valid = '{ // JSONC comments and trailing commas are supported\n version: 1, config: {class: {"app_public.users": {tags: {omit: "all"}}}}, }'
test('smart tags parse eagerly and reject unsupported or malformed structures', () => {
  assert.equal(parseSmartTags(valid).version, 1)
  for (const invalid of ['{broken', '{}', '{version:2, config:{}}', '{version:1, config:[]}', '{version:1, config:{typo:{}}}', '{version:1, config:{class:{users:{tags:{omit:false}}}}}', '{version:1, config:{class:{users:{unknown:true}}}}', '{version:1,config:{class:{"a.b.c":{}}}}']) {
    assert.throws(() => parseSmartTags(invalid))
  }
})
test('source lookup is anchored to a Nuxt project rather than cwd; overrides never fall back', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'main-tags-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'db'))
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { nuxt: '4.5.2' } }))
  const tags = join(root, 'db/tags.jsonc')
  await writeFile(tags, valid)
  const location = { entryFile: join(root, 'node_modules/.bin/nuxt'), moduleURL: pathToFileURL(join(root, 'server/graphile/smartTagsFile.ts')).href }
  assert.equal(loadSmartTagsFile(location).path, tags)
  const explicit = join(root, 'override.jsonc')
  await writeFile(explicit, valid)
  assert.equal(loadSmartTagsFile({ ...location, override: explicit }).path, explicit)
  assert.throws(() => loadSmartTagsFile({ ...location, override: join(root, 'missing.jsonc') }), /refusing to start/)
  assert.throws(() => loadSmartTagsFile({ ...location, override: 'db/tags.jsonc' }), /absolute/)
  assert.throws(() => loadSmartTagsFile({ ...location, override: '' }), /absolute/)
  await writeFile(explicit, '{invalid')
  assert.throws(() => loadSmartTagsFile({ ...location, override: explicit }), /refusing to start/)
  // A deployed artifact cannot fall back to the valid source tags in its ancestor.
  const entryFile = join(root, '.output/server/index.mjs')
  await mkdir(join(root, '.output/server'), { recursive: true })
  await writeFile(join(root, '.output/server/package.json'), JSON.stringify({ name: 'nuxt-app-prod' }))
  assert.equal(findSmartTagsFile({ ...location, entryFile }), join(root, '.output/server/tags.jsonc'))
  assert.throws(() => loadSmartTagsFile({ ...location, entryFile }), /refusing to start/)
  await rm(tags)
  assert.throws(() => loadSmartTagsFile(location), /refusing to start/)
})
