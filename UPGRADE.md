# Apollo client preset upgrade

Source: `apollo-client-preset` at `a3c233f`. Result: `codex/upgrade-apollo-client-preset`.
The saved working changes to the manifest, lockfile, SQL snapshot, and LoginPlugin are included. No database migrations were applied.

Versions were checked against npm registry metadata on 2026-09-18. Major versions include Nuxt 4.5.2, Nuxt UI 4.11.1, Vue 3.5.43, Vue Router 5.3.1, Apollo Client 4.3.0, Vue Apollo 5.0.0-alpha.4, PostGraphile 5.1.5, Graphile Worker 0.18.0, GraphQL Codegen CLI 7.4.1/client preset 6.2.0, MJML 5.4.1, Nodemailer 10.0.10, ESLint 10.10.0, and Bun 1.4.2. Exact direct versions and compatible transitive updates are locked in `bun.lock`.

GraphQL 16.14.2 is the newest stable 16.x compatible with PostGraphile's peer requirements; GraphQL 17 is not supported by that dependency yet. TypeScript 6.0.3 is the newest release compatible with the current Vue checker: TypeScript 7.0.2 fails because `vue-tsc` imports the removed `typescript/lib/tsc` entry. Vue Apollo's old utility package has no published 5.x alpha and was replaced with Apollo's ErrorLink. The unused, disabled Nuxt AI module was removed because it pulled an obsolete AI dependency tree. Existing Graphile prereleases moved to their newest appropriate stable/RC releases; graphile-migrate remains at stable 1.4.1.

The client-preset architecture, inline documents, fragment masking, custom in-process Graphile SSR link, request-local Apollo cache, and cookie-authenticated WebSockets remain intact. Vue Apollo 5's official `/compat` entry provides the existing composable API. Apollo 4 errors and mutation results are handled through `error`/CombinedGraphQLErrors. Browser HTTP and WebSocket URLs use the current origin so previews and reverse proxies do not connect to another instance's configured port.

LoginPayload now reads the user ID returned by the authentication side effect, making the returned user explicitly depend on successful login. Registration and login are tested for same-mutation user resolution. MJML rendering now awaits its asynchronous result; its current published typings incorrectly describe a synchronous return. The Lodash ESM subpath includes `.js` for standalone Node production execution. GraphQL/Grafast overrides ensure one runtime instance; use a clean install if upgrading an existing node_modules tree containing stale nested copies.

## Verification

The app was run alone on port 4312 against the existing database. The historical test/reset scripts were inspected and not executed. No migrations, migration watchers, or queue consumers were started.

- `bun install --frozen-lockfile`: installation, Nuxt prepare and code generation.
- `bun run graphql`: generated typed documents against the schema exported by live PostGraphile initialization.
- `bun run typecheck`: app, server, shared and Nuxt configuration project references.
- `bun run typecheck:worker`: worker source type checking without running the worker.
- `bun run lint`: non-mutating lint; zero errors and 11 existing console warnings.
- `bun run app:build`: production build.
- `NODE_ENV=production PORT=4312 HOST=127.0.0.1 node --env-file=.env .output/server/index.mjs`: standalone Node 26.8.2 production server.
- `bun run test:smoke`: anonymous query; registration/user payload/cookie; authenticated query and SSR/cache; anonymous SSR isolation; logout; login/user payload; authenticated WebSocket query; live subscription notification. Passed in development and production. Creates a unique fixture, then deletes only that account and its related jobs in `finally`.
- `bun run test:email`: all six templates render HTML and plain text with in-memory JSON transport. No SMTP or database access.
- In-app browser: production hydration, invalid login error, successful login, authenticated SSR reload and logout. Only the deliberately triggered invalid-login errors were logged; no hydration errors observed. Browser fixture and its jobs were cleaned up.

Run smoke tests only with queue consumers stopped: fixture registration briefly creates a verification job before cleanup. The smoke runner does not start or stop a worker. `SMOKE_ORIGIN` can override the default port.

## Limitations

CSRF protection is now enabled. Apollo HTTP requests send the token from the SSR meta tag, and Ruru receives the request token through the shared Graphile plugin. Missing, invalid, and mismatched tokens are rejected before HTTP mutations execute. Database schema watching is disabled to avoid installing watch fixtures in a shared database. Password reset, account deletion, organization administration, real email delivery, and queue migration/consumption were not exercised end to end. Existing illustrative README/page claims about email deployment were not audited.

