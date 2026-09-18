import { parse } from 'graphql'
import { CombinedError, type ClientPlugin } from 'villus'
import { execute, hookArgs } from 'postgraphile/grafast'
import type { PostGraphileInstance } from 'postgraphile'
import type { H3Event } from 'h3'
import { validateGraphQLDocument } from '../graphile/graphqlPolicy'

/** Execute SSR queries directly, using only this request's authenticated context. */
export function grafastPlugin(pgl: PostGraphileInstance, requestContext: { h3v1: { event: H3Event } }): ClientPlugin {
  return async ({ operation, useResult }) => {
    try {
      if (operation.type !== 'query') throw new Error('Direct SSR only supports queries')
      const document = typeof operation.query === 'string' ? parse(operation.query) : operation.query
      if (!('kind' in document)) throw new Error('Expected a GraphQL document')
      const schema = await pgl.getSchema()
      const errors = validateGraphQLDocument(schema, document)
      if (errors.length) {
        useResult({ data: null, error: new CombinedError({ response: null, graphqlErrors: [...errors] }) }, true)
        return
      }
      const args = {
        resolvedPreset: pgl.getResolvedPreset(), schema, document, requestContext,
        variableValues: operation.variables,
      }
      await hookArgs(args)
      const result = await execute(args)
      if (!result || typeof result !== 'object' || Symbol.asyncIterator in result) {
        throw new Error('Unexpected streaming result from SSR query')
      }
      useResult({
        data: result.data ?? null,
        error: result.errors?.length ? new CombinedError({ response: null, graphqlErrors: [...result.errors] }) : null,
      }, true)
    } catch (error) {
      useResult({ data: null, error: new CombinedError({
        response: null, networkError: error instanceof Error ? error : new Error(String(error)),
      }) }, true)
    }
  }
}
