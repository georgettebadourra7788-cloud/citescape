import type { ClusterSummary, GraphNode } from './types'

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function topKeywordsByFrequency(keywordLists: string[][], limit = 5): string[] {
  const counts = new Map<string, number>()
  for (const list of keywordLists) {
    for (const keyword of list) {
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword)
}

/** Groups nodes by cluster and computes each cluster's summary stats. */
export function buildClusterSummaries(
  nodes: GraphNode[],
  keywordsById: Map<string, string[]>,
): ClusterSummary[] {
  const byCluster = new Map<number, GraphNode[]>()
  for (const node of nodes) {
    let clusterNodes = byCluster.get(node.cluster)
    if (!clusterNodes) {
      clusterNodes = []
      byCluster.set(node.cluster, clusterNodes)
    }
    clusterNodes.push(node)
  }

  const summaries: ClusterSummary[] = []
  for (const [cluster, clusterNodes] of byCluster) {
    // Never let a node with no resolved OpenAlex record (resolved === false)
    // become a cluster's top/label paper — only fall back to it if every
    // node in the cluster is unresolved.
    const resolvedNodes = clusterNodes.filter((node) => node.resolved !== false)
    const topPapersSource = resolvedNodes.length > 0 ? resolvedNodes : clusterNodes
    const topPapers = [...topPapersSource]
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 5)
      .map((node) => ({ id: node.id, title: node.label, citations: node.citations }))

    const medianYear = median(
      clusterNodes.map((node) => node.year).filter((year): year is number => year !== null),
    )

    const topKeywords = topKeywordsByFrequency(
      clusterNodes.map((node) => keywordsById.get(node.id) ?? []),
    )

    summaries.push({ cluster, size: clusterNodes.length, topPapers, medianYear, topKeywords })
  }

  return summaries.sort((a, b) => b.size - a.size)
}
