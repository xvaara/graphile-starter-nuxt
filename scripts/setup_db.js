#!/usr/bin/env node
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import pg from 'pg'
import {
  checkGit,
  outro,
  pkgMgrCmd,
  projectName,
  runMain,
  runSync,
} from './_setup_utils.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

runMain(async () => {
  await checkGit()

  // Ensure server build has been run
  // runSync(pkgMgrCmd, ["server", "build"]);

  // Source our environment
  dotenv.config({ path: resolve(import.meta.dirname, '../.env') })
  // require(resolve(import.meta.dirname, '../@app/config/extra'));
  const {
    DATABASE_AUTHENTICATOR,
    DATABASE_AUTHENTICATOR_PASSWORD,
    DATABASE_NAME,
    DATABASE_OWNER,
    DATABASE_OWNER_PASSWORD,
    DATABASE_VISITOR,
    ROOT_DATABASE_URL,
    CONFIRM_DROP,
  } = process.env

  // Validate required environment variables
  const requiredEnvVars = [
    'DATABASE_AUTHENTICATOR',
    'DATABASE_AUTHENTICATOR_PASSWORD',
    'DATABASE_NAME',
    'DATABASE_OWNER',
    'DATABASE_OWNER_PASSWORD',
    'DATABASE_VISITOR',
    'ROOT_DATABASE_URL',
  ]

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
  if (missingEnvVars.length > 0) {
    console.error(`Error: Missing required environment variables: ${missingEnvVars.join(', ')}`)
    process.exit(1)
  }
  if (!CONFIRM_DROP) {
    const { default: inquirer } = await import('inquirer')
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'CONFIRM',
        default: false,
        message: `We're going to drop (if necessary):

  - database ${DATABASE_NAME}
  - database ${DATABASE_NAME}_shadow
  - database role ${DATABASE_VISITOR} (cascade)
  - database role ${DATABASE_AUTHENTICATOR} (cascade)
  - database role ${DATABASE_OWNER}`,
      },
    ])
    if (!confirm.CONFIRM) {
      console.error('Confirmation failed; exiting')
      process.exit(1)
    }
  }

  console.log('Installing or reinstalling the roles and database...')
  const pgPool = new pg.Pool({
    connectionString: ROOT_DATABASE_URL,
  })

  pgPool.on('error', (err) => {
    // Ignore
    console.log(
      `An error occurred whilst trying to talk to the database: ${err.message}`,
    )
  })

  // Wait for PostgreSQL to come up
  let attempts = 0
  while (true) {
    try {
      await pgPool.query('select true as "Connection test";')
      break
    }
    catch (e) {
      if (e.code === '28P01') {
        throw e
      }
      attempts++
      if (attempts <= 30) {
        console.log(
          `Database is not ready yet (attempt ${attempts}): ${e.message}`,
        )
      }
      else {
        console.log(`Database never came up, aborting :(`)
        process.exit(1)
      }
      await sleep(1000)
    }
  }

  const client = await pgPool.connect()
  try {
    // RESET database
    await client.query(`DROP DATABASE IF EXISTS ${DATABASE_NAME};`)
    await client.query(`DROP DATABASE IF EXISTS ${DATABASE_NAME}_shadow;`)
    await client.query(`DROP DATABASE IF EXISTS ${DATABASE_NAME}_test;`)
    await client.query(`DROP ROLE IF EXISTS ${DATABASE_VISITOR};`)
    await client.query(`DROP ROLE IF EXISTS ${DATABASE_AUTHENTICATOR};`)
    await client.query(`DROP ROLE IF EXISTS ${DATABASE_OWNER};`)

    // Now to set up the database cleanly:
    // Ref: https://devcenter.heroku.com/articles/heroku-postgresql#connection-permissions

    // This is the root role for the database`);
    const isProd = process.env.NODE_ENV === 'production'
    await client.query(
      // IMPORTANT: don't grant SUPERUSER in production, we only need this so we can load the watch fixtures!
      `CREATE ROLE ${DATABASE_OWNER} WITH LOGIN PASSWORD '${DATABASE_OWNER_PASSWORD}' ${isProd ? '' : 'SUPERUSER'};`,
    )

    // This is the no-access role that PostGraphile will run as by default`);
    await client.query(
      `CREATE ROLE ${DATABASE_AUTHENTICATOR} WITH LOGIN PASSWORD '${DATABASE_AUTHENTICATOR_PASSWORD}' NOINHERIT;`,
    )

    // This is the role that PostGraphile will switch to (from ${DATABASE_AUTHENTICATOR}) during a GraphQL request
    await client.query(`CREATE ROLE ${DATABASE_VISITOR};`)

    // This enables PostGraphile to switch from ${DATABASE_AUTHENTICATOR} to ${DATABASE_VISITOR}
    await client.query(
      `GRANT ${DATABASE_VISITOR} TO ${DATABASE_AUTHENTICATOR};`,
    )
  }
  finally {
    await client.release()
  }
  await pgPool.end()

  runSync(pkgMgrCmd, ['db:reset', '--erase'])
  runSync(pkgMgrCmd, ['db:reset', '--shadow', '--erase'])

  outro(`\
✅ Setup success

🚀 To get started, run:

${
  projectName
    ? '  export UID; docker-compose up server' // Probably Docker setup
    : `  ${pkgMgrCmd} start`
}`)
})
