import { describe, expect, it } from 'vitest'
import {
  labelCapForZoom,
  labelPriority,
  placeLabel,
  selectLabelsWithFocus,
  selectNonOverlappingLabels,
  type LabelCandidate,
} from './labelCollision'

const FONT_SIZE = 11
/** Deterministic stand-in for canvas measureText, proportional to length. */
const measureTextWidth = (text: string, fontSize: number) => text.length * fontSize * 0.5

function candidate(overrides: Partial<LabelCandidate> & { id: string }): LabelCandidate {
  return { x: 0, y: 0, radius: 6, text: overrides.id, priority: 1, ...overrides }
}

/** selectNonOverlappingLabels returns placement info per label; most tests only care which ids won. */
function selectedIds(selected: Map<string, unknown>): Set<string> {
  return new Set(selected.keys())
}

describe('selectNonOverlappingLabels', () => {
  it('keeps both labels when they do not overlap', () => {
    const candidates = [
      candidate({ id: 'a', x: 0, y: 0, priority: 2 }),
      candidate({ id: 'b', x: 500, y: 0, priority: 1 }),
    ]
    const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
    expect(selectedIds(selected)).toEqual(new Set(['a', 'b']))
  })

  it('drops the lower-priority (smaller-node) label when two would overlap', () => {
    const candidates = [
      candidate({ id: 'big', x: 0, y: 0, priority: 10, text: 'Big important paper' }),
      candidate({ id: 'small', x: 5, y: 2, priority: 1, text: 'Small paper' }),
    ]
    const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
    expect(selectedIds(selected)).toEqual(new Set(['big']))
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
    expect(selectedIds(selected)).toEqual(new Set(['ethics'])) // highest priority wins
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

  it('returns an empty map for no candidates', () => {
    expect(selectNonOverlappingLabels([], measureTextWidth, FONT_SIZE).size).toBe(0)
  })

  describe('maxLabels', () => {
    it('never selects more than maxLabels, keeping the highest-priority candidates', () => {
      // 20 well-separated, non-overlapping candidates — without a cap all 20 would fit.
      const candidates = Array.from({ length: 20 }, (_, i) =>
        candidate({ id: `n${i}`, x: i * 200, y: 0, priority: 20 - i, text: `Paper ${i}` }),
      )
      const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE, {
        maxLabels: 10,
      })
      expect(selected.size).toBe(10)
      // The 10 kept are exactly the 10 highest-priority (lowest index) ones.
      expect(selectedIds(selected)).toEqual(new Set(candidates.slice(0, 10).map((c) => c.id)))
    })

    it('caps priority-tiered candidates as cluster-tops first, then largest, matching the live-map rule', () => {
      const CLUSTER_TOP_BONUS = 1e9
      // 3 cluster-top papers (low citation counts, but bonus-boosted) and
      // 10 ordinary papers with higher raw citation counts — mirrors
      // NetworkGraph's own priority computation.
      const clusterTops = Array.from({ length: 3 }, (_, i) =>
        candidate({ id: `top${i}`, x: i * 200, y: 0, priority: CLUSTER_TOP_BONUS + i, text: `Top ${i}` }),
      )
      const ordinary = Array.from({ length: 10 }, (_, i) =>
        candidate({ id: `p${i}`, x: 1000 + i * 200, y: 0, priority: 100 - i, text: `Paper ${i}` }),
      )
      const selected = selectNonOverlappingLabels([...ordinary, ...clusterTops], measureTextWidth, FONT_SIZE, {
        maxLabels: 5,
      })
      expect(selected.size).toBe(5)
      // All 3 cluster tops make it in before any ordinary paper does.
      for (const top of clusterTops) expect(selected.has(top.id)).toBe(true)
      expect(selected.has('p0')).toBe(true)
      expect(selected.has('p1')).toBe(true)
      expect(selected.has('p2')).toBe(false)
    })
  })

  describe('cluster-top-2 guarantee (labelPriority)', () => {
    it('guarantees at least 2 labels per cluster before any cluster gets a 3rd', () => {
      // 3 clusters, each with a rank-0 and rank-1 top paper (bonus-boosted
      // via labelPriority) plus 3 ordinary high-citation papers that would
      // otherwise crowd out everything else.
      const clusterCandidates = Array.from({ length: 3 }, (_, c) => [
        candidate({
          id: `c${c}top0`,
          x: c * 400,
          y: 0,
          priority: labelPriority(0, 1),
          text: `Cluster ${c} top`,
        }),
        candidate({
          id: `c${c}top1`,
          x: c * 400 + 100,
          y: 0,
          priority: labelPriority(1, 1),
          text: `Cluster ${c} second`,
        }),
      ]).flat()
      const ordinary = Array.from({ length: 3 }, (_, i) =>
        candidate({ id: `p${i}`, x: 2000 + i * 200, y: 0, priority: labelPriority(-1, 1000 - i), text: `Paper ${i}` }),
      )
      const selected = selectNonOverlappingLabels([...ordinary, ...clusterCandidates], measureTextWidth, FONT_SIZE, {
        maxLabels: 6,
      })
      expect(selected.size).toBe(6)
      // All 6 cluster-top-2 candidates fill the budget before any ordinary paper does.
      for (const c of clusterCandidates) expect(selected.has(c.id)).toBe(true)
      expect(selected.has('p0')).toBe(false)
    })
  })

  describe('viewport edge clipping', () => {
    it('flips a label to the node\'s left when the right-side placement would run off the canvas', () => {
      const viewport = { width: 400, height: 300 }
      // Node near the right edge — a right-side label would overflow.
      const candidates = [candidate({ id: 'edge', x: 390, y: 100, priority: 1, text: 'A fairly long title here' })]
      const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE, { viewport })
      expect(selectedIds(selected)).toEqual(new Set(['edge']))
      expect(selected.get('edge')?.side).toBe('left')
    })

    it('drops a label that fits on neither side (node itself off-canvas)', () => {
      const viewport = { width: 400, height: 300 }
      // Way outside the canvas on both sides — an oversized label can't fit left or right.
      const candidates = [candidate({ id: 'lost', x: 200, y: 100, priority: 1, text: 'X'.repeat(200) })]
      const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE, { viewport })
      expect(selected.size).toBe(0)
    })

    it('nudges a label vertically back into view instead of dropping it near the top/bottom edge', () => {
      const viewport = { width: 400, height: 300 }
      const candidates = [candidate({ id: 'top-edge', x: 100, y: 1, priority: 1, text: 'Short' })]
      const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE, { viewport })
      expect(selectedIds(selected)).toEqual(new Set(['top-edge']))
      // Its natural box top (y - fontSize = 1 - 11 = -10) got nudged down to 0.
      expect(selected.get('top-edge')?.dy).toBe(10)
    })

    it('keeps the default right-side placement when nothing is given (no viewport)', () => {
      // Same coordinates as the "flips" case above, but with no viewport —
      // should place (and keep) it on the right without ever considering clipping.
      const candidates = [candidate({ id: 'edge', x: 390, y: 100, priority: 1, text: 'A fairly long title here' })]
      const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE)
      expect(selectedIds(selected)).toEqual(new Set(['edge']))
      expect(selected.get('edge')?.side).toBe('right')
      expect(selected.get('edge')?.dy).toBe(0)
    })

    it('does not let a flipped-left label collide with another label already placed there', () => {
      const viewport = { width: 400, height: 300 }
      const candidates = [
        // Higher priority, placed normally to the right, sitting right where a
        // left-flipped label from the second node would land.
        candidate({ id: 'blocker', x: 300, y: 100, priority: 10, text: 'Blocker' }),
        // Near the right edge with a long title, so it flips left — straight into 'blocker'.
        candidate({ id: 'edge', x: 390, y: 100, priority: 1, text: 'A very long edge title that needs lots of room' }),
      ]
      const selected = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE, { viewport })
      expect(selectedIds(selected)).toEqual(new Set(['blocker']))
    })

    it('recomputes placement for the same node when the viewport shrinks — e.g. the side panel opening', () => {
      // A node that fits comfortably to the right of a 1400px-wide canvas
      // (NetworkGraph.tsx's resize observer must re-run this with the new
      // width — see recomputeLabels — or a stale placement from before a
      // resize would clip against the new, narrower bound).
      const candidates = [candidate({ id: 'n', x: 900, y: 100, priority: 1, text: 'A moderately long paper title' })]
      const wide = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE, {
        viewport: { width: 1400, height: 1000 },
      })
      expect(wide.get('n')?.side).toBe('right')

      // Same node, same graph-space position — only the canvas got narrower.
      const narrow = selectNonOverlappingLabels(candidates, measureTextWidth, FONT_SIZE, {
        viewport: { width: 1000, height: 1000 },
      })
      expect(narrow.get('n')?.side).toBe('left')
    })
  })
})

