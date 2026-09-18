<script setup lang="ts">
import { useQuery } from '@vue/apollo-composable/compat'
import { graphql, useFragment } from '~/graphql'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Define the OrganizationPage_Organization fragment
const OrganizationPageOrganizationFragment = graphql(`
  fragment OrganizationPage_Organization on Organization {
    id
    name
    slug
    currentUserIsOwner
    currentUserIsBillingContact
  }
`)

// Define the OrganizationPage_Query fragment
const OrganizationPageQueryFragment = graphql(`
  fragment OrganizationPage_Query on Query {
    ...SharedLayout_Query
    organizationBySlug(slug: $slug) {
      id
      ...OrganizationPage_Organization
    }
  }
`)

// Define the OrganizationPage query
const OrganizationPageQuery = graphql(`
  query OrganizationPage($slug: String!) {
    ...OrganizationPage_Query
  }
`)

const { result, loading, error } = useQuery(OrganizationPageQuery, { slug: slug.value })

// Use fragment masking to access the query data and then the organization data
const queryData = computed(() => {
  if (!result.value)
    return null
  return useFragment(OrganizationPageQueryFragment, result.value)
})

const organization = computed(() => {
  if (!queryData.value?.organizationBySlug)
    return null
  return useFragment(OrganizationPageOrganizationFragment, queryData.value.organizationBySlug)
})

// Throw 404 error if organization not found, but only after the query completes
watchEffect(() => {
  console.log('onResult', result.value, loading.value, error.value)
  if (!loading.value && result.value && !queryData.value?.organizationBySlug) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organization Not Found',
      message: 'The organization you are looking for does not exist.',
      fatal: true,
    })
  }
})
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold text-center">
          {{ organization?.name || slug }}
        </h1>
      </template>
      <div v-if="loading" class="text-center py-8">
        <span class="i-heroicons-arrow-path animate-spin text-2xl" /> Loading organization...
      </div>
      <div v-else-if="error" class="text-red-500 text-center py-8">
        {{ error.message }}
      </div>
      <div v-else>
        <div class="mb-4 text-center">
          <div class="font-bold">
            Dashboard
          </div>
          <UButton
            v-if="organization?.currentUserIsOwner"
            color="primary"
            class="mt-4"
            :to="`/o/${slug}/settings`"
          >
            Organization Settings
          </UButton>
          <!-- Add more organization details here -->
        </div>
      </div>
    </UCard>
  </div>
</template>
