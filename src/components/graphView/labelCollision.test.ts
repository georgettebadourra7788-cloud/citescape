import { describe, expect, it } from 'vitest'
import { selectNonOverlappingLabels, type LabelCandidate } from './labelCollision'

const FONT_SIZE = 11
/** Deterministic stand-in for canvas measureText, proportional to length. */
const measureTextWidth = (text: string, fontSize: number) => text.length * fontSize * 0.5

function candidate(overrides: Partial<LabelCandidate> & { id: string }): LabelCandidate {
  return { x: 0, y: 0, radius: 6, text: overrides.id, priority: 1, ...overrides }
}

describe('selectNonOverlappingLabels', () => {
  it('keeps both labels when they do not overlap', () => {
    const candidates = [
      candidate({ id: 'a', x: 0, y: 0, priority: 2 }),
      candidate({ id: 'b', x: 500, y: 0, priority: 1 }),
    ]
    const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
    expect(selected).toEqual(new Set(['a', 'b']))
  })

  it('drops the lower-priority (smaller-node) label when two would overlap', () => {
    const candidates = [
      candidate({ id: 'big', x: 0, y: 0, priority: 10, text: 'Big important paper' }),
      candidate({ id: 'small', x: 5, y: 2, priority: 1, text: 'Small paper' }),
    ]
    const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
    expect(selected).toEqual(new Set(['big']))
  })

  it('matches the reported bug: three labels overlapping in a dense center collapse to one', () => {
    // Mirrors "Opinion Paper…", "Ethics of AI in Education…", and
    // "Emerging challenges…" all sitting close together on screen.
    const candidates = [
      candidate({ id: 'opinion', x: 100, y: 100, priority: 5, text: 'Opinion Paper on AI Ethics' }),
      candidate({ id: 'ethics', x: 106, y: 102, priority: 8, text: 'Ethics of AI in Education' }),
      candidate({ id: 'emerging', x: 112, y: 98, priority: 3, text: 'Emerging challenges in AI' }),
    ]
    const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
    expect(selected).toEqual(new Set(['ethics'])) // highest priority wins
  })

  it('never selects two labels whose boxes overlap, for any pair in the result', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      candidate({ id: `n${i}`, x: (i % 5) * 15, y: Math.floor(i / 5) * 15, priority: 20 - i, text: `Paper number ${i}` }),
    )
    const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
    const kept = candidates.filter((c) => selected.has(c.id))
    for (let i = 0; i < kept.length; i++) {
      for (let j = i + 1; j < kept.length; j++) {
        const a = kept[i]
        const b = kept[j]
        const aBox = { x: a.x + a.radius + 3, y: a.y - FONT_SIZE, width: measureTextWidth(a.text, FONT_SIZE), height: FONT_SIZE * 1.3 }
        const bBox = { x: b.x + b.radius + 3, y: b.y - FONT_SIZE, width: measureTextWidth(b.text, FONT_SIZE), height: FONT_SIZE * 1.3 }
        const overlap =
          aBox.x < bBox.x + bBox.width &&
          aBox.x + aBox.width > bBox.x &&
          aBox.y < bBox.y + bBox.height &&
          aBox.y + aBox.height > bBox.y
        expect(overlap).toBe(false)
      }
    }
  })

  it('reveals more labels once "zoomed in" (screen positions spread apart)', () => {
    // Same three candidates as the dense-center case, but with all
    // coordinates scaled up 8x — simulating what their screen positions
    // become after the user zooms in (graph-space positions are fixed;
    // zooming only changes the screen-space distance between them).
    const zoom = 8
    const candidates = [
      candidate({ id: 'opinion', x: 100 * zoom, y: 100 * zoom, priority: 5, text: 'Opinion Paper on AI Ethics' }),
      candidate({ id: 'ethics', x: 106 * zoom, y: 102 * zoom, priority: 8, text: 'Ethics of AI in Education' }),
      candidate({ id: 'emerging', x: 112 * zoom, y: 98 * zoom, priority: 3, text: 'Emerging challenges in AI' }),
    ]
    const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
    expect(selected.size).toBeGreaterThan(1) // more than the 1 label shown at the default zoom
  })

  it('returns an empty set for no candidates', () => {
    expect(selectNonOverlappingLabels([], measureTextWidth, FONT_SIZE)).toEqual(new Set())
  })
})
