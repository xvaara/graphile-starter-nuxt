import type { Pool } from 'pg'
import type { UserSessionData } from './types'
import { ServerResponse } from 'node:http'
import { PgSimplifyInflectionPreset } from '@graphile/simplify-inflection'
import { H3Event } from 'h3'
import { makePgService } from 'postgraphile/adaptors/pg'
import { NodePlugin } from 'postgraphile/graphile-build'

import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'

import { makeV4Preset } from 'postgraphile/presets/v4'

import { jsonPgSmartTags } from 'postgraphile/utils'
// eslint-disable-next-line antfu/no-import-node-modules-by-path
import { getUserSession } from '~~/node_modules/nuxt-auth-utils/dist/runtime/server/utils/session'
import GraphQLPolicyPlugin from './graphile/GraphQLPolicyPlugin'
import LoginPlugin from './graphile/LoginPlugin'
import OrdersPlugin from './graphile/Orders'
import PrimaryKeyMutationsOnlyPlugin from './graphile/PrimaryKeyMutationsOnlyPlugin'
import RemoveQueryQueryPlugin from './graphile/RemoveQueryQueryPlugin'
import RuruCsrfPlugin from './graphile/RuruCsrfPlugin'
import { loadSmartTagsFile } from './graphile/smartTagsFile'

import SubscriptionsPlugin from './graphile/SubscriptionsPlugin'

import handleErrors from './utils/handleErrors'

interface IPostGraphileOptionsOptions {
  authPgPool: InstanceType<typeof Pool>
  rootPgPool?: InstanceType<typeof Pool>
}

// For configuration file details, see: https://postgraphile.org/postgraphile/next/config

// Parse and validate before schema initialization, so configuration errors cannot retry.
const TagsFilePlugin = jsonPgSmartTags(loadSmartTagsFile().json)

type UUID = string

const isTest = process.env.NODE_ENV === 'test'

function uuidOrNull(input: string | number | null | undefined): UUID | null {
  if (!input)
    return null
  const str = String(input)
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      str,
    )
  ) {
    return str
  }
  else {
    return null
  }
}

const isDev = process.env.NODE_ENV === 'development'
// const isTest = process.env.NODE_ENV === "test";

