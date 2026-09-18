import type { GraphQLError } from "graphql";

export function extractError(error: null): null;
export function extractError(error: Error): Error;
export function extractError(error: GraphQLError): GraphQLError;
export function extractError(
  error: null | Error | GraphQLError
): null | Error | GraphQLError;
export function extractError(
  error: null | Error | GraphQLError
): null | Error | GraphQLError {
  return (
    (error &&
      "graphqlErrors" in error &&
      Array.isArray(error.graphqlErrors) &&
      error.graphqlErrors.length &&
      error.graphqlErrors[0]) ||
    error
  );
}

export function getExceptionFromError(
  error: null | Error | GraphQLError
):
  | (Error & {
    code?: string;
    fields?: string[];
    extensions?: { code?: string; fields?: string[] };
  })
  | null {
  // @ts-expect-error ignore null
  const graphqlError: GraphQLError = extractError(error);
  const exception =
    graphqlError &&
    graphqlError.extensions &&
    graphqlError.extensions.exception;
  return (exception || graphqlError || error) as Error | null;
}

export function getCodeFromError(
  error: null | Error | GraphQLError
): null | string {
  const err = getExceptionFromError(error);
  return err?.extensions?.code ?? err?.code ?? null;
}
