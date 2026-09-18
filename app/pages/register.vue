<script setup>
definePageMeta({
  layout: 'auth',
})

const { refetchUser } = useAuth()

// TODO: Add a loading state
const loading = ref(false)
const { mutate: register } = useRegisterMutation()

const toast = useToast()

const state = reactive({
  name: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const fieldErrors = reactive({
  name: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const validatePasswords = computed(() => {
  if (!state.confirmPassword)
    return true
  return state.password === state.confirmPassword
})

const validateUsername = computed(() => {
  if (!state.username)
    return true
  if (state.username.length < 2 || state.username.length > 24)
    return false
  // check that username starts with a letter
  if (!/^[a-z]|$/i.test(state.username))
    return false
  // Checks that underscores aren't adjacent (except at the end)
  if (!/^(?:[^_]|_[^_]|_$)*$/.test(state.username))
    return false
  // Ensures username only contains alphanumeric characters and underscores
  if (!/^\w*$/.test(state.username))
    return false
  return true
})

async function handleSubmit() {
  // Reset field errors
  Object.keys(fieldErrors).forEach(key => fieldErrors[key] = '')
  try {
    if (!validatePasswords.value) {
      fieldErrors.confirmPassword = 'Passwords do not match'
      toast.add({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
      return
    }

    if (!validateUsername.value) {
      fieldErrors.username = 'Please provide a valid username'
      toast.add({
        title: 'Invalid username',
        description: 'Please provide a valid username',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error',
      })
      return
    }

    const result = await register({
      name: state.name,
      username: state.username,
      email: state.email,
      password: state.password,
    })
    if (result.data.register?.user) {
      toast.add({
        title: 'Account created successfully',
        description: `Welcome, ${result.data.register.user.name}!`,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      await refetchUser()
      navigateTo('/')
    }
    else {
      if (result.error) {
        const code = getCodeFromError(result.error)
        const exception = getExceptionFromError(result.error)
        console.error('Registration error:', code, exception)
        const fields = exception?.extensions?.fields ?? exception?.fields
        if (code === 'WEAKP') {
          fieldErrors.password = 'The server believes this passphrase is too weak, please make it stronger'
        }
        else if (code === 'EMTKN') {
          fieldErrors.email = 'An account with this email address has already been registered, consider using the \'Forgot passphrase\' function.'
        }
        else if (code === 'NUNIQ' && fields && fields[0] === 'username') {
          fieldErrors.username = 'An account with this username has already been registered, please try a different username.'
        }
        else if (code === '23514') {
          fieldErrors.username = 'This username is not allowed; usernames must be between 2 and 24 characters long (inclusive), must start with a letter, and must contain only alphanumeric characters and underscores.'
        }
        else {
          toast.add({
            title: 'Registration failed',
            description: `An error occurred during registration: ${result.error.message}`,
            icon: 'i-heroicons-exclamation-circle',
            color: 'error',
          })
        }
      }
      else {
        toast.add({
          title: 'Registration failed',
          description: 'An unknown error occurred during registration',
          icon: 'i-heroicons-exclamation-circle',
          color: 'error',
        })
      }
    }
  }
  catch (e) {
    console.error('Registration error:', e)
    toast.add({
      title: 'An error occurred',
      description: `Please try again later: ${e.message}`,
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
        <UFormField label="Name" name="name" :error="fieldErrors.name">
          <UInput
            v-model="state.name"
            placeholder="John Doe"
            icon="i-heroicons-user"
            autocomplete="name"
            required
          />
        </UFormField>

        <UFormField label="Username" name="username" :error="fieldErrors.username || (!validateUsername && state.username ? 'Invalid username' : undefined)">
          <UInput
            v-model="state.username"
            placeholder="your_username"
            icon="i-heroicons-identification"
            autocomplete="username"
            required
          />
        </UFormField>

        <UFormField label="Email" name="email" :error="fieldErrors.email">
          <UInput
            v-model="state.email"
            type="email"
            placeholder="your@email.com"
            icon="i-heroicons-envelope"
            autocomplete="email"
            required
          />
        </UFormField>

        <UFormField label="Password" name="password" :error="fieldErrors.password">
          <UInput
            v-model="state.password"
            type="password"
            placeholder="••••••••"
            icon="i-heroicons-lock-closed"
            autocomplete="new-password"
            required
          />
        </UFormField>

        <UFormField
          label="Confirm Password"
          name="confirmPassword"
          :error="fieldErrors.confirmPassword || (!validatePasswords && state.confirmPassword ? 'Passwords do not match' : undefined)"
        >
          <UInput
            v-model="state.confirmPassword"
            type="password"
            placeholder="••••••••"
            icon="i-heroicons-lock-closed"
            autocomplete="new-password"
            required
          />
        </UFormField>

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
