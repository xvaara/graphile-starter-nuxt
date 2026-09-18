import type { SQL } from 'postgraphile/pg-sql2'
import { addPgTableOrderBy, orderByAscDesc } from 'postgraphile/utils'

export default addPgTableOrderBy(
  { schemaName: 'app_public', tableName: 'organization_memberships' },
  (build) => {
    const {
      sql,
      input: {
        pgRegistry: { pgResources },
      },
    } = build
    const usersResource = Object.values(pgResources).find(
      s =>
        !s.parameters
        && s.extensions?.pg?.schemaName === 'app_public'
        && s.extensions.pg.name === 'users',
    )
    if (!usersResource) {
      throw new Error(`Couldn't find the source for app_public.users`)
    }
    const nameCodec = usersResource.codec.attributes?.name?.codec
    if (!nameCodec)
      throw new Error('Missing name codec for app_public.users')
    const sqlIdentifier = sql.identifier(Symbol('member'))
    return orderByAscDesc('MEMBER_NAME', ($organizationMemberships) => {
      $organizationMemberships.join({
        type: 'inner',
        from: usersResource.from as SQL,
        alias: sqlIdentifier,
        conditions: [
          sql`${sqlIdentifier}.id = ${$organizationMemberships.alias}.user_id`,
        ],
      })
      return {
        fragment: sql`${sqlIdentifier}.name`,
        codec: nameCodec,
      }
    })
  },
)
