import type { DocumentNode, GraphQLSchema, ValidationRule } from 'postgraphile/graphql'
import { NoSchemaIntrospectionCustomRule, specifiedRules, validate } from 'postgraphile/graphql'
import { depthLimitRule } from './DepthLimitPlugin'

export function getGraphQLPolicy(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.GRAPHQL_DEPTH_LIMIT ?? ''
  const parsed = /^\d+$/.test(raw) ? Number(raw) : Number.NaN
  return {
    production: env.NODE_ENV === 'production',
    maxDepth: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 16,
    allowIntrospection: env.NODE_ENV !== 'production' || env.GRAPHQL_ALLOW_INTROSPECTION === 'true',
  }
}

// Used by Grafserv (HTTP/WebSocket) and the direct SSR link before execution.
export function getGraphQLPolicyRules(env: NodeJS.ProcessEnv = process.env): ValidationRule[] {
  const policy = getGraphQLPolicy(env)
  return [
    ...(policy.production ? [depthLimitRule(policy.maxDepth)] : []),
    ...(!policy.allowIntrospection ? [NoSchemaIntrospectionCustomRule] : []),
  ]
}

export function validateGraphQLDocument(schema: GraphQLSchema, document: DocumentNode, env: NodeJS.ProcessEnv = process.env) {
  return validate(schema, document, [...specifiedRules, ...getGraphQLPolicyRules(env)])
}
