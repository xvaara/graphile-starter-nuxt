import type { H3Event } from 'h3'
import type { PostGraphileInstance } from 'postgraphile'
import type { DocumentNode } from 'postgraphile/graphql'
import { ApolloLink } from '@apollo/client'
import { LRUCache } from 'lru-cache'
import { execute, hookArgs, isAsyncIterable } from 'postgraphile/grafast'
import { getOperationAST, parse, print } from 'postgraphile/graphql'
import { Observable } from 'rxjs'
import { validateGraphQLDocument } from '../graphile/graphqlPolicy'

export interface GraphileApolloLinkInterface {
  /** The event object. */
  event: H3Event

  /** The instance of the express middleware returned by calling `postgraphile()` */
  pgl: PostGraphileInstance
}

// TODO: This is a hack
// https://discord.com/channels/489127045289476126/498852330754801666/1373200934150344724

const cache = new LRUCache<string, DocumentNode>({ max: 300 })
function cachedParse(text: string) {
  if (cache.has(text)) {
    return cache.get(text) as DocumentNode
  }
  else {
    const doc = parse(text)
    cache.set(text, doc)
    return doc
  }
}

/**
 * A Graphile Apollo link for use during SSR. Allows Apollo Client to resolve
 * server-side requests without requiring an HTTP roundtrip.
 */
export class GraphileApolloLink extends ApolloLink {
  constructor(private options: GraphileApolloLinkInterface) {
    super()
  }

  override request(
    operation: ApolloLink.Operation,
    _forward?: ApolloLink.ForwardFunction,
  ): Observable<ApolloLink.Result> {
    const { pgl, event } = this.options
    return new Observable((observer) => {
      (async () => {
        try {
          const {
            operationName,
            variables: variableValues,
            // query: document,
          } = operation
          const document = cachedParse(print(operation.query))
          const schema = await pgl.getSchema()
          const errors = validateGraphQLDocument(schema, document)
          if (errors.length) {
            if (!observer.closed) {
              observer.next({ errors })
              observer.complete()
            }
            return
          }
          const op = getOperationAST(document, operationName)
          if (!op || op.operation !== 'query') {
            if (!observer.closed) {
              /* Only do queries (not subscriptions) on server side */
              observer.complete()
            }
            return
          }
          const args = {
            schema,
            resolvedPreset: pgl.getResolvedPreset(),
            requestContext: { h3v1: { event } },
            document,
            variableValues,
            operationName,
          }
          const hookedArgs = await hookArgs(args)
          const data = await execute(hookedArgs)
          if (isAsyncIterable(data)) {
            data.return?.()
            throw new Error('Iterable not supported by GraphileApolloLink')
          }
          if (!observer.closed) {
            observer.next(data)
            observer.complete()
          }
        }
        catch (e: any) {
          if (!observer.closed) {
            observer.error(e)
          }
          else {
            console.error(e)
          }
        }
      })()
    })
  }
}
