import type Graph from 'graphology'
import { buildClusterSummaries } from './clusterSummary'
import { citationRank } from './citationRank'
import { OTHER_CLUSTER_ID, remapClustersForDisplay } from './clusterDisplay'
import { computeLayout } from './layout'
import { runLouvain } from './louvain'
import { nodeSize } from './nodeSize'
import type { GraphEdge, GraphNode, NetworkResult } from './types'

export interface NodeMeta {
  label: string
  year: number | null
  inSetCitations: number
  globalCitations: number | null
  authors?: string[]
  doi?: string | null
  resolved?: boolean
}

/**
 * Runs Louvain on `graph` and assembles the final node/edge/cluster-summary
 * shape described in the CLAUDE.md build order, using the given metadata
 * and keyword lookups (callers supply these differently for the coupling
 * vs. co-citation networks — see the worker).
 */
export function assembleNetwork(
  graph: Graph,
  metaById: Map<string, NodeMeta>,
  keywordsById: Map<string, string[]>,
): NetworkResult {
  const rawClusters = runLouvain(graph)
  const clusters = remapClustersForDisplay(rawClusters)

  // ForceAtlas2's adjustSizes (overlap prevention) reads each node's `size`
  // attribute directly, so set it — on the same scale the renderer uses —
  // before computing positions.
  const maxRank = Math.max(0, ...[...metaById.values()].map(citationRank))
  graph.forEachNode((nodeId) => {
    const meta = metaById.get(nodeId)
    const rank = meta ? citationRank(meta) : 0
    graph.setNodeAttribute(nodeId, 'size', nodeSize(rank, maxRank))
  })

  const positions = computeLayout(graph)

  const nodes: GraphNode[] = graph.mapNodes((nodeId): GraphNode => {
    const meta = metaById.get(nodeId)
    const position = positions.get(nodeId)
    return {
      id: nodeId,
      label: meta?.label ?? nodeId,
      year: meta?.year ?? null,
      inSetCitations: meta?.inSetCitations ?? 0,
      globalCitations: meta?.globalCitations ?? null,
      cluster: clusters.get(nodeId) ?? OTHER_CLUSTER_ID,
      degree: graph.degree(nodeId),
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      authors: meta?.authors,
      doi: meta?.doi,
      resolved: meta?.resolved,
    }
  })

  const edges: GraphEdge[] = graph.mapEdges(
    (_edge, attributes, source, target): GraphEdge => ({
      source,
      target,
      weight: (attributes.weight as number | undefined) ?? 1,
    }),
  )

  const clusterSummaries = buildClusterSummaries(nodes, keywordsById)

  return { nodes, edges, clusters: clusterSummaries }
}
