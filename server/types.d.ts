import type { Pool } from 'pg'

// Define the user session data type, replace `Record<string, unknown>`
// with a more specific type if the structure of userSession is known.
type UserSessionData = Record<string, unknown>

declare global {
  namespace Grafast {
    interface Context {
      sessionId: string | null
      rootPgPool: InstanceType<typeof Pool> | undefined
      login: (userSession: UserSessionData) => Promise<UserSessionData>
      logout: () => Promise<boolean>
    }
  }
}

declare module '#auth-utils' {
  interface SecureSessionData {
    session_id: string
  }
}

// Runtime implementation lives exclusively in Nitro; the app consumes the link.
declare module 'h3' {
  interface H3EventContext {
    graphileApolloLink: import('@apollo/client').ApolloLink
  }
}
