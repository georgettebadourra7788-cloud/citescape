import forceAtlas2, { type ForceAtlas2Settings } from 'graphology-layout-forceatlas2'
import type Graph from 'graphology'
import { createSeededRng } from './seededRng'

/** Enough iterations to converge on real (noisier, larger) graphs, not just toy fixtures. */
export const LAYOUT_ITERATIONS = 600

/** Distinct from LOUVAIN_SEED — this seeds only the initial-position jitter. */
export const LAYOUT_SEED = 7

const CLUSTER_RING_SPACING = 220
const JITTER_RADIUS_PER_NODE = 6
const MIN_CENTER_RADIUS = 200

/**
 * Multiplier on FA2's auto-inferred scalingRatio (repulsion strength) only
 * — gravity is left at whatever inferSettings computed. Measured against a
 * hand-built fixture: scaling *only* scalingRatio spreads the whole layout
 * out while preserving the same/cross-cluster distance ratio exactly
 * (it's a uniform "zoom out"). Raising gravity instead, or enabling
 * linLogMode/adjustSizes, measurably degraded cluster separation in the
 * same test — see the regression fix in this file's history.
 */
const SCALING_RATIO_MULTIPLIER = 2

export interface NodePosition {
  x: number
  y: number
}

/**
 * ForceAtlas2 starts from whatever x/y a node already has. Seed each
 * cluster's nodes in a jittered blob around a per-cluster center, with the
 * centers themselves spread around a larger circle — so FA2 starts from
 * "roughly clustered" instead of one big ring, and mainly has to refine
 * separation rather than discover clustering from scratch. Deterministic
 * via a fixed seed, not `Math.random()`.
 */
function assignClusterSeededLayout(graph: Graph, clusterById: Map<string, number>): void {
  const rng = createSeededRng(LAYOUT_SEED)
  const nodeIds = graph.nodes()

  const nodesByCluster = new Map<number, string[]>()
  for (const nodeId of nodeIds) {
    const cluster = clusterById.get(nodeId) ?? 0
    let clusterNodes = nodesByCluster.get(cluster)
    if (!clusterNodes) {
      clusterNodes = []
      nodesByCluster.set(cluster, clusterNodes)
    }
    clusterNodes.push(nodeId)
  }

  const clusterIds = [...nodesByCluster.keys()].sort((a, b) => a - b)
  const numClusters = clusterIds.length || 1
  const centerRadius = Math.max(MIN_CENTER_RADIUS, (numClusters * CLUSTER_RING_SPACING) / (2 * Math.PI))

  clusterIds.forEach((clusterId, clusterIndex) => {
    const angle = (2 * Math.PI * clusterIndex) / numClusters
    const centerX = centerRadius * Math.cos(angle)
    const centerY = centerRadius * Math.sin(angle)
    const clusterNodes = nodesByCluster.get(clusterId)!
    const jitterRadius = Math.max(20, Math.sqrt(clusterNodes.length) * JITTER_RADIUS_PER_NODE)

    for (const nodeId of clusterNodes) {
      const nodeAngle = rng() * 2 * Math.PI
      const r = rng() * jitterRadius
      graph.setNodeAttribute(nodeId, 'x', centerX + r * Math.cos(nodeAngle))
      graph.setNodeAttribute(nodeId, 'y', centerY + r * Math.sin(nodeAngle))
    }
  })
}

/**
 * Computes a deterministic ForceAtlas2 layout on the FULL graph (every
 * node/edge, regardless of any later display-only filtering like the
 * minimum-link-strength slider — that only hides edges in Sigma, it never
 * triggers a re-layout). A fixed cluster-seeded start plus a fixed
 * iteration count means the same graph always yields the same positions.
 */
export function computeLayout(graph: Graph, clusterById: Map<string, number>): Map<string, NodePosition> {
  if (graph.order === 0) return new Map()

  assignClusterSeededLayout(graph, clusterById)

  const inferred = forceAtlas2.inferSettings(graph)
  const settings: ForceAtlas2Settings = {
    ...inferred,
    edgeWeightInfluence: 1,
    scalingRatio: (inferred.scalingRatio ?? 10) * SCALING_RATIO_MULTIPLIER,
  }

  const positions = forceAtlas2(graph, {
    iterations: LAYOUT_ITERATIONS,
    settings,
    getEdgeWeight: 'weight',
  })

  return new Map(Object.entries(positions))
}
