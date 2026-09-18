<script setup lang="ts">
import { useMutation, useQuery } from 'villus'
import { graphql } from '~/graphql'

const SettingsPasswordDocument = graphql(/* GraphQL */ `
  query SettingsPassword {
    currentUser {
      id
      hasPassword
      userEmails(first: 1, condition: {isPrimary: true}) {
        nodes {
          id
          email
        }
      }
    }
  }
`)

const ChangePasswordDocument = graphql(/* GraphQL */ `
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changePassword(input: {oldPassword: $oldPassword, newPassword: $newPassword}) {
      success
    }
  }
`)

definePageMeta({ public: false })

const { isFetching: loading, error } = await useQuery({ fetchOnMount: false, client: useNuxtApp().$villus, query: SettingsPasswordDocument })
const oldPassword = ref('')
const newPassword = ref('')
const changeError = ref('')
const changeSuccess = ref(false)
const changing = ref(false)

const { execute: changePasswordMutation } = useMutation(ChangePasswordDocument, { client: useNuxtApp().$villus })
const changePassword = async () => {
  changeError.value = ''
  changeSuccess.value = false
  changing.value = true
  try {
    await changePasswordMutation({ oldPassword: oldPassword.value, newPassword: newPassword.value })
    changeSuccess.value = true
    oldPassword.value = ''
    newPassword.value = ''
  } catch (e: Error | unknown) {
    changeError.value = e instanceof Error ? e.message : String(e)
  }
  changing.value = false
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-10">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Change Passphrase</h1>
      </template>
      <div v-if="loading">Loading...</div>
      <div v-else-if="error">Error loading security settings</div>
      <form v-else class="space-y-4" @submit.prevent="changePassword">
        <div>
          <label class="block font-medium mb-1">Old passphrase</label>
          <UInput v-model="oldPassword" type="password" required />
        </div>
        <div>
          <label class="block font-medium mb-1">New passphrase</label>
          <UInput v-model="newPassword" type="password" required />
        </div>
        <div v-if="changeError" class="text-red-500">{{ changeError }}</div>
        <div v-if="changeSuccess" class="text-green-600">Password changed!</div>
        <UButton type="submit" color="primary" :loading="changing">Change Passphrase</UButton>
      </form>
    </UCard>
  </div>
</template>
