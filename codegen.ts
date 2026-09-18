import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './data/schema.graphql',
  documents: ['app/**/*.vue', 'app/**/*.ts'],
  config: {
    avoidOptionals: {
      field: true,
      inputValue: false,
      object: false,
    },
    scalars: {
      UUID: 'string',
      // Username: "string",
      // Url: "string",
      // Tag: "string",
      Datetime: 'string',
      BigInt: 'string',
      JSON: '{ [key: string]: any }',
    },
    enumsAsTypes: true,
    useTypeImports: true,
  },
  generates: {
    './app/graphql/': {
      preset: 'client',
      config: {
        useTypeImports: true,
      },
    },
  },
  // hooks: {
  //   afterAllFileWrite: ['npx eslint --fix '],
  // },
}
export default config
