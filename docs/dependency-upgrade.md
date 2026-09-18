# Dependency upgrade (2026-09-18)

Source: `main` at `3a73592`; result: `codex/upgrade-main`.

The branch retains Vue URQL, Graphcache, WebSocket subscriptions and server-side rendering. Nitro owns one PostGraphile instance and gives each SSR request a direct Grafast exchange, avoiding HTTP loopback and separate backend instances in Vite. Authentication state and hydration data are scoped to a Nuxt request. Authentication changes replace the browser cache and reconnect the WebSocket; URQL uses CSRF-protected POST requests because Grafserv rejects GET by default.

## Versions and selection

Registry metadata was checked on 2026-09-18 rather than assuming that the old majors or dist-tags were current. Core installed versions: Nuxt 4.5.2, Vue 3.5.43, Vue Router 5.3.1, Nuxt UI 4.11.1, PostGraphile 5.1.5, Grafast 1.1.3, URQL Vue 2.1.1/Core 6.0.3/Graphcache 9.0.1, GraphQL Code Generator CLI 7.4.1, Graphile Worker 0.18.0, MJML 5.4.1 and Nodemailer 10.0.10.

Compatibility constraints:

- GraphQL 16.14.2 is the newest 16.x release; PostGraphile/Grafast do not yet accept stable GraphQL 17.0.2.
- h3 1.15.11 is the newest stable 1.x release supported by the Nitro/Grafserv h3-v1 adapter. The registry's latest tag points to a 2.x release candidate.
- TypeScript 6.0.3 is used for compatibility with Vue/ESLint tooling's compiler APIs; the registry latest is 7.0.2.
- The archived-row plugin's latest tag is stale; 4.0.0-rc.1 is the newest compatible published prerelease. The many-to-many and aggregate plugins likewise use their newest release candidates.
- Nuxt CLI’s optional `cac` 6 peer is explicitly installed alongside nested cac 7 consumers, avoiding npm’s invalid peer placement.
- A single Grafast and GraphQL version is enforced through npm overrides. esbuild 0.28.2 fixes the advisory affecting a transitive 0.27.x version.
- This branch has no Apollo packages. The user's Apollo/Vue Apollo version selection applies to the Apollo branches.

The obsolete Graphcache code generator only declares support through Graphcache 7 and was removed; Graphcache's native configuration types cover this branch. The operations generator now emits input types itself, so the redundant TypeScript schema generator was removed. UUID and Cursor mappings are explicit. Generated operations and Graphcache introspection now have one location under `app/utils`.

Inactive AI/i18n module configuration and unused test-utils were removed. The inactive translation CLI pulled obsolete network/archive dependencies with advisories. No active translated UI or AI feature existed on this branch. The DB package is now an npm workspace, covered by the same lockfile.

## Compatibility fixes

- Registration stores a secure session; login's returned user depends on the actual login result instead of independently reading the old session.
- Nuxt 4 TypeScript project references, URQL reactive variables, nullable IDs and Graphile imports/types have been migrated.
- The original strict CSP is preserved. Icons render as locally bundled SVG, Reka receives the request nonce, and the loading indicator/toast viewport render only on the client to avoid blocked SSR inline style attributes. Iconify’s no-op empty SVG style attributes are removed during SSR without altering real styles or the CSP. Automatic font downloads are disabled; the app uses its existing system font stack.
- Nuxt UI color-mode controls avoid hydration mismatches; modal state uses `v-model:open` and body slots.
- MJML 5 rendering is awaited. All six email templates are tested through the actual task using Nodemailer's JSON transport.
- Lint is non-mutating; explicit `lint:fix` remains available.
- Shutdown releases PostGraphile, then PostgreSQL services (including the LISTEN subscriber), then the two app-owned pools. This avoids hanging on a checked-out subscriber connection or ending externally supplied pools twice.
- Graphile database/schema watch is disabled. No database migration, reset, setup, or background worker was run for this upgrade.

## Schema and operation policy

Smart tags are parsed and validated eagerly before PostGraphile starts its retryable database gather. The loader finds source `db/tags.jsonc` relative to the project, independently of the working directory. Production builds must copy the file to `.output/server/tags.jsonc`; a copy failure fails the build. Standalone output uses that adjacent file and never falls back to source files. Missing, malformed or unsupported tags fail startup before accepting requests. Tags are not watched; restart after changing them.

`GRAPHILE_TAGS_FILE` optionally selects an absolute file path. An empty, relative, missing or invalid override fails closed. This explicit override also applies to standalone output.

In production (`NODE_ENV=production`), operation depth defaults to 16, counting leaf fields while fragment spreads and inline fragments add no levels. `GRAPHQL_DEPTH_LIMIT` accepts a positive safe integer; invalid or zero values fall back to 16. Fragment depths are memoized and cycles terminate safely; standard GraphQL validation rejects cycles. Production rejects `__schema` and `__type` introspection by default while allowing `__typename`. Only the literal `GRAPHQL_ALLOW_INTROSPECTION=true` opts in. Development and test permit introspection and do not impose the production depth limit.

HTTP, WebSocket, and direct SSR use the same policy helpers. SSR validates the document with standard GraphQL rules and these policy rules before creating execution context, returning GraphQL errors through URQL. No role bypass is added. The existing primary-key-only mutation policy and omitted root `query` field are retained and checked against the live schema. Login/subscription extensions and custom orderings use the current PostGraphile utility names, including a checked users/name codec.

