import { createClient, ssrExchange, type Client, type Exchange } from '@urql/core'
import type { H3Event } from 'h3'

export default defineNuxtPlugin(nuxt => {
  const event: H3Event = nuxt.ssrContext!.event
  const ssr = ssrExchange({ isClient: false })
  const client: Ref<Client> = shallowRef(createClient({
    url: '/api/graphql',
    exchanges: [ssr, event.context.grafastExchange as Exchange],
  }))
  nuxt.hook('app:rendered', () => {
    nuxt.payload.__URQL_DATA__ = ssr.extractData()
  })
  nuxt.vueApp.provide('$urql', client)
  return { provide: { urql: client } }
})
