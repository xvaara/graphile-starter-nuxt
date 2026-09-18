<script setup lang="ts">
import { useMutation, useQuery } from '@urql/vue'
import { getFragmentData, graphql } from '~/graphql'
import { EmailsFormUserFragment, EmailsFormUserEmailFragment } from '~/operations/fragments'

const SettingsEmailsDocument = graphql(/* GraphQL */ `
  query SettingsEmails {
    ...SharedLayout_Query
    currentUser {
      id
      isVerified
      ...EmailsForm_User
    }
  }
`)

const AddEmailDocument = graphql(/* GraphQL */ `
  mutation AddEmail($email: String!) {
    createUserEmail(input: {userEmail: {email: $email}}) {
      user {
        id
        userEmails(first: 50) {
          nodes {
            id
            ...EmailsForm_UserEmail
          }
        }
      }
    }
  }
`)

const DeleteEmailDocument = graphql(/* GraphQL */ `
  mutation DeleteEmail($emailId: UUID!) {
    deleteUserEmail(input: {id: $emailId}) {
      user {
        id
        userEmails(first: 50) {
          nodes {
            id
            ...EmailsForm_UserEmail
          }
        }
      }
    }
  }
`)

const MakeEmailPrimaryDocument = graphql(/* GraphQL */ `
  mutation MakeEmailPrimary($emailId: UUID!) {
    makeEmailPrimary(input: {emailId: $emailId}) {
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

const ResendEmailVerificationDocument = graphql(/* GraphQL */ `
  mutation ResendEmailVerification($emailId: UUID!) {
    resendEmailVerificationCode(input: {emailId: $emailId}) {
      success
    }
  }
`)

definePageMeta({ public: false })

const { data, fetching: loading, error } = await useQuery({ query: SettingsEmailsDocument })
const emailUser = computed(() => getFragmentData(EmailsFormUserFragment, data.value?.currentUser))
const emails = computed(() => getFragmentData(EmailsFormUserEmailFragment, emailUser.value?.userEmails.nodes ?? []))
const showAddEmailForm = ref(false)
const newEmail = ref('')
const addEmailError = ref('')

const { executeMutation: addEmailMutation } = useMutation(AddEmailDocument)
const addEmail = async () => {
  addEmailError.value = ''
  try {
    await addEmailMutation({ email: newEmail.value })
    showAddEmailForm.value = false
    newEmail.value = ''
  } catch (e: Error | unknown) {
    addEmailError.value = e instanceof Error ? e.message : String(e)
  }
}
const { executeMutation: deleteEmailMutation } = useMutation(DeleteEmailDocument)
const deleteEmail = async (id: string) => {
  await deleteEmailMutation({ emailId: id })
}
const { executeMutation: makePrimaryMutation } = useMutation(MakeEmailPrimaryDocument)
const makePrimary = async (id: string) => {
  await makePrimaryMutation({ emailId: id })
}
const { executeMutation: resendVerificationMutation } = useMutation(ResendEmailVerificationDocument)
const resendVerification = async (id: string) => {
  await resendVerificationMutation({ emailId: id })
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-10">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Email addresses</h1>
      </template>
      <div v-if="loading">Loading...</div>
      <div v-else-if="error">Error loading emails</div>
      <ul v-else class="space-y-4">
        <li v-for="email in emails" :key="email.id" class="flex items-center justify-between">
          <span>
            {{ email.email }}
            <span v-if="email.isPrimary">(Primary)</span>
            <span v-else-if="!email.isVerified" class="text-red-500">(unverified)</span>
          </span>
          <div class="flex gap-2">
            <UButton v-if="!email.isPrimary && emails.length > 1" color="error" @click="deleteEmail(email.id)">Delete</UButton>
            <UButton v-if="!email.isVerified" color="primary" @click="resendVerification(email.id)">Resend verification</UButton>
            <UButton v-if="email.isVerified && !email.isPrimary" color="primary" @click="makePrimary(email.id)">Make primary</UButton>
          </div>
        </li>
      </ul>
      <div class="mt-6">
        <UButton v-if="!showAddEmailForm" color="primary" @click="showAddEmailForm = true">Add email</UButton>
        <form v-else class="flex gap-2 items-center" @submit.prevent="addEmail">
          <UInput v-model="newEmail" placeholder="New email" required />
          <UButton type="submit" color="primary">Add</UButton>
          <UButton type="button" color="neutral" @click="showAddEmailForm = false">Cancel</UButton>
        </form>
        <div v-if="addEmailError" class="text-red-500 mt-2">{{ addEmailError }}</div>
      </div>
    </UCard>
  </div>
</template>
