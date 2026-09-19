import { describe, expect, it } from 'vitest'
import { buildCoCitationGraph } from './coCitation'
import { makePaper } from './testFixtures'

// Same fixture as coupling.test.ts, read from the other direction:
//   P1 -> R1,R2,R3    P2 -> R1,R2,R4    P3 -> R1,R5    P4 -> R6    P5 -> (none)
//
// Co-citation counts (how many of our papers cite both references):
//   R1&R2 = {P1,P2} -> 2      R1&R3 = {P1} -> 1      R2&R3 = {P1} -> 1
//   R1&R4 = {P2} -> 1         R2&R4 = {P2} -> 1       R1&R5 = {P3} -> 1
// R6 never pairs with anything (P4 has only one reference).
const papers = [
  makePaper({ id: 'P1', referencedWorks: ['R1', 'R2', 'R3'] }),
  makePaper({ id: 'P2', referencedWorks: ['R1', 'R2', 'R4'] }),
  makePaper({ id: 'P3', referencedWorks: ['R1', 'R5'] }),
  makePaper({ id: 'P4', referencedWorks: ['R6'] }),
  makePaper({ id: 'P5', referencedWorks: [] }),
]

describe('buildCoCitationGraph', () => {
  it('keeps only the pair that meets the default minimum edge weight of 2', () => {
    const { graph } = buildCoCitationGraph(papers)

    expect(graph.nodes().sort()).toEqual(['R1', 'R2'])
    expect(graph.edges()).toHaveLength(1)
    expect(graph.getEdgeAttribute('R1', 'R2', 'weight')).toBe(2)
  })

  it('never creates a node for a reference that only ever appears alone (R6)', () => {
    const { graph } = buildCoCitationGraph(papers, { minEdgeWeight: 1 })
    expect(graph.hasNode('R6')).toBe(false)
  })

  it('reports the in-set citing papers for each surviving reference', () => {
    const { citingPapersByRef } = buildCoCitationGraph(papers)

    expect([...(citingPapersByRef.get('R1') ?? [])].sort()).toEqual(['P1', 'P2', 'P3'])
    expect([...(citingPapersByRef.get('R2') ?? [])].sort()).toEqual(['P1', 'P2'])
  })

  it('caps to maxNodes by co-citation strength and keeps only edges within the cap', () => {
    // With minEdgeWeight 1, strengths are R1=5, R2=4, R3=2, R4=2, R5=1.
    // Top 3 -> R1, R2, R3, forming a triangle; R4 and R5 are dropped.
    const { graph } = buildCoCitationGraph(papers, { minEdgeWeight: 1, maxNodes: 3 })

    expect(graph.nodes().sort()).toEqual(['R1', 'R2', 'R3'])
    expect(graph.edges()).toHaveLength(3)
    expect(graph.getEdgeAttribute('R1', 'R2', 'weight')).toBe(2)
    expect(graph.getEdgeAttribute('R1', 'R3', 'weight')).toBe(1)
    expect(graph.getEdgeAttribute('R2', 'R3', 'weight')).toBe(1)
  })
})
