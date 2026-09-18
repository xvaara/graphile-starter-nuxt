import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { ErrorLink } from '@apollo/client/link/error'

import { DefaultApolloClient } from '@vue/apollo-composable'

const ssrKey = '__apollo_ssr__'

export default defineNuxtPlugin((nuxt) => {
  const { vueApp } = nuxt

  // Cache implementation
  const cache = new InMemoryCache()

  // when app is created in browser, restore SSR state from nuxt payload
  if (import.meta.client) {
    throw new Error('Apollo server plugin should not be used in the browser')
  }

  // when app has rendered in server, send SSR state to client
  if (import.meta.server) {
    nuxt.hook('app:rendered', () => {
      nuxt.payload[ssrKey] = cache.extract()
    })
  }

  // Handle errors
  const errorLink = new ErrorLink(({ error }) => {
    console.error(error)
  })
  if (!nuxt.ssrContext?.event) {
    throw new Error('No event found in Nuxt SSR context, which is required for GraphQL operations')
  }
  const graphileLink = nuxt.ssrContext.event.context.graphileApolloLink
  if (!graphileLink)
    throw new Error('Graphile was not initialized for this request')
  const apolloClient = new ApolloClient({
    cache,
    link: errorLink.concat(graphileLink),
    ssrMode: true,
    devtools: {
      enabled: import.meta.dev,
    },
  })

  nuxt.provide('apollo', apolloClient)
  vueApp.provide(DefaultApolloClient, apolloClient)
})

declare module '#app' {
  interface NuxtApp {
    $apollo: ApolloClient
  }
}
