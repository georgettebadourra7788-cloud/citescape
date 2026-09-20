import type { GraphEdge } from './types'

/**
 * Sum of incident edge weights per node — "times co-cited" for a co-citation
 * node. Shared by the Excel export (Co-citation nodes sheet) and the live
 * map's node details panel, so both show the same number.
 */
export function computeWeightedDegree(edges: GraphEdge[]): Map<string, number> {
  const weightedDegreeById = new Map<string, number>()
  for (const edge of edges) {
    weightedDegreeById.set(edge.source, (weightedDegreeById.get(edge.source) ?? 0) + edge.weight)
    weightedDegreeById.set(edge.target, (weightedDegreeById.get(edge.target) ?? 0) + edge.weight)
  }
  return weightedDegreeById
}
