import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { buildSchema, parse, validate } from 'postgraphile/graphql'
import { firstValueFrom } from 'rxjs'
import { depthLimitRule } from '../server/graphile/DepthLimitPlugin'
import { getGraphQLPolicy, validateGraphQLDocument } from '../server/graphile/graphqlPolicy'
import { findSmartTagsFile, loadSmartTagsFile, parseSmartTags } from '../server/graphile/smartTagsFile'
import { GraphileApolloLink } from '../server/graphserv/GraphileApolloLink'

const schema = buildSchema('type Query { item: Item } type Item { value: String child: Item }')
const production = { NODE_ENV: 'production' }
const depthErrors = (query: string, limit: number) => validate(schema, parse(query), [depthLimitRule(limit)])

it('positive integer depth settings, production introspection and development policy', () => {
  for (const value of [undefined, '', '0', '-1', 'NaN', '1junk', '1.5', 'Infinity', '9007199254740992'])
    assert.equal(getGraphQLPolicy({ ...production, GRAPHQL_DEPTH_LIMIT: value }).maxDepth, 16)
  assert.equal(getGraphQLPolicy({ ...production, GRAPHQL_DEPTH_LIMIT: '6' }).maxDepth, 6)
  assert.equal(validateGraphQLDocument(schema, parse('{__typename}'), production).length, 0)
  for (const query of ['{__schema{queryType{name}}}', '{__type(name:"Query"){name}}']) {
    assert.ok(validateGraphQLDocument(schema, parse(query), production).length)
    assert.equal(validateGraphQLDocument(schema, parse(query), { ...production, GRAPHQL_ALLOW_INTROSPECTION: 'true' }).length, 0)
    assert.ok(validateGraphQLDocument(schema, parse(query), { ...production, GRAPHQL_ALLOW_INTROSPECTION: 'TRUE' }).length)
    for (const NODE_ENV of ['test', 'development'])
      assert.equal(validateGraphQLDocument(schema, parse(query), { NODE_ENV }).length, 0)
  }
})

it('depth counts fields consistently through inline/named fragments and reused DAGs', () => {
  for (const query of ['{item{child{value}}}', '{item{... on Item {child{value}}}}', 'query{item{...A}} fragment A on Item {child{...B}} fragment B on Item {value}']) {
    assert.equal(depthErrors(query, 3).length, 0)
    assert.match(depthErrors(query, 2)[0]!.message, /depth 3/)
  }
  const fragments = Array.from({ length: 26 }, (_, i) => `fragment F${i} on Item { ${i === 25 ? 'value' : `...F${i + 1} ...F${i + 1}`} }`).join('\n')
  assert.equal(depthErrors(`{item{...F0}} ${fragments}`, 2).length, 0)
  const cyclic = parse('{item{...A}} fragment A on Item {child{...B}} fragment B on Item {...A}')
  assert.ok(validateGraphQLDocument(schema, cyclic, production).some(error => error.message.includes('within itself')))
})

it('smart tags validate eagerly and never recover from explicit override failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'preset-tags-'))
  try {
    const original = loadSmartTagsFile()
    assert.equal(parseSmartTags(readFileSync(original.path, 'utf8')).version, 1)
    for (const text of ['{', '{}', '{version:2,config:{}}', '{version:1,config:{wrong:{}}}', '{version:1,config:{class:{users:{tags:{omit:false}}}}}', '{version:1,config:{class:{users:{attribute:{"x.y":{}}}}}}', '{version:1,config:{class:{"a.b.c":{}}}}'])
      assert.throws(() => parseSmartTags(text))
    assert.throws(() => parseSmartTags(JSON.stringify({ version: 1, config: { class: { users: { attribute: { 'bad\"name': {} } } } } })))
    const bad = join(directory, 'bad.jsonc')
    writeFileSync(bad, '{')
    assert.throws(() => loadSmartTagsFile({ override: bad }), /refusing to start/)
    assert.throws(() => loadSmartTagsFile({ override: join(directory, 'missing') }), /refusing to start/)
    assert.throws(() => loadSmartTagsFile({ override: '' }), /absolute/)
    assert.throws(() => loadSmartTagsFile({ override: 'relative.jsonc' }), /absolute/)
    const entry = join(directory, 'index.mjs')
    writeFileSync(join(directory, 'package.json'), '{"name":"nuxt-app-prod"}')
    assert.equal(findSmartTagsFile({ entryFile: entry }), join(directory, 'tags.jsonc'))
    assert.throws(() => loadSmartTagsFile({ entryFile: entry }), /refusing to start/)
    writeFileSync(join(directory, 'tags.jsonc'), '{version:1,config:{}}')
    assert.equal(loadSmartTagsFile({ entryFile: entry }).json.version, 1)
    mkdirSync(join(directory, 'unrelated'))
    assert.equal(loadSmartTagsFile({ entryFile: join(directory, 'unrelated', 'index.mjs') }).path, original.path)
    const cwd = process.cwd()
    try {
      process.chdir(directory)
      assert.equal(loadSmartTagsFile({ entryFile: undefined }).path, original.path)
    }
    finally { process.chdir(cwd) }
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

it('direct SSR rejects policy violations before context hooks or execution', async () => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const pgl = { getSchema: () => schema, getResolvedPreset: () => {
      throw new Error('validation must precede execution')
    } }
    const link = new GraphileApolloLink({ pgl: pgl as any, event: {} as any })
    for (const query of ['{__schema{queryType{name}}}', `{item{${'child{'.repeat(17)}value${'}'.repeat(17)}}}`]) {
      const result = await firstValueFrom(link.request({ query: parse(query), variables: {}, operationName: undefined } as any))
      assert.ok(result.errors?.length)
      assert.ok(!result.errors?.some(error => error.message.includes('validation must precede')))
    }
  }
  finally {
    if (before === undefined)
      delete process.env.NODE_ENV
    else process.env.NODE_ENV = before
  }
})

it('direct SSR executes typename and respects production opt-in and development introspection', async () => {
  const before = { NODE_ENV: process.env.NODE_ENV, GRAPHQL_ALLOW_INTROSPECTION: process.env.GRAPHQL_ALLOW_INTROSPECTION }
  try {
    const pgl = { getSchema: () => schema, getResolvedPreset: () => ({}) }
    const link = new GraphileApolloLink({ pgl: pgl as any, event: {} as any })
    for (const NODE_ENV of ['production', 'development', 'test']) {
      process.env.NODE_ENV = NODE_ENV
      if (NODE_ENV === 'production')
        process.env.GRAPHQL_ALLOW_INTROSPECTION = 'true'
      else delete process.env.GRAPHQL_ALLOW_INTROSPECTION
      const result = await firstValueFrom(link.request({ query: parse('{__typename __schema{queryType{name}}}'), variables: {} } as any))
      assert.equal(result.errors, undefined)
      assert.equal(result.data?.__typename, 'Query')
    }
  }
  finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined)
        delete process.env[key]
      else process.env[key] = value
    }
  }
})
