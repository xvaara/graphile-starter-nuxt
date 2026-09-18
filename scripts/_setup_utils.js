import { promises as fsp } from 'node:fs'
import os from 'node:os'
import { resolve } from 'node:path'
import { safeRandomString } from './lib/random.js'

export { readDotenv, withDotenvUpdater } from './lib/dotenv.js'
export { runSync } from './lib/run.js'

const major = Number.parseInt(process.version.replace(/^v/, '').split('.')[0], 10)
if (major < 22) {
  throw new Error('This project requires Node.js >= 22.0.0')
}

// fixes runSync not throwing ENOENT on windows
const platform = os.platform()

export const pkgMgrCmd = platform === 'win32' ? 'bun.cmd' : 'bun'

export const projectName = process.env.PROJECT_NAME

export function updateDotenv(add, answers) {
  const PASSWORDS = {
    DATABASE_OWNER_PASSWORD: safeRandomString(30),
    DATABASE_AUTHENTICATOR_PASSWORD: safeRandomString(30),
  }
  add(
    'GRAPHILE_LICENSE',
    null,
    `\
# If you're supporting PostGraphile's development via Patreon or Graphile
# Store, add your license key from https://store.graphile.com here so you can
# use the Pro plugin - thanks so much!`,
  )

  add(
    'NODE_ENV',
    'development',
    `\
# This is a development environment (production wouldn't write envvars to a file)`,
  )

  add(
    'ROOT_DATABASE_URL',
    null,
    `\
# Superuser connection string (to a _different_ database), so databases can be dropped/created (may not be necessary in production)`,
  )

  add(
    'DATABASE_HOST',
    null,
    `\
# Where's the DB, and who owns it?`,
  )

  add('DATABASE_NAME')
  add('DATABASE_OWNER', answers.DATABASE_NAME)
  add('DATABASE_OWNER_PASSWORD', PASSWORDS.DATABASE_OWNER_PASSWORD)

  add(
    'DATABASE_AUTHENTICATOR',
    `${answers.DATABASE_NAME}_authenticator`,
    `\
# The PostGraphile database user, which has very limited
# privileges, but can switch into the DATABASE_VISITOR role`,
  )

  add('DATABASE_AUTHENTICATOR_PASSWORD', PASSWORDS.DATABASE_AUTHENTICATOR_PASSWORD)

  add(
    'DATABASE_VISITOR',
    `${answers.DATABASE_NAME}_visitor`,
    `\
# Visitor role, cannot be logged into directly`,
  )

  add(
    'SECRET',
    safeRandomString(30),
    `\
# This secret is used for signing cookies`,
  )

  add(
    'JWT_SECRET',
    safeRandomString(48),
    `\
# This secret is used for signing JWT tokens (we don't use this by default)`,
  )

  add(
    'PORT',
    '3000',
    `\
# This port is the one you'll connect to`,
  )

  add(
    'ROOT_URL',
    'http://localhost:3000',
    `\
# This is needed any time we use absolute URLs, e.g. for OAuth callback URLs
# IMPORTANT: must NOT end with a slash`,
  )

  add(
    'GITHUB_KEY',
    null,
    `\
# To enable login with GitHub, create a GitHub application by visiting
# https://github.com/settings/applications/new and then enter the Client
# ID/Secret below
#
#   Name: PostGraphile Starter (Dev)
#   Homepage URL: http://localhost:3000
#   Authorization callback URL: http://localhost:3000/auth/github/callback
#
# Client ID:`,
  )

  add(
    'GITHUB_SECRET',
    null,
    `\
# Client Secret:`,
  )

  if (projectName) {
    add(
      'COMPOSE_PROJECT_NAME',
      projectName,
      `\
# The name of the folder you cloned graphile-starter to (so we can run docker-compose inside a container):`,
    )
  }

  add(
    'DATABASE_URL',
    `postgres://${answers.DATABASE_NAME}:${PASSWORDS.DATABASE_OWNER_PASSWORD}@${answers.DATABASE_HOST}/${answers.DATABASE_NAME}`,
    `\
# The database URL for the PostGraphile database user owns the database.`,
  )
  add(
    'AUTH_DATABASE_URL',
    `postgres://${answers.DATABASE_NAME}_authenticator:${PASSWORDS.DATABASE_AUTHENTICATOR_PASSWORD}@${answers.DATABASE_HOST}/${answers.DATABASE_NAME}`,
    `\
# The database URL for the PostGraphile database user (which has very limited
# privileges, but can switch into the DATABASE_VISITOR role)`,
  )
  add(
    'SHADOW_DATABASE_URL',
    `postgres://${answers.DATABASE_NAME}:${PASSWORDS.DATABASE_OWNER_PASSWORD}@${answers.DATABASE_HOST}/${answers.DATABASE_NAME}_shadow`,
    `\
# Shadow database URL (used for migrations, not used in production)`,
  )
  add(
    'SHADOW_AUTH_DATABASE_URL',
    `postgres://${answers.DATABASE_NAME}_authenticator:${PASSWORDS.DATABASE_AUTHENTICATOR_PASSWORD}@${answers.DATABASE_HOST}/${answers.DATABASE_NAME}_shadow`,
    `\
# Shadow database URL (used for migrations, not used in production)`,
  )
  add(
    'TEST_DATABASE_URL',
    `postgres://${answers.DATABASE_NAME}:${PASSWORDS.DATABASE_OWNER_PASSWORD}@${answers.DATABASE_HOST}/${answers.DATABASE_NAME}_test`,
    `\
# Test database URL for development and testing purposes`,
  )
  add(
    'CYPRESS_ROOT_URL',
    `http://localhost:3000`,
    `\
# https://docs.cypress.io/guides/guides/environment-variables.html#Option-3-CYPRESS
`,
  )
  add(
    'EMAIL_FROM',
    `"PostGraphile Starter" <no-reply@examples.graphile.org>`,
    `\
# Email is sent from this address.
`,
  )
  add(
    'PROJECT_NAME',
    `PostGraphile Starter`,
    `\
# Added to emails.
`,
  )
  add(
    'LEGAL_TEXT',
    `Legal text goes here`,
    `\
# Added to emails.
`,
  )
}

export async function checkGit() {
  try {
    const gitStat = await fsp.stat(resolve(import.meta.dirname, '../.git'))
    if (!gitStat || !gitStat.isDirectory()) {
      throw new Error('No .git folder found')
    }
  }
  catch (e) {
    console.error(e)
    console.error()
    console.error()
    console.error(
      'ERROR: Graphile Starter must run inside of a git versioned folder. Please run the following:',
    )
    console.error()
    console.error('  git init')
    console.error('  git add .')
    console.error('  git commit -m \'Graphile Starter base\'')
    console.error()
    console.error(
      'For more information, read https://github.com/graphile/starter#making-it-yours',
    )
    console.error()
    console.error()
    console.error()
    process.exit(1)
  }
}

export function runMain(main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

export function outro(message) {
  console.log()
  console.log()
  console.log('____________________________________________________________')
  console.log()
  console.log()
  console.log(message)
  console.log()
  console.log()
  console.log('🙏 Please support our Open Source work:')
  console.log('     https://graphile.org/sponsor')
  console.log()
  console.log('____________________________________________________________')
  console.log()
}
