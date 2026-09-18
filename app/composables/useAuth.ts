import { useQuery, useSubscription } from '@vue/apollo-composable/compat'
import { graphql, useFragment } from '~/graphql'

// Define the shared layout user fragment (matching SharedLayout_User in GraphQL files)
export const SharedLayoutUserFragment = graphql(/* GraphQL */ `
  fragment SharedLayout_User on User {
    id
    name
    username
    avatarUrl
    isAdmin
    isVerified
    organizationMemberships(first: 20) {
      nodes {
        id
        isOwner
        isBillingContact
        organization {
          id
          name
          slug
        }
      }
    }
  }
`)

// Define the shared layout query fragment (matching SharedLayout_Query in GraphQL files)
export const SharedLayoutQueryFragment = graphql(/* GraphQL */ `
  fragment SharedLayout_Query on Query {
    currentUser {
      id
      ...SharedLayout_User
    }
  }
`)

// Define the shared query (matching Shared.graphql)
export const SharedQuery = graphql(/* GraphQL */ `
  query Shared {
    ...SharedLayout_Query
  }
`)

// Define the logout mutation (matching Logout.graphql)
export const LogoutMutation = graphql(/* GraphQL */ `
  mutation Logout {
    logout {
      success
    }
  }
`)

// Define the current user updated subscription (matching CurrentUserUpdated.graphql)
export const CurrentUserUpdatedSubscription = graphql(/* GraphQL */ `
  subscription CurrentUserUpdated {
    currentUserUpdated {
      user {
        id
        ...SharedLayout_User
      }
    }
  }
`)

export function useAuth() {
  const nuxtApp = useNuxtApp()
  const client = nuxtApp.$apollo
  const toast = useToast()
  const router = useRouter()

  // Ensure we're in a Vue lifecycle context
  if (!getCurrentInstance()) {
    throw new Error('useAuth must be called within a Vue component setup function')
  }

  const { result, refetch, onResult } = useQuery(SharedQuery)

  // Use fragment masking to access the query data and then the user data
  const queryData = computed(() => {
    if (!result.value)
      return null
    return useFragment(SharedLayoutQueryFragment, result.value)
  })

  const userData = queryData.value?.currentUser
  const userFragment = useFragment(SharedLayoutUserFragment, userData)
  const user = import.meta.client
    ? useState('user', () => userFragment)
    : ref(userFragment)

  onResult(({ data }) => {
    if (data) {
      const queryFragment = useFragment(SharedLayoutQueryFragment, data)
      user.value = queryFragment.currentUser ? useFragment(SharedLayoutUserFragment, queryFragment.currentUser) : null
    }
  })

  function subscribe() {
    const { onError, onResult: onCurrentUserUpdated } = useSubscription(CurrentUserUpdatedSubscription, null, { enabled: computed(() => !!user.value) })

    onCurrentUserUpdated(({ data }) => {
      if (data?.currentUserUpdated?.user) {
        user.value = useFragment(SharedLayoutUserFragment, data.currentUserUpdated.user)
      }
    })
    onError((error) => {
      console.error('error subscribing to current user updates', error)
    })
  }
  async function logout() {
    await client.mutate({ mutation: LogoutMutation })
    user.value = null
    nuxtApp.$apolloWSClient?.terminate()
    await client.resetStore()
    toast.add({
      title: 'Logged out',
      description: 'See you soon!',
      icon: 'i-heroicons-arrow-right-start-on-rectangle',
      color: 'success',
    })
    await router.push('/')
    return true
  }

  async function restartSession() {
    nuxtApp.$apolloWSClient?.terminate()
    const data = await refetch()
    if (data?.data) {
      const queryFragment = useFragment(SharedLayoutQueryFragment, data.data)
      user.value = queryFragment.currentUser ? useFragment(SharedLayoutUserFragment, queryFragment.currentUser) : null
    }
    return user.value
  }

  return {
    isAuthenticated: computed(() => !!user.value),
    user: readonly(user),
    logout,
    restartSession,
    subscribe,
  }
}
