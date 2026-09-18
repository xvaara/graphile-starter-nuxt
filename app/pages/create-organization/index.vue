<script setup lang="ts">
const toast = useToast()
const router = useRouter()

const state = reactive({
  name: '',
  slug: '',
})

const { executeMutation: createOrganization, fetching: loading } = useCreateOrganizationMutation()
const { executeQuery: lookupOrganizationBySlug, data: existingOrganizationData, fetching: slugLoading, error: slugError } = useOrganizationBySlugQuery({variables: computed(() => ({ slug: state.slug })), pause: () => !state.slug })
const slugCheckIsValid = ref(false)
const organization = ref<{ id: string; name: string; slug: string } | null>(null)
const formError = ref<unknown>(null)

watch(() => state.name, async (name) => {
  // @ts-expect-error: slugify is globally available or auto-imported
  state.slug = (typeof slugify === 'function' ? slugify(name || '', { lower: true }) : name || '').replace(/\s+/g, '-').toLowerCase()
  slugCheckIsValid.value = false
  if (state.slug) {
    await lookupOrganizationBySlug()
    slugCheckIsValid.value = true
  } else {
    slugCheckIsValid.value = false
  }
})

const handleSubmit = async () => {
  formError.value = null
  try {
    const result = await createOrganization({ name: state.name, slug: state.slug })
    if (result.data?.createOrganization?.organization) {
      organization.value = result.data.createOrganization.organization
      toast.add({
        title: 'Organization created',
        description: `Welcome to ${state.name}!`,
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
      setTimeout(() => {
        if (organization.value) router.push(`/o/${organization.value.slug}`)
      }, 1000)
    } else {
      formError.value = result.error
      toast.add({
        title: 'Creation failed',
        description: result.error?.message || 'Unknown error',
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
    }
  } catch (e) {
    formError.value = e
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
  <div class="w-full max-w-md mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold text-center">Create Organization</h1>
        <p class="text-gray-500 text-center mt-2">Start a new organization</p>
      </template>
      <UForm :state="state" class="space-y-4" @submit="handleSubmit">
        <UFormField label="Name" name="name">
          <UInput v-model="state.name" placeholder="Organization name" required />
        </UFormField>
        <div class="text-xs text-gray-500 mt-1">
          Your organization URL will be <span class="font-mono">/o/{{ state.slug }}</span>
        </div>
        <div v-if="state.slug">
          <div v-if="!slugCheckIsValid || slugLoading" class="flex items-center gap-2 text-xs text-gray-400 mt-1">
            <span class="i-heroicons-arrow-path animate-spin" /> Checking organization name
          </div>
          <div v-else-if="existingOrganizationData?.organizationBySlug" class="text-xs text-red-500 mt-1">
            Organization name is already in use
          </div>
          <div v-else-if="slugError" class="text-xs text-yellow-500 mt-1">
            Error checking for existing organization (error code: ERR_{{ slugError?.graphQLErrors?.[0]?.extensions?.code }})
          </div>
        </div>
        <UAlert v-if="formError" color="error" class="mt-2">
          <template #title>Creating organization failed</template>
          <span>
            {{ typeof formError === 'object' && formError && 'message' in formError ? formError.message : String(formError) }}
          </span>
        </UAlert>
        <UButton
          type="submit"
          color="primary"
          block
          :loading="loading"
          :disabled="!state.slug || !slugCheckIsValid || slugLoading || !!existingOrganizationData?.organizationBySlug"
        >
          {{ loading ? 'Creating...' : 'Create' }}
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
