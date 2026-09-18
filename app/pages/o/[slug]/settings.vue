<script setup lang="ts">
import { useMutation, useQuery } from '@urql/vue'
import { getFragmentData, graphql } from '~/graphql'
import { OrganizationMembersOrganizationFragment, OrganizationMembersMembershipFragment, OrganizationPageOrganizationFragment } from '~/operations/fragments'
import { getOrganizationPage, OrganizationPageDocument } from '~/operations/organization'

const UpdateOrganizationDocument = graphql(/* GraphQL */ `
  mutation UpdateOrganization($input: UpdateOrganizationInput!) {
    updateOrganization(input: $input) {
      organization {
        id
        slug
        name
      }
    }
  }
`)

const DeleteOrganizationDocument = graphql(/* GraphQL */ `
  mutation DeleteOrganization($organizationId: UUID!) {
    deleteOrganization(input: {organizationId: $organizationId}) {
      clientMutationId
    }
  }
`)

const OrganizationMembersDocument = graphql(/* GraphQL */ `
  query OrganizationMembers($slug: String!, $offset: Int = 0) {
    ...OrganizationPage_Query
    organizationBySlug(slug: $slug) {
      id
      ...OrganizationMembers_Organization
    }
  }
`)

const InviteToOrganizationDocument = graphql(/* GraphQL */ `
  mutation InviteToOrganization($organizationId: UUID!, $email: String, $username: String) {
    inviteToOrganization(
      input: {organizationId: $organizationId, email: $email, username: $username}
    ) {
      clientMutationId
    }
  }
`)

const RemoveFromOrganizationDocument = graphql(/* GraphQL */ `
  mutation RemoveFromOrganization($organizationId: UUID!, $userId: UUID!) {
    removeFromOrganization(
      input: {organizationId: $organizationId, userId: $userId}
    ) {
      clientMutationId
    }
  }
`)

const TransferOrganizationOwnershipDocument = graphql(/* GraphQL */ `
  mutation TransferOrganizationOwnership($organizationId: UUID!, $userId: UUID!) {
    transferOrganizationOwnership(
      input: {organizationId: $organizationId, userId: $userId}
    ) {
      organization {
        id
        currentUserIsOwner
      }
    }
  }
`)

const TransferOrganizationBillingContactDocument = graphql(/* GraphQL */ `
  mutation TransferOrganizationBillingContact($organizationId: UUID!, $userId: UUID!) {
    transferOrganizationBillingContact(
      input: {organizationId: $organizationId, userId: $userId}
    ) {
      organization {
        id
        currentUserIsBillingContact
      }
    }
  }
`)


const route = useRoute()
const toast = useToast()
const slug = computed(() => route.params.slug as string)

// Tab state
const currentTab = ref('general')

// General settings state and mutations
const { data: orgResult, fetching } = await useQuery({ query: OrganizationPageDocument,
  variables: computed(() => ({ slug: slug.value }))
})

const orgData = computed(() => getOrganizationPage(orgResult.value))

// Throw 404 error if organization not found, but only after the query completes
watchEffect(() => {
  if (!fetching.value && orgResult.value && !orgData.value) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organization Not Found',
      message: 'The organization you are looking for does not exist.',
      fatal: true
    })
  }
  if (!fetching.value && !orgData.value?.currentUserIsOwner) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You are not authorized to access this organization.',
      fatal: true
    })
  }
})

const { executeMutation: updateOrganization, fetching: updating } = useMutation(UpdateOrganizationDocument)
const { executeMutation: deleteOrganization, fetching: deleting } = useMutation(DeleteOrganizationDocument)

const generalState = reactive({
  name: '',
  slug: '',
})

watchEffect(() => {
  if (orgData.value) {
    generalState.name = orgData.value.name
    generalState.slug = orgData.value.slug
  }
})

// Members state and mutations
const page = ref(1)
const RESULTS_PER_PAGE = 10

const inviteForm = ref({
  inviteText: ''
})
const inviteInProgress = ref(false)

const { data: membersData, fetching: membersFetching, error: membersError } = useQuery({ query: OrganizationMembersDocument,
  variables: computed(() => ({
    slug: slug.value,
    offset: (page.value - 1) * RESULTS_PER_PAGE
  }))
})

const memberOrganization = computed(() => getFragmentData(OrganizationMembersOrganizationFragment, membersData.value?.organizationBySlug))
const memberPermissions = computed(() => getFragmentData(OrganizationPageOrganizationFragment, memberOrganization.value))
const members = computed(() => getFragmentData(OrganizationMembersMembershipFragment, memberOrganization.value?.organizationMemberships.nodes ?? []))