describe('placeLabel', () => {
  // Used for the hovered/selected node — see NetworkGraph.tsx — which must
  // always show a label, unlike selectNonOverlappingLabels' candidates.
  it('places on the right by default, with no vertical nudge, when there is room', () => {
    const placement = placeLabel(candidate({ id: 'a', x: 100, y: 100, text: 'Short' }), measureTextWidth, FONT_SIZE, {
      width: 400,
      height: 300,
    })
    expect(placement).toEqual({ side: 'right', dy: 0 })
  })

  it('flips to the left when the right side would clip the canvas edge', () => {
    const placement = placeLabel(
      candidate({ id: 'edge', x: 390, y: 100, text: 'A fairly long title here' }),
      measureTextWidth,
      FONT_SIZE,
      { width: 400, height: 300 },
    )
    expect(placement.side).toBe('left')
  })

  it('never drops the label, even when it fits on neither side — picks the side with less overflow', () => {
    // Node itself sits right at the canvas edge with an oversized title:
    // the right placement would overflow far more than the left.
    const placement = placeLabel(
      candidate({ id: 'lost', x: 399, y: 100, text: 'X'.repeat(200) }),
      measureTextWidth,
      FONT_SIZE,
      { width: 400, height: 300 },
    )
    expect(placement.side).toBe('left')
  })

  it('places on the right with no viewport, same as the collision-aware path', () => {
    const placement = placeLabel(candidate({ id: 'a', x: 999, y: 100, text: 'Anything' }), measureTextWidth, FONT_SIZE)
    expect(placement).toEqual({ side: 'right', dy: 0 })
  })
})

