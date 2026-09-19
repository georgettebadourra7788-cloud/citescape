import Graph from 'graphology'
import type { Paper } from '../openalex'
import { pairKey } from './pairKey'

export const DEFAULT_MIN_COCITATION_WEIGHT = 2
export const DEFAULT_MAX_COCITATION_NODES = 200

export interface CoCitationBuildResult {
  graph: Graph
  /**
   * For each surviving reference node, the ids of papers in our set that
   * cite it. Used both as the node's "local" citation count and to
   * aggregate keywords for cluster summaries (see step 6).
   */
  citingPapersByRef: Map<string, Set<string>>
}

export interface CoCitationOptions {
  minEdgeWeight?: number
  maxNodes?: number
}

/**
 * Co-citation: nodes are referenced works (identified only by OpenAlex
 * id); two references are linked when the same paper in our set cites
 * both, with edge weight equal to how many papers in the set do so.
 * Computed entirely from the reference lists we already have — no
 * fetching of citing papers.
 *
 * Edges below `minEdgeWeight` are dropped first; each node's co-citation
 * strength is then the sum of its surviving edge weights, and only the
 * top `maxNodes` by that strength are kept. Any node left with no edges
 * after capping is dropped too.
 */
export function buildCoCitationGraph(
  papers: Paper[],
  options: CoCitationOptions = {},
): CoCitationBuildResult {
  const minEdgeWeight = options.minEdgeWeight ?? DEFAULT_MIN_COCITATION_WEIGHT
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_COCITATION_NODES

  const pairCounts = new Map<string, number>()
  const citingPapersByRef = new Map<string, Set<string>>()

  for (const paper of papers) {
    const refs = paper.referencedWorks
    for (const ref of refs) {
      let citers = citingPapersByRef.get(ref)
      if (!citers) {
        citers = new Set()
        citingPapersByRef.set(ref, citers)
      }
      citers.add(paper.id)
    }

    if (refs.length < 2) continue
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const key = pairKey(refs[i], refs[j])
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const survivingEdges: { a: string; b: string; weight: number }[] = []
  const strength = new Map<string, number>()
  for (const [key, weight] of pairCounts) {
    if (weight < minEdgeWeight) continue
    const [a, b] = key.split('|')
    survivingEdges.push({ a, b, weight })
    strength.set(a, (strength.get(a) ?? 0) + weight)
    strength.set(b, (strength.get(b) ?? 0) + weight)
  }

  const keptNodes = new Set(
    [...strength.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, maxNodes)
      .map(([id]) => id),
  )

  const graph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false })
  for (const id of keptNodes) graph.addNode(id)

  for (const { a, b, weight } of survivingEdges) {
    if (!keptNodes.has(a) || !keptNodes.has(b)) continue
    graph.addEdge(a, b, { weight })
  }

  for (const nodeId of graph.nodes()) {
    if (graph.degree(nodeId) === 0) graph.dropNode(nodeId)
  }

  // Only report citing-paper sets for nodes that survived into the graph.
  const filteredCitingPapersByRef = new Map<string, Set<string>>()
  for (const nodeId of graph.nodes()) {
    const citers = citingPapersByRef.get(nodeId)
    if (citers) filteredCitingPapersByRef.set(nodeId, citers)
  }

  return { graph, citingPapersByRef: filteredCitingPapersByRef }
}
