import type { JSONPgSmartTags } from 'postgraphile/utils'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSON5 from 'json5'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validIdentifier(identifier: string, maxParts: number): boolean {
  const parts = identifier.match(/"(?:[^"\n]|"")+"|[^".]+/g)
  return !!parts && parts.length <= maxParts && parts.join('.') === identifier
}

function validEntry(value: unknown, nested: boolean): boolean {
  if (!isRecord(value))
    return false
  if (Object.keys(value).some(key => !['tags', 'description', ...(nested ? ['attribute', 'constraint'] : [])].includes(key)))
    return false
  if (value.description !== undefined && typeof value.description !== 'string')
    return false
  if (value.tags !== undefined && (!isRecord(value.tags) || !Object.values(value.tags).every(tag =>
    tag === null || tag === true || typeof tag === 'string' || (Array.isArray(tag) && tag.every(item => typeof item === 'string')),
  ))) {
    return false
  }
  return ['attribute', 'constraint'].every(key => value[key] === undefined
    || (nested && isRecord(value[key]) && Object.entries(value[key]).every(([name, entry]) => validIdentifier(name, 1) && !name.includes('.') && validEntry(entry, false))))
}

export function parseSmartTags(contents: string): JSONPgSmartTags {
  const value: unknown = JSON5.parse(contents)
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.config)
    || Object.keys(value).some(key => !['$schema', 'version', 'config'].includes(key))
    || !Object.entries(value.config).every(([kind, entries]) =>
      ['class', 'attribute', 'constraint', 'procedure', 'type', 'namespace'].includes(kind)
      && isRecord(entries) && Object.entries(entries).every(([identifier, entry]) =>
        validIdentifier(identifier, kind === 'namespace' ? 1 : ['attribute', 'constraint'].includes(kind) ? 3 : 2)
        && validEntry(entry, kind === 'class')),
    )) {
    throw new Error('Expected a version 1 smart-tag document with valid config entries')
  }
  return value as JSONPgSmartTags
}

interface TagsLocation {
  override?: string
  entryFile?: string
  moduleURL?: string
}

export function findSmartTagsFile({
  override = process.env.GRAPHILE_TAGS_FILE,
  entryFile = process.argv[1],
  moduleURL = import.meta.url,
}: TagsLocation = {}): string {
  if (override !== undefined) {
    if (!isAbsolute(override))
      throw new Error('[graphile] GRAPHILE_TAGS_FILE must be an absolute file path; refusing to start')
    return override
  }
  // Standalone output is self-contained: never fall back to source tags if its copy is missing.
  if (entryFile && basename(entryFile) === 'index.mjs') {
    const manifest = join(dirname(entryFile), 'package.json')
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name?.endsWith('-prod'))
      return join(dirname(entryFile), 'tags.jsonc')
  }
  const starts = [dirname(fileURLToPath(moduleURL)), ...(entryFile ? [dirname(entryFile)] : [])]
  for (const start of starts) {
    let directory = start
    while (true) {
      const manifest = join(directory, 'package.json')
      if (existsSync(manifest)) {
        const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
        if (pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt)
          return join(directory, 'db/tags.jsonc')
      }
      const parent = dirname(directory)
      if (parent === directory)
        break
      directory = parent
    }
  }
  throw new Error('[graphile] Cannot locate smart tags independently of cwd; set GRAPHILE_TAGS_FILE to an absolute path')
}

export function loadSmartTagsFile(location: TagsLocation = {}) {
  const path = findSmartTagsFile(location)
  try {
    return { path, json: parseSmartTags(readFileSync(path, 'utf8')) }
  }
  catch (cause) {
    throw new Error(`[graphile] Cannot load valid smart tags at ${path}; refusing to start`, { cause })
  }
}
