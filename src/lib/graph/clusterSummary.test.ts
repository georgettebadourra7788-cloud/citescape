import { describe, expect, it } from 'vitest'
import { buildClusterSummaries, median, topKeywordsByDistinctiveness } from './clusterSummary'
import { OTHER_CLUSTER_ID } from './clusterDisplay'
import type { GraphNode } from './types'

describe('median', () => {
  it('returns null for an empty list', () => {
    expect(median([])).toBeNull()
  })

  it('returns the middle value for an odd-length list', () => {
    expect(median([2019, 2020, 2021])).toBe(2020)
  })

  it('averages the two middle values for an even-length list', () => {
    expect(median([2018, 2020, 2021, 2023])).toBe(2020.5)
  })
})

describe('topKeywordsByDistinctiveness', () => {
  // 6 papers total. 'coastal' is in all 6 (shared, non-distinctive:
  // clusterShare 1 / globalShare 1 = score 1). 'adaptation' is only in
  // this cluster's 3 papers (clusterShare 1 / globalShare 0.5 = score 2)
  // — more distinctive, so it should outrank the shared term.
  const clusterLists = [
    ['coastal', 'adaptation'],
    ['coastal', 'adaptation'],
    ['coastal', 'adaptation'],
  ]
  const allLists = [
    ...clusterLists,
    ['coastal', 'biodiversity'],
    ['coastal', 'biodiversity'],
    ['coastal', 'biodiversity'],
  ]

  it('ranks a term exclusive to the cluster above one shared across the whole set', () => {
    const result = topKeywordsByDistinctiveness(clusterLists, allLists)
    expect(result).toEqual(['adaptation', 'coastal'])
  })

  it('drops a term below the minimum count even if perfectly distinctive', () => {
    const sparseCluster = [['rare-term'], ['other'], ['other']]
    const result = topKeywordsByDistinctiveness(sparseCluster, sparseCluster, { minCount: 3 })
    expect(result).toEqual([]) // 'rare-term' and 'other' both appear <3 times
  })

  it('truncates to the limit', () => {
    const cluster = [['a', 'b'], ['a', 'b'], ['a', 'c'], ['a', 'c']]
    const result = topKeywordsByDistinctiveness(cluster, cluster, { minCount: 1, limit: 1 })
    expect(result).toHaveLength(1)
  })
})

function node(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    label: overrides.id,
    year: 2020,
    inSetCitations: 0,
    globalCitations: null,
    cluster: 1,
    degree: 1,
    x: 0,
    y: 0,
    ...overrides,
  }
}

