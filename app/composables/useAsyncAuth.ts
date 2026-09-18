import type { FetchPolicy, WatchQueryFetchPolicy } from '@apollo/client'
import type { DeepReadonly } from 'vue'
import type { SharedLayout_UserFragment } from '~/graphql/graphql'
import { useQuery } from '@vue/apollo-composable/compat'
import { useFragment } from '~/graphql'

import { SharedLayoutQueryFragment, SharedLayoutUserFragment, SharedQuery } from './useAuth'

export async function useAsyncAuth(fetchPolicy: WatchQueryFetchPolicy | FetchPolicy = 'cache-first'): Promise<{
  isAuthenticated: ComputedRef<boolean>
  user: Readonly<Ref<DeepReadonly<SharedLayout_UserFragment> | null>>
}> {
  const nuxtApp = useNuxtApp()
  const client = nuxtApp.$apollo
  const user = import.meta.client ? useState('user', () => useFragment(SharedLayoutUserFragment, null)) : ref(useFragment(SharedLayoutUserFragment, null))

  if (!getCurrentInstance()) {
    if (fetchPolicy === 'cache-and-network' || fetchPolicy === 'standby') {
      fetchPolicy = 'cache-first'
    }
    try {
      const { data } = await client.query({ query: SharedQuery, fetchPolicy })
      const queryFragment = useFragment(SharedLayoutQueryFragment, data)
      user.value = useFragment(SharedLayoutUserFragment, queryFragment?.currentUser ?? null)
    }
    catch (error) {
      console.error('Error fetching auth state:', error)
      // Optionally set user to null explicitly
      user.value = useFragment(SharedLayoutUserFragment, null)
    }
    return {
      isAuthenticated: computed(() => !!user.value),
      user: readonly(user),
    }
  }
  else {
    return new Promise((resolve) => {
      const { onResult, onError } = useQuery(SharedQuery, null, { fetchPolicy })
      onResult(({ data }) => {
        const queryFragment = useFragment(SharedLayoutQueryFragment, data)
        user.value = useFragment(SharedLayoutUserFragment, queryFragment?.currentUser ?? null)
        resolve({
          isAuthenticated: computed(() => !!user.value),
          user: readonly(user),
        })
      })
      onError((error) => {
        console.error('Error fetching auth state:', error)
        // Resolve with null user to prevent hanging promises
        user.value = useFragment(SharedLayoutUserFragment, null)
        resolve({
          isAuthenticated: computed(() => false),
          user: readonly(user),
        })
      })
    })
  }
}
