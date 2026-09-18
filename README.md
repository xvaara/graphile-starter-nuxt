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

This starter uses the beta version of Graphile, it is missing some features, has a focused upgrade smoke suite but no complete end-to-end test suite and the components are created with AI agent converting from the original next.js ones and then fixed to work somewhat correctly.

Use at your own risk. Probably not ready for production.

See [UPGRADE.md](./UPGRADE.md) for verified versions, safe validation commands, migration notes and remaining limitations.

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
