# Villus with the Codegen client preset

`codex/villus-client-preset` branches from `main` at `46da970` and replaces URQL with Villus 3.5.2. The Codegen client preset, fragment masking, 33 operations and PostGraphile schema are retained. The backend policies, database configuration and worker remain shared with `main`.

## Typed operations

Use `graphql` from `~/graphql` with native `useQuery`, `useMutation` and `useSubscription` from `villus`. Pass `client: useNuxtApp().$villus` explicitly: this also avoids Villus's process-global client fallback during concurrent SSR. The typed document infers both variables and results; use `getFragmentData` at each fragment boundary as on `main`.

```ts
const { data, isFetching, error } = await useQuery({
  client: useNuxtApp().$villus,
  query: OrganizationPageDocument,
  variables: computed(() => ({ slug: route.params.slug as string })),
  tags: ['organization'],
  fetchOnMount: false,
})
```

Await page queries to render their data on the server. `fetchOnMount: false` avoids an extra execution when the awaited query mounts. Reactive variables still trigger queries. For conditional lookups use `paused` or `skip`; Villus names the execution function `execute` and its loading ref `isFetching`. Its errors expose `graphqlErrors`.

## Cache and authentication

Villus caches complete query results, **not normalized entities**. The email, linked-account and organization queries have tags. Mutations use `refetchTags` to invalidate cached queries and refresh mounted consumers, or `clearCacheTags` when navigation should happen before another query. New features must declare their own invalidation: returned mutation objects do not automatically update related query results.

The browser plugin adds the current CSRF header and same-origin cookies to HTTP requests. `graphql-ws` supplies cookie-authenticated subscriptions through `handleSubscriptions`. Authentication refresh replaces the cache, deduplication state and WebSocket connection while keeping the Villus client stable for mounted hooks. Old pending responses can only populate the abandoned cache. The auth subscription restarts after a session reset and unsubscribes when logged out.

Each SSR request gets its own client, cache and Grafast plugin. Queries run directly in-process with the request's H3 event and the same validation, depth and introspection rules as the HTTP/WebSocket API. Successful query data is serialized in `__VILLUS_DATA__` and reused during hydration. No process-global authenticated client or cross-request result cache is installed.

## Install and verify

Use npm and `package-lock.json`. `npm ci` generates `app/graphql/` before Nuxt preparation from the checked-in schema; generated files remain ignored. Villus needs no Graphcache introspection artifact, so this branch removes the URQL packages, exchange and introspection codegen target.

With the existing `.env` and configured database:

```sh
npm ci
bun run graphql
bun run app:dev
# In another terminal:
bun run schema:export
bun run typecheck
bun run lint
bun run test:unit
bun run app:build
```

Run `test:auth` against the app using `SMOKE_ORIGIN` for its URL. `test:policy` and `test:shutdown` start the production build themselves. Auth tests use disposable account and organization fixtures and clean up their jobs; do not start a real worker, migration watcher or database reset for these checks.

## Verification

Type checks, lint, 17 unit tests, code generation and the production build pass. The 33 generated operations and their fragment selections match `main` exactly, and live schema export is byte-identical. Development and production browser checks cover login/logout, nested fragment rendering, organization mutations, email cache invalidation and live subscription updates. Production checks also verify missing-CSRF rejection, concurrent SSR isolation, subscription reconnection after login, policy enforcement and natural shutdown.

See [Villus overview](https://villus.dev/guide/overview/), [query caching](https://villus.dev/plugins/cache/), [mutation tag invalidation](https://villus.dev/api/use-mutation/) and [Codegen client preset](https://the-guild.dev/graphql/codegen/plugins/presets/preset-client).
