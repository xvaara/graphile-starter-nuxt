<script setup lang="ts">
import { useMutation } from '@urql/vue'
import { graphql } from '~/graphql'

const VerifyEmailDocument = graphql(/* GraphQL */ `
  mutation VerifyEmail($id: UUID!, $token: String!) {
    verifyEmail(input: {userEmailId: $id, token: $token}) {
      success
      query {
        currentUser {
          id
          isVerified
        }
      }
    }
  }
`)

definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const toast = useToast()

const state = reactive({
  id: route.query.id as string || '',
  token: route.query.token as string || ''
})

const { executeMutation: verifyEmail, fetching: loading } = useMutation(VerifyEmailDocument)
const success = ref(false)

const handleSubmit = async () => {
  try {
    const result = await verifyEmail({ id: state.id, token: state.token })
    if (result.data?.verifyEmail?.success) {
      success.value = true
      toast.add({
        title: 'Email verified',
        description: 'Your email has been verified.',
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
      setTimeout(() => {
        navigateTo('/')
      }, 3000)
    } else {
      toast.add({
        title: 'Verification failed',
        description: result.error?.message || 'Invalid or expired token.',
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
        <h1 class="text-2xl font-bold text-center">Verify Email</h1>
        <p class="text-gray-500 text-center mt-2">Enter your verification code</p>
      </template>
      <UForm :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="Verification Token" name="token">
          <UInput v-model="state.token" type="text" placeholder="Verification token" required />
        </UFormField>
        <UButton type="submit" color="primary" block :loading="loading">
          {{ loading ? 'Verifying...' : 'Verify Email' }}
        </UButton>
      </UForm>
      <div v-if="success" class="mt-4 text-green-600 text-center">
        Email verified!
      </div>
    </UCard>
  </div>
</template>
