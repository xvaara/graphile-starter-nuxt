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

const userEmailId = computed(() => route.query.id as string)
const token = computed(() => route.query.token as string)

const VerifyEmailMutation = graphql(/* GraphQL */ `
  mutation VerifyEmail($userEmailId: UUID!, $token: String!) {
    verifyEmail(input: { userEmailId: $userEmailId, token: $token }) {
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

const { mutate: verifyEmail, loading } = useMutation(VerifyEmailMutation)

const success = ref(false)
const formError = ref<unknown>(null)

// Auto-verify on page load if we have the required parameters
onMounted(async () => {
  if (userEmailId.value && token.value) {
    await handleVerify()
  }
})

async function handleVerify() {
  formError.value = null
  try {
    const result = await verifyEmail({
      userEmailId: userEmailId.value,
      token: token.value,
    })
    if (result?.data?.verifyEmail?.success) {
      success.value = true
      toast.add({
        title: 'Email verified!',
        description: 'Your email address has been successfully verified.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      setTimeout(() => router.push('/'), 2000)
    }
    else {
      formError.value = result?.error
      toast.add({
        title: 'Verification failed',
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
          Email Verification
        </h1>
        <p class="text-gray-500 text-center mt-2">
          Verifying your email address...
        </p>
      </template>
      <div class="text-center py-8">
        <div v-if="loading" class="space-y-4">
          <span class="i-heroicons-arrow-path animate-spin text-4xl text-blue-500" />
          <p>Verifying your email...</p>
        </div>
        <div v-else-if="success" class="space-y-4">
          <span class="i-heroicons-check-circle text-4xl text-green-500" />
          <p class="text-green-600">
            Email verified successfully!
          </p>
          <p class="text-sm text-gray-500">
            Redirecting you to the homepage...
          </p>
        </div>
        <div v-else-if="formError" class="space-y-4">
          <span class="i-heroicons-exclamation-circle text-4xl text-red-500" />
          <p class="text-red-600">
            Verification failed
          </p>
          <p class="text-sm text-gray-500">
            {{ formError instanceof Error ? formError.message : String(formError) }}
          </p>
          <UButton color="primary" to="/login">
            Go to Login
          </UButton>
        </div>
        <div v-else class="space-y-4">
          <span class="i-heroicons-question-mark-circle text-4xl text-gray-400" />
          <p class="text-gray-600">
            Missing verification parameters
          </p>
          <UButton color="primary" to="/login">
            Go to Login
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