describe('selectLabelsWithFocus', () => {
  it('always keeps the hovered node\'s label, even if a higher-priority neighbor would otherwise crowd it out', () => {
    const candidates = [
      candidate({ id: 'hovered', x: 200, y: 100, priority: 1, text: 'Hovered node (low priority)' }),
      candidate({ id: 'neighbor', x: 205, y: 102, priority: 100, text: 'A much bigger neighbor' }),
    ]
    const selected = selectLabelsWithFocus('hovered', candidates, measureTextWidth, FONT_SIZE)
    expect(selected.has('hovered')).toBe(true)
  })

  it("matches the reported bug: two overlapping neighbor labels collapse to the higher-priority (larger) one", () => {
    // Mirrors "Translating Principles…" sitting right under "How the
    // machine 'thinks'…" while hovering some other node they're both
    // neighbors of.
    const candidates = [
      candidate({ id: 'hovered', x: 0, y: 200, priority: 1, text: 'Hovered node' }),
      candidate({ id: 'howMachine', x: 300, y: 100, priority: 20, text: "How the machine 'thinks'…" }),
      candidate({ id: 'translating', x: 305, y: 103, priority: 5, text: 'Translating Principles…' }),
    ]
    const selected = selectLabelsWithFocus('hovered', candidates, measureTextWidth, FONT_SIZE)
    expect(selected.has('hovered')).toBe(true)
    expect(selected.has('howMachine')).toBe(true)
    expect(selected.has('translating')).toBe(false) // dropped: would overlap the higher-priority neighbor
  })

  it('never selects two labels (hovered or neighbor) whose boxes overlap, for any pair in the result', () => {
    const hovered = candidate({ id: 'hovered', x: 0, y: 0, priority: 1, text: 'Hovered' })
    const neighbors = Array.from({ length: 15 }, (_, i) =>
      candidate({ id: `n${i}`, x: (i % 5) * 12, y: Math.floor(i / 5) * 12, priority: 15 - i, text: `Neighbor ${i}` }),
    )
    const selected = selectLabelsWithFocus('hovered', [hovered, ...neighbors], measureTextWidth, FONT_SIZE)
    const kept = [hovered, ...neighbors].filter((c) => selected.has(c.id))
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

  it('ranks neighbors by priority (node size), keeping the largest when they compete for the same space', () => {
    const candidates = [
      candidate({ id: 'hovered', x: 0, y: 300, priority: 1, text: 'Hovered' }),
      candidate({ id: 'small', x: 100, y: 100, priority: 1, text: 'A small neighbor node' }),
      candidate({ id: 'big', x: 103, y: 101, priority: 50, text: 'A big neighbor node' }),
    ]
    const selected = selectLabelsWithFocus('hovered', candidates, measureTextWidth, FONT_SIZE)
    expect(selected.has('big')).toBe(true)
    expect(selected.has('small')).toBe(false)
  })

  it('caps the total (hovered + neighbors) at maxLabels', () => {
    const hovered = candidate({ id: 'hovered', x: 0, y: 0, priority: 1, text: 'Hovered' })
    const neighbors = Array.from({ length: 20 }, (_, i) =>
      candidate({ id: `n${i}`, x: 500 + i * 200, y: 0, priority: 20 - i, text: `Neighbor ${i}` }),
    )
    const selected = selectLabelsWithFocus('hovered', [hovered, ...neighbors], measureTextWidth, FONT_SIZE, {
      maxLabels: 10,
    })
    expect(selected.size).toBe(10) // hovered + the 9 highest-priority neighbors
    expect(selected.has('hovered')).toBe(true)
    for (let i = 0; i < 9; i++) expect(selected.has(`n${i}`)).toBe(true)
    expect(selected.has('n9')).toBe(false)
  })

  describe('viewport edge clipping during hover', () => {
    it("flips a neighbor's label left when the right side would run off the canvas — same as the default view", () => {
      const viewport = { width: 400, height: 300 }
      // Mirrors "Interpretable Outcome Pred…" running off the right edge.
      const candidates = [
        candidate({ id: 'hovered', x: 50, y: 200, priority: 1, text: 'Hovered' }),
        candidate({ id: 'edge', x: 390, y: 100, priority: 10, text: 'Interpretable Outcome Predictions in AI' }),
      ]
      const selected = selectLabelsWithFocus('hovered', candidates, measureTextWidth, FONT_SIZE, { viewport })
      expect(selected.get('edge')?.side).toBe('left')
    })

    it('drops a neighbor label that fits on neither side, rather than clipping it', () => {
      const viewport = { width: 400, height: 300 }
      const candidates = [
        candidate({ id: 'hovered', x: 50, y: 200, priority: 1, text: 'Hovered' }),
        candidate({ id: 'lost', x: 200, y: 100, priority: 10, text: 'X'.repeat(200) }),
      ]
      const selected = selectLabelsWithFocus('hovered', candidates, measureTextWidth, FONT_SIZE, { viewport })
      expect(selected.has('lost')).toBe(false)
    })

    it("never drops the hovered node's own label, flipping it instead when it's the one near the edge", () => {
      const viewport = { width: 400, height: 300 }
      const candidates = [
        candidate({ id: 'hovered', x: 390, y: 100, priority: 1, text: 'A fairly long hovered title' }),
        candidate({ id: 'neighbor', x: 50, y: 200, priority: 1, text: 'Neighbor' }),
      ]
      const selected = selectLabelsWithFocus('hovered', candidates, measureTextWidth, FONT_SIZE, { viewport })
      expect(selected.has('hovered')).toBe(true)
      expect(selected.get('hovered')?.side).toBe('left')
    })
  })

  it('returns an empty map when the hovered node has no neighbors and is not itself a candidate', () => {
    expect(selectLabelsWithFocus('missing', [], measureTextWidth, FONT_SIZE).size).toBe(0)
  })

  describe('selection (not hover) — the same routine, reused', () => {
    // NetworkGraph.tsx calls this same function for a selected-but-not-
    // hovered node, passing the FULL resting-state candidate set (not just
    // neighbors) — this is what makes a selected node's label draw exactly
    // once (never twice) and never overlap another visible label.
    it("matches the reported bug: a selected node's label never overlaps another already-shown label", () => {
      // Mirrors "Can linguists distinguish…" sitting on top of "What Can
      // ChatGPT Do?…" once a node near it gets selected.
      const candidates = [
        candidate({ id: 'chatgpt', x: 300, y: 100, priority: 50, text: 'What Can ChatGPT Do?…' }),
        candidate({ id: 'selected', x: 305, y: 103, priority: 1, text: 'Can linguists distinguish…' }),
      ]
      const selected = selectLabelsWithFocus('selected', candidates, measureTextWidth, FONT_SIZE)
      // The selected node's own label always shows...
      expect(selected.has('selected')).toBe(true)
      // ...but the pre-existing higher-priority label right where it would
      // land must be the one to yield, not the other way around — since
      // the loop reserves the focus node's box FIRST, then filters others.
      expect(selected.has('chatgpt')).toBe(false)
      expect(selected.size).toBe(1)
    })

    it('is drawn exactly once — a single placement per id, never a separate left+right pair', () => {
      const candidates = [
        candidate({ id: 'selected', x: 390, y: 100, priority: 1, text: 'A fairly long selected title here' }),
        candidate({ id: 'other', x: 50, y: 200, priority: 100, text: 'Other' }),
      ]
      const selected = selectLabelsWithFocus('selected', candidates, measureTextWidth, FONT_SIZE, {
        viewport: { width: 400, height: 300 },
      })
      // Exactly one entry, exactly one side — never both.
      expect(selected.size).toBe(2)
      const placement = selected.get('selected')
      expect(placement).toBeDefined()
      expect(['left', 'right']).toContain(placement?.side)
    })

    it('caps at the zoom-derived maxLabels while guaranteeing the selected node a slot', () => {
      const selectedCandidate = candidate({ id: 'selected', x: 0, y: 0, priority: 1, text: 'Selected' })
      const rest = Array.from({ length: 15 }, (_, i) =>
        candidate({ id: `p${i}`, x: 500 + i * 200, y: 0, priority: 100 - i, text: `Paper ${i}` }),
      )
      const selected = selectLabelsWithFocus('selected', [selectedCandidate, ...rest], measureTextWidth, FONT_SIZE, {
        maxLabels: 10,
      })
      expect(selected.size).toBe(10)
      expect(selected.has('selected')).toBe(true)
    })
  })
})

describe('labelCapForZoom', () => {
  const MIN_RATIO = 0.05

  it('caps at the default (10) when at or above the resting camera ratio', () => {
    expect(labelCapForZoom(1, MIN_RATIO)).toBe(10)
    expect(labelCapForZoom(2, MIN_RATIO)).toBe(10) // zoomed further out than default — still just the default cap
  })

  it('rises toward the zoomed-in cap (40) as the ratio approaches the most-zoomed-in value', () => {
    expect(labelCapForZoom(MIN_RATIO, MIN_RATIO)).toBe(40)
  })

  it('is monotonically non-decreasing as the camera zooms in (ratio shrinks toward minCameraRatio)', () => {
    const ratios = [1, 0.5, 0.3, 0.2, 0.1, MIN_RATIO]
    const caps = ratios.map((r) => labelCapForZoom(r, MIN_RATIO))
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i]).toBeGreaterThanOrEqual(caps[i - 1])
    }
  })

  it('respects custom default/zoomed-in caps', () => {
    expect(labelCapForZoom(1, MIN_RATIO, { defaultCap: 5, zoomedInCap: 20 })).toBe(5)
    expect(labelCapForZoom(MIN_RATIO, MIN_RATIO, { defaultCap: 5, zoomedInCap: 20 })).toBe(20)
  })
})
