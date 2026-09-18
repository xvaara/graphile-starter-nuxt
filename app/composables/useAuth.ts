import type { ResultOf } from '@graphql-typed-document-node/core'
import { SharedLayoutQueryFragment, SharedLayoutUserFragment } from '~/operations/fragments'
import { useSubscription } from 'villus'
import { getFragmentData, graphql } from '~/graphql'

const CurrentUserUpdatedDocument = graphql(/* GraphQL */ `
  subscription CurrentUserUpdated {
    currentUserUpdated {
      event
      user {
        id
        username
        name
        avatarUrl
        isAdmin
        isVerified
      }
    }
  }
`)

const SharedDocument = graphql(/* GraphQL */ `
  query Shared {
    ...SharedLayout_Query
  }
`)

const LogoutDocument = graphql(/* GraphQL */ `
  mutation Logout {
    logout {
      success
    }
  }
`)

function getSharedUser(data: ResultOf<typeof SharedDocument> | null | undefined) {
  const query = getFragmentData(SharedLayoutQueryFragment, data)
  return getFragmentData(SharedLayoutUserFragment, query?.currentUser) ?? null
}

export async function useAuth(refresh = false) {
  const nuxtApp = useNuxtApp()
  const user = useState<ResultOf<typeof SharedLayoutUserFragment> | null>('auth:user', () => null)
  const initialized = useState('auth:initialized', () => false)
  if (refresh && import.meta.client) nuxtApp.$refreshClient()
  const client = nuxtApp.$villus

  if (!initialized.value || refresh) {
    const result = await client.executeQuery({ query: SharedDocument, cachePolicy: refresh ? 'network-only' : 'cache-first' })
    if (result.error) throw result.error
    user.value = getSharedUser(result.data)
    initialized.value = true
  }

  function subscribe() {
    if (import.meta.server) return
    const subscription = useSubscription({ client: nuxtApp.$villus, query: CurrentUserUpdatedDocument, skip: computed(() => !user.value) })
    watch(nuxtApp.$villusSessionVersion, () => {
      if (user.value) subscription.subscribe()
    })
    watch(subscription.data, async (data) => {
      if (!data?.currentUserUpdated) return
      const currentUserId = user.value?.id
      const result = await nuxtApp.$villus.executeQuery({ query: SharedDocument, cachePolicy: 'network-only' })
      if (!result.error && currentUserId && user.value?.id === currentUserId) user.value = getSharedUser(result.data)
    })
  }

  async function logout() {
    const result = await nuxtApp.$villus.executeMutation({ query: LogoutDocument })
    if (result.error) throw result.error
    user.value = null
    initialized.value = false
    nuxtApp.$refreshClient()
    useToast().add({ title: 'Logged out', color: 'success' })
    await navigateTo('/')
  }

  return { user, isAuthenticated: computed(() => !!user.value), subscribe, logout }
}
