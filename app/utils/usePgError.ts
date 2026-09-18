import type { ErrorLike } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'

interface PgError {
  message: string
  code?: string
  fields?: string[]
  extensions?: { code?: string, fields?: string[], exception?: PgError }
}

export function extractError(error: ErrorLike | null | undefined): PgError | null {
  if (!error)
    return null
  return CombinedGraphQLErrors.is(error) ? error.errors[0] ?? error : error
}

export function getExceptionFromError(error: ErrorLike | null | undefined): PgError | null {
  const graphqlError = extractError(error)
  return graphqlError?.extensions?.exception ?? graphqlError
}

export function getCodeFromError(error: ErrorLike | null | undefined): string | null {
  const err = getExceptionFromError(error)
  return err?.extensions?.code ?? err?.code ?? null
}
