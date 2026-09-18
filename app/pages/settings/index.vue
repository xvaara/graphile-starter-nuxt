<script setup lang="ts">
import { useMutation } from '@vue/apollo-composable/compat'
import { useAsyncQuery } from '~/composables/useAsyncQuery'
import { graphql, useFragment } from '~/graphql'

definePageMeta({
  name: 'Settings-profile-index',
})

const ProfileSettingsFormUserFragment = graphql(`
  fragment ProfileSettingsForm_User on User {
    id
    name
    username
  }
`)

const SettingsProfileQuery = graphql(`
  query SettingsProfile {
    currentUser {
      id
      ...ProfileSettingsForm_User
    }
  }
`)

// Define the update user mutation using the client preset approach
const updateUserMutation = graphql(`
  mutation UpdateUser($id: UUID!, $patch: UserPatch!) {
    updateUser(input: { id: $id, patch: $patch }) {
      clientMutationId
      user {
        id
        name
        username
      }
    }
  }
`)

const { result, error, promise } = useAsyncQuery(SettingsProfileQuery)

const data = await promise
const user = computed(() => {
  if (!result.value?.currentUser)
    return null
  return useFragment(ProfileSettingsFormUserFragment, result.value.currentUser)
})

const form = reactive({
  name: data.currentUser ? useFragment(ProfileSettingsFormUserFragment, data.currentUser).name || '' : '',
  username: data.currentUser ? useFragment(ProfileSettingsFormUserFragment, data.currentUser).username || '' : '',
})

const { mutate: updateProfile } = useMutation(updateUserMutation)

async function handleSubmit() {
  if (!user.value)
    return
  try {
    await updateProfile({
      id: user.value.id,
      patch: {
        name: form.name,
        username: form.username,
      },
    })
    const toast = useToast()
    toast.add({
      title: 'Profile Updated',
      description: 'Your profile has been successfully updated',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  }
  catch (e) {
    console.error('Error updating profile:', e)
  }
}
</script>

<template>
  <div class="mt-8">
    <h2 class="text-xl font-semibold mb-4">
      Edit Profile
    </h2>

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
