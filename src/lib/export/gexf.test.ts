import { describe, expect, it } from 'vitest'
import { buildGexf } from './gexf'
import type { GraphNode, NetworkResult } from '../graph/types'

function node(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    label: overrides.id,
    year: 2020,
    inSetCitations: 0,
    globalCitations: 0,
    cluster: 1,
    degree: 1,
    x: 0,
    y: 0,
    ...overrides,
  }
}

// Tiny hand-built network: P1 -[weight 3]- P2, cluster 1, with enough
// distinct field values (year, citations, doi, a quote in the label) to
// hand-verify every XML value that comes out.
const network: NetworkResult = {
  nodes: [
    node({
      id: 'P1',
      label: 'Paper "One" & Friends',
      year: 2019,
      globalCitations: 12,
      cluster: 1,
      doi: 'https://doi.org/10.1/p1',
      x: 1.5,
      y: -2.5,
    }),
    node({ id: 'P2', label: 'Paper Two', year: 2021, globalCitations: 4, cluster: 2, x: 3, y: 4 }),
  ],
  edges: [{ source: 'P1', target: 'P2', weight: 3 }],
  clusters: [],
}

describe('buildGexf', () => {
  const xml = buildGexf(network, { title: 'coastal cities — coupling', generatedAt: new Date('2026-09-19') })

  it('declares the GEXF 1.3 root and viz namespaces', () => {
    expect(xml).toContain('xmlns="http://gexf.net/1.3"')
    expect(xml).toContain('xmlns:viz="http://gexf.net/1.3/viz"')
    expect(xml).toContain('version="1.3"')
  })

  it('escapes special characters in labels and the description', () => {
    expect(xml).toContain('label="Paper &quot;One&quot; &amp; Friends"')
    expect(xml).toContain('coastal cities')
  })

  it('writes node attvalues for year, citations, cluster, and doi', () => {
    expect(xml).toContain('<attvalue for="0" value="2019"/>') // year
    expect(xml).toContain('<attvalue for="1" value="12"/>') // citations (global)
    expect(xml).toContain('<attvalue for="2" value="1"/>') // cluster
    expect(xml).toContain('<attvalue for="3" value="https://doi.org/10.1/p1"/>') // doi
  })

  it('writes viz:position from the node\'s x/y layout coordinates', () => {
    expect(xml).toContain('<viz:position x="1.5" y="-2.5" z="0"/>')
    expect(xml).toContain('<viz:position x="3" y="4" z="0"/>')
  })

  it('writes one edge with source, target, and weight', () => {
    expect(xml).toContain('<edge id="0" source="P1" target="P2" weight="3"/>')
  })

  it('omits a doi attvalue when the node has none', () => {
    const noDoiXml = buildGexf(
      { nodes: [node({ id: 'R1', doi: undefined })], edges: [], clusters: [] },
      { title: 'x' },
    )
    expect(noDoiXml).not.toContain('for="3"')
  })
})
