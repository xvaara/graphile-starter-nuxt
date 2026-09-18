import { getGraphQLPolicyRules } from './graphqlPolicy'

const GraphQLPolicyPlugin: GraphileConfig.Plugin = {
  name: 'GraphQLPolicyPlugin',
  version: '1.0.0',
  grafserv: {
    middleware: {
      setPreset(next, event) {
        event.validationRules.push(...getGraphQLPolicyRules())
        return next()
      },
    },
  },
}
export default GraphQLPolicyPlugin
