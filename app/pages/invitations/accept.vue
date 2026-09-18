<script setup lang="ts">
import { useMutation, useQuery } from '@vue/apollo-composable/compat'
import { graphql } from '~/graphql'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const AcceptOrganizationInviteMutation = graphql(`
  mutation AcceptOrganizationInvite($id: UUID!, $code: String) {
    acceptInvitationToOrganization(input: { invitationId: $id, code: $code }) {
      clientMutationId
    }
  }
`)

const InvitationDetailQuery = graphql(`
  query InvitationDetail($id: UUID!, $code: String) {
    ...SharedLayout_Query
    organizationForInvitation(invitationId: $id, code: $code) {
      id
      name
      slug
    }
  }
`)

const id = computed(() => route.query.id as string)
const code = computed(() => route.query.code as string)

const { result, loading, error } = useQuery(InvitationDetailQuery, () => ({
  id: id.value,
  code: code.value,
}))

const { mutate: acceptInvitation, loading: accepting } = useMutation(AcceptOrganizationInviteMutation)
const accepted = ref(false)

async function handleAccept() {
  try {
    const mutationResult = await acceptInvitation({ id: id.value, code: code.value })
    if (mutationResult?.data?.acceptInvitationToOrganization) {
      accepted.value = true
      toast.add({
        title: 'Invitation accepted',
        description: 'You have successfully joined the organization.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      const slug = result.value?.organizationForInvitation?.slug
      if (slug)
        setTimeout(() => router.push(`/o/${slug}`), 1000)
    }
    else {
      toast.add({
        title: 'Accept failed',
        description: mutationResult?.error?.message || 'Unknown error',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
    }
  }
  catch (e) {
    toast.add({
      title: 'An error occurred',
      description: e instanceof Error ? e.message : String(e),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold text-center">
          Accept Invitation
        </h1>
      </template>
      <div v-if="loading" class="text-center py-8">
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
          <div class="font-bold">
            Organization:
          </div>
          <div>{{ result?.organizationForInvitation?.name || 'Unknown' }}</div>
        </div>
        <UButton color="primary" block :loading="accepting" @click="handleAccept">
          Accept Invitation
        </UButton>
      </div>
    </UCard>
  </div>
</template>
