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

const noClusters = new Map<string, number>()

describe('computeLayout', () => {
  it('returns an empty map for an empty graph', () => {
    expect(computeLayout(new Graph(), noClusters).size).toBe(0)
  })

  it('returns a position for every node', () => {
    const positions = computeLayout(buildGraph(), noClusters)
    expect([...positions.keys()].sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    for (const pos of positions.values()) {
      expect(Number.isFinite(pos.x)).toBe(true)
      expect(Number.isFinite(pos.y)).toBe(true)
    }
  })

  it('produces bit-identical positions across two runs on identically-built graphs', () => {
    const first = computeLayout(buildGraph(), noClusters)
    const second = computeLayout(buildGraph(), noClusters)
    expect(Object.fromEntries(second)).toEqual(Object.fromEntries(first))
  })
})

// --- Layout quality: same-cluster nodes should end up clearly closer
// together than different-cluster nodes. This is the regression the
// "hollow ring" bug broke (linLogMode + adjustSizes + a 4x scalingRatio
// boost pushed connected nodes apart instead of together) — see the fix
// in layout.ts and its commit message for the numbers that proved it.

function buildClusteredFixture(): { graph: Graph; clusterById: Map<string, number> } {
  const graph = new Graph({ type: 'undirected' })
  const clusterById = new Map<string, number>()
  const clusterSizes = [5, 5, 5]

  clusterSizes.forEach((size, clusterIndex) => {
    const cluster = clusterIndex + 1 // 1..N, matching remapClustersForDisplay's convention
    for (let i = 0; i < size; i++) {
      const nodeId = `c${cluster}n${i}`
      graph.addNode(nodeId)
      clusterById.set(nodeId, cluster)
    }
  })

  // Complete graph within each cluster, no edges across clusters — the
  // clearest possible signal that a working layout should separate.
  clusterSizes.forEach((size, clusterIndex) => {
    const cluster = clusterIndex + 1
    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        graph.addEdge(`c${cluster}n${i}`, `c${cluster}n${j}`, { weight: 5 })
      }
    }
  })

  return { graph, clusterById }
}

function meanDistances(
  nodeIds: string[],
  clusterById: Map<string, number>,
  positions: Map<string, { x: number; y: number }>,
) {
  let sameTotal = 0
  let sameCount = 0
  let crossTotal = 0
  let crossCount = 0

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const a = positions.get(nodeIds[i])!
      const b = positions.get(nodeIds[j])!
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (clusterById.get(nodeIds[i]) === clusterById.get(nodeIds[j])) {
        sameTotal += distance
        sameCount += 1
      } else {
        crossTotal += distance
        crossCount += 1
      }
    }
  }

  return { meanSameCluster: sameTotal / sameCount, meanCrossCluster: crossTotal / crossCount }
}

describe('computeLayout quality', () => {
  it('places same-cluster nodes clearly closer together than different-cluster nodes', () => {
    const { graph, clusterById } = buildClusteredFixture()
    const positions = computeLayout(graph, clusterById)

    const { meanSameCluster, meanCrossCluster } = meanDistances(graph.nodes(), clusterById, positions)

    // Regression guard: the "hollow ring" bug produced same≈98/cross≈176
    // (ratio ~1.8, clusters indistinguishable). A working layout on this
    // fixture should give a ratio well above that.
    expect(meanCrossCluster).toBeGreaterThan(meanSameCluster * 3)
  })
})
