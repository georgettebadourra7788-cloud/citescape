import { describe, expect, it } from 'vitest'
import { buildClusterSummaries, median, topKeywordsByFrequency } from './clusterSummary'
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
    citations: 0,
    cluster: 0,
    degree: 1,
    ...overrides,
  }
}

describe('buildClusterSummaries', () => {
  it('groups nodes by cluster and computes size, top papers, median year, and top keywords', () => {
    const nodes: GraphNode[] = [
      node({ id: 'A', cluster: 0, citations: 10, year: 2019, label: 'Paper A' }),
      node({ id: 'B', cluster: 0, citations: 30, year: 2021, label: 'Paper B' }),
      node({ id: 'C', cluster: 1, citations: 5, year: 2018, label: 'Paper C' }),
    ]
    const keywordsById = new Map<string, string[]>([
      ['A', ['coastal', 'adaptation']],
      ['B', ['coastal', 'flooding']],
      ['C', ['drought']],
    ])

    const summaries = buildClusterSummaries(nodes, keywordsById)

    expect(summaries).toHaveLength(2)
    // Sorted by cluster size descending: cluster 0 (2 nodes) before cluster 1 (1 node).
    const [clusterZero, clusterOne] = summaries

    expect(clusterZero.cluster).toBe(0)
    expect(clusterZero.size).toBe(2)
    expect(clusterZero.medianYear).toBe(2020)
    expect(clusterZero.topPapers[0]).toEqual({ id: 'B', title: 'Paper B', citations: 30 })
    expect(clusterZero.topKeywords).toContain('coastal')

    expect(clusterOne.cluster).toBe(1)
    expect(clusterOne.size).toBe(1)
    expect(clusterOne.topKeywords).toEqual(['drought'])
  })
})
