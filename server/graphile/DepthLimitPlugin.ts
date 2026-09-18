import type { SelectionSetNode, ValidationContext, ValidationRule } from 'postgraphile/graphql'
import { GraphQLError, Kind } from 'postgraphile/graphql'

// Field depth counts leaves; inline fragments and spreads add no extra level.
export function depthLimitRule(maxDepth: number): ValidationRule {
  return (context: ValidationContext) => {
    const depths = new Map<string, number>()
    const computing = new Set<string>()
    function measure(selectionSet: SelectionSetNode): number {
      let maximum = 0
      for (const selection of selectionSet.selections) {
        let depth = 0
        if (selection.kind === Kind.FIELD) {
          depth = 1 + (selection.selectionSet ? measure(selection.selectionSet) : 0)
        }
        else if (selection.kind === Kind.INLINE_FRAGMENT) {
          depth = measure(selection.selectionSet)
        }
        else {
          const name = selection.name.value
          if (depths.has(name)) {
            depth = depths.get(name)!
          }
          else if (!computing.has(name)) {
            const fragment = context.getFragment(name)
            if (fragment) {
              computing.add(name)
              depth = measure(fragment.selectionSet)
              computing.delete(name)
              depths.set(name, depth)
            }
          }
        }
        maximum = Math.max(maximum, depth)
      }
      return maximum
    }
    return {
      OperationDefinition(node) {
        const depth = measure(node.selectionSet)
        if (depth > maxDepth) {
          context.reportError(new GraphQLError(`GraphQL operation depth ${depth} exceeds the maximum allowed depth of ${maxDepth}.`, {
            nodes: node,
            extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
          }))
        }
      },
    }
  }
}