export function getPreset({
  authPgPool,
  rootPgPool,
}: IPostGraphileOptionsOptions) {
  const preset: GraphileConfig.Preset = {
    plugins: [RuruCsrfPlugin, GraphQLPolicyPlugin],
    pgServices: [
      makePgService({
        // Introspection uses the existing database without installing watch fixtures.
        pool: authPgPool,

        schemas: ['app_public'],

        // Enable LISTEN/NOTIFY (for subscriptions/watch mode)
        pubsub: true,
      }),
    ],

    extends: [
      PostGraphileAmberPreset,

      makeV4Preset({
        // On production we still want to start even if the database isn't available.
        // On development, we want to deal nicely with issues in the database.
        // For these reasons, we're going to keep retryOnInitFail enabled for both environments.
        retryOnInitFail: !isTest,

        // Add websocket support to the PostGraphile server;
        subscriptions: true,

        // dynamicJson: instead of inputting/outputting JSON as strings, input/output raw JSON objects
        dynamicJson: true,

        // ignoreRBAC=false: honour the permissions in your DB - don't expose what you don't GRANT
        ignoreRBAC: false,

        // ignoreIndexes=false: honour your DB indexes - only expose things that are fast
        ignoreIndexes: false,

        // setofFunctionsContainNulls=false: reduces the number of nulls in your schema
        setofFunctionsContainNulls: false,

        // Enable GraphiQL in development
        graphiql: isDev || !!process.env.ENABLE_GRAPHIQL,
        // Use a fancier GraphiQL with `prettier` for formatting, and header editing.
        enhanceGraphiql: true,
        // Allow EXPLAIN in development (you can replace this with a callback function if you want more control)
        allowExplain: isDev,

        // Disable query logging - we're using morgan
        // TODO: disableQueryLog: true,

        // Custom error handling
        handleErrors,
        /*
         * To use the built in PostGraphile error handling, you can use the
         * following code instead of `handleErrors` above. Using `handleErrors`
         * gives you much more control (and stability) over how errors are
         * output to the user.
         */
        /*
        // See https://www.graphile.org/postgraphile/debugging/
        extendedErrors:
          isDev || isTest
            ? [
                "errcode",
                "severity",
                "detail",
                "hint",
                "positon",
                "internalPosition",
                "internalQuery",
                "where",
                "schema",
                "table",
                "column",
                "dataType",
                "constraint",
              ]
            : ["errcode"],
        showErrorStack: isDev || isTest,
        */

        // Shared databases must not install schema-watch fixtures automatically.
        watchPg: false,

        // Keep data/schema.graphql up to date
        sortExport: true,
        exportGqlSchemaPath: isDev
          ? `data/schema.graphql`
          : undefined,

        /*
         * Plugins to enhance the GraphQL schema, see:
         *   https://www.graphile.org/postgraphile/extending/
         */
        appendPlugins: [
          // PostGraphile adds a `query: Query` field to `Query` for Relay 1
          // compatibility. We don't need that.
          RemoveQueryQueryPlugin,

          // Apply the validated starter smart tags.
          TagsFilePlugin,

          // Omits by default non-primary-key constraint mutations
          PrimaryKeyMutationsOnlyPlugin,

          // Adds the `login` mutation to enable users to log in
          LoginPlugin,

          // Adds realtime features to our GraphQL schema
          SubscriptionsPlugin,

          // Adds custom orders to our GraphQL schema
          OrdersPlugin,
        ],

        /*
         * Plugins we don't want in our schema
         */
        skipPlugins: [
          // Disable the 'Node' interface
          NodePlugin,
        ],

        graphileBuildOptions: {
          /*
           * Any properties here are merged into the settings passed to each Graphile
           * Engine plugin - useful for configuring how the plugins operate.
           */

          // Makes all SQL function arguments except those with defaults non-nullable
          pgStrictFunctions: true,
        },

        // Pro plugin options (requires process.env.GRAPHILE_LICENSE)
        // TODO: defaultPaginationCap: parseInt(process.env.GRAPHQL_PAGINATION_CAP || "", 10) || 50,
        // TODO: graphqlCostLimit: parseInt(process.env.GRAPHQL_COST_LIMIT || "", 10) || 30000,
        // TODO: exposeGraphQLCost: (parseInt(process.env.HIDE_QUERY_COST || "", 10) || 0) < 1,
        // readReplicaPgPool ...,
      }),

      // Simplifies the field names generated by PostGraphile.
      PgSimplifyInflectionPreset,
    ],
    grafserv: {
      port: 3000,
      websockets: true,
      // allowUnpersistedOperation: true,
      watch: false,
      graphqlPath: '/api/graphql',
      eventStreamPath: '/api/graphql/stream',
    },
    grafast: {
      explain: isDev,
      /*
         * These properties are merged into context (the third argument to GraphQL
         * resolvers). This is useful if you write your own plugins that need
         * access to, e.g., the logged in user.
         */
      async context(ctx) {
        // console.log("context", ctx);
        // @ts-expect-error ws in context
        const event = ctx.event ?? ctx.h3v1?.event ?? (ctx.ws ? new H3Event(ctx.ws.request._req, new ServerResponse(ctx.ws.request)) : null) // <=== ctx.ws is provided by makeWsHandler: open hook !
        // console.log("event", event);
        if (!event) {
          throw new Error('No event')
        }
        const session = await getUserSession(event)
        // console.log("session", session);
        const sessionId = uuidOrNull(session.secure?.session_id)

        // console.log("sessionId", sessionId);
        if (sessionId) {
          // Update the last_active timestamp (but only do it at most once every 15 seconds to avoid too much churn).
          await rootPgPool?.query(
            'UPDATE app_private.sessions SET last_active = NOW() WHERE uuid = $1 AND last_active < NOW() - INTERVAL \'15 seconds\'',
            [sessionId],
          )
        }

        return {
          sessionId: uuidOrNull(session.secure?.session_id),
          rootPgPool,
          login: (userSession: UserSessionData) => setUserSession(event, userSession),
          logout: () => clearUserSession(event),
          /*
          * Postgres transaction settings for each GraphQL query/mutation to
          * indicate to Postgres who is attempting to access the resources. These
          * will be referenced by RLS policies/triggers/etc.
          *
          * Settings set here will be set using the equivalent of `SET LOCAL`, so
          * certain things are not allowed. You can override Postgres settings such
          * as 'role' and 'search_path' here; but for settings indicating the
          * current user, session id, or other privileges to be used by RLS policies
          * the setting names must contain at least one and at most two period
          * symbols (`.`), and the first segment must not clash with any Postgres or
          * extension settings. We find `jwt.claims.*` to be a safe namespace,
          * whether or not you're using JWTs.
          */
          pgSettings: {
            // Everyone uses the "visitor" role currently
            'role': process.env.DATABASE_VISITOR,

            /*
              * Note, though this says "jwt" it's not actually anything to do with
              * JWTs, we just know it's a safe namespace to use, and it means you
              * can use JWTs too, if you like, and they'll use the same settings
              * names reducing the amount of code you need to write.
              */
            'jwt.claims.session_id': sessionId ?? undefined,

          },
        }
      },
    },
    ruru: {
      endpoint: '/api/graphql',
    },
  }
  return preset
}
