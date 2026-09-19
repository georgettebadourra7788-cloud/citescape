import Graph from 'graphology'
import { describe, expect, it } from 'vitest'
import { computeLayout } from './layout'

function buildGraph(): Graph {
  const graph = new Graph({ type: 'undirected' })
  const ids = ['A', 'B', 'C', 'D', 'E']
  for (const id of ids) graph.addNode(id)
  graph.addEdge('A', 'B', { weight: 3 })
  graph.addEdge('B', 'C', { weight: 2 })
  graph.addEdge('C', 'D', { weight: 1 })
  graph.addEdge('D', 'E', { weight: 4 })
  graph.addEdge('A', 'E', { weight: 1 })
  return graph
}

describe('computeLayout', () => {
  it('returns an empty map for an empty graph', () => {
    expect(computeLayout(new Graph()).size).toBe(0)
  })

  it('returns a position for every node', () => {
    const positions = computeLayout(buildGraph())
    expect([...positions.keys()].sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    for (const pos of positions.values()) {
      expect(Number.isFinite(pos.x)).toBe(true)
      expect(Number.isFinite(pos.y)).toBe(true)
    }
  })

  it('produces bit-identical positions across two runs on identically-built graphs', () => {
    const first = computeLayout(buildGraph())
    const second = computeLayout(buildGraph())
    expect(Object.fromEntries(second)).toEqual(Object.fromEntries(first))
  })
})
