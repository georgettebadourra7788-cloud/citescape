import { describe, expect, it } from 'vitest'
import {
  buildDisplayGraph,
  MAX_FORCED_LABELS,
  MAX_NODE_SIZE,
  MIN_NODE_SIZE,
} from './buildDisplayGraph'
import { OTHER_COLOR } from '../../lib/graph/clusterColors'
import type { NetworkResult, GraphNode, ClusterSummary } from '../../lib/graph/types'

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

function cluster(overrides: Partial<ClusterSummary> & { cluster: number }): ClusterSummary {
  return {
    size: 1,
    topPapers: [],
    medianYear: null,
    topKeywords: [],
    allUnresolved: false,
    ...overrides,
  }
}

describe('buildDisplayGraph', () => {
  it('scales node size by citation rank (log scale) between the min and max bounds, a 3x ratio', () => {
    expect(MAX_NODE_SIZE).toBe(MIN_NODE_SIZE * 3)

    const network: NetworkResult = {
      nodes: [node({ id: 'A', globalCitations: 0 }), node({ id: 'B', globalCitations: 100 })],
      edges: [],
      clusters: [],
    }
    const graph = buildDisplayGraph(network)

    expect(graph.getNodeAttribute('A', 'size')).toBe(MIN_NODE_SIZE)
    expect(graph.getNodeAttribute('B', 'size')).toBe(MAX_NODE_SIZE)
  })

  it('force-labels only each cluster\'s top paper, capped at MAX_FORCED_LABELS', () => {
    const clusters = Array.from({ length: MAX_FORCED_LABELS + 3 }, (_, i) =>
      cluster({ cluster: i + 1, topPapers: [{ id: `top${i}`, title: `Top ${i}`, citations: 1 }] }),
    )
    const nodes = clusters.map((c) => node({ id: c.topPapers[0].id, label: c.topPapers[0].title }))
    const graph = buildDisplayGraph({ nodes, edges: [], clusters })

    const forced = nodes.filter((n) => graph.getNodeAttribute(n.id, 'forceLabel')).length
    expect(forced).toBe(MAX_FORCED_LABELS)
    // The earliest (biggest) clusters keep their forced label.
    expect(graph.getNodeAttribute('top0', 'forceLabel')).toBe(true)
    expect(graph.getNodeAttribute(`top${MAX_FORCED_LABELS + 2}`, 'forceLabel')).toBe(false)
  })

  it('renders unresolved nodes gray and never labels them, even if they would be a label pick', () => {
    const clusters = [cluster({ cluster: 1, topPapers: [{ id: 'ghost', title: 'x', citations: 1 }] })]
    const nodes = [node({ id: 'ghost', resolved: false, label: 'Unknown work (no OpenAlex record)' })]
    const graph = buildDisplayGraph({ nodes, edges: [], clusters })

    expect(graph.getNodeAttribute('ghost', 'color')).toBe(OTHER_COLOR)
    expect(graph.getNodeAttribute('ghost', 'label')).toBeNull()
    expect(graph.getNodeAttribute('ghost', 'forceLabel')).toBe(false)
  })

  it('drops edges that reference a node outside the network (defensive)', () => {
    const network: NetworkResult = {
      nodes: [node({ id: 'A' }), node({ id: 'B' })],
      edges: [{ source: 'A', target: 'ghost', weight: 1 }],
      clusters: [],
    }
    const graph = buildDisplayGraph(network)
    expect(graph.edges()).toHaveLength(0)
  })

  it('carries edge weight through for later min-link-strength filtering', () => {
    const network: NetworkResult = {
      nodes: [node({ id: 'A' }), node({ id: 'B' })],
      edges: [{ source: 'A', target: 'B', weight: 7 }],
      clusters: [],
    }
    const graph = buildDisplayGraph(network)
    expect(graph.getEdgeAttribute('A', 'B', 'weight')).toBe(7)
  })
})
