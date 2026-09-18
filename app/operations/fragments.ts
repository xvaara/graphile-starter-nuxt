import { graphql } from '~/graphql'

export const CreatedOrganizationFragment = graphql(/* GraphQL */ `
  fragment CreatedOrganization on Organization {
    id
    name
    slug
  }
`)

export const EmailsFormUserFragment = graphql(/* GraphQL */ `
  fragment EmailsForm_User on User {
    id
    userEmails(first: 50) {
      nodes {
        ...EmailsForm_UserEmail
        id
        email
        isVerified
      }
    }
  }
`)

export const EmailsFormUserEmailFragment = graphql(/* GraphQL */ `
  fragment EmailsForm_UserEmail on UserEmail {
    id
    email
    isVerified
    isPrimary
    createdAt
  }
`)

export const OrganizationMembersMembershipFragment = graphql(/* GraphQL */ `
  fragment OrganizationMembers_Membership on OrganizationMembership {
    id
    createdAt
    isOwner
    isBillingContact
    user {
      id
      username
      name
    }
  }
`)

export const OrganizationMembersOrganizationFragment = graphql(/* GraphQL */ `
  fragment OrganizationMembers_Organization on Organization {
    id
    ...OrganizationPage_Organization
    name
    slug
    organizationMemberships(first: 10, offset: $offset, orderBy: [MEMBER_NAME_ASC]) {
      nodes {
        id
        ...OrganizationMembers_Membership
      }
      totalCount
    }
  }
`)

export const OrganizationPageOrganizationFragment = graphql(/* GraphQL */ `
  fragment OrganizationPage_Organization on Organization {
    id
    name
    slug
    currentUserIsOwner
    currentUserIsBillingContact
  }
`)

export const OrganizationPageQueryFragment = graphql(/* GraphQL */ `
  fragment OrganizationPage_Query on Query {
    ...SharedLayout_Query
    organizationBySlug(slug: $slug) {
      id
      ...OrganizationPage_Organization
    }
  }
`)

export const ProfileSettingsFormUserFragment = graphql(/* GraphQL */ `
  fragment ProfileSettingsForm_User on User {
    id
    name
    username
    avatarUrl
  }
`)

export const SharedLayoutQueryFragment = graphql(/* GraphQL */ `
  fragment SharedLayout_Query on Query {
    currentUser {
      id
      ...SharedLayout_User
    }
  }
`)

export const SharedLayoutUserFragment = graphql(/* GraphQL */ `
  fragment SharedLayout_User on User {
    id
    name
    username
    avatarUrl
    isAdmin
    isVerified
    organizationMemberships(first: 20) {
      nodes {
        id
        isOwner
        isBillingContact
        organization {
          id
          name
          slug
        }
      }
    }
  }
`)
