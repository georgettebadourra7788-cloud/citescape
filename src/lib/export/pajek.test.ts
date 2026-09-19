import { describe, expect, it } from 'vitest'
import { buildPajek } from './pajek'
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

// Hand-verifiable: 3 nodes (one with a quote in its label), 2 edges.
const network: NetworkResult = {
  nodes: [
    node({ id: 'https://openalex.org/W1', label: 'Paper "One"' }),
    node({ id: 'https://openalex.org/W2', label: 'Paper Two' }),
    node({ id: 'https://openalex.org/W3', label: 'Paper Three' }),
  ],
  edges: [
    { source: 'https://openalex.org/W1', target: 'https://openalex.org/W2', weight: 5 },
    { source: 'https://openalex.org/W2', target: 'https://openalex.org/W3', weight: 2 },
  ],
  clusters: [],
}

describe('buildPajek', () => {
  const output = buildPajek(network)
  const lines = output.trim().split('\n')

  it('starts with *Vertices N', () => {
    expect(lines[0]).toBe('*Vertices 3')
  })

  it('numbers vertices 1-based in node order, with quoted (and escaped) labels', () => {
    expect(lines[1]).toBe('1 "Paper \\"One\\""')
    expect(lines[2]).toBe('2 "Paper Two"')
    expect(lines[3]).toBe('3 "Paper Three"')
  })

  it('writes *Edges with source/target as the 1-based vertex indices, then weight', () => {
    expect(lines[4]).toBe('*Edges')
    expect(lines[5]).toBe('1 2 5')
    expect(lines[6]).toBe('2 3 2')
  })

  it('drops an edge whose endpoint is not in the node set (defensive)', () => {
    const withGhostEdge: NetworkResult = {
      nodes: network.nodes,
      edges: [...network.edges, { source: 'https://openalex.org/W1', target: 'ghost', weight: 1 }],
      clusters: [],
    }
    const result = buildPajek(withGhostEdge)
    expect(result).not.toContain('ghost')
    // Still just the original two valid edges.
    expect(result.trim().split('\n').slice(5)).toEqual(['1 2 5', '2 3 2'])
  })
})
