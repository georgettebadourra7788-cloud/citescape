import { describe, expect, it } from 'vitest'
import {
  buildAboutRows,
  buildClustersRows,
  buildCoCitationNodesRows,
  buildEdgesRows,
  buildPapersRows,
} from './excelRows'
import { APP_VERSION } from '../appInfo'
import { brand } from '../../brand'
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
    layoutIterations: 300,
    louvainRuns: 10,
    couplingLouvainSeed: 42,
    couplingModularity: 0.4231,
    coCitationLouvainSeed: 45,
    coCitationModularity: 0.3102,
    duplicatePapersMerged: 0,
    coCitationNodesMerged: 0,
  },
  duplicatePapers: {},
  fetchedAt: new Date('2026-09-19T12:00:00Z'),
  dataSource: 'live',
  figure: {
    networkLabel: 'Bibliographic coupling',
    minLinkStrength: 2,
    visibleEdgeCount: 1,
    totalEdgeCount: 1,
  },
}

describe('buildPapersRows', () => {
  it("builds one row per paper, in fetch order, with an OpenAlex ID, fetch rank, and both networks' cluster labels", () => {
    const rows = buildPapersRows(context)
    expect(rows).toEqual([
      {
        'OpenAlex ID': 'P1',
        'Fetch rank': 1,
        Title: 'Paper One',
        Authors: 'Ada Lovelace',
        Year: 2019,
        DOI: 'https://doi.org/10.1/p1',
        Citations: 42,
        'Coupling cluster': 'Cluster 1',
        'Co-citation cluster': '', // P1 isn't itself a co-citation node
        'Merged duplicate IDs': '',
      },
      {
        'OpenAlex ID': 'P2',
        'Fetch rank': 2,
        Title: 'Paper Two',
        Authors: 'Alan Turing, Grace Hopper',
        Year: 2021,
        DOI: '',
        Citations: 7,
        'Coupling cluster': 'Cluster 1',
        'Co-citation cluster': '',
        'Merged duplicate IDs': '',
      },
    ])
  })

  it("lists the merged-away ids on the survivor's row, and leaves other rows' cluster blank", () => {
    const contextWithDuplicate: ExportContext = {
      ...context,
      papers: [...papers, makePaper({ id: 'P1-dup', title: 'Paper One (dup)', year: 2019 })],
      duplicatePapers: { P1: ['P1-dup'] },
    }

    const rows = buildPapersRows(contextWithDuplicate)
    const byId = Object.fromEntries(rows.map((r) => [r['OpenAlex ID'], r]))

    expect(byId['P1']['Merged duplicate IDs']).toBe('P1-dup')
    // The merged-away paper still gets its own row (documenting the raw
    // fetch), but isn't a coupling-graph node of its own anymore.
    expect(byId['P1-dup']['Coupling cluster']).toBe('')
    expect(byId['P1-dup']['Merged duplicate IDs']).toBe('')
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
    expect(byField['Louvain seeds tried per network']).toBe('10')
    expect(byField['Bibliographic coupling: Louvain seed used']).toBe('42')
    expect(byField['Bibliographic coupling: modularity']).toBe('0.4231')
    expect(byField['Co-citation: Louvain seed used']).toBe('45')
    expect(byField['Co-citation: modularity']).toBe('0.3102')
    expect(byField['ForceAtlas2 layout iterations']).toBe('300')
    expect(byField['Duplicate papers merged']).toBe('0')
    expect(byField['Duplicate co-citation nodes merged']).toBe('0')
    expect(byField[`${brand.name} version`]).toBe(APP_VERSION)
  })

  it('reports how many duplicate papers/co-citation nodes were merged', () => {
    const contextWithMerges: ExportContext = {
      ...context,
      meta: { ...context.meta, duplicatePapersMerged: 3, coCitationNodesMerged: 2 },
    }
    const rows = buildAboutRows(contextWithMerges)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Duplicate papers merged']).toBe('3')
    expect(byField['Duplicate co-citation nodes merged']).toBe('2')
  })

  it('includes the current figure\'s network, minimum link strength, and visible edge count', () => {
    const rows = buildAboutRows(context)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Figure network']).toBe('Bibliographic coupling')
    expect(byField['Figure minimum link strength']).toBe('2')
    expect(byField['Edges shown in figure']).toBe('1 of 1')
  })

  it('notes that GEXF/Pajek/Excel edges are unfiltered and the Papers co-citation column is partial', () => {
    const rows = buildAboutRows(context)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Note: edges in figure vs. exports']).toMatch(/every edge/i)
    expect(byField["Note: Papers sheet's Co-citation cluster column"]).toMatch(
      /only filled for papers/i,
    )
  })

  it('reports "Data retrieved" (date and time) and "Source: live OpenAlex query" for a fresh search', () => {
    const rows = buildAboutRows(context)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Data retrieved']).toBe('2026-09-19T12:00:00.000Z')
    expect(byField['Source']).toBe('live OpenAlex query')
    expect(byField['Date fetched']).toBeUndefined() // renamed, not duplicated
  })

  it('reports "Source: local cache, originally retrieved on <date>" for a reopened saved project', () => {
    const cachedContext: ExportContext = { ...context, dataSource: 'cache' }
    const rows = buildAboutRows(cachedContext)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Source']).toBe('local cache, originally retrieved on 2026-09-19')
  })

  it('reports zero papers missing from the coupling map when every fetched paper is shown', () => {
    const rows = buildAboutRows(context)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Papers shown in coupling map']).toBe('2')
    expect(byField['Papers not shown in coupling map']).toBe('0')
  })

  it('breaks down papers missing from the coupling map by reason, including merged duplicates', () => {
    const contextWithGaps: ExportContext = {
      ...context,
      papers: [
        ...papers,
        makePaper({ id: 'P3', title: 'No references', referencedWorks: [] }),
        makePaper({ id: 'P4', title: 'Too few shared refs', referencedWorks: ['R9'] }),
        makePaper({ id: 'P5', title: 'Merged away', referencedWorks: ['R1'] }),
      ],
      duplicatePapers: { P1: ['P5'] },
    }

    const rows = buildAboutRows(contextWithGaps)
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]))

    expect(byField['Papers shown in coupling map']).toBe('2')
    expect(byField['Papers not shown in coupling map']).toBe(
      '3 (1 with no reference list, 1 below the minimum shared-reference threshold, ' +
        '1 merged into a duplicate record)',
    )
  })
})

