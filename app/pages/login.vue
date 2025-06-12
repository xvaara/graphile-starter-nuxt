<script setup lang="ts">
import { useMutation } from '@vue/apollo-composable'
import { graphql } from '~/graphql'

definePageMeta({
  layout: 'auth',
  public: true,
})

const toast = useToast()
const route = useRoute()
const router = useRouter()

const state = reactive({
  username: '',
  password: '',
})

// Get returnTo from query and validate it's internal
const returnTo = computed(() => {
  const to = route.query.returnTo?.toString()
  // Only allow internal URLs (starting with /)
  return to?.startsWith('/') ? to : '/'
})

const { restartSession } = useAuth()

const LoginMutation = graphql(/* GraphQL */ `
  mutation Login($username: String!, $password: String!) {
    login(input: { username: $username, password: $password }) {
      user {
        id
        username
        name
      }
    }
  }
`)

const { mutate: login, loading } = useMutation(LoginMutation)

const formError = ref<unknown>(null)

async function handleSubmit() {
  formError.value = null
  try {
    const result = await login({
      username: state.username,
      password: state.password,
    })
    if (result?.data?.login?.user) {
      toast.add({
        title: 'Welcome back!',
        description: `You're now logged in as ${result.data.login.user.username}`,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      await restartSession()
      setTimeout(() => router.push(returnTo.value), 1000)
    }
    else {
      formError.value = result?.errors?.[0]
      toast.add({
        title: 'Login failed',
        description: result?.errors?.[0]?.message || 'Unknown error',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
    }
  }
  catch (e) {
    formError.value = e
    console.error(e)
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
          Welcome Back
        </h1>
        <p class="text-gray-500 text-center mt-2">
          Sign in to your account
        </p>
      </template>

      <UForm :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="Email or username" name="username">
          <UInput
            v-model="state.username"
            type="text"
            placeholder="username"
            autocomplete="username"
            required
          />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput
            v-model="state.password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </UFormField>

        <div class="flex justify-end mb-2">
          <UButton
            variant="link"
            color="primary"
            size="xs"
            to="/forgot"
            class="!p-0"
          >
            Forgot password?
          </UButton>
        </div>

        <UButton
          type="submit"
          color="primary"
          block
          :loading="loading"
        >
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </UButton>
      </UForm>

      <template #footer>
        <div class="text-center">
          <span class="text-gray-500">Don't have an account? </span>
          <UButton
            variant="link"
            color="primary"
            to="/register"
            class="!p-0"
          >
            Create one
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
