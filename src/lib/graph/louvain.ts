import louvain from 'graphology-communities-louvain'
import Graph from 'graphology'
import { createSeededRng } from './seededRng'

/**
 * ~10 fixed seeds tried per network — the partition with the highest
 * modularity wins (see runLouvain). Fixed and ordered, not random, so a
 * tie between two seeds' modularity always resolves the same way.
 */
export const LOUVAIN_SEEDS = [42, 43, 44, 45, 46, 47, 48, 49, 50, 51]

export interface LouvainResult {
  communities: Map<string, number>
  /** Which of LOUVAIN_SEEDS produced the winning (highest-modularity) partition. */
  seed: number
  modularity: number
  /** How many seeds were actually tried (0 for an empty graph). */
  runs: number
}

/**
 * Builds a copy of `graph` with nodes — and their incident edges — added in
 * a fixed, content-derived order (sorted by node id) rather than whatever
 * order the caller happened to insert them in. graphology-communities-
 * louvain's result depends on iteration order even with a fixed RNG seed,
 * and node order otherwise reflects OpenAlex's fetch order, which drifts
 * run to run for a result set that's ~99% identical — sorting first is
 * what makes the same input set cluster the same way regardless.
 */
function canonicalize(graph: Graph): Graph {
  const canonical = new Graph({ type: graph.type, multi: graph.multi, allowSelfLoops: graph.allowSelfLoops })

  for (const id of [...graph.nodes()].sort()) {
    canonical.addNode(id, graph.getNodeAttributes(id))
  }

  const edges = graph
    .mapEdges((_edge, attributes, source, target) => ({ source, target, attributes }))
    .sort((a, b) => {
      if (a.source !== b.source) return a.source < b.source ? -1 : 1
      if (a.target !== b.target) return a.target < b.target ? -1 : 1
      return 0
    })
  for (const edge of edges) {
    canonical.addEdge(edge.source, edge.target, edge.attributes)
  }

  return canonical
}

/**
 * Runs Louvain once per seed in LOUVAIN_SEEDS, on a canonicalized (sorted
 * node/edge order) copy of `graph`, and keeps the partition with the
 * highest modularity. Ties are broken deterministically: LOUVAIN_SEEDS is
 * a fixed, ordered list, and only a strictly higher modularity replaces
 * the current best, so the earliest seed to reach the top score always
 * wins, every time, for the same graph.
 */
export function runLouvain(graph: Graph): LouvainResult {
  if (graph.order === 0) {
    return { communities: new Map(), seed: LOUVAIN_SEEDS[0], modularity: 0, runs: 0 }
  }

  const canonical = canonicalize(graph)

  let bestSeed = LOUVAIN_SEEDS[0]
  let bestOutput = louvain.detailed(canonical, { getEdgeWeight: 'weight', rng: createSeededRng(bestSeed) })

  for (const seed of LOUVAIN_SEEDS.slice(1)) {
    const output = louvain.detailed(canonical, { getEdgeWeight: 'weight', rng: createSeededRng(seed) })
    if (output.modularity > bestOutput.modularity) {
      bestSeed = seed
      bestOutput = output
    }
  }

  return {
    communities: new Map(Object.entries(bestOutput.communities)),
    seed: bestSeed,
    modularity: bestOutput.modularity,
    runs: LOUVAIN_SEEDS.length,
  }
}
