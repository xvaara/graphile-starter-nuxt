import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const isDev = process.env.NODE_ENV === 'development'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  devtools: { enabled: true },
  experimental: {
    asyncContext: true,
  },
  vite: {
    build: {
      rolldownOptions: {
        output: { minify: { compress: { dropConsole: !isDev, dropDebugger: !isDev } } },
      },
    },
  },
  build: {
    transpile: [],
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/test-utils',
    // https://github.com/atinux/nuxt-auth-utils
    'nuxt-auth-utils',
    // https://nuxt-security.vercel.app/getting-started/usage
    'nuxt-security',
    '@nuxt/ui',
    // '@josephanson/nuxt-ai',
    // 'nuxt-i18n-micro'
  ],
  eslint: {
    config: {
      // stylistic: true,
      standalone: false,
    },
  },
  nitro: {
    hooks: {
      async compiled(nitro) {
        await mkdir(nitro.options.output.serverDir, { recursive: true })
        await copyFile(fileURLToPath(new URL('./db/tags.jsonc', import.meta.url)), join(nitro.options.output.serverDir, 'tags.jsonc'))
      },
    },
    experimental: {
      websocket: true,
    },
  },
  security: {
    strict: !isDev,
    headers: false,
    csrf: {
      enabled: true,
      addCsrfTokenToEventCtx: true,
    },
    removeLoggers: false,
  },
  ui: {
    fonts: false,
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      rootUrl: process.env.ROOT_URL || 'http://localhost:3000',
    },
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      cookie: {
        secure: !isDev,
      },
    },
  },
  // i18n: {
  //   locales: [
  //     { code: 'en', iso: 'en-US', dir: 'ltr' },
  //     { code: 'fi', iso: 'fi-FI', dir: 'ltr' },
  //     { code: 'es', iso: 'es-ES', dir: 'ltr' },
  //     { code: 'zh', iso: 'zh-CN', dir: 'ltr' },
  //   ],
  //   defaultLocale: 'en',
  //   translationDir: 'locales',
  //   meta: true,
  //   autoDetectLanguage: true,
  //   // strategy: 'no_prefix',
  // },
  // ai: {
  //   dev: {
  //     mcp: {
  //       additionalDocs: {
  //         'nuxt-18n-micro': {
  //           url: 'github:s00d/nuxt-i18n-micro/tree/main/docs'
  //         },
  //       }

  //     }
  //   }

  // }

})
