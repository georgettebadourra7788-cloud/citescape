import { describe, expect, it } from 'vitest'
import { buildDisplayGraph, LABELED_NODE_COUNT, MAX_NODE_SIZE, MIN_NODE_SIZE } from './buildDisplayGraph'
import type { NetworkResult, GraphNode } from '../../lib/graph/types'

function node(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    label: overrides.id,
    year: 2020,
    citations: 0,
    cluster: 0,
    degree: 1,
    x: 0,
    y: 0,
    ...overrides,
  }
}

describe('buildDisplayGraph', () => {
  it('scales node size by citations (log scale) between the min and max bounds', () => {
    const network: NetworkResult = {
      nodes: [
        node({ id: 'A', citations: 0 }),
        node({ id: 'B', citations: 100 }),
      ],
      edges: [],
      clusters: [],
    }
    const graph = buildDisplayGraph(network)

    expect(graph.getNodeAttribute('A', 'size')).toBe(MIN_NODE_SIZE)
    expect(graph.getNodeAttribute('B', 'size')).toBe(MAX_NODE_SIZE)
  })

  it('only labels the top LABELED_NODE_COUNT nodes by citations', () => {
    const nodes = Array.from({ length: LABELED_NODE_COUNT + 5 }, (_, i) =>
      node({ id: `N${i}`, citations: i, label: `Paper ${i}` }),
    )
    const graph = buildDisplayGraph({ nodes, edges: [], clusters: [] })

    const labeledCount = nodes.filter((n) => graph.getNodeAttribute(n.id, 'label') !== null).length
    expect(labeledCount).toBe(LABELED_NODE_COUNT)
    // The highest-citation nodes should be the labeled ones.
    expect(graph.getNodeAttribute('N4', 'label')).toBeNull()
    expect(graph.getNodeAttribute('N24', 'label')).toBe('Paper 24')
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
