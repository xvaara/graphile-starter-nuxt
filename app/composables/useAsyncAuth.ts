import type { FetchPolicy, WatchQueryFetchPolicy } from '@apollo/client'

export async function useAsyncAuth(fetchPolicy: WatchQueryFetchPolicy | FetchPolicy = 'cache-first'): Promise<{
  isAuthenticated: ComputedRef<boolean>
  user: Ref<Readonly<SharedLayout_UserFragment | null>>
}> {
  const nuxtApp = useNuxtApp()
  const client = nuxtApp.$apollo
  const user = import.meta.client ? useState<SharedLayout_UserFragment | null>('user', () => null) : ref<SharedLayout_UserFragment | null>(null)

  if (!getCurrentInstance()) {
    if (fetchPolicy === 'cache-and-network' || fetchPolicy === 'standby') {
      fetchPolicy = 'cache-first'
    }
    try {
      const { data } = await client.query<SharedQuery>({ query: SharedDocument, fetchPolicy })
      user.value = data?.currentUser ?? null
    }
    catch (error) {
      console.error('Error fetching auth state:', error)
      // Optionally set user to null explicitly
      user.value = null
    }
    return {
      isAuthenticated: computed(() => !!user.value),
      user: readonly(user),
    }
  }
  else {
    return new Promise((resolve) => {
      const { onResult, onError } = useSharedQuery({ fetchPolicy })
      onResult(({ data }) => {
        user.value = data?.currentUser ?? null
        resolve({
          isAuthenticated: computed(() => !!user.value),
          user: readonly(user),
        })
      })
      onError((error) => {
        console.error('Error fetching auth state:', error)
        // Resolve with null user to prevent hanging promises
        user.value = null
        resolve({
          isAuthenticated: computed(() => false),
          user: readonly(user),
        })
      })
    })
  }
}
