import Graph from 'graphology'
import { describe, expect, it } from 'vitest'
import { LOUVAIN_SEEDS, runLouvain } from './louvain'

// Two dense 4-node cliques joined by a single weak bridge edge — Louvain
// should keep them as separate clusters, and (with a fixed seed) do so
// identically no matter how many times we build and run it.
function buildTwoClusterGraph(nodeOrder: string[] = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4']): Graph {
  const graph = new Graph({ type: 'undirected' })
  for (const id of nodeOrder) graph.addNode(id)

  function connectAll(ids: string[], weight: number) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!graph.hasEdge(ids[i], ids[j])) graph.addEdge(ids[i], ids[j], { weight })
      }
    }
  }

  connectAll(['A1', 'A2', 'A3', 'A4'], 5)
  connectAll(['B1', 'B2', 'B3', 'B4'], 5)
  if (!graph.hasEdge('A1', 'B1')) graph.addEdge('A1', 'B1', { weight: 1 })

  return graph
}

describe('runLouvain', () => {
  it('produces an identical partition across two independent runs on identically-built graphs', () => {
    const first = runLouvain(buildTwoClusterGraph())
    const second = runLouvain(buildTwoClusterGraph())

    expect(Object.fromEntries(second.communities)).toEqual(Object.fromEntries(first.communities))
    expect(second.seed).toBe(first.seed)
    expect(second.modularity).toBe(first.modularity)
  })

  it('produces an identical partition when the same fixture is built with its nodes shuffled', () => {
    const inOrder = runLouvain(buildTwoClusterGraph())
    const shuffled = runLouvain(
      buildTwoClusterGraph(['B3', 'A1', 'B1', 'A4', 'B4', 'A2', 'B2', 'A3']),
    )

    expect(Object.fromEntries(shuffled.communities)).toEqual(Object.fromEntries(inOrder.communities))
    expect(shuffled.modularity).toBe(inOrder.modularity)
  })

  it('separates the two densely-connected groups into different clusters', () => {
    const { communities } = runLouvain(buildTwoClusterGraph())
    const groupA = ['A1', 'A2', 'A3', 'A4']
    const groupB = ['B1', 'B2', 'B3', 'B4']

    const clusterIdsA = new Set(groupA.map((id) => communities.get(id)))
    const clusterIdsB = new Set(groupB.map((id) => communities.get(id)))

    expect(clusterIdsA.size).toBe(1)
    expect(clusterIdsB.size).toBe(1)
    expect([...clusterIdsA][0]).not.toBe([...clusterIdsB][0])
  })

  it('reports the winning seed (from the fixed list) and how many seeds were tried', () => {
    const { seed, runs } = runLouvain(buildTwoClusterGraph())
    expect(LOUVAIN_SEEDS).toContain(seed)
    expect(runs).toBe(LOUVAIN_SEEDS.length)
  })

  it('reports a modularity score for a graph with real community structure', () => {
    const { modularity } = runLouvain(buildTwoClusterGraph())
    // Two well-separated cliques joined by one weak bridge should score well.
    expect(modularity).toBeGreaterThan(0.3)
  })

  it('returns an empty map (and zero runs) for an empty graph', () => {
    const result = runLouvain(new Graph())
    expect(result.communities.size).toBe(0)
    expect(result.runs).toBe(0)
  })
})
