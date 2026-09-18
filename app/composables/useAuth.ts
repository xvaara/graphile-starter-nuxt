import type { ResultOf } from '@graphql-typed-document-node/core'
import { SharedLayoutQueryFragment, SharedLayoutUserFragment } from '~/operations/fragments'
import { useSubscription } from '@urql/vue'
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

function getSharedUser(data: ResultOf<typeof SharedDocument> | undefined) {
  const query = getFragmentData(SharedLayoutQueryFragment, data)
  return getFragmentData(SharedLayoutUserFragment, query?.currentUser) ?? null
}

export async function useAuth(refresh = false) {
  const nuxtApp = useNuxtApp()
  const user = useState<ResultOf<typeof SharedLayoutUserFragment> | null>('auth:user', () => null)
  const initialized = useState('auth:initialized', () => false)
  if (refresh && import.meta.client) nuxtApp.$refreshClient()
  const client = unref(nuxtApp.$urql)

  if (!initialized.value || refresh) {
    const result = await client.query(SharedDocument, {}, {
      requestPolicy: refresh ? 'network-only' : 'cache-first',
    }).toPromise()
    if (result.error) throw result.error
    user.value = getSharedUser(result.data)
    initialized.value = true
  }

  function subscribe() {
    if (import.meta.server) return
    const subscription = useSubscription({ query: CurrentUserUpdatedDocument, pause: computed(() => !user.value) })
    watch(subscription.data, async (data) => {
      if (!data?.currentUserUpdated) return
      const result = await unref(nuxtApp.$urql).query(SharedDocument, {}, { requestPolicy: 'network-only' }).toPromise()
      if (!result.error) user.value = getSharedUser(result.data)
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
