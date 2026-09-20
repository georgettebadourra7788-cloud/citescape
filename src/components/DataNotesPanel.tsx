import { computeCouplingCoverage } from '../lib/graph/couplingCoverage'
import type { GraphNode } from '../lib/graph/types'
import type { Paper } from '../lib/openalex'

interface DataNotesPanelProps {
  papers: Paper[]
  couplingNodes: GraphNode[]
  /** Survivor paper id -> ids of the other fetched papers merged into it — see duplicates.ts. */
  duplicatePapers: Record<string, string[]>
}

/**
 * Explains any gap between "papers fetched" and "papers shown in the
 * coupling map" — silently dropping papers with no references, too few
 * shared references to clear the minimum threshold, or merged into a
 * duplicate record, would otherwise look like data loss. Renders nothing
 * once everything is accounted for.
 */
export function DataNotesPanel({ papers, couplingNodes, duplicatePapers }: DataNotesPanelProps) {
  const mergedAwayIds = new Set(Object.values(duplicatePapers).flat())
  const coverage = computeCouplingCoverage(papers, couplingNodes, mergedAwayIds)
  const notShown = coverage.totalPapers - coverage.shownPapers
  if (notShown === 0) return null

  const reasons: string[] = []
  if (coverage.notShownNoReferences > 0) {
    reasons.push(`${coverage.notShownNoReferences} have no reference list`)
  }
  if (coverage.notShownBelowThreshold > 0) {
    reasons.push(
      `${coverage.notShownBelowThreshold} share too few references with any other paper`,
    )
  }
  if (coverage.notShownMergedDuplicate > 0) {
    reasons.push(
      `${coverage.notShownMergedDuplicate} ${coverage.notShownMergedDuplicate === 1 ? 'was' : 'were'} merged into a duplicate record`,
    )
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <span className="font-medium">Data notes:</span> {notShown} of {coverage.totalPapers} fetched
      papers aren&rsquo;t shown in the bibliographic coupling map &mdash; {reasons.join(', ')}.
    </div>
  )
}
