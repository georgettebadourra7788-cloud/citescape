import { describe, expect, it } from 'vitest'
import { computeAutoMinLinkStrength } from './autoMinLinkStrength'

function edgesOfWeight(weight: number, count: number): { weight: number }[] {
  return Array.from({ length: count }, () => ({ weight }))
}

describe('computeAutoMinLinkStrength', () => {
  it('returns 1 (no filtering) when already under the target', () => {
    const edges = edgesOfWeight(2, 100)
    expect(computeAutoMinLinkStrength(edges, 2500)).toBe(1)
  })

  it('picks the smallest threshold that brings the count at or under the target', () => {
    // weight 1: 2000 edges, weight 2: 1000 edges, weight 3: 500 edges.
    // >=1 -> 3500, >=2 -> 1500, >=3 -> 500. Target 2500 -> first w with count<=2500 is w=2 (1500).
    const edges = [...edgesOfWeight(1, 2000), ...edgesOfWeight(2, 1000), ...edgesOfWeight(3, 500)]
    expect(computeAutoMinLinkStrength(edges, 2500)).toBe(2)
  })

  it('falls back to the highest weight if even that alone exceeds the target', () => {
    const edges = edgesOfWeight(5, 3000)
    expect(computeAutoMinLinkStrength(edges, 2500)).toBe(5)
  })
})
