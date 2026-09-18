import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const isDev = process.env.NODE_ENV !== 'production'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  icon: { mode: 'svg', serverBundle: { collections: ['heroicons', 'lucide'] } },
  ui: { fonts: false },
  devtools: { enabled: true },
  experimental: {
    asyncContext: true
  },
  build: {
    transpile: ["villus"],
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/image',
    // https://github.com/atinux/nuxt-auth-utils
    'nuxt-auth-utils',
    // https://nuxt-security.vercel.app/getting-started/usage
    'nuxt-security',
    '@nuxt/ui',
  ],
  nitro: {
    hooks: {
      async compiled(nitro) {
        const destination = join(nitro.options.output.serverDir, 'tags.jsonc')
        await mkdir(dirname(destination), { recursive: true })
        // Never ship a server whose schema exposure rules were not packaged.
        await copyFile(fileURLToPath(new URL('./db/tags.jsonc', import.meta.url)), destination)
      },
    },
    experimental: {
      websocket: true
    }
  },
  security: {
    strict: !isDev,
    headers: {
    },
    csrf: {
      enabled: true,
      addCsrfTokenToEventCtx: true,
    },
  },
  routeRules: {
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' }
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      rootUrl: process.env.ROOT_URL || 'http://localhost:3000',
    },
    session: {
      cookie: {
        secure: !import.meta.dev,
      },
    },
  },
})
