# Apollo client dependency upgrade

Source: `apollo-client` at `aef16aa0f718ca0387fa3dfc82c75a5e05466505`.
Result branch: `codex/upgrade-apollo-client`.

Registry metadata was checked on 2026-09-18, including published versions and dist tags. Dependencies are pinned and `bun.lock` records the complete graph. The client still uses generated Vue Apollo composables, Apollo HTTP/WebSocket links, and direct Grafast execution during SSR. SSR remains enabled.

## Versions and compatibility decisions

| Package | Installed |
| --- | --- |
| Nuxt / Nuxt Kit | 4.5.2 |
| Nuxt UI | 4.11.1 |
| Vue / Vue Router | 3.5.43 / 5.3.1 |
| Apollo Client | 4.3.0 |
| Vue Apollo composable | 5.0.0-alpha.4 |
| PostGraphile / Grafast | 5.1.5 / 1.1.3 |
| GraphQL | 16.14.2 |
| GraphQL WS / RxJS | 6.2.2 / 7.8.2 |
| TypeScript / vue-tsc | 6.0.3 / 3.3.11 |
| GraphQL Codegen CLI / operations / Vue Apollo | 7.4.1 / 6.1.6 / 5.0.1 |
| ESLint / Antfu config | 10.10.0 / 9.5.1 |
| Graphile Worker / Migrate | 0.18.0 / 1.4.1 |
| MJML / Nodemailer | 5.4.1 / 10.0.10 |

H3 is pinned to stable 1.15.11 for Nitro 2/Grafserv’s H3 v1 adapter; the registry’s latest tag currently points at H3 2 RC. GraphQL 17 is published, but PostGraphile/Grafast currently require GraphQL 16. TypeScript 7 is published, but the current vue-tsc cannot load its compiler API and typescript-eslint explicitly rejects it. The latest compatible stable versions are pinned above. Existing prerelease-only Graphile extensions use their newest release candidates. Graphile Migrate stays on its newest stable release; no migrations were executed.

Vue Apollo's official v5 `compat` entry point preserves the generated v4 composable calling conventions on Apollo 4. `@vue/apollo-util` has no published v5 alpha; its obsolete error logger was replaced with Apollo 4 `ErrorLink`. Codegen operations v6 emits its own input types, so the redundant TypeScript schema plugin was removed. Explicit custom scalar mappings preserve string IDs. The unused Nuxt AI module was removed because its old AI SDK conflicts with Nuxt UI 4's optional AI peer.

The entire compatible transitive graph was refreshed. This upgrades jsonwebtoken 9.0.2 to 9.0.3 and fixes its old dependency chain's Node 26 `SlowBuffer` startup failure. GraphQL and Grafast overrides guarantee a single version across the schema builder and SSR executor.

## Integration fixes

- Apollo 4 link types, RxJS observable, error extraction and devtools configuration. Nitro owns the direct SSR link and injects it per request, keeping database and session modules out of Vite’s development import graph.
- Same-mutation login user depends on the resolver's authenticated user ID.
- App-owned user subscription survives login/layout navigation; subscription updates preserve membership fields.
- CSRF protection is intentionally enabled (the original branch disabled it). HTTP GraphQL POSTs require the token supplied in SSR HTML and the matching cookie. The Apollo client supplies it, and Ruru receives request-specific initial headers so its queries remain usable.
- WebSocket URLs use `ws:`/`wss:`. Runtime root URL can be overridden using `NUXT_PUBLIC_ROOT_URL`; an empty root URL uses the browser origin.
- Node ESM-compatible Lodash import, current Nuxt UI modal slots/models, pagination model, dropdown handlers and semantic colors.
- MJML 5 rendering is awaited and the worker has a separate TypeScript check.
- Shutdown releases Graphile services/listeners before ending their PostgreSQL pools.
- Database schema watching is disabled, including automatic privileged watch-fixture installation. Query plans are exposed only in development.
- Nuxt UI uses the existing system font stack without fetching remote fonts. Production console stripping uses Vite's Rolldown configuration.

## Reproducible checks

