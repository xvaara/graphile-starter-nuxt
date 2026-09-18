<script setup lang="ts">
definePageMeta({ public: false })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const token = computed(() => typeof route.query.token === 'string' ? route.query.token : null)
const error = ref<string | null>(null)
const confirmOpen = ref(false)
const itIsDone = ref(false)
const doingIt = ref(false)
const deleting = ref(false)
const deleted = ref(false)

function openModal() {
  confirmOpen.value = true
}
function closeModal() {
  confirmOpen.value = false
}

const requestAccountDeletion = useRequestAccountDeletionMutation()
const confirmAccountDeletion = useConfirmAccountDeletionMutation()

async function doIt() {
  error.value = null
  doingIt.value = true
  try {
    const { mutate } = requestAccountDeletion

    const result = await mutate({})

    if (!result?.data?.requestAccountDeletion?.success)
      throw new Error('Requesting deletion failed')
    itIsDone.value = true
    toast.add({ title: 'Check your email', description: 'A confirmation link was sent to your email.', color: 'info' })
  }
  catch (e: Error | unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  doingIt.value = false
  confirmOpen.value = false
}

async function confirmDeletion() {
  if (deleting.value || !token.value)
    return
  error.value = null
  deleting.value = true
  try {
    const { mutate } = confirmAccountDeletion
    const result = await mutate({ token: token.value })

    if (!result?.data?.confirmAccountDeletion?.success)
      throw new Error('Account deletion failed')
    deleted.value = true
    toast.add({ title: 'Account deleted', description: 'Your account has been deleted.', color: 'success' })
  }
  catch (e: Error | unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  deleting.value = false
}
</script>

<template>
  <div class="max-w-xl mx-auto py-10">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">
          Delete Account
        </h1>
      </template>
      <div>
        <p class="mb-4">
          Deleting your user account will delete all data (except that which we must retain for legal, compliance and accounting reasons) and cannot be undone. Make sure you want to do this.
        </p>
        <p class="mb-4">
          To protect your account, we require you to confirm you wish to delete your account here, then you will be sent an email with a confirmation code (to check your identity) and when you click that link you will be asked to confirm your account deletion again.
        </p>

        <template v-if="token">
          <UAlert type="error" title="Confirm account deletion">
            <p>
              This is it. <span class="font-bold">Press this button and your account will be deleted.</span>
              We're sorry to see you go, please don't hesitate to reach out and let us know why you no longer want your account.
            </p>
            <UButton color="error" :loading="deleting" @click="confirmDeletion">
              PERMANENTLY DELETE MY ACCOUNT
            </UButton>
          </UAlert>
        </template>
        <template v-else-if="itIsDone">
          <UAlert type="warning" title="Confirm deletion via email link">
            <p>
              You've been sent an email with a confirmation link in it, you must click it to confirm that you are the account holder so that you may continue deleting your account.
            </p>
          </UAlert>
        </template>
        <template v-else>
          <UAlert type="error" title="Delete user account?">
            <p>
              Deleting your account cannot be undone, you will lose all your data.
            </p>
            <UButton color="error" @click="openModal">
              I want to delete my account
            </UButton>
          </UAlert>
        </template>

        <template v-if="error">
          <UAlert type="error" title="Error">
            <span>{{ error }}</span>
          </UAlert>
        </template>

        <UModal v-model:open="confirmOpen" title="Send delete account confirmation email?" :dismissible="!doingIt">
          <template #body>
            <p>
              Before we can delete your account, we need to confirm it's definitely you. We'll send you an email with a link in it, which when clicked will give you the option to delete your account.
            </p>
            <p>
              You should not trigger this unless you're sure you want to delete your account.
            </p>
          </template>
          <template #footer>
            <UButton color="primary" :loading="doingIt" class="mr-2" danger @click="doIt">
              Send delete account email
            </UButton>
            <UButton color="neutral" @click="closeModal">
              Cancel
            </UButton>
          </template>
        </UModal>

        <UModal v-model:open="deleted" title="Account deleted" :close="false" :dismissible="false">
          <template #body>
            <div>
              <p>Your account has been successfully deleted. We wish you all the best.</p>
              <UButton color="primary" @click="router.push('/')">
                Return to homepage
              </UButton>
            </div>
          </template>
        </UModal>
      </div>
    </UCard>
  </div>
</template>
