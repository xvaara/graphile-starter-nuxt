export async function useAuth(refresh = false) {
  const nuxtApp = useNuxtApp()
  const user = useState<SharedLayout_UserFragment | null>('auth:user', () => null)
  const initialized = useState('auth:initialized', () => false)
  if (refresh && import.meta.client) nuxtApp.$refreshClient()
  const client = unref(nuxtApp.$urql)

  if (!initialized.value || refresh) {
    const result = await client.query<SharedQuery>(SharedDocument, {}, {
      requestPolicy: refresh ? 'network-only' : 'cache-first',
    }).toPromise()
    if (result.error) throw result.error
    user.value = result.data?.currentUser ?? null
    initialized.value = true
  }

  function subscribe() {
    if (import.meta.server) return
    const subscription = useCurrentUserUpdatedSubscription({ pause: computed(() => !user.value) })
    watch(subscription.data, async (data) => {
      if (!data?.currentUserUpdated) return
      const result = await unref(nuxtApp.$urql).query<SharedQuery>(SharedDocument, {}, { requestPolicy: 'network-only' }).toPromise()
      if (!result.error) user.value = result.data?.currentUser ?? null
    })
  }

  async function logout() {
    const result = await unref(nuxtApp.$urql).mutation(LogoutDocument, {}).toPromise()
    if (result.error) throw result.error
    user.value = null
    initialized.value = false
    nuxtApp.$refreshClient()
    useToast().add({ title: 'Logged out', color: 'success' })
    await navigateTo('/')
  }

  return { user, isAuthenticated: computed(() => !!user.value), subscribe, logout }
}
