<script setup lang="ts">
import { useMutation } from '@vue/apollo-composable/compat'
import { graphql } from '~/graphql'

definePageMeta({
  layout: 'auth',
  public: true,
})

const toast = useToast()
const router = useRouter()
const route = useRoute()

const userId = computed(() => route.query.userId as string)
const resetToken = computed(() => route.query.token as string)

const state = reactive({
  newPassword: '',
  confirmPassword: '',
})

const ResetPasswordMutation = graphql(/* GraphQL */ `
  mutation ResetPassword(
    $userId: UUID!
    $resetToken: String!
    $newPassword: String!
  ) {
    resetPassword(
      input: {
        userId: $userId
        resetToken: $resetToken
        newPassword: $newPassword
      }
    ) {
      success
    }
  }
`)

const { mutate: resetPassword, loading } = useMutation(ResetPasswordMutation)

const formError = ref<unknown>(null)

async function handleSubmit() {
  formError.value = null
  if (state.newPassword !== state.confirmPassword) {
    formError.value = new Error('Passwords do not match')
    return
  }
  try {
    const result = await resetPassword({
      userId: userId.value,
      resetToken: resetToken.value,
      newPassword: state.newPassword,
    })
    if (result?.data?.resetPassword?.success) {
      toast.add({
        title: 'Password reset successful',
        description: 'Your password has been reset. You can now log in with your new password.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      setTimeout(() => router.push('/login'), 1000)
    }
    else {
      formError.value = result?.error
      toast.add({
        title: 'Reset failed',
        description: result?.error?.message || 'Unknown error',
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
  <div class="w-full max-w-md mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold text-center">
          Reset Password
        </h1>
        <p class="text-gray-500 text-center mt-2">
          Enter your new password
        </p>
      </template>
      <UForm :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="New Password" name="newPassword">
          <UInput v-model="state.newPassword" type="password" placeholder="••••••••" autocomplete="new-password" required />
        </UFormField>
        <UFormField label="Confirm Password" name="confirmPassword">
          <UInput v-model="state.confirmPassword" type="password" placeholder="••••••••" autocomplete="new-password" required />
        </UFormField>
        <UButton type="submit" color="primary" block :loading="loading">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </UButton>
      </UForm>
      <div v-if="formError" class="mt-4 text-red-600 text-center">
        {{ formError instanceof Error ? formError.message : String(formError) }}
      </div>
    </UCard>
  </div>
</template>
