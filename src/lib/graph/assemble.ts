import type Graph from 'graphology'
import { buildClusterSummaries } from './clusterSummary'
import { computeLayout } from './layout'
import { runLouvain } from './louvain'
import type { GraphEdge, GraphNode, NetworkResult } from './types'

export interface NodeMeta {
  label: string
  year: number | null
  citations: number
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
  const clusters = runLouvain(graph)
  const positions = computeLayout(graph)

  const nodes: GraphNode[] = graph.mapNodes((nodeId): GraphNode => {
    const meta = metaById.get(nodeId)
    const position = positions.get(nodeId)
    return {
      id: nodeId,
      label: meta?.label ?? nodeId,
      year: meta?.year ?? null,
      citations: meta?.citations ?? 0,
      cluster: clusters.get(nodeId) ?? -1,
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
