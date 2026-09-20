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
  /**
   * This node's rank among its cluster's top papers: 0 for the cluster's
   * single highest-citationRank paper, 1 for its second, -1 if it's not
   * one of the cluster's top 2 — see labelCollision's priority tiering,
   * which guarantees both a cluster's rank-0 and rank-1 papers a label
   * before any other node gets a second label from the same cluster.
   */
  clusterTopRank: number
  /**
   * Which side of the node to draw its label on, and any vertical nudge —
   * set per-frame by NetworkGraph's nodeReducer (from labelCollision's
   * placement decision), never by buildDisplayGraph itself. Optional/absent
   * here; drawNodeLabelWithHalo defaults to the right when unset.
   */
  labelSide?: 'left' | 'right'
  labelDy?: number
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

  // Every cluster's top 2 papers (uncapped, unlike forcedLabelIds above) —
  // the live map's on-screen label selection always prioritizes these
  // first, so every cluster gets at least 2 labels before any cluster gets
  // a 3rd — see computeVisibleLabels in NetworkGraph.tsx.
  const clusterTopRankById = new Map<string, number>()
  for (const cluster of network.clusters) {
    cluster.topPapers.slice(0, 2).forEach((paper, rank) => {
      clusterTopRankById.set(paper.id, rank)
    })
  }

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
      clusterTopRank: clusterTopRankById.get(node.id) ?? -1,
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
