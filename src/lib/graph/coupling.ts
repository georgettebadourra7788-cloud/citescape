import Graph from 'graphology'
import type { Paper } from '../openalex'
import { pairKey } from './pairKey'

export const DEFAULT_MIN_COUPLING_WEIGHT = 2

/**
 * Bibliographic coupling: nodes are papers in the set that have at least
 * one reference; an edge's weight is the number of references two papers
 * share. Edges below `minEdgeWeight` are dropped, then any node left with
 * no edges is dropped too.
 */
export function buildCouplingGraph(
  papers: Paper[],
  minEdgeWeight: number = DEFAULT_MIN_COUPLING_WEIGHT,
): Graph {
  const eligible = papers.filter((p) => p.referencedWorks.length > 0)

  // reference -> ids of papers (from our set) that cite it
  const citingPapersByRef = new Map<string, string[]>()
  for (const paper of eligible) {
    for (const ref of paper.referencedWorks) {
      let citers = citingPapersByRef.get(ref)
      if (!citers) {
        citers = []
        citingPapersByRef.set(ref, citers)
      }
      citers.push(paper.id)
    }
  }

  const pairCounts = new Map<string, number>()
  for (const citers of citingPapersByRef.values()) {
    if (citers.length < 2) continue
    for (let i = 0; i < citers.length; i++) {
      for (let j = i + 1; j < citers.length; j++) {
        const key = pairKey(citers[i], citers[j])
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const graph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false })
  for (const paper of eligible) {
    graph.addNode(paper.id)
  }

  // pairKey always orders ids as `${a}|${b}` with a < b, and OpenAlex ids
  // never contain "|", so splitting the key back apart is safe here.
  for (const [key, weight] of pairCounts) {
    if (weight < minEdgeWeight) continue
    const [a, b] = key.split('|')
    graph.addEdge(a, b, { weight })
  }

  for (const nodeId of graph.nodes()) {
    if (graph.degree(nodeId) === 0) graph.dropNode(nodeId)
  }

  return graph
}
