import { createClient, cache, dedup, fetch, handleSubscriptions, VILLUS_CLIENT, type ClientPlugin } from 'villus'
import { createClient as createWSClient } from 'graphql-ws'

export default defineNuxtPlugin(nuxt => {
  const { csrf } = useCsrf()
  const createSocket = () => createWSClient({
    url: () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/graphql/ws`,
  })
  let socket = createSocket()
  let queryCache = cache()
  let deduplicate = dedup()
  const sessionVersion = ref(0)
  let hydrated = nuxt.payload.__VILLUS_DATA__ as Record<string, unknown> | undefined
  const hydrate: ClientPlugin = ({ operation, useResult }) => {
    if (operation.type === 'query' && nuxt.isHydrating && hydrated && Object.hasOwn(hydrated, operation.key)) {
      useResult({ data: hydrated[operation.key], error: null }, true)
    }
  }
  const client = createClient({
    url: '/api/graphql',
    use: [
      ({ opContext }) => {
        opContext.headers['csrf-token'] = unref(csrf)
        opContext.credentials = 'same-origin'
      },
      hydrate,
      context => queryCache(context),
      context => deduplicate(context),
      handleSubscriptions(operation => ({
        subscribe(observer) {
          return { unsubscribe: socket.subscribe({ query: operation.query, variables: operation.variables }, observer) }
        },
      })),
      fetch(),
    ],
  })
  nuxt.hook('app:mounted', () => { hydrated = undefined })
  nuxt.vueApp.provide(VILLUS_CLIENT, client)
  if (import.meta.hot) import.meta.hot.dispose(() => { void socket.dispose() })
  return {
    provide: {
      villus: client,
      villusSessionVersion: sessionVersion,
      refreshClient() {
        // Keep the client stable for mounted hooks, but abandon all session-owned caches
        // and pending dedup entries. Late responses can only populate the old cache.
        queryCache = cache()
        deduplicate = dedup()
        hydrated = undefined
        void socket.dispose()
        socket = createSocket()
        sessionVersion.value++
      },
    },
  }
})
