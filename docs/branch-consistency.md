# Branch consistency review

Reviewed on 2026-09-18 across `codex/upgrade-main`, `codex/upgrade-apollo-client`, and `codex/upgrade-apollo-client-preset`, including comparison with their original source branches.

## Shared behavior

- Shared direct dependencies have identical version pins. All branches require Nuxt's supported Node range: `^22.19.0 || ^24.11.0 || >=26.0.0`.
- `data/schema.graphql`, `db/tags.jsonc`, smart-tag loading, depth/introspection policy, primary-key mutation restrictions, root-query removal, subscriptions, ordering, and Ruru CSRF support match byte for byte across the branches.
- Production depth defaults to 16; introspection requires the exact opt-in `GRAPHQL_ALLOW_INTROSPECTION=true`. HTTP, WebSockets and direct SSR apply the same policy. Query explanations are development-only.
- Schema watching is disabled. The Graphile service uses the existing application pool without a redundant privileged watch connection.
- Nitro closes PostGraphile, PostgreSQL services/subscribers, then the application pools. A shared close promise prevents repeated pool shutdown. Both Apollo branches share the same direct SSR link implementation.
- All branches use Nuxt's app/server/shared/node TypeScript project references. `typecheck` also checks the worker; `test:unit` runs each branch's unit tests.
- Both Apollo branches use the same error extraction and hydration-safe dark-mode controls. Production logger removal uses Vite 8/Rolldown options. Local `.nuxtrc` setup state is ignored.

The schema SHA-256 after live regeneration is `58fee8aff8a2aa4e4e97c3b3609fd27bae315eb17bf74991948032ff75c72ed9` on all three branches. Relative to the original schema, the upgrade adds filtering/ordering for `UserAuthentication.identifier` and `UserEmail.email` (10 lines); the consistency follow-up makes no further schema changes.

## Expected differences

| Area | main | apollo-client | apollo-client-preset |
| --- | --- | --- | --- |
| Client | URQL | Apollo 4 / Vue Apollo 5 alpha | Apollo 4 / Vue Apollo 5 alpha |
| Code generation | External documents, URQL composables/introspection | External documents, Apollo composables | Inline documents, client preset / fragment masking |
| Lockfile / package manager | npm | Bun | Bun |
| Direct SSR | Grafast exchange | Graphile Apollo link | Graphile Apollo link |
| Existing security configuration | CSRF and CSP enabled | CSRF enabled; headers disabled | CSRF enabled; headers disabled |

The preset branch additionally retains the user's saved SQL snapshot and plan-based LoginPlugin changes. The other branches retain their resolver-based login implementation. All variants return the newly authenticated user in the same mutation and pass the auth/SSR/subscription checks. Frontend document usage, generated types, legacy setup-script formats, lint configuration, and branch-specific test implementations remain appropriate to their respective clients.

## Verification

All three branches passed code generation, app/server/worker type checking, lint (only the existing Apollo console warnings), unit tests, production builds, and isolated GraphQL policy/deployment tests. Both Bun lockfiles passed frozen installation with no changes.

Fresh `bun run app:dev` processes on ports 4311/4312/4313 passed HTTP startup, live schema export, code generation, Ruru header/query checks, authentication, request-isolated SSR and live WebSocket subscriptions. The exported schema remained unchanged. Standalone production servers passed the same applicable integration checks and exited naturally within 40 ms after subscription use with forced shutdown disabled. Existing browser auth checks passed on main and apollo-client. Preset home/auth layouts additionally passed browser hydration and dark-mode toggling with both light and dark preferences in development and production.

No migration watcher, database reset, or real worker was started. Auth checks create unique disposable accounts and clean up their records and queued jobs. The original working checkout and its saved changes are preserved.

## Commands to keep aligned

Start just the application with `bun run app:dev` (the script is `app:dev`, not `dev:app`). Then, in another terminal:

```sh
SMOKE_ORIGIN=http://localhost:3000 bun run schema:export
bun run graphql
git diff --exit-code -- data/schema.graphql
bun run typecheck
bun run lint
bun run test:unit
bun run app:build
bun run test:policy
```

`schema:export` defaults to port 3000; set `SMOKE_ORIGIN` when using another port. It introspects the running API and writes the sorted SDL. `graphql` reads that SDL and generates client artifacts; it does not export the schema. Production export requires starting the server with the explicit introspection opt-in. Policy tests use the branch-specific smoke ports and require those ports to be free. `SMOKE_ORIGIN=http://localhost:3000 bun run test:ruru` verifies the running playground's GraphQL endpoint and request headers.
