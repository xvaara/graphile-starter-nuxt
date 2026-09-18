<script setup lang="ts">
import { useMutation, useQuery } from '@vue/apollo-composable/compat'
import { graphql } from '~/graphql'

definePageMeta({ public: false })
const toast = useToast()

const CurrentUserAuthenticationsQuery = graphql(/* GraphQL */ `
  query CurrentUserAuthentications {
    currentUser {
      id
      authentications: userAuthenticationsList {
        id
        service
        identifier
        createdAt
      }
    }
  }
`)

const UnlinkUserAuthenticationMutation = graphql(/* GraphQL */ `
  mutation UnlinkUserAuthentication($id: UUID!) {
    deleteUserAuthentication(input: { id: $id }) {
      user {
        id
        userAuthenticationsList {
          id
          identifier
          service
          createdAt
        }
      }
    }
  }
`)

const { result, loading, error } = useQuery(CurrentUserAuthenticationsQuery)
const { mutate: unlinkAuthentication, loading: deleting } = useMutation(UnlinkUserAuthenticationMutation)

const modalOpen = ref(false)
const selectedId = ref<string | null>(null)

function openModal(id: string) {
  selectedId.value = id
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  selectedId.value = null
}

async function handleUnlink(authId: string) {
  try {
    const response = await unlinkAuthentication({ id: authId })

    if (response?.data?.deleteUserAuthentication?.user) {
      toast.add({
        title: 'Account unlinked',
        description: 'The linked account has been removed.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      closeModal()
    }
    else {
      toast.add({
        title: 'Unlink failed',
        description: response?.error?.message || 'Unknown error',
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
  <div class="max-w-2xl mx-auto py-10">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">
          Linked Accounts
        </h1>
      </template>
      <div v-if="loading">
        Loading...
      </div>
      <div v-else-if="error">
        <UAlert color="error">
          <template #title>
            Error loading accounts
          </template>
          {{ error.message }}
        </UAlert>
      </div>
      <div v-else-if="!result?.currentUser?.authentications?.length" class="text-center py-8 text-gray-500">
        No linked accounts found.
      </div>
      <ul v-else class="space-y-4">
        <li v-for="auth in result.currentUser.authentications" :key="auth.id" class="flex items-center justify-between p-4 border rounded-lg">
          <div class="flex flex-col">
            <span class="font-medium">{{ auth.service }}</span>
            <span class="text-sm text-gray-500">{{ auth.identifier }}</span>
            <span class="text-xs text-gray-400">Added {{ new Date(auth.createdAt).toLocaleString() }}</span>
          </div>
          <UButton color="error" size="sm" @click="openModal(auth.id)">
            Unlink
          </UButton>
        </li>
      </ul>
      <UModal v-model="modalOpen" :prevent-close="deleting">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Confirm Account Unlink
            </h3>
          </template>
          <p class="mb-4">
            Are you sure you want to unlink this account? You won't be able to log in with it anymore.
            Please make sure your email is verified and you have another way to access your account.
          </p>
          <template #footer>
            <div class="flex gap-2 justify-end">
              <UButton color="neutral" :disabled="deleting" @click="closeModal">
                Cancel
              </UButton>
              <UButton color="error" :loading="deleting" @click="selectedId && handleUnlink(selectedId)">
                {{ deleting ? 'Unlinking...' : 'Unlink Account' }}
              </UButton>
            </div>
          </template>
        </UCard>
      </UModal>
    </UCard>
  </div>
</template>