describe('buildClusterSummaries', () => {
  it('groups nodes by cluster and computes size, top papers, median year, and top keywords', () => {
    const nodes: GraphNode[] = [
      node({ id: 'A', cluster: 1, globalCitations: 10, year: 2019, label: 'Paper A' }),
      node({ id: 'B', cluster: 1, globalCitations: 30, year: 2021, label: 'Paper B' }),
      node({ id: 'C', cluster: 2, globalCitations: 5, year: 2018, label: 'Paper C' }),
    ]
    const keywordsById = new Map<string, string[]>([
      ['A', ['coastal', 'adaptation']],
      ['B', ['coastal', 'flooding']],
      ['C', ['drought']],
    ])

    const summaries = buildClusterSummaries(nodes, keywordsById)

    expect(summaries).toHaveLength(2)
    const [clusterOne, clusterTwo] = summaries

    expect(clusterOne.cluster).toBe(1)
    expect(clusterOne.size).toBe(2)
    expect(clusterOne.medianYear).toBe(2020)
    expect(clusterOne.topPapers[0]).toEqual({ id: 'B', title: 'Paper B', citations: 30 })
    // Every keyword here appears in fewer than 3 papers (the distinctiveness
    // minimum-count default) — see topKeywordsByDistinctiveness above for
    // keyword-ranking coverage with a fixture large enough to clear it.
    expect(clusterOne.topKeywords).toEqual([])

    expect(clusterTwo.cluster).toBe(2)
    expect(clusterTwo.size).toBe(1)
    expect(clusterTwo.topKeywords).toEqual([])
  })

  it('gives two clusters clearly different top keywords end to end', () => {
    // Cluster 1: 3 papers about "adaptation"; Cluster 2: 3 papers about
    // "biodiversity"; both clusters also mention the shared term "coastal".
    const nodes: GraphNode[] = [
      node({ id: 'A1', cluster: 1 }),
      node({ id: 'A2', cluster: 1 }),
      node({ id: 'A3', cluster: 1 }),
      node({ id: 'B1', cluster: 2 }),
      node({ id: 'B2', cluster: 2 }),
      node({ id: 'B3', cluster: 2 }),
    ]
    const keywordsById = new Map<string, string[]>([
      ['A1', ['coastal', 'adaptation']],
      ['A2', ['coastal', 'adaptation']],
      ['A3', ['coastal', 'adaptation']],
      ['B1', ['coastal', 'biodiversity']],
      ['B2', ['coastal', 'biodiversity']],
      ['B3', ['coastal', 'biodiversity']],
    ])

    const summaries = buildClusterSummaries(nodes, keywordsById)
    const clusterOne = summaries.find((s) => s.cluster === 1)!
    const clusterTwo = summaries.find((s) => s.cluster === 2)!

    // The distinctive term ranks first in each cluster, ahead of the term
    // shared across the whole set — and the two clusters' top terms differ.
    expect(clusterOne.topKeywords[0]).toBe('adaptation')
    expect(clusterTwo.topKeywords[0]).toBe('biodiversity')
    expect(clusterOne.topKeywords[0]).not.toBe(clusterTwo.topKeywords[0])
  })

  it('ranks top papers by global citations when present, falling back to in-set citations', () => {
    const nodes: GraphNode[] = [
      node({ id: 'A', cluster: 1, globalCitations: 5, inSetCitations: 99 }),
      node({ id: 'B', cluster: 1, globalCitations: 50, inSetCitations: 1 }),
      // Co-citation-style node: no global count at all.
      node({ id: 'C', cluster: 1, globalCitations: null, inSetCitations: 10 }),
    ]
    const summaries = buildClusterSummaries(nodes, new Map())
    expect(summaries[0].topPapers.map((p) => p.id)).toEqual(['B', 'C', 'A'])
  })

  it('sorts the Other bucket last even when it is the largest group', () => {
    const nodes: GraphNode[] = [
      node({ id: 'other1', cluster: OTHER_CLUSTER_ID }),
      node({ id: 'other2', cluster: OTHER_CLUSTER_ID }),
      node({ id: 'other3', cluster: OTHER_CLUSTER_ID }),
      node({ id: 'real1', cluster: 1 }),
    ]
    const summaries = buildClusterSummaries(nodes, new Map())
    expect(summaries.map((s) => s.cluster)).toEqual([1, OTHER_CLUSTER_ID])
  })

  it('never picks an unresolved node as the top/label paper unless every node is unresolved', () => {
    const nodes: GraphNode[] = [
      node({ id: 'unresolved', cluster: 1, inSetCitations: 999, resolved: false }),
      node({ id: 'resolved', cluster: 1, inSetCitations: 1, resolved: true }),
    ]
    const summaries = buildClusterSummaries(nodes, new Map())
    expect(summaries[0].topPapers[0].id).toBe('resolved')
    expect(summaries[0].allUnresolved).toBe(false)
  })

  it('flags allUnresolved only when every node in the cluster is unresolved', () => {
    const nodes: GraphNode[] = [
      node({ id: 'a', cluster: 1, resolved: false }),
      node({ id: 'b', cluster: 1, resolved: false }),
      node({ id: 'c', cluster: 2, resolved: false }),
      node({ id: 'd', cluster: 2, resolved: true }),
    ]
    const summaries = buildClusterSummaries(nodes, new Map())
    const clusterOne = summaries.find((s) => s.cluster === 1)!
    const clusterTwo = summaries.find((s) => s.cluster === 2)!
    expect(clusterOne.allUnresolved).toBe(true)
    expect(clusterOne.topPapers[0].id).toBe('a') // forced fallback, all unresolved
    expect(clusterTwo.allUnresolved).toBe(false)
    expect(clusterTwo.topPapers[0].id).toBe('d')
  })
})
