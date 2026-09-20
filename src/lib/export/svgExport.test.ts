import { describe, expect, it } from 'vitest'
import { buildSvg } from './svgExport'
import type { ClusterSummary, GraphNode, NetworkResult } from '../graph/types'

function node(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    label: overrides.id,
    year: 2020,
    inSetCitations: 1,
    globalCitations: 1,
    cluster: 1,
    degree: 1,
    x: 0,
    y: 0,
    ...overrides,
  }
}

// Three nodes spread along the y axis, one per cluster, each a cluster's
// top (and only) paper — so all three become label candidates, far enough
// apart on x that their labels never collide with each other.
const nodes: GraphNode[] = [
  node({ id: 'top', label: 'Node at the top on screen', cluster: 1, x: 0, y: 500 }),
  node({ id: 'middle', label: 'Node in the middle on screen', cluster: 2, x: 400, y: 0 }),
  node({ id: 'bottom', label: 'Node at the bottom on screen', cluster: 3, x: 800, y: -500 }),
]

const clusters: ClusterSummary[] = [
  { cluster: 1, size: 1, topPapers: [{ id: 'top', title: 'Node at the top', citations: 1 }], medianYear: 2020, topKeywords: [], allUnresolved: false },
  { cluster: 2, size: 1, topPapers: [{ id: 'middle', title: 'Node in the middle', citations: 1 }], medianYear: 2020, topKeywords: [], allUnresolved: false },
  { cluster: 3, size: 1, topPapers: [{ id: 'bottom', title: 'Node at the bottom', citations: 1 }], medianYear: 2020, topKeywords: [], allUnresolved: false },
]

const network: NetworkResult = {
  nodes,
  edges: [
    { source: 'top', target: 'middle', weight: 2 },
    { source: 'middle', target: 'bottom', weight: 2 },
  ],
  clusters,
}

const baseOptions = {
  network,
  unitLabel: 'papers' as const,
  minLinkStrength: 1,
  title: 'Test map',
  watermark: false,
}

describe('buildSvg — y-axis orientation', () => {
  it('flips y so the node with the largest on-screen y also has the largest SVG y', () => {
    const svg = buildSvg(baseOptions)

    // Node circles are drawn in `network.nodes` order and are the only
    // circles with a fill-opacity attribute (legend dots have none).
    const cys = [...svg.matchAll(/<circle cx="[\d.-]+" cy="([\d.-]+)"[^>]*fill-opacity="0\.85"/g)].map(
      (m) => Number(m[1]),
    )
    expect(cys).toHaveLength(3)

    // Sigma renders with graph-space y pointing *up*: the smallest raw y
    // ('bottom', y=-500) sits lowest on screen — i.e. has the largest
    // on-screen (pixel) y. Its SVG cy must be the largest of the three,
    // proving the export isn't a vertical mirror of the on-screen map.
    const [topCy, middleCy, bottomCy] = cys
    expect(bottomCy).toBeGreaterThan(middleCy)
    expect(middleCy).toBeGreaterThan(topCy)
  })
})

describe('buildSvg — label layering', () => {
  it('draws every node circle before any label, so no circle can cover a label', () => {
    const svg = buildSvg(baseOptions)

    const mapGroupMatch = svg.match(/<g transform="translate\(0, \d+\)">([\s\S]*?)<\/g>/)
    expect(mapGroupMatch).not.toBeNull()
    const mapGroup = mapGroupMatch![1]

    const lastCircleIndex = mapGroup.lastIndexOf('<circle')
    const firstLabelTextIndex = mapGroup.indexOf('<text')
    expect(lastCircleIndex).toBeGreaterThanOrEqual(0)
    expect(firstLabelTextIndex).toBeGreaterThanOrEqual(0)
    expect(lastCircleIndex).toBeLessThan(firstLabelTextIndex)

    // All three well-separated candidate labels should have been placed.
    expect((mapGroup.match(/<text/g) ?? []).length).toBe(3)
  })

  it('draws a white halo rect behind each label', () => {
    const svg = buildSvg(baseOptions)
    const haloCount = (svg.match(/<rect[^>]*fill="#ffffff" fill-opacity="0\.85"\/>/g) ?? []).length
    expect(haloCount).toBe(3)
  })
})

describe('buildSvg — empty network', () => {
  it('still renders a title and message without throwing', () => {
    const svg = buildSvg({ ...baseOptions, network: { nodes: [], edges: [], clusters: [] } })
    expect(svg).toContain('No connected papers to map.')
  })
})
