import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './data/schema.graphql',
  documents: ['app/**/*.vue', 'app/**/*.ts', '!app/graphql/**'],
  config: {
    useTypeImports: true,
    immutableTypes: true,
    enumsAsTypes: true,
    avoidOptionals: { field: true, inputValue: false, object: false },
    scalars: {
      UUID: 'string',
      Cursor: 'string',
      Datetime: 'string',
      BigInt: 'string',
      JSON: '{ [key: string]: unknown }',
    },
  },
  generates: {
    './app/graphql/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: { unmaskFunctionName: 'getFragmentData' },
      },
    },
    // Graphcache still needs schema metadata for normalized caching.
    './app/utils/introspection.ts': {
      plugins: ['urql-introspection'],
    },
  },
}

export default config
