import { describe, expect, it } from 'vitest'
import { buildAboutRows, buildClustersRows, buildEdgesRows, buildPapersRows } from './excelRows'
import { APP_VERSION } from '../appInfo'
import { makePaper } from '../graph/testFixtures'
import type { ExportContext } from './exportContext'
import type { GraphNode, NetworkResult } from '../graph/types'

function node(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    label: overrides.id,
    year: 2020,
    inSetCitations: 0,
    globalCitations: 0,
    cluster: 1,
    degree: 1,
    x: 0,
    y: 0,
    ...overrides,
  }
}

// Small hand-built fixture, verifiable by hand:
//   Papers P1, P2 both land in coupling Cluster 1, one edge between them.
//   Co-citation has a single reference node R1 in its own Cluster 1.
const papers = [
  makePaper({
    id: 'P1',
    title: 'Paper One',
    authors: ['Ada Lovelace'],
    year: 2019,
    doi: 'https://doi.org/10.1/p1',
    citedByCount: 42,
    referencedWorks: ['R1'],
  }),
  makePaper({
    id: 'P2',
    title: 'Paper Two',
    authors: ['Alan Turing', 'Grace Hopper'],
    year: 2021,
    doi: null,
    citedByCount: 7,
    referencedWorks: ['R1'],
  }),
]

const coupling: NetworkResult = {
  nodes: [node({ id: 'P1', label: 'Paper One', cluster: 1 }), node({ id: 'P2', label: 'Paper Two', cluster: 1 })],
  edges: [{ source: 'P1', target: 'P2', weight: 2 }],
  clusters: [
    {
      cluster: 1,
      size: 2,
      topPapers: [
        { id: 'P1', title: 'Paper One', citations: 42 },
        { id: 'P2', title: 'Paper Two', citations: 7 },
      ],
      medianYear: 2020,
      topKeywords: ['adaptation'],
      allUnresolved: false,
    },
  ],
}

const coCitation: NetworkResult = {
  nodes: [node({ id: 'R1', label: 'Reference One', cluster: 1, inSetCitations: 2 })],
  edges: [],
  clusters: [
    {
      cluster: 1,
      size: 1,
      topPapers: [{ id: 'R1', title: 'Reference One', citations: 2 }],
      medianYear: 2015,
      topKeywords: ['coastal'],
      allUnresolved: false,
    },
  ],
}

const context: ExportContext = {
  query: 'coastal cities',
  papers,
  coupling,
  coCitation,
  meta: {
    minCouplingWeight: 2,
    minCoCitationWeight: 2,
    maxCoCitationNodes: 200,
    louvainSeed: 42,
    layoutIterations: 300,
  },
  fetchedAt: new Date('2026-09-19T12:00:00Z'),
}

describe('buildPapersRows', () => {
  it('builds one row per paper with both networks\' cluster labels', () => {
    const rows = buildPapersRows(context)
    expect(rows).toEqual([
      {
        Title: 'Paper One',
        Authors: 'Ada Lovelace',
        Year: 2019,
        DOI: 'https://doi.org/10.1/p1',
        Citations: 42,
        'Coupling cluster': 'Cluster 1',
        'Co-citation cluster': '', // P1 isn't itself a co-citation node
      },
      {
        Title: 'Paper Two',
        Authors: 'Alan Turing, Grace Hopper',
        Year: 2021,
        DOI: '',
        Citations: 7,
        'Coupling cluster': 'Cluster 1',
        'Co-citation cluster': '',
      },
    ])
  })
})

describe('buildClustersRows', () => {
  it('emits one row per cluster per network, with the network named', () => {
    const rows = buildClustersRows(context)
    expect(rows).toEqual([
      {
        Network: 'Bibliographic coupling',
        Cluster: 'Cluster 1',
        Size: 2,
        'Top 5 works': 'Paper One | Paper Two',
        'Median year': 2020,
        'Top keywords': 'adaptation',
      },
      {
        Network: 'Co-citation',
        Cluster: 'Cluster 1',
        Size: 1,
        'Top 5 works': 'Reference One',
        'Median year': 2015,
        'Top keywords': 'coastal',
      },
    ])
  })
})

describe('buildEdgesRows', () => {
  it('resolves source/target titles from the network\'s own nodes', () => {
    expect(buildEdgesRows(coupling)).toEqual([
      {
        'Source ID': 'P1',
        'Source title': 'Paper One',
        'Target ID': 'P2',
        'Target title': 'Paper Two',
        Weight: 2,
      },
    ])
  })

  it('returns an empty array for a network with no edges', () => {
    expect(buildEdgesRows(coCitation)).toEqual([])
  })
})

describe('buildAboutRows', () => {
  it('includes the query, thresholds, seeds, and app version for reproducibility', () => {
    const rows = buildAboutRows(context)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Query']).toBe('coastal cities')
    expect(byField['Data source']).toContain('OpenAlex')
    expect(byField['Bibliographic coupling: minimum shared references']).toBe('2')
    expect(byField['Co-citation: minimum co-citation count']).toBe('2')
    expect(byField['Co-citation: max nodes']).toBe('200')
    expect(byField['Louvain clustering seed']).toBe('42')
    expect(byField['ForceAtlas2 layout iterations']).toBe('300')
    expect(byField['CiteScape version']).toBe(APP_VERSION)
  })
})