Install Node satisfying `package.json` and Bun 1.4.2. Copy a valid `.env` locally; never commit it. The database must already be provisioned. Do not use `bun dev`, database setup/reset/watch scripts, or the legacy test launcher against a shared database: those scripts include workers or destructive database operations.

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test:unit
bun run test:email
bun run app:build
```

Run the built application locally on the reserved port:

```sh
NITRO_PORT=4311 NODE_ENV=production ENABLE_GRAPHIQL=1 \
NUXT_PUBLIC_ROOT_URL=http://localhost:4311 \
NUXT_SESSION_COOKIE_SECURE=false \
NUXT_CSURF_COOKIE_SECURE=false NUXT_CSURF_COOKIE_KEY=csrf \
node --env-file=.env .output/server/index.mjs
```

The cookie overrides above are only for local HTTP validation. Keep secure cookies in HTTPS deployments. In another terminal:

```sh
bun run test:smoke
bun run test:ruru
```

`schema:export` performs read-only introspection of the running API. Use the development server, or explicitly start the production server with `GRAPHQL_ALLOW_INTROSPECTION=true`, then run `bun run schema:export` and `bun run graphql`. Production introspection is blocked by default; code generation does not silently disable that policy. `test:smoke` requires Google Chrome, creates a randomly named account using an `example.invalid` email, and cleans up only that fixture and its queued jobs in `finally`. It tests CSRF rejection/acceptance, registration/login payloads, session cookies, SSR cache isolation, logout, WebSocket queries, live subscription delivery, and browser navigation/login/subscription/reload/logout. Do not run a job consumer during this test. `test:email` invokes all six templates directly with an in-memory JSON mail transport, without a database, worker, SMTP connection or real recipient. Unit tests exercise the direct SSR link and Apollo 4 Postgres error-code extraction.

## Recorded verification

Validation used Bun 1.4.2, Node 26.8.2, Google Chrome, and the pre-existing PostgreSQL database. A preliminary production run also verified Node 24.20.0.

| Check | Outcome |
| --- | --- |
| Clean `bun install --frozen-lockfile`, then final frozen recheck | Passed; preparation and codegen run successfully |
| `bun run schema:export` and `bun run graphql` | Passed against live schema |
| `bun run lint` | Passed, 0 errors and 12 existing console warnings |
| `bun run typecheck` | Passed Nuxt and separate worker checks |
| `bun run test:unit` | 8 passed, including policy, SSR and tag packaging checks |
| `bun run test:email` | All 6 templates passed |
| `bun run app:build` | Passed, includes standalone smart tags |
| `bun run test:policy` | Passed isolated artifact HTTP/WS/SSR policies, tag failures and shutdown |
| `bun run test:smoke` on production | Passed all HTTP, SSR, WS, subscription and browser assertions |
| `bun run app:dev --port 4311`, then `bun run test:smoke` | Passed the same integration assertions |
| `bun run test:ruru` | Passed request-specific CSRF header check |
| SIGINT after live subscriptions | Passed graceful shutdown without timeout |

Browser checks wait for Nuxt hydration to complete before interacting with forms, which is necessary during development's on-demand compilation. After the lockfile change, the first development browser run timed out during Vite dependency optimization; the complete suite passed on the warmed server. Color-mode controls render on the client to avoid server/browser theme hydration mismatches. Test fixtures and their queued jobs were removed by the smoke suite.

## Limits

The historical destructive test suite remains excluded. Actual mail delivery, OAuth providers, complete organization administration, password recovery and account deletion were not exercised end to end. Worker queue consumption and worker database migrations were deliberately not run. Lint retains 12 existing console-use warnings. Nuxt DevTools emits an upstream Vite-specific-hook warning in development. Bun blocks optional `protobufjs` and `unrs-resolver` lifecycle scripts; validation does not require them. Native image binaries in the local production build target macOS arm64; build on the deployment platform.

## Upstream references

- [Vue Apollo v5 releases and compatibility entry point](https://github.com/vuejs/apollo/releases)
- [Apollo Client 4 migration guide](https://github.com/apollographql/apollo-client/blob/main/docs/source/migrating/apollo-client-4-migration.mdx)
- [Nuxt 4 upgrade announcement](https://nuxt.com/blog/v4)
- [PostGraphile v5 migration guide](https://postgraphile.org/postgraphile/5/migrating-from-v4/)
- [npm registry metadata](https://registry.npmjs.org/)

## GraphQL policy and standalone smart tags

The server eagerly parses and validates `db/tags.jsonc` before retryable schema initialization. The build copies it to `.output/server/tags.jsonc`; a copy failure fails the build. A standalone server loads that bundled copy independently of the working directory and cannot fall back to source tags if the copy is missing. `GRAPHILE_TAGS_FILE` accepts an absolute override path; missing, malformed or invalid overrides fail startup. JSON5 2.2.3 is a direct dependency. The same helpers are shared with the other upgraded starter branches. Tag edits require a server restart; file and database schema watchers remain disabled.

Production allows field depth up to 16, counting scalar leaves and expanding named/inline fragments without charging an extra level for the fragment itself. Fragment depths are memoized and cycle-protected; standard GraphQL validation rejects cycles. `GRAPHQL_DEPTH_LIMIT` accepts a positive safe integer; invalid values and zero use 16. No role bypass exists. Production blocks `__schema` and `__type` unless `GRAPHQL_ALLOW_INTROSPECTION=true` exactly; `__typename` remains allowed. Development and test allow introspection and do not apply the production depth limit.

HTTP, WebSocket and Apollo's direct SSR executor use the same rule-selection helper. The SSR link validates before request context or execution and returns GraphQL errors through Apollo's result channel. Vue Apollo renders a public page when its shared query is rejected; that rejected query does not populate the serialized hydration cache. Existing generated operations fit the default limit.

The primary-key-only mutation plugin and removal of root `Query.query` already matched Borg's behavior and retain those semantics. Unique-key update/delete fields stay omitted while primary-key mutations remain available. Custom schema/order plugins now use `extendSchema` and `addPgTableOrderBy` from PostGraphile's public reexports. Organization member ordering explicitly checks the users name codec. No Borg-specific staff, task, session or subscription plugin was added.

Run `bun run test:policy` after building, with port 4311 free. It copies the standalone artifact into a temporary directory and performs read-only HTTP/WebSocket checks against the existing database: production defaults, exact introspection opt-in, depth overrides/fallbacks and fragments, development/test policy, schema omissions, actual SSR hydration behavior, tag startup failures, valid absolute override, and graceful shutdown. Unit tests cover fragment cycles/DAGs, configuration validation, direct SSR rejection before context, cwd-independent loading, and propagation of build-copy failures. No worker or migration is started.

## Cross-branch consistency follow-up

See the [branch consistency review](docs/branch-consistency.md) for shared fixes, intentional differences, live Bun/schema checks, and the common schema-export command (port 3000 by default; override with `SMOKE_ORIGIN`).
