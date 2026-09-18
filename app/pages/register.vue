<script setup lang="ts">
import { useMutation } from '@vue/apollo-composable/compat'
import { graphql } from '~/graphql'

definePageMeta({
  layout: 'auth',
  public: true,
})

const toast = useToast()
const router = useRouter()

const state = reactive({
  username: '',
  password: '',
  email: '',
  name: '',
})

const RegisterMutation = graphql(/* GraphQL */ `
  mutation Register(
    $username: String!
    $password: String!
    $email: String!
    $name: String
  ) {
    register(
      input: {
        username: $username
        password: $password
        email: $email
        name: $name
      }
    ) {
      user {
        id
        username
        name
      }
    }
  }
`)

const { mutate: register, loading } = useMutation(RegisterMutation)

const formError = ref<unknown>(null)

async function handleSubmit() {
  formError.value = null
  try {
    const result = await register({
      username: state.username,
      password: state.password,
      email: state.email,
      name: state.name || null,
    })
    if (result?.data?.register?.user) {
      toast.add({
        title: 'Account created!',
        description: `Welcome ${result.data.register.user.username}! Please check your email to verify your account.`,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      setTimeout(() => router.push('/login'), 1000)
    }
    else {
      formError.value = result?.error
      toast.add({
        title: 'Registration failed',
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
          Create Account
        </h1>
        <p class="text-gray-500 text-center mt-2">
          Join us today
        </p>
      </template>

      <UForm :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="Name" name="name">
          <UInput
            v-model="state.name"
            placeholder="John Doe"
            autocomplete="name"
          />
        </UFormField>

        <UFormField label="Username" name="username">
          <UInput
            v-model="state.username"
            placeholder="your_username"
            autocomplete="username"
            required
          />
        </UFormField>

        <UFormField label="Email" name="email">
          <UInput
            v-model="state.email"
            type="email"
            placeholder="your@email.com"
            autocomplete="email"
            required
          />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput
            v-model="state.password"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
            required
          />
        </UFormField>

        <UAlert v-if="formError" color="error" class="mt-2">
          <template #title>
            Registration failed
          </template>
          <span>
            {{ typeof formError === 'object' && formError && 'message' in formError ? formError.message : String(formError) }}
          </span>
        </UAlert>

        <UButton
          type="submit"
          color="primary"
          block
          :loading="loading"
          class="mt-6"
        >
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </UButton>
      </UForm>

      <template #footer>
        <div class="text-center">
          <span class="text-gray-500">Already have an account? </span>
          <UButton
            variant="link"
            color="primary"
            to="/login"
            class="!p-0"
          >
            Sign in
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
