// Ruru is rendered by Grafserv rather than Nuxt, so seed its GraphQL headers
// with the token already generated for this request by nuxt-csurf.
const RuruCsrfPlugin: GraphileConfig.Plugin = {
  name: 'RuruCsrfPlugin',
  version: '1.0.0',
  grafserv: {
    middleware: {
      ruruHTML(next, event) {
        const token = event.request.requestContext.h3v1?.event.context.csrfToken
        if (token) {
          const headers = JSON.stringify(JSON.stringify({ 'csrf-token': token })).replaceAll('<', '\\u003c')
          event.htmlParts.configScript = event.htmlParts.configScript.replace('</script>', `RURU_CONFIG.initialHeaders = ${headers};</script>`)
        }
        return next()
      },
    },
  },
}

export default RuruCsrfPlugin
