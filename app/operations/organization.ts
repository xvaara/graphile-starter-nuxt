import type { ResultOf } from '@graphql-typed-document-node/core'
import { getFragmentData, graphql } from '~/graphql'
import { OrganizationPageOrganizationFragment, OrganizationPageQueryFragment } from './fragments'

export const OrganizationPageDocument = graphql(/* GraphQL */ `
  query OrganizationPage($slug: String!) {
    ...OrganizationPage_Query
  }
`)

export function getOrganizationPage(data: ResultOf<typeof OrganizationPageDocument> | undefined) {
  const query = getFragmentData(OrganizationPageQueryFragment, data)
  return getFragmentData(OrganizationPageOrganizationFragment, query?.organizationBySlug)
}
