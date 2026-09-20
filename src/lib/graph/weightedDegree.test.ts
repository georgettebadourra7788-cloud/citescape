import { describe, expect, it } from 'vitest'
import { computeWeightedDegree } from './weightedDegree'
import type { GraphEdge } from './types'

describe('computeWeightedDegree', () => {
  it('sums incident edge weights per node', () => {
    // R1: 3 + 2 = 5      P1: 3      R3: 2  (hand-verifiable star)
    const edges: GraphEdge[] = [
      { source: 'R1', target: 'P1', weight: 3 },
      { source: 'R1', target: 'R3', weight: 2 },
    ]
    const result = computeWeightedDegree(edges)
    expect(result.get('R1')).toBe(5)
    expect(result.get('P1')).toBe(3)
    expect(result.get('R3')).toBe(2)
  })

  it('returns an empty map for no edges', () => {
    expect(computeWeightedDegree([]).size).toBe(0)
  })

  it('omits a node with no edges entirely (undefined, not zero)', () => {
    const result = computeWeightedDegree([{ source: 'A', target: 'B', weight: 1 }])
    expect(result.get('C')).toBeUndefined()
  })
})
