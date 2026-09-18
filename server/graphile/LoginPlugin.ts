import { sideEffectWithPgClient } from 'postgraphile/@dataplan/pg'
import { access, constant, context as grafastContextStep, list, object, sideEffect } from 'postgraphile/grafast'
import { extendSchema, gql } from 'postgraphile/utils'
import { ERROR_MESSAGE_OVERRIDES } from '../utils/handleErrors'

const PassportLoginPlugin = extendSchema((build) => {
  const typeDefs = gql`
    input RegisterInput {
      username: String!
      email: String!
      password: String!
      name: String
      avatarUrl: String
    }

    type RegisterPayload {
      user: User!
    }

    input LoginInput {
      username: String!
      password: String!
    }

    type LoginPayload {
      user: User!
    }

    type LogoutPayload {
      success: Boolean
    }

    """
    All input for the \`resetPassword\` mutation.
    """
    input ResetPasswordInput {
      """
      An arbitrary string value with no semantic meaning. Will be included in the
      payload verbatim. May be used to track mutations by the client.
      """
      clientMutationId: String

      userId: UUID!
      resetToken: String!
      newPassword: String!
    }

    """
    The output of our \`resetPassword\` mutation.
    """
    type ResetPasswordPayload {
      """
      The exact same \`clientMutationId\` that was provided in the mutation input,
      unchanged and unused. May be used by a client to track mutations.
      """
      clientMutationId: String

      """
      Our root query field type. Allows us to run any query from our mutation payload.
      """
      query: Query

      success: Boolean
    }

    extend type Mutation {
      """
      Use this mutation to create an account on our system. This may only be used if you are logged out.
      """
      register(input: RegisterInput!): RegisterPayload

      """
      Use this mutation to log in to your account; this login uses sessions so you do not need to take further action.
      """
      login(input: LoginInput!): LoginPayload

      """
      Use this mutation to logout from your account. Don't forget to clear the client state!
      """
      logout: LogoutPayload

      """
      After triggering forgotPassword, you'll be sent a reset token. Combine this with your user ID and a new password to reset your password.
      """
      resetPassword(input: ResetPasswordInput!): ResetPasswordPayload
    }
  `
  const userResource = build.input.pgRegistry.pgResources.users
  const currentUserIdResource
    = build.input.pgRegistry.pgResources.current_user_id
  if (!userResource || !currentUserIdResource) {
    throw new Error(
      'Couldn\'t find either the \'users\' or \'current_user_id\' source',
    )
  }
  const objects = {
    RegisterPayload: {
      plans: {
        user($obj: any) {
          const $userId = access($obj, 'userId')
          return userResource.get({ id: $userId })
        },
      },
    },
    LoginPayload: {
      plans: {
        user($obj: any) {
          const $userId = access($obj, 'userId')
          return userResource.get({ id: $userId })
        },
      },
    },
    Mutation: {
      plans: {
        // Register mutation: create user and session
        register(_obj: any, fieldArgs: any) {
          const $input = fieldArgs.getRaw('input')
          const $rootPgPool = grafastContextStep().get('rootPgPool')
          const $loginFn = grafastContextStep().get('login')
          const $pgSettings = grafastContextStep().get('pgSettings')

          const $result = sideEffect(
            list([$rootPgPool, $loginFn, $pgSettings, $input]),
            async ([rootPool, loginFn, pgSettings, input]: any) => {
              try {
                if (!rootPool)
                  throw new Error('rootPgPool is not defined')
                const {
                  rows: [details],
                } = await rootPool.query(
                  `
                    with new_user as (
                      select users.* from app_private.really_create_user(
                        username => $1,
                        email => $2,
                        email_is_verified => false,
                        name => $3,
                        avatar_url => $4,
                        password => $5
                      ) users where not (users is null)
                    ), new_session as (
                      insert into app_private.sessions (user_id)
                      select id from new_user
                      returning *
                    )
                    select new_user.id as user_id, new_session.uuid as session_id
                    from new_user, new_session
                  `,
                  [input.username, input.email, input.name, input.avatarUrl, input.password],
                )

                if (!details || !details.user_id) {
                  throw Object.assign(new Error('Registration failed'), { code: 'FFFFF' })
                }

                if (details.session_id) {
                  if (pgSettings && typeof pgSettings === 'object') {
                    pgSettings['jwt.claims.session_id'] = details.session_id
                  }
                  if (typeof loginFn === 'function') {
                    await loginFn({ secure: { session_id: details.session_id } })
                  }
                }

                return details.user_id
              }
              catch (e: any) {
                const { code } = e || {}
                const safeErrorCodes = [
                  'WEAKP',
                  'LOCKD',
                  'EMTKN',
                  ...Object.keys(ERROR_MESSAGE_OVERRIDES),
                ]
                if (safeErrorCodes.includes(code)) {
                  throw e
                }
                else {
                  console.error('Unrecognised error in PassportLoginPlugin; replacing with sanitized version')
                  console.error(e)
                  throw Object.assign(new Error('Registration failed'), { code })
                }
              }
            },
          )

          return object({ userId: $result })
        },
        // Login mutation: authenticate user and create session
        login(_obj: any, fieldArgs: any) {
          const $input = fieldArgs.getRaw('input')
          const $rootPgPool = grafastContextStep().get('rootPgPool')
          const $loginFn = grafastContextStep().get('login')
          const $pgSettings = grafastContextStep().get('pgSettings')

          const $session = sideEffect(
            list([$rootPgPool, $loginFn, $pgSettings, $input]),
            async ([rootPool, loginFn, pgSettings, input]: any) => {
              try {
                if (!rootPool)
                  throw new Error('rootPgPool is not defined')
                const {
                  rows: [_session],
                } = await rootPool.query(
                  `select sessions.* from app_private.login($1, $2) sessions where not (sessions is null)`,
                  [input.username, input.password],
                )
                if (!_session) {
                  throw Object.assign(new Error('Incorrect username/password'), { code: 'CREDS' })
                }
                if (_session.uuid) {
                  if (pgSettings && typeof pgSettings === 'object') {
                    pgSettings['jwt.claims.session_id'] = _session.uuid
                  }
                  if (typeof loginFn === 'function') {
                    await loginFn({ secure: { session_id: _session.uuid } })
                  }
                }
                return _session.user_id
              }
              catch (err: any) {
                const code = err?.extensions?.code ?? err?.code
                const safeErrorCodes = ['LOCKD', 'CREDS']
                if (safeErrorCodes.includes(code)) {
                  throw err
                }
                else {
                  console.error(err)
                  throw Object.assign(new Error('Login failed'), { code })
                }
              }
            },
          )

          return object({ userId: $session })
        },
        // Logout mutation: end session
        logout(_obj: any, _fieldArgs: any) {
          const $ctx = grafastContextStep()
          return sideEffectWithPgClient(
            userResource.executor,
            list([constant({}), $ctx]),
            async (pgClient: any, [_unused, _ctx]: any) => {
              /*
               * Call logout function and clear session
               */
              await pgClient.query({ text: 'select app_public.logout();' })
              if (typeof _ctx.logout === 'function')
                await _ctx.logout()
              return { success: true }
            },
          )
        },
        // Reset password mutation
        resetPassword(_obj: any, fieldArgs: any) {
          const $input = fieldArgs.getRaw('input')
          const $rootPgPool = grafastContextStep().get('rootPgPool')

          const $result = sideEffect(
            list([$rootPgPool, $input]),
            async ([rootPool, input]: any) => {
              try {
                if (!rootPool)
                  throw new Error('rootPgPool is not defined')
                const {
                  rows: [row],
                } = await rootPool.query(
                  `select app_private.reset_password($1::uuid, $2::text, $3::text) as success`,
                  [input.userId, input.resetToken, input.newPassword],
                )
                return {
                  clientMutationId: input.clientMutationId,
                  success: row?.success,
                }
              }
              catch (err: any) {
                if (!(err instanceof Error))
                  throw new Error(String(err))
                throw err
              }
            },
          )

          return object({
            clientMutationId: access($result, 'clientMutationId'),
            success: access($result, 'success'),
          })
        },
      },
    },
  }
  return {
    typeDefs,
    objects,
  }
})

export default PassportLoginPlugin
