<script setup lang="ts">
definePageMeta({ public: false })

const { data, fetching: loading, error } = await useCurrentUserAuthenticationsQuery()
const modalOpen = ref(false)
const deleting = ref(false)
const selectedId = ref<string | null>(null)

function openModal(id: string) {
  selectedId.value = id
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
  selectedId.value = null
}
const { executeMutation: unlinkUserAuthenticationMutation } = useUnlinkUserAuthenticationMutation()
async function handleUnlink() {
  if (!selectedId.value) return
  deleting.value = true
  try {
    await unlinkUserAuthenticationMutation({ id: selectedId.value })
  } finally {
    deleting.value = false
    closeModal()
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-10">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Linked Accounts</h1>
      </template>
      <div v-if="loading">Loading...</div>
      <div v-else-if="error">Error loading accounts</div>
      <ul v-else class="space-y-4">
        <li v-for="auth in data?.currentUser?.authentications || []" :key="auth.id" class="flex items-center justify-between">
          <span>{{ auth.service }} (added {{ new Date(auth.createdAt).toLocaleString() }})</span>
          <UButton color="error" @click="openModal(auth.id)">Unlink</UButton>
        </li>
      </ul>
      <UModal v-model:open="modalOpen" title="Are you sure?" :close="true">
          <template #body>
        <div>If you unlink this account you won’t be able to log in with it any more; please make sure your email is valid.</div>
        </template>
          <template #footer>
          <UButton color="error" :loading="deleting" @click="handleUnlink">Unlink</UButton>
          <UButton color="neutral" @click="closeModal">Cancel</UButton>
        </template>
      </UModal>
    </UCard>
  </div>
</template>
