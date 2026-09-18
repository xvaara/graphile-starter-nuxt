<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })

const toast = useToast()
const state = reactive({ email: '' })
const { mutate: forgotPassword, loading } = useForgotPasswordMutation()
const success = ref(false)

async function handleSubmit() {
  try {
    const result = await forgotPassword({ email: state.email })
    if (!result) {
      toast.add({
        title: 'An error occurred',
        description: 'Please try again later',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
    }
    else if (!result.error) {
      success.value = true
      toast.add({
        title: 'Check your email',
        description: `We've sent a password reset link to ${state.email}.`,
        icon: 'i-heroicons-envelope',
        color: 'success',
      })
    }
    else {
      toast.add({
        title: 'Request failed',
        description: result?.error?.message || 'An error occurred',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
    }
  }
  catch (e: unknown) {
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
          Forgot Password
        </h1>
        <p class="text-gray-500 text-center mt-2">
          Enter your email to receive a reset link
        </p>
      </template>
      <UForm :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="Email" name="email">
          <UInput
            v-model="state.email"
            type="email"
            placeholder="your@email.com"
            icon="i-heroicons-envelope"
            autocomplete="email"
            required
          />
        </UFormField>
        <UButton type="submit" color="primary" block :loading="loading">
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </UButton>
      </UForm>
      <template #footer>
        <div class="text-center">
          <UButton variant="link" color="primary" to="/login" class="!p-0">
            Back to login
          </UButton>
        </div>
      </template>
      <div v-if="success" class="mt-4 text-green-600 text-center">
        Please check your email for a reset link.
      </div>
    </UCard>
  </div>
</template>
