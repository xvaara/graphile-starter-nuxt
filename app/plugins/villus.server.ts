import { createClient, cache, VILLUS_CLIENT, type ClientPlugin } from 'villus'

export default defineNuxtPlugin(nuxt => {
  const payload: Record<string, unknown> = {}
  const capture: ClientPlugin = ({ operation, afterQuery }) => {
    afterQuery(result => {
      // Only plain successful data belongs in the Nuxt payload, never Error instances.
      if (!result.error) payload[operation.key] = result.data
    })
  }
  const client = createClient({
    url: '/api/graphql',
    use: [capture, cache(), nuxt.ssrContext!.event.context.grafastPlugin as ClientPlugin],
  })
  nuxt.hook('app:rendered', () => { nuxt.payload.__VILLUS_DATA__ = payload })
  // Avoid Villus's process-global active client. Hooks receive this instance explicitly.
  nuxt.vueApp.provide(VILLUS_CLIENT, client)
  return { provide: { villus: client } }
})
