import { describe, expect, it } from 'vitest'
import { buildCouplingGraph } from './coupling'
import { makePaper } from './testFixtures'

// Hand-verifiable fixture:
//   P1 -> R1,R2,R3    P2 -> R1,R2,R4    P3 -> R1,R5    P4 -> R6    P5 -> (none)
//
// Shared-reference counts (bibliographic coupling weight):
//   P1 & P2 = {R1,R2}     -> 2
//   P1 & P3 = {R1}        -> 1
//   P2 & P3 = {R1}        -> 1
//   every other pair      -> 0
const papers = [
  makePaper({ id: 'P1', referencedWorks: ['R1', 'R2', 'R3'] }),
  makePaper({ id: 'P2', referencedWorks: ['R1', 'R2', 'R4'] }),
  makePaper({ id: 'P3', referencedWorks: ['R1', 'R5'] }),
  makePaper({ id: 'P4', referencedWorks: ['R6'] }),
  makePaper({ id: 'P5', referencedWorks: [] }),
]

describe('buildCouplingGraph', () => {
  it('never includes a paper with no references as a node', () => {
    const graph = buildCouplingGraph(papers, 1)
    expect(graph.hasNode('P5')).toBe(false)
  })

  it('computes shared-reference edge weights and drops edges below the default minimum of 2', () => {
    const graph = buildCouplingGraph(papers)

    expect(graph.nodes().sort()).toEqual(['P1', 'P2'])
    expect(graph.edges()).toHaveLength(1)
    expect(graph.getEdgeAttribute('P1', 'P2', 'weight')).toBe(2)
  })

  it('keeps weight-1 edges when minEdgeWeight is lowered, forming a P1-P2-P3 triangle', () => {
    const graph = buildCouplingGraph(papers, 1)

    expect(graph.nodes().sort()).toEqual(['P1', 'P2', 'P3'])
    expect(graph.getEdgeAttribute('P1', 'P2', 'weight')).toBe(2)
    expect(graph.getEdgeAttribute('P1', 'P3', 'weight')).toBe(1)
    expect(graph.getEdgeAttribute('P2', 'P3', 'weight')).toBe(1)
  })

  it('drops a paper with references as an isolated node once its only edges fall below the threshold', () => {
    const graph = buildCouplingGraph(papers, 2)
    // P4 has a reference (R6) but shares it with nobody else in the set.
    expect(graph.hasNode('P4')).toBe(false)
  })
})
