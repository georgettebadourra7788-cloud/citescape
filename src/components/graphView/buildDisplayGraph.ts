import Graph from 'graphology'
import { clusterColor } from '../../lib/graph/clusterColors'
import { truncateTitle } from '../../lib/text'
import type { NetworkResult } from '../../lib/graph/types'

export const MIN_NODE_SIZE = 3
export const MAX_NODE_SIZE = 22
/** Only the largest nodes get a permanent label, to avoid a hairball of text. */
export const LABELED_NODE_COUNT = 20

export interface DisplayNodeAttributes {
  x: number
  y: number
  size: number
  color: string
  label: string | null
  cluster: number
  citations: number
}

export interface DisplayEdgeAttributes {
  weight: number
  size: number
  color: string
}

export type DisplayGraph = Graph<DisplayNodeAttributes, DisplayEdgeAttributes>

function nodeSize(citations: number, maxCitations: number): number {
  if (maxCitations <= 0) return MIN_NODE_SIZE
  const t = Math.log1p(citations) / Math.log1p(maxCitations)
  return MIN_NODE_SIZE + t * (MAX_NODE_SIZE - MIN_NODE_SIZE)
}

/**
 * Builds a graphology Graph with Sigma-ready display attributes
 * (x/y/size/color/label) from a worker-computed NetworkResult. Pure and
 * side-effect free — safe to rebuild whenever the network changes.
 */
export function buildDisplayGraph(network: NetworkResult): DisplayGraph {
  const graph: DisplayGraph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false })

  const maxCitations = Math.max(0, ...network.nodes.map((node) => node.citations))
  const labeledNodeIds = new Set(
    [...network.nodes]
      .sort((a, b) => b.citations - a.citations)
      .slice(0, LABELED_NODE_COUNT)
      .map((node) => node.id),
  )

  for (const node of network.nodes) {
    graph.addNode(node.id, {
      x: node.x,
      y: node.y,
      size: nodeSize(node.citations, maxCitations),
      color: clusterColor(node.cluster),
      label: labeledNodeIds.has(node.id) ? truncateTitle(node.label, 60) : null,
      cluster: node.cluster,
      citations: node.citations,
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
