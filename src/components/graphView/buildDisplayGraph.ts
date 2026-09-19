import Graph from 'graphology'
import { citationRank } from '../../lib/graph/citationRank'
import { clusterNodeColor, OTHER_COLOR } from '../../lib/graph/clusterColors'
import { MAX_NODE_SIZE, MIN_NODE_SIZE, nodeSize } from '../../lib/graph/nodeSize'
import { truncateTitle } from '../../lib/text'
import type { NetworkResult } from '../../lib/graph/types'

export { MAX_NODE_SIZE, MIN_NODE_SIZE }

/** At most this many nodes get a permanent, always-on label. */
export const MAX_FORCED_LABELS = 8

export interface DisplayNodeAttributes {
  x: number
  y: number
  size: number
  color: string
  label: string | null
  forceLabel: boolean
  cluster: number
  citations: number
}

export interface DisplayEdgeAttributes {
  weight: number
  size: number
  color: string
}

export type DisplayGraph = Graph<DisplayNodeAttributes, DisplayEdgeAttributes>

/**
 * Builds a graphology Graph with Sigma-ready display attributes
 * (x/y/size/color/label) from a worker-computed NetworkResult. Pure and
 * side-effect free — safe to rebuild whenever the network changes.
 */
export function buildDisplayGraph(network: NetworkResult): DisplayGraph {
  const graph: DisplayGraph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false })

  const maxRank = Math.max(0, ...network.nodes.map(citationRank))

  // One label per cluster's top item — the same "label paper" the legend
  // shows — capped at MAX_FORCED_LABELS, biggest clusters first (and
  // "Other" sorts last already, so it's the first one dropped if there
  // are more than MAX_FORCED_LABELS clusters).
  const forcedLabelIds = new Set(
    network.clusters
      .slice(0, MAX_FORCED_LABELS)
      .map((cluster) => cluster.topPapers[0]?.id)
      .filter((id): id is string => Boolean(id)),
  )

  for (const node of network.nodes) {
    const rank = citationRank(node)
    graph.addNode(node.id, {
      x: node.x,
      y: node.y,
      size: nodeSize(rank, maxRank),
      color: node.resolved === false ? OTHER_COLOR : clusterNodeColor(node.cluster),
      // Unresolved nodes are never labeled, forced or otherwise.
      label: node.resolved === false ? null : truncateTitle(node.label, 60),
      forceLabel: node.resolved !== false && forcedLabelIds.has(node.id),
      cluster: node.cluster,
      citations: rank,
    })
  }

  for (const edge of network.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
    if (graph.hasEdge(edge.source, edge.target)) continue
    graph.addEdge(edge.source, edge.target, {
      weight: edge.weight,
      size: 1,
      color: 'rgba(100, 116, 139, 0.25)',
    })
  }

  return graph
}
