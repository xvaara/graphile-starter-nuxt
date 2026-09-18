# Postgraphile Nuxt Starter

For information about Nuxt look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

Original [Graphile starter](https://github.com/graphile/starter) is build using Next.js and express. This is a fork to use Nuxt, Nuxt UI and Apollo Client.
## NOT FOR BEGINNERS

We do not advise that you build your own projects on top of this project until
you're comfortable with the various tools it uses
([Node.js](https://nodejs.org/en/docs/),
[Nuxt](https://nuxt.com),
[Nuxt Ui](https://ui.nuxt.com),
[PostgreSQL](https://www.postgresql.org/docs/current/index.html),
[GraphQL](https://graphql.org/learn/),
[PostGraphile](https://www.graphile.org/postgraphile/introduction/),
[Graphile Worker](https://github.com/graphile/worker),
[Graphile Migrate](https://github.com/graphile/migrate),
[TypeScript](https://www.typescriptlang.org/docs/),
[Apollo Client](https://www.apollographql.com/docs/react),
[Vue Apollo](https://apollo.vuejs.org/),
[GraphQL Code Generator](https://github.com/dotansimha/graphql-code-generator),
[ESLint](https://eslint.org/), etc.)

This is an **advanced** project with deeply integrated tooling across the full
stack. The project is called "Starter" because it helps you to start new
projects with all these technologies, tools and techniques already in place. If
you're not already familiar with these things then you'll probably find the
project overwhelming, it is not intended to be your first experience of any of
these tools.

If you're just getting started with PostGraphile, before you dive into this
project make sure you check out the
[PostGraphile required knowledge](https://www.graphile.org/postgraphile/required-knowledge/)
and especially the
[schema design tutorial](https://www.graphile.org/postgraphile/postgresql-schema-design/).
This repository takes a slightly different approach to schema design than the
aforementioned tutorial, but it's still an incredibly valuable resource.

## Status

This starter uses the beta version of Graphile, it is missing some features, has no working tests and the components are created with AI agent converting from the original next.js ones and then fixed to work somewhat correctly.

Use at your own risk. Probably not ready for production.

## Usage

### bun

This version uses [Bun](https://bun.sh) as package manager and task runner. Install bun:

```bash
npm install -g bun
```

### Setup env, database and start the dev server

```bash
bun setup
bun dev
```

## Please sponsor Benjie

### [Click here to find out more about sponsors and sponsorship.](https://www.graphile.org/sponsor/)

## Sponsoring random vue / graphile related stuff from me

You can sponsor my [Flow tools project](https://github.com/sponsors/flow-tools) to help me build more open source.

You can contact me as @xvaara on various social medias or through my company [Mentalhouse Oy](https://mentalhouse.fi/) if you have a postgraphile related work that need to be done.

## Nuxt GraphQL Application

This application has been converted to use the GraphQL Codegen **client preset** for better type safety and developer experience.

## GraphQL Client Preset

The application now uses the `@graphql-codegen/client-preset` which provides:

- **Fragment Masking**: Ensures components only access the data they explicitly request
- **Typed Document Nodes**: Full type safety for GraphQL operations
- **Inline Queries**: GraphQL queries are defined directly in Vue components using the `graphql()` function
- **Better Bundle Splitting**: Improved tree-shaking and code splitting capabilities

### Usage Examples

#### Mutations
```vue
<script setup>
import { useMutation } from '@vue/apollo-composable'
import { graphql } from '~/graphql'

// Define mutation inline
const loginMutation = graphql(`
  mutation Login($username: String!, $password: String!) {
    login(input: { username: $username, password: $password }) {
      user {
        id
        username
        name
      }
    }
  }
`)

const { mutate: login, loading } = useMutation(loginMutation)
</script>
```

#### Queries
```vue
<script setup>
import { useQuery } from '@vue/apollo-composable'
import { graphql } from '~/graphql'

const userQuery = graphql(`
  query CurrentUser {
    currentUser {
      id
      name
      username
    }
  }
`)

const { result, loading } = useQuery(userQuery)
</script>
```

#### Fragments
```vue
<script setup>
import type { FragmentType } from '~/graphql'
import { graphql, useFragment } from '~/graphql'

// Component props should use FragmentType
const props = defineProps<{
  user: FragmentType<typeof UserFragment>
}>()

const UserFragment = graphql(`
  fragment UserInfo on User {
    id
    name
    username
    avatarUrl
  }
`)

// Use the fragment to get typed data
const user = useFragment(UserFragment, props.user)
</script>
```

### Configuration

The GraphQL Codegen configuration is in `codegen.ts`:

```typescript
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './data/schema.graphql',
  documents: ['app/**/*.vue', 'app/**/*.ts'],
  config: {
    avoidOptionals: {
      field: true,
      inputValue: false,
      object: false,
    },
    scalars: {
      Datetime: 'string',
      BigInt: 'string',
      JSON: '{ [key: string]: any }',
    },
    enumsAsTypes: true,
    useTypeImports: true,
  },
  generates: {
    './app/graphql/': {
      preset: 'client',
      config: {
        useTypeImports: true,
      },
    },
  },
}
export default config
```

### Generated Files

The client preset generates the following files in `app/graphql/`:

- `index.ts` - Main exports
- `gql.ts` - The `graphql()` function and document types
- `graphql.ts` - Generated TypeScript types
- `fragment-masking.ts` - Fragment masking utilities

### Migration Notes

- All GraphQL operations are now defined inline using the `graphql()` function
- Fragment masking is enabled by default for better component isolation
- The old separate `.graphql` files have been removed
- Import paths changed from `~/utils/graphql` to `~/graphql`

### Development

Run the GraphQL codegen in watch mode during development:

```bash
npm run graphql:dev
```

Generate types once:

```bash
npm run graphql
```

## Benefits

1. **Type Safety**: Full end-to-end type safety from GraphQL schema to Vue components
2. **Fragment Masking**: Components can only access data they explicitly request
3. **Better DX**: Inline queries with syntax highlighting and IntelliSense
4. **Bundle Optimization**: Better tree-shaking and code splitting
5. **Colocation**: GraphQL operations are defined close to where they're used