describe('buildCoCitationNodesRows', () => {
  // R1 is co-cited with both P1 (also one of our fetched papers) and R3
  // (an external reference only, never one of our own papers). Hand-verifiable
  // weighted degrees: R1: 3 + 2 = 5      P1: 3      R3: 2
  const coCitationWithEdges: NetworkResult = {
    nodes: [
      node({
        id: 'R1',
        label: 'Reference One',
        cluster: 1,
        inSetCitations: 2,
        globalCitations: 99,
        doi: 'https://doi.org/10.1/r1',
      }),
      node({ id: 'P1', label: 'Paper One', cluster: 1, inSetCitations: 1, globalCitations: 42 }),
      node({
        id: 'R3',
        label: 'Reference Three',
        cluster: 2,
        inSetCitations: 1,
        resolved: true,
        globalCitations: null,
        doi: null,
      }),
    ],
    edges: [
      { source: 'R1', target: 'P1', weight: 3 },
      { source: 'R1', target: 'R3', weight: 2 },
    ],
    clusters: [],
  }
  const contextWithEdges: ExportContext = { ...context, coCitation: coCitationWithEdges }

  it('emits exactly one row per co-citation node', () => {
    const rows = buildCoCitationNodesRows(contextWithEdges)
    expect(rows).toHaveLength(coCitationWithEdges.nodes.length)
  })

  it('computes weighted degree (times co-cited) by summing incident edge weights', () => {
    const rows = buildCoCitationNodesRows(contextWithEdges)
    const byId = Object.fromEntries(rows.map((r) => [r['OpenAlex ID'], r]))

    expect(byId['R1']['Times co-cited (weighted degree)']).toBe(5)
    expect(byId['P1']['Times co-cited (weighted degree)']).toBe(3)
    expect(byId['R3']['Times co-cited (weighted degree)']).toBe(2)
  })

  it('fills Global citations and DOI from the node\'s own batched lookup, not just papers we fetched', () => {
    const rows = buildCoCitationNodesRows(contextWithEdges)
    const byId = Object.fromEntries(rows.map((r) => [r['OpenAlex ID'], r]))

    // R1 is a reference-only node (never one of our fetched papers), but
    // the batched lookup now fetches cited_by_count/doi for every
    // resolved reference — see fetchWorksByIds.
    expect(byId['R1']['Global citations']).toBe(99)
    expect(byId['R1'].DOI).toBe('https://doi.org/10.1/r1')

    expect(byId['P1']['Global citations']).toBe(42)

    // A resolved node OpenAlex simply has no DOI/citation count for.
    expect(byId['R3']['Global citations']).toBe('')
    expect(byId['R3'].DOI).toBe('')
  })

  it('flags "In fetched set?" against our own papers, independent of Global citations', () => {
    const rows = buildCoCitationNodesRows(contextWithEdges)
    const byId = Object.fromEntries(rows.map((r) => [r['OpenAlex ID'], r]))

    expect(byId['P1']['In fetched set?']).toBe('Yes')
    expect(byId['R1']['In fetched set?']).toBe('No')
  })

  it('labels clusters the same way the legend does', () => {
    const rows = buildCoCitationNodesRows(contextWithEdges)
    const byId = Object.fromEntries(rows.map((r) => [r['OpenAlex ID'], r]))
    expect(byId['R1'].Cluster).toBe('Cluster 1')
    expect(byId['R3'].Cluster).toBe('Cluster 2')
  })
})