const { executeMutation: inviteToOrganization } = useMutation(InviteToOrganizationDocument)
const { executeMutation: removeMember } = useMutation(RemoveFromOrganizationDocument)
const { executeMutation: transferOwnership } = useMutation(TransferOrganizationOwnershipDocument)
const { executeMutation: transferBillingContact } = useMutation(TransferOrganizationBillingContactDocument)

// General settings handlers
const handleGeneralSubmit = async () => {
  try {
    if (!orgData.value) {
      toast.add({
        title: 'Organization not found',
        description: 'Please check the organization slug.',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
      return
    }
    if (!generalState.name.trim() || !generalState.slug.trim()) {
      toast.add({
        title: 'Missing fields',
        description: 'Name and slug are required.',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
      return
    }
    const result = await updateOrganization({
      input: {
        id: orgData.value.id,
        patch: {
          name: generalState.name,
          slug: generalState.slug
        }
      }
    })
    if (result.data?.updateOrganization?.organization) {
      toast.add({
        title: 'Organization updated',
        description: 'Organization updated successfully.',
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
    } else {
      toast.add({
        title: 'Update failed',
        description: result.error?.message || 'Unknown error',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
    }
  } catch (e) {
    toast.add({
      title: 'An error occurred',
      description: e instanceof Error ? e.message : String(e),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error'
    })
  }
}

// Members handlers
const handleInvite = async () => {
  const organizationId = orgData.value?.id
  if (!organizationId) return
  if (inviteInProgress.value || !inviteForm.value.inviteText) return

  inviteInProgress.value = true
  const inviteText = inviteForm.value.inviteText
  const isEmail = inviteText.includes('@')

  try {
    const result = await inviteToOrganization({
      organizationId,
      email: isEmail ? inviteText : null,
      username: isEmail ? null : inviteText
    })
    if (result.error) {
      toast.add({
        title: 'Error',
        description: result.error.message,
        color: 'error'
      })
      return
    }
    toast.add({
      title: 'Success',
      description: `${inviteText} has been invited.`,
      color: 'success'
    })
    inviteForm.value.inviteText = ''
  } catch (e) {
    toast.add({
      title: 'Error',
      description: (e as { message: string }).message.replace(/^GraphQL Error:/i, ''),
      color: 'error'
    })
  } finally {
    inviteInProgress.value = false
  }
}

const handleRemoveMember = async (userId: string) => {
  const organizationId = orgData.value?.id
  if (!organizationId) return
  try {
    await removeMember({
      organizationId,
      userId
    })
    toast.add({
      title: 'Success',
      description: 'Member has been removed.',
      color: 'success'
    })
  } catch (e) {
    toast.add({
      title: 'Error',
      description: (e as { message: string }).message,
      color: 'error'
    })
  }
}

const handleTransferOwnership = async (userId: string) => {
  const organizationId = orgData.value?.id
  if (!organizationId) return
  try {
    await transferOwnership({
      organizationId,
      userId
    })
    toast.add({
      title: 'Success',
      description: 'Ownership has been transferred.',
      color: 'success'
    })
  } catch (e) {
    toast.add({
      title: 'Error',
      description: (e as { message: string }).message,
      color: 'error'
    })
  }
}

const handleTransferBillingContact = async (userId: string) => {
  const organizationId = orgData.value?.id
  if (!organizationId) return
  try {
    await transferBillingContact({
      organizationId,
      userId
    })
    toast.add({
      title: 'Success',
      description: 'Billing contact has been transferred.',
      color: 'success'
    })
  } catch (e) {
    toast.add({
      title: 'Error',
      description: (e as { message: string }).message,
      color: 'error'
    })
  }
}

// Delete organization handler
const handleDelete = async () => {
  try {
    if (!orgData.value) {
      toast.add({
        title: 'Organization not found',
        description: 'The organization you are trying to delete does not exist.',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
      return
    }
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return
    }
    const result = await deleteOrganization({ organizationId: orgData.value.id })
    if (result.data?.deleteOrganization) {
      toast.add({
        title: 'Organization deleted',
        description: 'The organization has been deleted.',
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
      setTimeout(() => navigateTo('/'), 1000)
    } else {
      toast.add({
        title: 'Delete failed',
        description: result.error?.message || 'Unknown error',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
    }
  } catch (e) {
    toast.add({
      title: 'An error occurred',
      description: e instanceof Error ? e.message : String(e),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="w-full max-w-5xl mx-auto space-y-8 p-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Organization Settings</h1>
    </div>

    <!-- Settings Tabs -->
    <UTabs
v-model="currentTab" :items="[
      { label: 'General', value: 'general' },
      { label: 'Members', value: 'members' },
      { label: 'Danger Zone', value: 'danger' }
    ]">
      <template #content>
        <div class="min-h-[500px]">
          <!-- General Tab -->
          <UCard v-if="currentTab === 'general'" class="mt-4">
            <UForm :state="generalState" class="space-y-4" @submit="handleGeneralSubmit">
              <UFormField label="Name" name="name">
                <UInput v-model="generalState.name" placeholder="Organization name" required />
              </UFormField>
              <UFormField label="Slug" name="slug">
                <UInput v-model="generalState.slug" placeholder="Organization slug" required />
              </UFormField>
              <UButton type="submit" color="primary" block :loading="updating">
                {{ updating ? 'Saving...' : 'Save Changes' }}
              </UButton>
            </UForm>
          </UCard>

          <!-- Members Tab -->
          <template v-if="currentTab === 'members'">
            <!-- Invite Form -->
            <UCard class="mt-4">
              <template #header>
                <h3 class="text-lg font-medium">Invite new member</h3>
              </template>

              <form class="space-y-4" @submit.prevent="handleInvite">
                <UFormField label="Username or email">
                  <UInput
                    v-model="inviteForm.inviteText"
                    placeholder="Enter username or email"
                    :disabled="inviteInProgress"
                  />
                </UFormField>

                <div class="flex justify-end">
                  <UButton
                    type="submit"
                    :loading="inviteInProgress"
                    :disabled="inviteInProgress || !inviteForm.inviteText"
                  >
                    Invite
                  </UButton>
                </div>
              </form>
            </UCard>

            <!-- Members List -->
            <UCard class="mt-4">
              <template #header>
                <h3 class="text-lg font-medium">Existing members</h3>
              </template>

              <div v-if="membersFetching" class="py-8 text-center">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin h-8 w-8 mx-auto" />
                <p class="mt-2 text-gray-500">Loading members...</p>
              </div>

              <div v-else-if="membersError" class="py-8 text-center text-red-500">
                {{ membersError.message }}
              </div>

              <div v-else-if="!memberOrganization" class="py-8 text-center text-gray-500">
                Organization not found.
              </div>

              <div v-else>
                <ul class="divide-y divide-gray-100">
                  <li
                    v-for="member in members"
                    :key="member.user?.id"
                    class="py-4"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="font-medium">{{ member.user?.name }}</h4>
                        <p class="text-sm text-gray-500">{{ member.user?.username }}</p>
                        <p v-if="member.isOwner || member.isBillingContact" class="text-xs text-gray-400 mt-1">
                          ({{ [
                            member.isOwner ? 'owner' : null,
                            member.isBillingContact ? 'billing contact' : null
                          ].filter(Boolean).join(' and ') }})
                        </p>
                      </div>

                      <div v-if="memberPermissions?.currentUserIsOwner" class="flex gap-2">
                        <UDropdownMenu
v-if="member.user?.id" :items="(() => {
                          const userId = member.user?.id
                          if (!userId) return []
                          return [
                            {
                              label: 'Remove member',
                              icon: 'i-heroicons-user-minus',
                              color: 'error' as const,
                              click: () => handleRemoveMember(userId)
                            },
                            member.isOwner ? null : {
                              label: 'Make owner',
                              icon: 'i-heroicons-key',
                              click: () => handleTransferOwnership(userId)
                            },
                            member.isBillingContact ? null : {
                              label: 'Make billing contact',
                              icon: 'i-heroicons-credit-card',
                              click: () => handleTransferBillingContact(userId)
                            }
                          ].filter((item): item is NonNullable<typeof item> => item !== null)
                        })()">
                          <UButton color="neutral" variant="soft" icon="i-heroicons-ellipsis-horizontal" />
                        </UDropdownMenu>
                      </div>
                    </div>
                  </li>
                </ul>

                <div
                  v-if="memberOrganization.organizationMemberships.totalCount > RESULTS_PER_PAGE"
                  class="mt-4"
                >
                  <UPagination
                    v-model="page"
                    :total="memberOrganization.organizationMemberships.totalCount"
                    :per-page="RESULTS_PER_PAGE"
                  />
                </div>
              </div>
            </UCard>
          </template>

          <!-- Danger Zone Tab -->
          <UCard v-if="currentTab === 'danger'" class="mt-4">
            <template #header>
              <h3 class="text-lg font-medium text-red-600">Delete Organization</h3>
            </template>

            <div class="space-y-4">
              <div class="text-red-600">
                <strong>Warning:</strong> This action cannot be undone.
              </div>
              <UButton color="error" block :loading="deleting" @click="handleDelete">
                Delete Organization
              </UButton>
            </div>
          </UCard>
        </div>
      </template>
    </UTabs>
  </div>
</template>
