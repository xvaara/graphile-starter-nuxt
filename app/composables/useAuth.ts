export function useAuth() {
  const nuxtApp = useNuxtApp()
  const client = nuxtApp.$apollo
  const toast = useToast()

  // Ensure we're in a Vue lifecycle context
  if (!getCurrentInstance()) {
    throw new Error('useAuth must be called within a Vue component setup function')
  }

  const { result, refetch, onResult } = useSharedQuery()

  const user = import.meta.client ? useState<SharedLayout_UserFragment | null>('user', () => result.value?.currentUser as SharedLayout_UserFragment | null) : ref<SharedLayout_UserFragment | null>(result.value?.currentUser as SharedLayout_UserFragment | null)

  onResult(({ data }) => {
    user.value = data?.currentUser ?? null
  })

  function logout() {
    return client
      .mutate({ mutation: LogoutDocument })
      .then(async () => {
        await client.resetStore()
        nuxtApp.$apolloWSClient?.terminate()
        user.value = null

        toast.add({
          title: 'Logged out',
          description: 'You have been successfully logged out',
          icon: 'i-heroicons-check-circle',
          color: 'success',
        })
        // nuxtApp.$refreshClient()
        navigateTo('/')
      })
  }
  async function refetchUser() {
    const data = await refetch()
    user.value = data?.data?.currentUser as SharedLayout_UserFragment
    return user.value
  }

  return {
    isAuthenticated: computed(() => !!user.value),
    user: readonly(user),
    logout,
    refetchUser,
  }
}

// The app owns this subscription so route/layout changes cannot dispose it.
export function useAuthSubscription() {
  if (import.meta.server)
    return
  const user = useState<SharedLayout_UserFragment | null>('user', () => null)
  const { onResult } = useCurrentUserUpdatedSubscription(() => ({ enabled: !!user.value }))
  onResult(({ data }) => {
    if (user.value && data?.currentUserUpdated?.user)
      user.value = { ...user.value, ...data.currentUserUpdated.user }
  })
}
