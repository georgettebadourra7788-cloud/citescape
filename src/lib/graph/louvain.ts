import louvain from 'graphology-communities-louvain'
import type Graph from 'graphology'
import { createSeededRng } from './seededRng'

/** Fixed seed so cluster assignments are reproducible across runs. */
export const LOUVAIN_SEED = 42

/** Runs Louvain with a fresh, fixed-seed RNG. Returns node id -> cluster index. */
export function runLouvain(graph: Graph): Map<string, number> {
  if (graph.order === 0) return new Map()

  const communities = louvain(graph, {
    getEdgeWeight: 'weight',
    rng: createSeededRng(LOUVAIN_SEED),
  })

  return new Map(Object.entries(communities))
}
