import { grafastExchange } from '../graphserv/grafastExchange'
import { pgl } from '../graphserv/pgl'
import { authPgPool, rootPgPool } from '../utils/pg'

// Nitro owns the database runtime for both HTTP and direct SSR requests.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    event.context.grafastExchange = grafastExchange(pgl, { h3v1: { event } })
  })
  const services = pgl.getResolvedPreset().pgServices ?? []
  let closing: Promise<void> | undefined
  nitroApp.hooks.hook('close', () => {
    closing ??= (async () => {
      await pgl.release()
      // LISTEN holds a checked-out client until its service releases it.
      await Promise.all(services.map(service => service.release?.()))
      // These pools were supplied by the application, so service.release does
      // not own/end them. End each pool once, after every subscriber is released.
      await Promise.all([authPgPool.end(), rootPgPool.end()])
    })()
    return closing
  })
})
