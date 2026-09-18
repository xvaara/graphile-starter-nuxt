<script setup lang="ts">
import { useMutation, useQuery } from '@vue/apollo-composable/compat'
import { graphql, useFragment } from '~/graphql'

definePageMeta({ public: false })
const toast = useToast()

const EmailsFormUserEmailFragment = graphql(/* GraphQL */ `
  fragment EmailsForm_UserEmail on UserEmail {
    id
    email
    isVerified
    isPrimary
    createdAt
  }
`)

const EmailsFormUserFragment = graphql(/* GraphQL */ `
  fragment EmailsForm_User on User {
    id
    userEmails(first: 50) {
      nodes {
        ...EmailsForm_UserEmail
        id
        email
        isVerified
      }
    }
  }
`)

const SettingsEmailsQuery = graphql(/* GraphQL */ `
  query SettingsEmails {
    ...SharedLayout_Query
    currentUser {
      id
      isVerified
      ...EmailsForm_User
    }
  }
`)

const AddEmailMutation = graphql(/* GraphQL */ `
  mutation AddEmail($email: String!) {
    createUserEmail(input: { userEmail: { email: $email } }) {
      user {
        id
        userEmails(first: 50) {
          nodes {
            id
            email
            isVerified
            isPrimary
            createdAt
          }
        }
      }
    }
  }
`)

const DeleteEmailMutation = graphql(/* GraphQL */ `
  mutation DeleteEmail($emailId: UUID!) {
    deleteUserEmail(input: { id: $emailId }) {
      user {
        id
        userEmails(first: 50) {
          nodes {
            id
            email
            isVerified
            isPrimary
            createdAt
          }
        }
      }
    }
  }
`)

const MakeEmailPrimaryMutation = graphql(/* GraphQL */ `
  mutation MakeEmailPrimary($emailId: UUID!) {
    makeEmailPrimary(input: { emailId: $emailId }) {
      user {
        id
        userEmails(first: 50) {
          nodes {
            id
            isPrimary
          }
        }
      }
    }
  }
`)

const ResendEmailVerificationMutation = graphql(/* GraphQL */ `
  mutation ResendEmailVerification($emailId: UUID!) {
    resendEmailVerificationCode(input: { emailId: $emailId }) {
      success
    }
  }
`)

const { result, loading, error } = useQuery(SettingsEmailsQuery)
const { mutate: addEmail, loading: addingEmail } = useMutation(AddEmailMutation)
const { mutate: deleteEmail } = useMutation(DeleteEmailMutation)
const { mutate: makePrimary } = useMutation(MakeEmailPrimaryMutation)
const { mutate: resendVerification } = useMutation(ResendEmailVerificationMutation)

// Use fragment masking to access the data
const userEmailsData = computed(() => {
  if (!result.value?.currentUser)
    return null
  return useFragment(EmailsFormUserFragment, result.value.currentUser)
})

// Create a computed property that properly fragments each email
const emails = computed(() => {
  if (!userEmailsData.value?.userEmails?.nodes)
    return []
  return userEmailsData.value.userEmails.nodes.map(email =>
    useFragment(EmailsFormUserEmailFragment, email),
  )
})

const showAddEmailForm = ref(false)
const newEmail = ref('')
const formError = ref<unknown>(null)

async function handleAddEmail() {
  formError.value = null
  try {
    const result = await addEmail({ email: newEmail.value })
    if (result?.data?.createUserEmail?.user) {
      showAddEmailForm.value = false
      newEmail.value = ''
      toast.add({
        title: 'Email added',
        description: 'Your new email address has been added. Please check your inbox for verification.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
    else {
      formError.value = result?.error
      toast.add({
        title: 'Add email failed',
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

async function handleDeleteEmail(emailId: string) {
  try {
    const result = await deleteEmail({ emailId })
    if (result?.data?.deleteUserEmail?.user) {
      toast.add({
        title: 'Email deleted',
        description: 'The email address has been removed from your account.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
    else {
      toast.add({
        title: 'Delete failed',
        description: result?.error?.message || 'Unknown error',
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

async function handleMakePrimary(emailId: string) {
  try {
    const result = await makePrimary({ emailId })
    if (result?.data?.makeEmailPrimary?.user) {
      toast.add({
        title: 'Primary email changed',
        description: 'Your primary email address has been updated.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
    else {
      toast.add({
        title: 'Update failed',
        description: result?.error?.message || 'Unknown error',
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

async function handleResendVerification(emailId: string) {
  try {
    const result = await resendVerification({ emailId })
    if (result?.data?.resendEmailVerificationCode?.success) {
      toast.add({
        title: 'Verification email sent',
        description: 'Please check your inbox for the verification email.',
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
    else {
      toast.add({
        title: 'Resend failed',
        description: result?.error?.message || 'Unknown error',
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
  <div class="max-w-2xl mx-auto py-10">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">
          Email addresses
        </h1>
      </template>
      <div v-if="loading">
        Loading...
      </div>
      <div v-else-if="error">
        Error loading emails
      </div>
      <ul v-else class="space-y-4">
        <li v-for="email in emails" :key="email.id" class="flex items-center justify-between">
          <span>
            {{ email.email }}
            <span v-if="email.isPrimary" class="text-green-600 font-medium">(Primary)</span>
            <span v-else-if="!email.isVerified" class="text-red-500">(unverified)</span>
          </span>
          <div class="flex gap-2">
            <UButton
              v-if="!email.isPrimary && (userEmailsData?.userEmails?.nodes && userEmailsData.userEmails.nodes.length > 1)"
              color="error"
              size="sm"
              @click="handleDeleteEmail(email.id)"
            >
              Delete
            </UButton>
            <UButton
              v-if="!email.isVerified"
              color="primary"
              size="sm"
              @click="handleResendVerification(email.id)"
            >
              Resend verification
            </UButton>
            <UButton
              v-if="email.isVerified && !email.isPrimary"
              color="primary"
              size="sm"
              @click="handleMakePrimary(email.id)"
            >
              Make primary
            </UButton>
          </div>
        </li>
      </ul>
      <div class="mt-6">
        <UButton v-if="!showAddEmailForm" color="primary" @click="showAddEmailForm = true">
          Add email
        </UButton>
        <UForm v-else :state="{ email: newEmail }" class="flex gap-2 items-start" @submit="handleAddEmail">
          <div class="flex-1">
            <UInput v-model="newEmail" placeholder="new@email.com" type="email" required />
            <div v-if="formError" class="text-red-500 text-sm mt-1">
              {{ formError instanceof Error ? formError.message : String(formError) }}
            </div>
          </div>
          <UButton type="submit" color="primary" :loading="addingEmail">
            {{ addingEmail ? 'Adding...' : 'Add' }}
          </UButton>
          <UButton type="button" color="neutral" @click="showAddEmailForm = false; newEmail = ''; formError = null">
            Cancel
          </UButton>
        </UForm>
      </div>
    </UCard>
  </div>
</template>
