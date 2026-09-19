import { describe, expect, it } from 'vitest'
import { buildClusterSummaries, median, topKeywordsByFrequency } from './clusterSummary'
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

describe('topKeywordsByFrequency', () => {
  it('ranks by frequency and truncates to the limit', () => {
    const result = topKeywordsByFrequency(
      [['sea level rise', 'adaptation'], ['adaptation'], ['adaptation', 'flooding']],
      2,
    )
    expect(result).toEqual(['adaptation', 'sea level rise'])
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
    expect(clusterOne.topKeywords).toContain('coastal')

    expect(clusterTwo.cluster).toBe(2)
    expect(clusterTwo.size).toBe(1)
    expect(clusterTwo.topKeywords).toEqual(['drought'])
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
