// from https://github.com/carvajalconsultants/headstart/blob/main/grafastExchange.ts

import { validateGraphQLDocument } from "../graphile/graphqlPolicy";
import { execute, hookArgs } from "postgraphile/grafast";
import {
  CombinedError,
  type Exchange,
  type Operation,
  type OperationResult,
} from "@urql/core";
import { filter, fromPromise, mergeMap, pipe } from "wonka";

import type { Maybe } from "postgraphile/grafast";
import type { PostGraphileInstance } from "postgraphile";
import type { H3Event } from "h3";


interface RequestContext {
  h3v1: {
    event: H3Event;
  };
}
export const grafastExchange = (
  pgl: PostGraphileInstance,
  requestContext: RequestContext
): Exchange => {
  return () => (ops$) => {
    return pipe(
      ops$,

      // Skip anything that's not a query since that's all we can run
      filter((operation) => operation.kind === "query"),

      mergeMap((operation) => fromPromise(runGrafastQuery(pgl, operation, requestContext))),
    );
  };
};

/**
 * Run the URQL query with Grafast, without making an HTTP request to ourselves (which is unnecessary overhead).
 *
 * @param pgl Postgraphile instance that we will run the URQL query with.
 * @param operation URQL operation, typically a query that will be run with Grafast.
 * @param requestContext Context for the request, passed to Grafast.
 * @returns Query data, which is used to pass along in the Exchange chain.
 */
const runGrafastQuery = async (
  pgl: PostGraphileInstance,
  operation: Operation,
  requestContext: RequestContext
): Promise<OperationResult> => {
  try {
    const { variables: variableValues, query: document } = operation;

    const schema = await pgl.getSchema();
    const errors = validateGraphQLDocument(schema, document);
    if (errors.length) {
      return {
        operation,
        error: new CombinedError({ graphQLErrors: [...errors] }),
        stale: false,
        hasNext: false,
      };
    }

    const args = {
      resolvedPreset: pgl.getResolvedPreset(),
      schema,
      document,
      requestContext, // Pass the provided requestContext here
      variableValues: variableValues as Maybe<{
        readonly [variable: string]: unknown;
      }>,
    };
    // Add the Graphile context to our args so Grafast can run
    await hookArgs(args);

    // Run the query with Grafast, to get the result from PostgreSQL
    const result = await execute(args);

    if (!result || typeof result !== "object" || !("data" in result)) {
      throw new Error("Unexpected result format from execute");
    }

    const { data, errors: executionErrors, extensions } = result;

    if (executionErrors && executionErrors.length > 0) {
      return {
        operation,
        data,
        error: new CombinedError({ graphQLErrors: [...executionErrors] }),
        extensions,
        stale: false,
        hasNext: false,
      };
    }

    return {
      operation,
      data,
      error: undefined,
      extensions,
      stale: false,
      hasNext: false,
    };
  } catch (error) {
    console.error("Error in runGrafastQuery:", error);

    return {
      operation,
      data: undefined,
      error: new CombinedError({
        networkError: error instanceof Error ? error : new Error(String(error)),
      }),
      extensions: undefined,
      stale: false,
      hasNext: false,
    };
  }
};