The consistency follow-up replaces Nuxt Security's incompatible logger-removal option with Vite 8/Rolldown production minification settings. Development Nuxt DevTools emits a Vite hook warning. Bun blocks optional lifecycle scripts for protobufjs and unrs-resolver; all listed checks work without those scripts. Nuxt Image bundles platform-specific sharp binaries: build on the deployment architecture. External font fetching is disabled because this app uses its existing system font styling.

## Upstream references

- [Nuxt 4 upgrade guide](https://nuxt.com/docs/4.x/getting-started/upgrade)
- [Vue Apollo 5 releases and compatibility API](https://github.com/vuejs/apollo/releases)
- [Apollo Client 4 migration](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration)
- [PostGraphile package exports and migration](https://postgraphile.org/postgraphile/next/migrating-from-v4/)
- [Nuxt UI releases](https://ui.nuxt.com/docs/releases)

## Development SSR follow-up

After a sibling branch reported a Vite/Graphile SSR import hang, this branch was verified again from a fresh `bun run app:dev --port 4312` process on the final dependency graph. Cold `/` returned HTTP 200 in 4.28 seconds and `/login` in 0.11 seconds. The full auth smoke suite passed, including authenticated SSR, cross-request cache isolation and live WebSocket subscriptions. Hydrated development browser login, authenticated reload and logout passed. The sibling's import hang was not reproduced here, so this branch retains its existing direct SSR link boundary.

Development logout revealed a Vue injection warning when `useToast()` was called after awaiting the mutation. Toast and router composables are now captured during component setup; logout uses those captured instances. A fresh browser login/reload/logout cycle then produced no warnings or errors. The disposable browser fixture and its jobs were removed. Nuxt type checking, non-mutating lint and production build were rerun for this change, followed by the production auth smoke suite.

## Subscription lifecycle follow-up

A regression test with `NITRO_SHUTDOWN_NO_FORCE_EXIT=1` reproduced a leaked database connection after the complete auth/live-subscription suite: the baseline process did not exit naturally within five seconds of SIGTERM. The original HTTP server and SSR instance also created separate presets/services.

Nitro now owns the single PostGraphile instance and request-specific direct Apollo links. The app receives its link through the H3 event, keeping database/Grafast runtime imports out of Vite's application graph. HTTP serving uses `pgl.createServ(grafserv)` so it shares the schema, preset, subscriber and release lifecycle with direct SSR. The close hook releases PostGraphile, then every PostgreSQL service (including LISTEN subscribers and service-owned pools), then the two application-owned pools. An idempotent close promise prevents repeated pool shutdown. SSR remains enabled and executes GraphQL in process.

`bun run test:shutdown` starts the built production server on port 4312 with forced process exit disabled, runs the full isolated auth/SSR/WebSocket query/live-subscription smoke suite, sends SIGTERM and requires a natural exit with status 0 within five seconds. The runner is self-contained and cleans up its server on failure. Run it with port 4312 free and real queue consumers stopped, as with `test:smoke`.

The lifecycle regression passed after the fix: production exited naturally with status 0 in 18 ms after SIGTERM, after the full auth/subscription suite. Nuxt type checking, non-mutating lint (zero errors/11 existing warnings) and production build passed. Fresh development `/` and `/login` SSR, the complete auth/subscription suite, and browser login-page hydration were also checked after the ownership change.

## Smart tags and GraphQL policy

Smart tags are parsed and validated at module initialization, before PostGraphile's schema retry loop. Source/development resolves `db/tags.jsonc` relative to the project rather than the working directory. The production build copies that file to `.output/server/tags.jsonc`, and copy errors fail the build. A standalone server uses its packaged copy without falling back to the source checkout. `GRAPHILE_TAGS_FILE` may select an absolute file path; relative, empty, missing, malformed or structurally invalid overrides fail startup. Tags are passed to the public `jsonPgSmartTags` API as parsed JSON. Tag changes require a restart; neither tag watching nor database schema watching is enabled.

Production GraphQL operations have a maximum field depth of 16, including leaf fields. Inline and named fragments add no extra depth themselves, but their fields count; fragment depths are memoized and cycles terminate safely before normal GraphQL validation rejects them. `GRAPHQL_DEPTH_LIMIT` accepts positive safe integers; missing, zero, negative, fractional or otherwise invalid values fall back to 16. There is no staff bypass. Production rejects `__schema` and `__type` unless `GRAPHQL_ALLOW_INTROSPECTION=true` exactly. `__typename` remains allowed. Development and test allow introspection and do not apply the production depth limit.

HTTP, WebSocket and the direct SSR Apollo link use the same policy selector. Direct SSR validates before creating context or executing and returns validation failures as GraphQL errors. The primary-key-only mutation and root-query-removal plugins retain their Borg-equivalent behavior: primary-key mutations remain, unique-key mutations and root `Query.query` remain absent. Subscriptions and ordering now use `extendSchema` and `addPgTableOrderBy`; the ordering plugin explicitly checks the name codec and obsolete examples were removed.

Additional verification commands:

- `bun run test:policy:unit`: environment parsing, introspection, fragment nesting/reuse/cycles, eager tag validation and cwd-independent lookup, plus direct Apollo SSR execution/rejection.
- `bun run test:policy`: copies the built output into a temporary deployment, launches it from an unrelated cwd on port 4312, and checks HTTP/WebSocket production defaults, override/fallback, development/test behavior, exact introspection opt-in, fragment/cycle handling, actual schema omissions, real SSR enforcement, packaged tag contents and fatal missing/malformed/override startup behavior. Uses the database read-only and cleans up its temporary servers/output.

An actual build with the source tag file temporarily unavailable failed with `ENOENT` from the copy hook; the source was restored in `finally` and the successful production build rerun.

All policy unit and isolated transport/deployment checks passed. Real Apollo SSR renders HTTP 200 after a handled GraphQL validation error: the normal cache contains `ROOT_QUERY`, whereas a depth limit of 1 leaves the SSR cache empty. A separate direct-link test verifies validation errors arrive before context hooks or execution. The coordinator also validated all 33 generated application operations against the actual schema and production defaults with no errors.

Final verification after the policy changes: frozen install (no lock changes), codegen, app/server and worker type checks, lint (zero errors/11 existing warnings), restored production build, policy tests, and six in-memory email renders passed. Development auth/SSR/live subscription and WebSocket introspection passed. Production auth/SSR/live subscription passed again; with forced shutdown disabled the process exited naturally in 15 ms. Disposable auth data was cleaned up and all branch-owned test servers were stopped.

## Cross-branch consistency follow-up

See the [branch consistency review](docs/branch-consistency.md) for shared fixes, intentional differences, live Bun/schema checks, and the common schema-export command (port 3000 by default; override with `SMOKE_ORIGIN`).

## CSRF follow-up

CSRF protection is enabled in both development and production. The Apollo client sends the SSR page token in the `csrf-token` header. The existing Ruru plugin supplies its own request token, so the playground and live schema export continue to work with protection enabled.

`test:smoke` now checks missing, invalid, and cookie-mismatched tokens, plus rejection of an authenticated logout without its token. It then exercises valid registration/login/logout, SSR isolation, WebSocket queries and subscriptions, and browser login/reload/logout. The browser assertions use the same pinned Playwright dependency and installed Google Chrome as the sibling Apollo branch. `test:shutdown` includes this suite and therefore also requires Chrome. Fixtures and their queued jobs are removed in `finally`; no real worker should be running during these tests.

Policy tests obtain the CSRF token and cookie from SSR before posting queries. Their HTTP assertions distinguish CSRF rejection from GraphQL policy validation. Readiness checks use a normal page request instead of an unprotected GraphQL POST. The Ruru regression now requires a generated CSRF header.

Verification passed: frozen install, code generation, app/server/worker type checks, lint (zero errors and 11 existing console warnings), eight unit tests, production build, development and production auth/browser/Ruru smoke checks, and isolated GraphQL policy tests. Missing/invalid/mismatched CSRF requests returned HTTP 403; valid requests and authenticated SSR/subscriptions continued to work. Live schema export left `data/schema.graphql` unchanged.

The first development browser run after the Playwright lockfile change recorded a transient dynamic-import failure while Vite re-optimized dependencies. A fresh run using the updated cache passed the complete suite; production passed without that failure.
