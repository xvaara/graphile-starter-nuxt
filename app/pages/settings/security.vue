<script setup lang="ts">
import { useMutation, useQuery } from '@vue/apollo-composable/compat'
import { graphql } from '~/graphql'

definePageMeta({ public: false })
const toast = useToast()

const SettingsPasswordQuery = graphql(/* GraphQL */ `
  query SettingsPassword {
    currentUser {
      id
      hasPassword
      userEmails(first: 50) {
        nodes {
          id
          email
        }
      }
    }
  }
`)

const ChangePasswordMutation = graphql(/* GraphQL */ `
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changePassword(input: { oldPassword: $oldPassword, newPassword: $newPassword }) {
      success
    }
  }
`)

const { result: _result, loading, error: _error } = useQuery(SettingsPasswordQuery)
const { mutate: changePassword, loading: changing } = useMutation(ChangePasswordMutation)

const state = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const formError = ref<unknown>(null)

async function handleSubmit() {
  formError.value = null

  if (state.newPassword !== state.confirmPassword) {
    formError.value = new Error('New passwords do not match')
    return
  }

  if (state.newPassword.length < 8) {
    formError.value = new Error('Password must be at least 8 characters long')
    return
  }

  try {
    const response = await changePassword({
      oldPassword: state.oldPassword,
      newPassword: state.newPassword,
    })

    if (response?.data?.changePassword?.success) {
      toast.add({
        title: 'Password changed',
        description: 'Your password has been successfully updated.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })

      // Clear the form
      state.oldPassword = ''
      state.newPassword = ''
      state.confirmPassword = ''
    }
    else {
      formError.value = response?.error || new Error('Failed to change password')
      toast.add({
        title: 'Password change failed',
        description: response?.error?.message || 'Unknown error',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
    }
  }
  catch (e) {
    formError.value = e
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
          Change Passphrase
        </h1>
      </template>
      <div v-if="loading">
        Loading...
      </div>
      <div v-else-if="formError" class="mb-4">
        <UAlert color="error">
          <template #title>
            Error
          </template>
          {{ formError instanceof Error ? formError.message : String(formError) }}
        </UAlert>
      </div>
      <UForm v-if="!loading" :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="Old passphrase" name="oldPassword">
          <UInput v-model="state.oldPassword" type="password" required />
        </UFormField>
        <UFormField label="New passphrase" name="newPassword">
          <UInput v-model="state.newPassword" type="password" required />
        </UFormField>
        <UFormField label="Confirm passphrase" name="confirmPassword">
          <UInput v-model="state.confirmPassword" type="password" required />
        </UFormField>
        <UButton type="submit" color="primary" :loading="changing">
          {{ changing ? 'Changing...' : 'Change Passphrase' }}
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
