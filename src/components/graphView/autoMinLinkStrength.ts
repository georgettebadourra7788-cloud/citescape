/**
 * Picks a default "minimum link strength" that leaves roughly
 * `maxVisibleEdges` edges visible — enough detail to be useful without
 * rendering a hairball. Weight thresholds are discrete, so this finds the
 * smallest threshold whose edge count is still at or under the target;
 * that's necessarily as close to the target as an integer threshold can
 * get (it may land below `maxVisibleEdges` if weights are sparse).
 */
export function computeAutoMinLinkStrength(
  edges: { weight: number }[],
  maxVisibleEdges = 2500,
): number {
  if (edges.length <= maxVisibleEdges) return 1

  const countByWeight = new Map<number, number>()
  for (const edge of edges) {
    countByWeight.set(edge.weight, (countByWeight.get(edge.weight) ?? 0) + 1)
  }

  const weightsAscending = [...countByWeight.keys()].sort((a, b) => a - b)

  // Cumulative count of edges with weight >= w, for each distinct w.
  let cumulative = 0
  const countAtOrAbove = new Map<number, number>()
  for (let i = weightsAscending.length - 1; i >= 0; i--) {
    const w = weightsAscending[i]
    cumulative += countByWeight.get(w)!
    countAtOrAbove.set(w, cumulative)
  }

  for (const w of weightsAscending) {
    if (countAtOrAbove.get(w)! <= maxVisibleEdges) return w
  }
  return weightsAscending[weightsAscending.length - 1]
}
