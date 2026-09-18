<script setup lang="ts">
import { useMutation, useQuery } from 'villus'
import { graphql } from '~/graphql'

const InvitationDetailDocument = graphql(/* GraphQL */ `
  query InvitationDetail($id: UUID!, $code: String) {
    ...SharedLayout_Query
    organizationForInvitation(invitationId: $id, code: $code) {
      id
      name
      slug
    }
  }
`)

const AcceptOrganizationInviteDocument = graphql(/* GraphQL */ `
  mutation AcceptOrganizationInvite($id: UUID!, $code: String) {
    acceptInvitationToOrganization(input: {invitationId: $id, code: $code}) {
      clientMutationId
    }
  }
`)

const route = useRoute()
const router = useRouter()
const toast = useToast()

const state = reactive({
  id: route.query.id as string || '',
  code: route.query.code as string || ''
})

const { data, isFetching: fetching, error } = await useQuery({ fetchOnMount: false, client: useNuxtApp().$villus, query: InvitationDetailDocument, variables: { id: state.id, code: state.code }  })
const { execute: acceptInvite, isFetching: accepting } = useMutation(AcceptOrganizationInviteDocument, { client: useNuxtApp().$villus, clearCacheTags: ['organization'] })
const accepted = ref(false)

const handleAccept = async () => {
  try {
    const result = await acceptInvite({ id: state.id, code: state.code })
    if (result.data?.acceptInvitationToOrganization) {
      accepted.value = true
      toast.add({
        title: 'Invitation accepted',
        description: 'You have joined the organization.',
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
      setTimeout(() => router.push('/o/' + data.value?.organizationForInvitation?.slug), 1000)
    } else {
      toast.add({
        title: 'Accept failed',
        description: result.error?.message || 'Unknown error',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
    }
  } catch (e) {
    toast.add({
      title: 'An error occurred',
      description: e instanceof Error ? e.message : String(e),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold text-center">Accept Invitation</h1>
      </template>
      <div v-if="fetching" class="text-center py-8">
        <span class="i-heroicons-arrow-path animate-spin text-2xl" /> Loading invitation...
      </div>
      <div v-else-if="error" class="text-red-500 text-center py-8">
        {{ error.message }}
      </div>
      <div v-else-if="accepted" class="text-green-600 text-center py-8">
        Invitation accepted! Redirecting...
      </div>
      <div v-else>
        <div class="mb-4 text-center">
          <div class="font-bold">Organization:</div>
          <div>{{ data?.organizationForInvitation?.name || 'Unknown' }}</div>
        </div>
        <UButton color="primary" block :loading="accepting" @click="handleAccept">
          Accept Invitation
        </UButton>
      </div>
    </UCard>
  </div>
</template>
