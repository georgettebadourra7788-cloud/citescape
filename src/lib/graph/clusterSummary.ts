import { citationRank } from './citationRank'
import { OTHER_CLUSTER_ID } from './clusterDisplay'
import type { ClusterSummary, GraphNode } from './types'

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Counts, for each term, how many keyword lists (papers) contain it at least once. */
function countTermDocFrequency(keywordLists: string[][]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const list of keywordLists) {
    for (const term of new Set(list)) {
      counts.set(term, (counts.get(term) ?? 0) + 1)
    }
  }
  return counts
}

export interface DistinctivenessOptions {
  /** A term must appear in at least this many of the cluster's papers to be considered. */
  minCount?: number
  /** ...and in at least this share of the cluster's papers — scales the floor up for big clusters. */
  minShare?: number
  limit?: number
}

const DEFAULT_MIN_COUNT = 5
const DEFAULT_MIN_SHARE = 0.05

/**
 * Ranks terms by distinctiveness — the share of the cluster's papers that
 * have the term, divided by the share of *all* papers that have it —
 * rather than raw frequency, so a term common across the whole set (e.g.
 * the query topic itself) doesn't dominate every cluster's keyword list.
 * A term must also clear both a minimum raw count and a minimum share of
 * the cluster, so a rare, noisy term (only ever seen in a couple of
 * papers, but happening to be perfectly "exclusive" to this cluster)
 * can't win purely on distinctiveness.
 */
export function topKeywordsByDistinctiveness(
  clusterKeywordLists: string[][],
  allKeywordLists: string[][],
  options: DistinctivenessOptions = {},
): string[] {
  const minCount = options.minCount ?? DEFAULT_MIN_COUNT
  const minShare = options.minShare ?? DEFAULT_MIN_SHARE
  const limit = options.limit ?? 5

  const clusterCounts = countTermDocFrequency(clusterKeywordLists)
  const globalCounts = countTermDocFrequency(allKeywordLists)
  const clusterSize = clusterKeywordLists.length || 1
  const globalSize = allKeywordLists.length || 1

  const scored: { term: string; score: number; count: number }[] = []
  for (const [term, count] of clusterCounts) {
    if (count < minCount) continue
    const clusterShare = count / clusterSize
    if (clusterShare < minShare) continue
    // globalCounts always has an entry >= count for this term, since the
    // cluster's papers are themselves part of `allKeywordLists` — the
    // fallback just guards against a caller passing mismatched lists.
    const globalShare = (globalCounts.get(term) ?? count) / globalSize
    scored.push({ term, score: globalShare > 0 ? clusterShare / globalShare : Infinity, count })
  }

  return scored
    .sort((a, b) => b.score - a.score || b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit)
    .map((s) => s.term)
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

  const allKeywordLists = nodes.map((node) => keywordsById.get(node.id) ?? [])

  const summaries: ClusterSummary[] = []
  for (const [cluster, clusterNodes] of byCluster) {
    // Never let a node with no resolved OpenAlex record (resolved === false)
    // become a cluster's top/label paper — only fall back to it if every
    // node in the cluster is unresolved.
    const resolvedNodes = clusterNodes.filter((node) => node.resolved !== false)
    const allUnresolved = resolvedNodes.length === 0
    const topPapersSource = allUnresolved ? clusterNodes : resolvedNodes
    const topPapers = [...topPapersSource]
      .sort((a, b) => citationRank(b) - citationRank(a))
      .slice(0, 5)
      .map((node) => ({ id: node.id, title: node.label, citations: citationRank(node) }))

    const medianYear = median(
      clusterNodes.map((node) => node.year).filter((year): year is number => year !== null),
    )

    const topKeywords = topKeywordsByDistinctiveness(
      clusterNodes.map((node) => keywordsById.get(node.id) ?? []),
      allKeywordLists,
    )

    summaries.push({
      cluster,
      size: clusterNodes.length,
      topPapers,
      medianYear,
      topKeywords,
      allUnresolved,
    })
  }

  // Numbered clusters are already 1..N by size (see clusterDisplay.ts);
  // "Other" always sorts last regardless of its combined size.
  return summaries.sort((a, b) => {
    if (a.cluster === OTHER_CLUSTER_ID) return 1
    if (b.cluster === OTHER_CLUSTER_ID) return -1
    return a.cluster - b.cluster
  })
}