## Reproducing safe checks

Use the ignored `.env` and the existing configured database. Node 26.8.2 and npm 11.19.1 were used. Install with `npm ci`; after the client-preset migration, root postinstall generates the client documents and Graphcache introspection from the committed schema before preparing Nuxt. See [the branch guide](branches.md) for the preserved `urql` variant and the current `main` integration.

Start only the app on the reserved port:

```sh
ROOT_URL=http://localhost:4313 NUXT_PUBLIC_ROOT_URL=http://localhost:4313 npm run app:dev -- --port 4313
```

Against that app, run `npm run schema:export` and `npm run graphql`. The export performs read-only introspection with CSRF protection; production export requires the explicit introspection opt-in. The normal static codegen command does not contact or reset a database. Then run:

```sh
npm run lint
npm run typecheck # Nuxt app/server plus the worker project
npm test
npm run test:browser
npm run test:auth
npm run app:build
```

The auth test creates a unique `smoke_*` user and removes only that user, its related rows and queued fixture jobs in `finally`. It checks registration/login payloads, session cookies, authenticated and anonymous SSR isolation, logout, WebSocket queries, a real isolated `pg_notify` subscription notification, and browser login/reload/logout. No worker consumes jobs. The browser-only test checks hydration, navigation, invalid login, route protection and rejection of a mutation without CSRF. Playwright needs an installed Chromium (`npx playwright install chromium` if absent).

For production, stop the development server first, then run:

```sh
NODE_ENV=production GRAPHILE_ENV=production NITRO_PORT=4313 NITRO_HOST=127.0.0.1 NUXT_PUBLIC_ROOT_URL=http://localhost:4313 node --env-file=.env .output/server/index.mjs
```

With port 4313 free, `npm run test:policy` copies the standalone output to a temporary deployment directory, starts it from an unrelated working directory, and checks HTTP/WebSocket environment policy variants, direct SSR rejection, schema omissions, fatal tag errors, and natural shutdown. `npm run test:shutdown` starts its own production server, runs the isolated auth/subscription suite, sends SIGTERM, and requires natural exit within seven seconds with Nitro forced exit disabled. It does not start workers or run migrations.

The standalone `.output` directory can run from an unrelated working directory. Supply an absolute path to the environment file when using Node’s `--env-file` from elsewhere. Production uses secure session cookies; localhost browser testing supports them, but real deployments require HTTPS. Keep secrets in environment variables, never in version control.

The legacy `scripts/test.cjs`/database test scripts reset databases and are not part of these checks. Outbound email delivery, background worker execution, destructive account operations, OAuth providers, organization billing/ownership workflows, and disconnect/retry subscription recovery are not covered by the smoke tests. Production build warnings about the upstream security module's esbuild options versus Vite 8 oxc and platform-specific Sharp binaries are non-fatal; deploy a build made for the target architecture.

## Verified outcomes

On Node 26.8.2/npm 11.19.1, both development and standalone production were tested on port 4313.

| Check | Outcome |
| --- | --- |
| `npm ci` and lockfile SHA-256 comparison | Passed; lockfile unchanged; zero audit vulnerabilities |
| `npm ls --all` | Passed; optional native WebSocket acceleration is not installed |
| `npm run schema:export` / `npm run graphql` | Passed; live schema exported and all operations generated; all 33 generated operations independently validate under production policy |
| `npm run lint` | Passed without fixes or warnings |
| `npm run typecheck` | Passed for Nuxt and worker code |
| `npm test` | 16 passed: six email templates, three SSR exchange checks, four policy checks, two smart-tag checks, empty SVG style regression |
| `npm run app:build` | Passed; missing source tags also verified to fail the required copy hook |
| `npm run test:policy` | Passed from isolated output/unrelated cwd; HTTP, WebSocket and SSR policy checks and fatal tag errors |
| `node tests/browser-smoke.mjs` | Passed in development and production; zero browser errors |
| `node --env-file=.env tests/auth-smoke.mjs` | Passed in development and production; fixtures cleaned |
| `npm run test:shutdown` | Passed after live subscription use; natural exit in 17 ms, no timeout or double pool teardown |
| `git diff --check` | Passed |

Production preserves strict CSP, with no `unsafe-inline` relaxation. The safe UI integration resolved the original production CSP failures. npm emits transitive deprecation notices and install-script approval notices; the clean installation and subsequent checks succeed. No PR was opened, no branch was pushed, and the source branch was not moved.

## Official migration references

- [Nuxt 4 upgrade guide](https://nuxt.com/docs/4.x/getting-started/upgrade)
- [Nuxt UI 4 migration](https://ui.nuxt.com/docs/getting-started/migration/v4)
- [PostGraphile v5 migration and package reexports](https://postgraphile.org/postgraphile/5/migrating-from-v4/)
- [URQL Vue changelog](https://github.com/urql-graphql/urql/blob/main/packages/vue-urql/CHANGELOG.md)
- [MJML releases](https://github.com/mjmlio/mjml/releases)

## Cross-branch consistency follow-up

See the [branch consistency review](branch-consistency.md) for shared fixes, intentional differences, live Bun/schema checks, and the common schema-export command (port 3000 by default; override with `SMOKE_ORIGIN`).
