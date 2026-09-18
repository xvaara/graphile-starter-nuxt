import { createClient, ssrExchange, fetchExchange, subscriptionExchange, type Client, type SSRData } from '@urql/core'
import { cacheExchange } from '@urql/exchange-graphcache'
import { createClient as createWSClient } from 'graphql-ws'
import introspectionSchema from '../utils/introspection'

export default defineNuxtPlugin(nuxt => {
  const { csrf } = useCsrf()
  let wsClient: ReturnType<typeof createWSClient>
  const newClient = (initialState?: SSRData) => {
    wsClient = createWSClient({
      url: () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/graphql/ws`,
    })
    return createClient({
      url: '/api/graphql',
      preferGetMethod: false,
      fetchOptions: () => ({ headers: { 'csrf-token': unref(csrf) } }),
      exchanges: [
        cacheExchange({ schema: introspectionSchema }),
        ssrExchange({ isClient: true, initialState }),
        fetchExchange,
        subscriptionExchange({
          forwardSubscription(request) {
            return {
              subscribe(sink) {
                return { unsubscribe: wsClient.subscribe({ ...request, query: request.query || '' }, sink) }
              },
            }
          },
        }),
      ],
    })
  }
  const client: Ref<Client> = shallowRef(newClient(nuxt.payload.__URQL_DATA__ as SSRData))
  nuxt.vueApp.provide('$urql', client)
  return {
    provide: {
      urql: client,
      refreshClient() {
        void wsClient.dispose()
        client.value = newClient()
      },
    },
  }
})
