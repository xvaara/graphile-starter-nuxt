export function userQuery(levels, fragments = false) {
  if (!fragments) {
    let selection = 'username'
    for (let i = 0; i < levels; i++) selection = `organizationMemberships(first:1){nodes{user{${selection}}}}`
    return `{currentUser{${selection}}}`
  }
  const definitions = ['fragment UserFields0 on User { username }']
  for (let i = 1; i <= levels; i++) definitions.push(`fragment UserFields${i} on User { organizationMemberships(first:1){nodes{user{...UserFields${i - 1}}}} }`)
  return `query { currentUser { ... on User { ...UserFields${levels} } } } ${definitions.reverse().join('\n')}`
}

export const schemaShapeQuery = `{
  queryType: __type(name:"Query") { fields { name } }
  mutationType: __type(name:"Mutation") { fields { name } }
  userInput: __type(name:"UpdateUserInput") { inputFields { name } }
}`
