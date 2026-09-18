# GraphQL client branches

The branches share the PostGraphile backend and schema, but demonstrate different frontend integrations. The `urql` branch was created from `main` at `a3c3974` before the client-preset migration.

| Branch | GraphQL client | Code generation and operation sources |
| --- | --- | --- |
| [`main`](https://github.com/xvaara/graphile-starter-nuxt/tree/main) | URQL | Codegen client preset; typed documents in Vue/TypeScript, native URQL hooks, fragment masking |
| [`codex/villus-client-preset`](https://github.com/xvaara/graphile-starter-nuxt/tree/codex/villus-client-preset) | Villus | Codegen client preset; native Villus hooks, fragment masking, tagged query caching ([integration notes](villus.md)) |
| [`urql`](https://github.com/xvaara/graphile-starter-nuxt/tree/urql) | URQL | The previous integration: external `graphql/*.graphql` documents and generated `use…Query` / `use…Mutation` composables |
| [`apollo-client`](https://github.com/xvaara/graphile-starter-nuxt/tree/apollo-client) | Apollo Client 4 / Vue Apollo 5 alpha | External GraphQL documents and generated Apollo composables |
| [`apollo-client-preset`](https://github.com/xvaara/graphile-starter-nuxt/tree/apollo-client-preset) | Apollo Client 4 / Vue Apollo 5 alpha | Codegen client preset; inline typed documents and fragment masking |

`main` continues to use URQL, Graphcache, direct in-process SSR, request-isolated state, cookie authentication, CSRF-protected HTTP requests and WebSocket subscriptions. Choosing the client preset changes how application operations are authored and typed; it does not change the server schema or switch the client to Apollo. The 33 existing operations and their fragment selections are preserved.

The Villus branch starts from `main` at `46da970`. It has its own request-scoped SSR plugin and query-cache invalidation; the sections below describe the URQL implementation on `main`.

## Authoring operations on main

Import the generated `graphql` helper and the native hook. The document carries its result and variable types; generated per-operation hooks and manually supplied generics are unnecessary.

```ts
import { useMutation } from '@urql/vue'
import { graphql } from '~/graphql'

const LoginDocument = graphql(/* GraphQL */ `
  mutation Login($username: String!, $password: String!) {
    login(input: { username: $username, password: $password }) {
      user { id username name }
    }
  }
`)

const { executeMutation: login, fetching } = useMutation(LoginDocument)
const result = await login({ username: 'alice', password: 'example' })
```

Define each named operation once. Most operations live in their consuming page or composable. Reused documents and fragments live in `app/operations/`; for example, the organization page query serves both the dashboard and settings pages. `SettingsProfile` remains available there even though the current profile form reads authentication state.

Fragment masking is enabled. Read fragment fields with `getFragmentData(FragmentDocument, result)` at the consuming boundary. Nested fragments must each be unmasked, as shown in `useAuth`, email settings and organization membership rendering. Use `computed` around fragment reads from reactive query results so subsequent cache/network updates remain visible. `getFragmentData` is a typed data helper, not a Vue lifecycle hook.

Codegen scans `app/**/*.vue` and `app/**/*.ts`, excluding its own output. `app/graphql/` contains generated typed documents, the document lookup and fragment helpers; do not edit or commit those files. `app/utils/introspection.ts` remains generated for Graphcache's schema-aware normalized cache. The old generated `app/utils/graphql.ts` hooks and external `graphql/` sources have been removed from `main`.

## Install, generate and verify

`main` and `urql` use npm and `package-lock.json`; the Apollo branches use Bun and `bun.lock`. Install using the selected branch's package manager after switching branches. Avoid carrying generated files or Nuxt caches from another client integration into a build.

On `main`, `npm ci` runs code generation before `nuxt prepare`, so a clean checkout needs neither an existing generated directory nor a running database to install. `npm run graphql` (or `bun run graphql`) regenerates typed client artifacts from `data/schema.graphql`. `npm run schema:export` separately exports the live server schema; set `SMOKE_ORIGIN` when the app uses a port other than 3000. Production schema export requires the explicit introspection opt-in.

```sh
npm ci
npm run app:dev
# In another terminal:
npm run schema:export
npm run graphql
npm run typecheck
npm run lint
npm run test:unit
npm run app:build
```

Use `app:dev` alone when the database is already configured. The aggregate `dev` command also starts the migration watcher and worker. The existing auth/browser, shutdown and policy smoke commands cover the integration; the auth test now also checks masked email data, organization creation and nested membership data. These tests use temporary account/organization fixtures and clean up their records and queued jobs. Do not run queue consumers alongside fixture tests.

## Maintaining the variants

Backend, schema, security and dependency fixes should be applied consistently where applicable. Review client and codegen changes separately: copying a generated URQL hook call into a client-preset branch, or copying an Apollo hook into URQL, will not preserve behavior. Regenerate each branch's own artifacts and run its type and smoke checks. Prefer focused commits for shared fixes so they can be cherry-picked without replacing another branch's client architecture. The Apollo preset also retains its separate plan-based LoginPlugin and SQL snapshot changes.

References: [Codegen client preset](https://the-guild.dev/graphql/codegen/plugins/presets/preset-client), [React and Vue guide](https://the-guild.dev/graphql/codegen/docs/guides/react-vue).

## Migration verification

The migration was checked against the pre-migration URQL documents: all 33 operations and their reachable fragment selections are identical. The exported `data/schema.graphql` remains byte-identical to the other branches. A clean `npm ci` regenerated missing client documents and Graphcache metadata exactly, without changing the lockfile or contacting the database for code generation.

Type checks, lint, 17 unit tests, production build, development and production auth/browser/Ruru tests, production policy checks and natural shutdown passed. Browser checks cover email fragment reads, creating a disposable organization, its dashboard/settings and nested membership fragments, as well as login/reload/logout. SSR isolation and live WebSocket notifications remain covered. Fixtures and their queued jobs are cleaned up; no migration watcher, database reset or real worker was started.
