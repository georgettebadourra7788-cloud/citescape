import Graph from 'graphology'
import { describe, expect, it } from 'vitest'
import { runLouvain } from './louvain'

// Two dense 4-node cliques joined by a single weak bridge edge — Louvain
// should keep them as separate clusters, and (with a fixed seed) do so
// identically no matter how many times we build and run it.
function buildTwoClusterGraph(): Graph {
  const graph = new Graph({ type: 'undirected' })
  const groupA = ['A1', 'A2', 'A3', 'A4']
  const groupB = ['B1', 'B2', 'B3', 'B4']
  for (const id of [...groupA, ...groupB]) graph.addNode(id)

  function connectAll(ids: string[], weight: number) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        graph.addEdge(ids[i], ids[j], { weight })
      }
    }
  }

  connectAll(groupA, 5)
  connectAll(groupB, 5)
  graph.addEdge('A1', 'B1', { weight: 1 })

  return graph
}

describe('runLouvain', () => {
  it('produces an identical partition across two independent runs on identically-built graphs', () => {
    const first = runLouvain(buildTwoClusterGraph())
    const second = runLouvain(buildTwoClusterGraph())

    expect(Object.fromEntries(second)).toEqual(Object.fromEntries(first))
  })

  it('separates the two densely-connected groups into different clusters', () => {
    const clusters = runLouvain(buildTwoClusterGraph())
    const groupA = ['A1', 'A2', 'A3', 'A4']
    const groupB = ['B1', 'B2', 'B3', 'B4']

    const clusterIdsA = new Set(groupA.map((id) => clusters.get(id)))
    const clusterIdsB = new Set(groupB.map((id) => clusters.get(id)))

    expect(clusterIdsA.size).toBe(1)
    expect(clusterIdsB.size).toBe(1)
    expect([...clusterIdsA][0]).not.toBe([...clusterIdsB][0])
  })

  it('returns an empty map for an empty graph', () => {
    expect(runLouvain(new Graph()).size).toBe(0)
  })
})
