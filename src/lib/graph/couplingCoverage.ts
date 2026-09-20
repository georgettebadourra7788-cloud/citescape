import type { GraphNode } from './types'
import type { Paper } from '../openalex'

export interface CouplingCoverage {
  totalPapers: number
  shownPapers: number
  /** Fetched papers with an empty reference list — they can never share a reference with anything. */
  notShownNoReferences: number
  /** Fetched papers with references, but none shared with any other paper above the minimum threshold. */
  notShownBelowThreshold: number
  /** Fetched papers merged into another paper as a duplicate — see duplicates.ts. */
  notShownMergedDuplicate: number
}

/**
 * How many of the fetched papers actually appear in the coupling map, and
 * why the rest don't. `buildCouplingGraph` (coupling.ts) only ever adds a
 * paper as a node if it has references, and drops it again if it ends up
 * with no edges meeting the minimum shared-reference threshold; a paper
 * merged into a duplicate (`mergedAwayIds`) never becomes its own node
 * either, regardless of its own references — so every fetched paper
 * missing from `couplingNodes` falls into exactly one of those three
 * buckets.
 */
export function computeCouplingCoverage(
  papers: Paper[],
  couplingNodes: GraphNode[],
  mergedAwayIds: ReadonlySet<string> = new Set(),
): CouplingCoverage {
  const shownIds = new Set(couplingNodes.map((node) => node.id))

  let notShownNoReferences = 0
  let notShownBelowThreshold = 0
  let notShownMergedDuplicate = 0
  for (const paper of papers) {
    if (shownIds.has(paper.id)) continue
    if (mergedAwayIds.has(paper.id)) {
      notShownMergedDuplicate++
      continue
    }
    if (paper.referencedWorks.length === 0) notShownNoReferences++
    else notShownBelowThreshold++
  }

  return {
    totalPapers: papers.length,
    shownPapers: couplingNodes.length,
    notShownNoReferences,
    notShownBelowThreshold,
    notShownMergedDuplicate,
  }
}
