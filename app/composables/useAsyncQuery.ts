import { useQuery } from '@vue/apollo-composable/compat'

export function useAsyncQuery<TResult = any, TVariables = any>(
  document: any,
  variables?: TVariables,
) {
  const { result, loading, error, onResult } = useQuery(document, variables || {} as any)

  const queryPromise = new Promise<TResult>((resolve, reject) => {
    onResult((queryResult) => {
      if (queryResult.data) {
        resolve(queryResult.data)
      }
      else if (queryResult.error) {
        reject(queryResult.error)
      }
    })

    // Handle errors from the error ref
    watch(error, (err) => {
      if (err) {
        reject(err)
      }
    }, { immediate: true })
  })

  return {
    result,
    loading,
    error,
    promise: queryPromise,
  }
}
