import type { NormalizedCacheObject } from '@apollo/client'
import type { Client as WSClient } from 'graphql-ws'
import { ApolloClient, createHttpLink, InMemoryCache, split } from '@apollo/client'

import { ErrorLink } from '@apollo/client/link/error'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { DefaultApolloClient } from '@vue/apollo-composable'
import { createClient as createWSClient } from 'graphql-ws'

const ssrKey = '__apollo_ssr__'

export default defineNuxtPlugin((nuxt) => {
  const { vueApp } = nuxt
  const rootUrl = window.location.origin

  // Cache implementation
  const cache = new InMemoryCache()

  // when app is created in browser, restore SSR state from nuxt payload
  if (import.meta.client) {
    nuxt.hook('app:created', () => {
      cache.restore(nuxt.payload[ssrKey] as NormalizedCacheObject)
    })
  }

  // when app has rendered in server, send SSR state to client
  if (import.meta.server) {
    nuxt.hook('app:rendered', () => {
      nuxt.payload[ssrKey] = cache.extract()
    })
  }
  const { csrf } = useCsrf()
  const headers = { ...useRequestHeaders(['cookie', 'authorization']), 'csrf-token': csrf }

  // HTTP connection to the API
  const httpLink = createHttpLink({
    // You should use an absolute URL here
    uri: `${rootUrl}/api/graphql`,
    headers: {
      ...headers,
    },
  })
  let wsClient: WSClient | undefined
  let wsLink: GraphQLWsLink | undefined
  let splitLink: typeof httpLink
  try {
    wsClient = createWSClient({
      url: `${rootUrl.replace(/^http/, 'ws')}/api/graphql/ws`,
      shouldRetry: () => true,
      keepAlive: 10000,
      connectionParams: {
        headers: {
          ...headers,
        },
      },
    })
    wsLink = new GraphQLWsLink(wsClient)
  }
  catch (e) {
    wsClient = undefined
    wsLink = undefined
    // Optionally log the error
    console.warn('WebSocket client could not be created:', e)
  }

  if (wsLink) {
    splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query)
        return (
          definition.kind === 'OperationDefinition'
          && definition.operation === 'subscription'
        )
      },
      wsLink,
      httpLink,
    )
  }
  else {
    splitLink = httpLink
  }

  // Handle errors
  const errorLink = new ErrorLink(({ error }) => {
    console.error(error)
  })

  const apolloClient = new ApolloClient({
    cache,
    link: errorLink.concat(splitLink),
    devtools: {
      enabled: import.meta.dev,
    },
  })

  nuxt.provide('apollo', apolloClient)
  nuxt.provide('apolloWSClient', wsClient)
  vueApp.provide(DefaultApolloClient, apolloClient)
})

declare module '#app' {
  interface NuxtApp {
    $apollo: ApolloClient
    $apolloWSClient: WSClient | undefined
  }
}
