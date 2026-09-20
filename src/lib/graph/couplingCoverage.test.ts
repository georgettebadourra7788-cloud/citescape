import { describe, expect, it } from 'vitest'
import { computeCouplingCoverage } from './couplingCoverage'
import { makePaper } from './testFixtures'
import type { GraphNode } from './types'

function node(id: string): GraphNode {
  return {
    id,
    label: id,
    year: 2020,
    inSetCitations: 1,
    globalCitations: 1,
    cluster: 1,
    degree: 1,
    x: 0,
    y: 0,
  }
}

describe('computeCouplingCoverage', () => {
  it('reports everything shown when every paper appears in the coupling map', () => {
    const papers = [makePaper({ id: 'P1', referencedWorks: ['R1'] }), makePaper({ id: 'P2', referencedWorks: ['R1'] })]
    const coverage = computeCouplingCoverage(papers, [node('P1'), node('P2')])
    expect(coverage).toEqual({
      totalPapers: 2,
      shownPapers: 2,
      notShownNoReferences: 0,
      notShownBelowThreshold: 0,
      notShownMergedDuplicate: 0,
    })
  })

  it('counts a paper with no reference list separately from one below the threshold', () => {
    const papers = [
      makePaper({ id: 'shown', referencedWorks: ['R1', 'R2'] }),
      makePaper({ id: 'no-refs', referencedWorks: [] }),
      // Has references, but never ended up as a coupling node — i.e. it
      // shared too few references with anything else to clear the
      // minimum-shared-references threshold.
      makePaper({ id: 'below-threshold', referencedWorks: ['R3'] }),
    ]
    const coupling = [node('shown')]

    const coverage = computeCouplingCoverage(papers, coupling)

    expect(coverage).toEqual({
      totalPapers: 3,
      shownPapers: 1,
      notShownNoReferences: 1,
      notShownBelowThreshold: 1,
      notShownMergedDuplicate: 0,
    })
  })

  it('counts a paper merged into a duplicate separately, even though it has references', () => {
    const papers = [
      makePaper({ id: 'shown', referencedWorks: ['R1', 'R2'] }),
      makePaper({ id: 'merged-away', referencedWorks: ['R1', 'R2'] }),
    ]
    const coverage = computeCouplingCoverage(papers, [node('shown')], new Set(['merged-away']))

    expect(coverage.notShownMergedDuplicate).toBe(1)
    expect(coverage.notShownNoReferences).toBe(0)
    expect(coverage.notShownBelowThreshold).toBe(0)
  })

  it('handles an empty paper set', () => {
    expect(computeCouplingCoverage([], [])).toEqual({
      totalPapers: 0,
      shownPapers: 0,
      notShownNoReferences: 0,
      notShownBelowThreshold: 0,
      notShownMergedDuplicate: 0,
    })
  })
})
