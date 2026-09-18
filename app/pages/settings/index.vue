<script setup lang="ts">
import { useMutation } from 'villus'
import { graphql } from '~/graphql'

const UpdateUserDocument = graphql(/* GraphQL */ `
  mutation UpdateUser($id: UUID!, $patch: UserPatch!) {
    updateUser(input: {id: $id, patch: $patch}) {
      clientMutationId
      user {
        id
        name
        username
      }
    }
  }
`)

const { user } = await useAuth()

definePageMeta({
  name: 'Settings-profile-index'
})

const form = reactive({
  name: user.value?.name || '',
  username: user.value?.username || ''
})

const { execute: updateProfile, error } = useMutation(UpdateUserDocument, { client: useNuxtApp().$villus })

async function handleSubmit() {
  if (!user.value) return
  try {
    await updateProfile({
      id: user.value.id,
      patch: {
        name: form.name,
        username: form.username
      }
    })
    const toast = useToast()
    toast.add({
      title: 'Profile Updated',
      description: 'Your profile has been successfully updated',
      icon: 'i-heroicons-check-circle',
      color: 'success'
    })
  } catch (e) {
    console.error('Error updating profile:', e)
  }
}
</script>

<template>
  <div class="mt-8">
    <h2 class="text-xl font-semibold mb-4">Edit Profile</h2>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <UFormField label="Name" name="name">
        <UInput v-model="form.name" placeholder="Your name" />
      </UFormField>

      <UFormField label="Username" name="username">
        <UInput v-model="form.username" placeholder="Your username" />
      </UFormField>

      <div v-if="error" class="text-red-500 text-sm mt-2">
        {{ error.message }}
      </div>

      <UButton type="submit" color="primary">
        Save Changes
      </UButton>
    </form>
  </div>
</template>
