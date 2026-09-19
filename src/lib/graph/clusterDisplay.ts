/** Sentinel display-cluster id for the grouped "Other" bucket. */
export const OTHER_CLUSTER_ID = 0

/** Clusters smaller than this share of all nodes get folded into "Other". */
export const MIN_CLUSTER_SHARE = 0.03

/**
 * Louvain's raw community indices are arbitrary and not ordered by size.
 * Remap them to what the UI actually shows: 1..N by size (largest first,
 * deterministic ties broken by the raw community id), with anything under
 * `MIN_CLUSTER_SHARE` of all nodes folded into one `OTHER_CLUSTER_ID` (0)
 * bucket — this is the single source of truth both the legend and the
 * node coloring read from.
 */
export function remapClustersForDisplay(rawClusters: Map<string, number>): Map<string, number> {
  const totalNodes = rawClusters.size
  if (totalNodes === 0) return new Map()

  const sizeByRaw = new Map<number, number>()
  for (const raw of rawClusters.values()) {
    sizeByRaw.set(raw, (sizeByRaw.get(raw) ?? 0) + 1)
  }

  const threshold = MIN_CLUSTER_SHARE * totalNodes
  const bigRawClustersDescending = [...sizeByRaw.entries()]
    .filter(([, size]) => size >= threshold)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])

  const displayIdByRaw = new Map<number, number>()
  bigRawClustersDescending.forEach(([rawId], index) => {
    displayIdByRaw.set(rawId, index + 1)
  })

  const result = new Map<string, number>()
  for (const [nodeId, raw] of rawClusters) {
    result.set(nodeId, displayIdByRaw.get(raw) ?? OTHER_CLUSTER_ID)
  }
  return result
}

export function clusterDisplayLabel(cluster: number): string {
  return cluster <= OTHER_CLUSTER_ID ? 'Other' : `Cluster ${cluster}`
}
