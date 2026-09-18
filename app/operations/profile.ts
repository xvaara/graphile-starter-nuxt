import { graphql } from '~/graphql'

export const SettingsProfileDocument = graphql(/* GraphQL */ `
  query SettingsProfile {
    ...SharedLayout_Query
    currentUser {
      id
      ...ProfileSettingsForm_User
    }
  }
`)
