import RuruCsrfPlugin from './graphile/RuruCsrfPlugin'
// @ts-check
import { makePgService } from "postgraphile/adaptors/pg";
import { PostGraphileAmberPreset} from "postgraphile/presets/amber";
import { makeV4Preset } from "postgraphile/presets/v4";
import { jsonPgSmartTags } from "postgraphile/utils";
import { loadSmartTagsFile } from "./graphile/smartTagsFile";
import GraphQLPolicyPlugin from "./graphile/GraphQLPolicyPlugin";
import { PgSimplifyInflectionPreset } from "@graphile/simplify-inflection";
import { NodePlugin } from "postgraphile/graphile-build";

import { H3Event } from "h3";

import { ServerResponse, } from "node:http";

import OrdersPlugin from "./graphile/Orders";
import LoginPlugin from "./graphile/LoginPlugin";
import PrimaryKeyMutationsOnlyPlugin from "./graphile/PrimaryKeyMutationsOnlyPlugin";
import RemoveQueryQueryPlugin from "./graphile/RemoveQueryQueryPlugin";
import SubscriptionsPlugin from "./graphile/SubscriptionsPlugin";
import handleErrors from "./utils/handleErrors";

import { getUserSession, setUserSession, clearUserSession } from '~~/node_modules/nuxt-auth-utils/dist/runtime/server/utils/session'

import type { Pool } from "pg";

interface IPostGraphileOptionsOptions {
  authPgPool: InstanceType<typeof Pool>;
  rootPgPool: InstanceType<typeof Pool>;
}

// For configuration file details, see: https://postgraphile.org/postgraphile/next/config

// Validate exposure rules before PostGraphile enters its retryable gather phase.
const TagsFilePlugin = jsonPgSmartTags(loadSmartTagsFile().json);

type UUID = string;

const isTest = process.env.NODE_ENV === "test";

function uuidOrNull(input: string | number | null | undefined): UUID | null {
  if (!input) return null;
  const str = String(input);
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      str
    )
  ) {
    return str;
  } else {
    return null;
  }
}

const isDev = process.env.NODE_ENV === "development";

export function getPreset({
  authPgPool,
  rootPgPool,
}: IPostGraphileOptionsOptions) {
  const preset: GraphileConfig.Preset = {
    plugins: [RuruCsrfPlugin, GraphQLPolicyPlugin],
    pgServices: [
      makePgService({
        // Use the existing pool without installing schema-watch fixtures.
        pool: authPgPool,

        schemas: ["app_public"],

        // Enable LISTEN/NOTIFY for application subscriptions.
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

        // Custom error handling
        handleErrors,

        // Schema changes are applied on restart.
        watchPg: false,

        // Keep data/schema.graphql up to date
        sortExport: true,
        exportGqlSchemaPath: isDev
          ? `data/schema.graphql`
          : undefined,

        appendPlugins: [
          // PostGraphile adds a `query: Query` field to `Query` for Relay 1
          // compatibility. We don't need that.
          RemoveQueryQueryPlugin,

          // Apply the eagerly validated exposure rules.
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

        skipPlugins: [
          // Disable the 'Node' interface
          NodePlugin,
        ],

        graphileBuildOptions: {
          // Makes all SQL function arguments except those with defaults non-nullable
          pgStrictFunctions: true,
        },
      }),

      // Simplifies the field names generated by PostGraphile.
      PgSimplifyInflectionPreset,
    ],
    grafserv: {
      port: 3000,
      websockets: true,
      watch: false,
      graphqlPath: "/api/graphql",
      eventStreamPath: "/api/graphql/stream",
    },
    grafast: {
      explain: isDev,
      async context(ctx) {
        // @ts-expect-error ws in context
        const event = ctx.event ?? ctx.h3v1?.event ?? new H3Event(ctx.ws.request._req, new ServerResponse(ctx.ws.request)); // <=== ctx.ws is provided by makeWsHandler: open hook !
        if (!event) {
          throw new Error("No event");
        }
        const session = await getUserSession(event);
        const sessionId = uuidOrNull(session.secure?.session_id)

        if (sessionId) {
          // Refresh activity at most once every 15 seconds.
          await rootPgPool.query(
            "UPDATE app_private.sessions SET last_active = NOW() WHERE uuid = $1 AND last_active < NOW() - INTERVAL '15 seconds'",
            [sessionId]
          );
        }

        return {
          sessionId: uuidOrNull(session.secure?.session_id),
          rootPgPool,
          login: (userSession: typeof session) =>
            setUserSession(event,
              userSession
            ),
          logout: () =>
            clearUserSession(event)
          ,
          // Transaction-local settings consumed by PostgreSQL RLS policies.
          pgSettings: {
              // Everyone uses the "visitor" role currently
              role: process.env.DATABASE_VISITOR,

              "jwt.claims.session_id": sessionId ?? undefined,

          },
        };

      },
    },
    ruru: {endpoint: "/api/graphql"}
  };
  return preset;
}
