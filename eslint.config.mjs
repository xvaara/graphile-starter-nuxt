// @ts-check
import antfu from '@antfu/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
  antfu(
    {},
    {
      rules: {
        'no-console': 'warn',
      // 'node/prefer-global/process': 'off',
      },
    },
    {
      files: ['server/**/*.ts', 'worker/**/*.ts', 'nuxt.config.ts', 'scripts/**/*', 'db/**/*.js'],
      rules: {
        'node/prefer-global/process': 'off',
      },
    },
    {
      files: ['tests/**/*.test.ts'],
      rules: {
        'test/no-import-node-test': 'off',
        'test/consistent-test-it': 'off',
        'test/prefer-lowercase-title': 'off',
      },
    },
    {
      files: ['tests/**/*.mjs', 'scripts/export-schema.mjs'],
      rules: {
        'antfu/no-top-level-await': 'off',
        'node/prefer-global/process': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['scripts/**/*'],
      rules: {
        'no-console': 'off',
      },
    },
  ),
)
