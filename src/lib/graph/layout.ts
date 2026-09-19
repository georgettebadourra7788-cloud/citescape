import forceAtlas2, { type ForceAtlas2Settings } from 'graphology-layout-forceatlas2'
import type Graph from 'graphology'

/** Fixed iteration count (not a convergence check) so layout is reproducible. */
export const LAYOUT_ITERATIONS = 300

export interface NodePosition {
  x: number
  y: number
}

/**
 * ForceAtlas2 starts from whatever x/y a node already has, so an
 * all-nodes-at-the-origin graph never breaks symmetry. Seed a deterministic
 * circle (by node insertion order — itself deterministic, see coupling.ts /
 * coCitation.ts) as the starting layout instead of anything random.
 */
function assignCircularLayout(graph: Graph): void {
  const nodes = graph.nodes()
  const radius = Math.max(10, Math.sqrt(nodes.length) * 10)
  nodes.forEach((nodeId, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    graph.setNodeAttribute(nodeId, 'x', radius * Math.cos(angle))
    graph.setNodeAttribute(nodeId, 'y', radius * Math.sin(angle))
  })
}

/**
 * Multiplier on FA2's auto-inferred scalingRatio (repulsion strength).
 * The inferred default packs clusters too tightly together once there are
 * a few hundred nodes; this pushes disconnected clusters further apart so
 * the map doesn't read as one crowded blob.
 */
const SCALING_RATIO_MULTIPLIER = 4

/**
 * Computes a deterministic ForceAtlas2 layout: a fixed circular start plus
 * a fixed iteration count means the same graph always yields the same
 * positions.
 *
 * If the graph's nodes carry a `size` attribute (set by the caller before
 * calling this — see assemble.ts), `adjustSizes` uses it to keep nodes
 * from overlapping.
 */
export function computeLayout(graph: Graph): Map<string, NodePosition> {
  if (graph.order === 0) return new Map()

  assignCircularLayout(graph)

  const inferred = forceAtlas2.inferSettings(graph)
  const settings: ForceAtlas2Settings = {
    ...inferred,
    edgeWeightInfluence: 1,
    linLogMode: true,
    adjustSizes: true,
    scalingRatio: (inferred.scalingRatio ?? 10) * SCALING_RATIO_MULTIPLIER,
  }

  const positions = forceAtlas2(graph, {
    iterations: LAYOUT_ITERATIONS,
    settings,
    getEdgeWeight: 'weight',
  })

  return new Map(Object.entries(positions))
}
