<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const state = reactive({
  userId: route.query.user_id as string || '',
  token: route.query.token as string || '',
  password: '',
  confirm: '',
})

const { mutate: resetPassword, loading } = useResetPasswordMutation()
const success = ref(false)

const passwordsMatch = computed(() => state.password && state.password === state.confirm)

async function handleSubmit() {
  if (!passwordsMatch.value) {
    toast.add({
      title: 'Passwords do not match',
      description: 'Please make sure your passwords match.',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
    return
  }
  try {
    const result = await resetPassword({ userId: state.userId, token: state.token, password: state.password })
    if (result && result.data?.resetPassword?.success) {
      success.value = true
      toast.add({
        title: 'Password reset',
        description: 'Your password has been reset. You can now log in.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      setTimeout(() => router.push('/login'), 2000)
    }
    else {
      toast.add({
        title: 'Reset failed',
        description: result?.error?.message || 'Invalid or expired token.',
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
          Reset Password
        </h1>
        <p class="text-gray-500 text-center mt-2">
          Enter your new password
        </p>
      </template>
      <UForm :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="Reset Token" name="token">
          <UInput v-model="state.token" type="text" placeholder="Reset token" required />
        </UFormField>
        <UFormField label="New Password" name="password">
          <UInput v-model="state.password" type="password" placeholder="••••••••" autocomplete="new-password" required />
        </UFormField>
        <UFormField label="Confirm Password" name="confirm">
          <UInput v-model="state.confirm" type="password" placeholder="••••••••" autocomplete="new-password" required />
        </UFormField>
        <UButton type="submit" color="primary" block :loading="loading">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </UButton>
      </UForm>
      <div v-if="success" class="mt-4 text-green-600 text-center">
        Password reset! Redirecting to login...
      </div>
    </UCard>
  </div>
</template>
