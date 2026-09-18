import { stripEmptyIconStyles } from '../utils/stripEmptyIconStyles'

export default defineNitroPlugin(nitro => {
  nitro.hooks.hook('render:html', html => {
    html.body = html.body.map(stripEmptyIconStyles)
  })
})
