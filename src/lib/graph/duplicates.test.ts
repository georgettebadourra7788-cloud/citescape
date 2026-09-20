import Graph from 'graphology'
import { describe, expect, it } from 'vitest'
import {
  groupDuplicates,
  mergeDuplicateCoCitationNodes,
  mergeDuplicatePapers,
  normalizeTitle,
  type DedupeCandidate,
} from './duplicates'
import { makePaper } from './testFixtures'
import type { MinimalWork } from '../openalex'

function candidate(overrides: Partial<DedupeCandidate> & { id: string }): DedupeCandidate {
  return { title: 'A Title', firstAuthor: 'Ada Lovelace', year: 2020, ...overrides }
}

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeTitle('  The   Ethics, of AI!  ')).toBe('the ethics of ai')
  })

  it('treats titles differing only in case/punctuation/spacing as identical', () => {
    expect(normalizeTitle('Ethics of AI')).toBe(normalizeTitle('ethics-of-ai!!'))
  })
})

describe('groupDuplicates', () => {
  it('groups two records with the same normalized title, first author, and year', () => {
    const groups = groupDuplicates([
      candidate({ id: 'A', title: 'Ethics of AI', firstAuthor: 'Ada Lovelace', year: 2020 }),
      candidate({ id: 'B', title: 'ethics of ai!', firstAuthor: 'ada lovelace', year: 2020 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((r) => r.id).sort()).toEqual(['A', 'B'])
  })

  it('never groups records with the same title but different first authors', () => {
    const groups = groupDuplicates([
      candidate({ id: 'A', title: 'A Generic Title', firstAuthor: 'Ada Lovelace' }),
      candidate({ id: 'B', title: 'A Generic Title', firstAuthor: 'Alan Turing' }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('chains records whose years are each within 1 of a neighbor, even if the group spans more than 1 year', () => {
    const groups = groupDuplicates([
      candidate({ id: 'A', year: 2019 }),
      candidate({ id: 'B', year: 2020 }),
      candidate({ id: 'C', year: 2021 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((r) => r.id).sort()).toEqual(['A', 'B', 'C'])
  })

  it('splits a bucket into separate groups when a year gap exceeds 1', () => {
    const groups = groupDuplicates([
      candidate({ id: 'A', year: 2018 }),
      candidate({ id: 'B', year: 2021 }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('never groups a record with a missing first author, even with an identical title and year', () => {
    const groups = groupDuplicates([
      candidate({ id: 'A', firstAuthor: null }),
      candidate({ id: 'B', firstAuthor: null }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('never groups a record with a missing year', () => {
    const groups = groupDuplicates([candidate({ id: 'A', year: null }), candidate({ id: 'B', year: null })])
    expect(groups).toHaveLength(2)
  })
})

describe('mergeDuplicatePapers', () => {
  it('merges a true duplicate pair: keeps the higher-citation record, sums citations, unions references', () => {
    const papers = [
      makePaper({
        id: 'W1',
        title: 'Ethics of AI',
        authors: ['Ada Lovelace'],
        year: 2020,
        citedByCount: 10,
        referencedWorks: ['R1', 'R2'],
      }),
      makePaper({
        id: 'W2',
        title: 'ethics of ai',
        authors: ['Ada Lovelace', 'Alan Turing'],
        year: 2020,
        citedByCount: 25,
        referencedWorks: ['R2', 'R3'],
      }),
    ]

    const { papers: merged, mergedIdsBySurvivor } = mergeDuplicatePapers(papers)

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('W2') // higher citedByCount survives
    expect(merged[0].citedByCount).toBe(35) // 10 + 25
    expect(merged[0].referencedWorks.slice().sort()).toEqual(['R1', 'R2', 'R3'])
    expect(mergedIdsBySurvivor.get('W2')).toEqual(['W1'])
  })

  it('does not merge two different works that happen to share a title', () => {
    const papers = [
      makePaper({ id: 'W1', title: 'Introduction', authors: ['Ada Lovelace'], year: 2020 }),
      makePaper({ id: 'W2', title: 'Introduction', authors: ['Grace Hopper'], year: 2020 }),
    ]

    const { papers: merged, mergedIdsBySurvivor } = mergeDuplicatePapers(papers)

    expect(merged).toHaveLength(2)
    expect(mergedIdsBySurvivor.size).toBe(0)
  })

  it('leaves an unrelated paper untouched', () => {
    const papers = [makePaper({ id: 'W1', title: 'Solo Paper', authors: ['Ada Lovelace'] })]
    const { papers: merged } = mergeDuplicatePapers(papers)
    expect(merged).toEqual(papers)
  })
})

describe('mergeDuplicateCoCitationNodes', () => {
  function work(overrides: Partial<MinimalWork> & { id: string }): MinimalWork {
    return { doi: null, title: 'A Reference', year: 2015, citedByCount: 0, authors: ['Ada Lovelace'], keywords: [], ...overrides }
  }

  it('merges two duplicate reference nodes: redirects edges, sums weight to a shared neighbor, unions citers', () => {
    // R1 and R1dup are the same work under two ids. R1 co-cites P1 (weight 2)
    // and R1dup co-cites P1 too (weight 3) — after merging, P1's edge to the
    // survivor should carry the summed weight 5, hand-verifiable.
    const graph = new Graph({ type: 'undirected' })
    graph.addNode('R1')
    graph.addNode('R1dup')
    graph.addNode('P1')
    graph.addEdge('R1', 'P1', { weight: 2 })
    graph.addEdge('R1dup', 'P1', { weight: 3 })

    const refWorks = new Map<string, MinimalWork>([
      ['R1', work({ id: 'R1', title: 'Ethics of AI', citedByCount: 10 })],
      ['R1dup', work({ id: 'R1dup', title: 'ethics of ai!', citedByCount: 20 })],
      ['P1', work({ id: 'P1', title: 'Unrelated', authors: ['Someone Else'] })],
    ])
    const citingPapersByRef = new Map<string, Set<string>>([
      ['R1', new Set(['CiterA'])],
      ['R1dup', new Set(['CiterB'])],
      ['P1', new Set(['CiterC'])],
    ])

    const result = mergeDuplicateCoCitationNodes(graph, ['R1', 'R1dup', 'P1'], refWorks, citingPapersByRef)

    expect(result.refIds.sort()).toEqual(['P1', 'R1dup'].sort()) // R1dup survives (higher citedByCount)
    expect(graph.hasNode('R1')).toBe(false)
    expect(graph.hasNode('R1dup')).toBe(true)
    expect(graph.getEdgeAttribute('R1dup', 'P1', 'weight')).toBe(5)
    expect(result.refWorks.get('R1dup')?.citedByCount).toBe(30) // 10 + 20
    expect(result.citingPapersByRef.get('R1dup')).toEqual(new Set(['CiterA', 'CiterB']))
    expect(result.mergedIdsBySurvivor.get('R1dup')).toEqual(['R1'])
  })

  it('never merges an unresolved reference (no MinimalWork) into anything', () => {
    const graph = new Graph({ type: 'undirected' })
    graph.addNode('R1')
    graph.addNode('R2')
    graph.addEdge('R1', 'R2', { weight: 1 })

    // Only R1 has metadata; R2 is unresolved (no entry in refWorks) — even if
    // it coincidentally would "match," there's nothing to compare it against.
    const refWorks = new Map<string, MinimalWork>([['R1', work({ id: 'R1', title: 'Ethics of AI' })]])
    const citingPapersByRef = new Map<string, Set<string>>()

    const result = mergeDuplicateCoCitationNodes(graph, ['R1', 'R2'], refWorks, citingPapersByRef)

    expect(result.refIds.sort()).toEqual(['R1', 'R2'])
    expect(result.mergedIdsBySurvivor.size).toBe(0)
    expect(graph.hasNode('R1')).toBe(true)
    expect(graph.hasNode('R2')).toBe(true)
  })
})
