import { describe, expect, it } from 'vitest'
import {
  chooseLegendPlacement,
  computeLegendGridLayout,
  computeMapCanvasSize,
  mapToPixel,
  paddedBBox,
} from './pngLayout'

describe('computeMapCanvasSize', () => {
  it('gives a wide graph a wide canvas (long edge on width)', () => {
    const size = computeMapCanvasSize({ x: [0, 1000], y: [0, 200] }, { targetLongEdge: 1200 })
    expect(size.aspect).toBeGreaterThan(1)
    expect(size.widthCss).toBe(1200)
    expect(size.heightCss).toBeLessThan(size.widthCss)
  })

  it('gives a tall graph a tall canvas (long edge on height)', () => {
    const size = computeMapCanvasSize({ x: [0, 200], y: [0, 1000] }, { targetLongEdge: 1200 })
    expect(size.aspect).toBeLessThan(1)
    expect(size.heightCss).toBe(1200)
    expect(size.widthCss).toBeLessThan(size.heightCss)
  })

  it('gives a square graph a square canvas', () => {
    const size = computeMapCanvasSize({ x: [0, 500], y: [0, 500] }, { targetLongEdge: 1200 })
    expect(size.aspect).toBeCloseTo(1)
    expect(size.widthCss).toBeCloseTo(size.heightCss)
  })

  it('adds the padding fraction to each side of the span', () => {
    const size = computeMapCanvasSize({ x: [0, 1000], y: [0, 1000] }, { padding: 0.1, targetLongEdge: 1200 })
    // 1000 * (1 + 0.1*2) = 1200
    expect(size.paddedSpanX).toBeCloseTo(1200)
    expect(size.paddedSpanY).toBeCloseTo(1200)
  })

  it('clamps to the minimum edge for an extreme aspect ratio', () => {
    const size = computeMapCanvasSize(
      { x: [0, 10000], y: [0, 10] },
      { targetLongEdge: 1200, minEdge: 300 },
    )
    expect(size.widthCss).toBe(1200)
    expect(size.heightCss).toBe(300) // would otherwise be far under 300
  })

  it('floors a degenerate (single-point) span to avoid a zero-size canvas', () => {
    const size = computeMapCanvasSize({ x: [5, 5], y: [5, 5] }, { targetLongEdge: 1200 })
    expect(size.widthCss).toBeGreaterThan(0)
    expect(size.heightCss).toBeGreaterThan(0)
  })
})

describe('paddedBBox', () => {
  it('is centered on the original bbox and spans the padded size', () => {
    const size = computeMapCanvasSize({ x: [0, 1000], y: [0, 1000] }, { padding: 0.1 })
    const bbox = paddedBBox(size)
    expect(bbox.x[0] + bbox.x[1]).toBeCloseTo(1000) // center still 500
    expect(bbox.x[1] - bbox.x[0]).toBeCloseTo(1200)
  })
})

describe('mapToPixel', () => {
  it('maps the bbox center to the canvas center', () => {
    const size = computeMapCanvasSize({ x: [0, 1000], y: [0, 1000] })
    const toPixel = mapToPixel(size)
    const p = toPixel(size.cx, size.cy)
    expect(p.x).toBeCloseTo(size.widthCss / 2)
    expect(p.y).toBeCloseTo(size.heightCss / 2)
  })

  it('flips y: a graph-space point above center lands above center in pixels (smaller y)', () => {
    const size = computeMapCanvasSize({ x: [0, 1000], y: [0, 1000] })
    const toPixel = mapToPixel(size)
    const above = toPixel(size.cx, size.cy + 100) // larger graph y = "up"
    const below = toPixel(size.cx, size.cy - 100)
    expect(above.y).toBeLessThan(size.heightCss / 2)
    expect(below.y).toBeGreaterThan(size.heightCss / 2)
  })
})

describe('chooseLegendPlacement', () => {
  it('places the legend below a wide (landscape) graph', () => {
    expect(chooseLegendPlacement(1.5)).toBe('below')
  })

  it('places the legend beside a tall (portrait) graph', () => {
    expect(chooseLegendPlacement(0.6)).toBe('beside')
  })

  it('treats an exactly-square graph as "below" (the >= 1 boundary)', () => {
    expect(chooseLegendPlacement(1)).toBe('below')
  })
})

describe('computeLegendGridLayout', () => {
  it('returns an empty layout for zero entries', () => {
    expect(computeLegendGridLayout(0, 1200)).toEqual({ cols: 0, rows: 0, heightCss: 0 })
  })

  it('fits everything in one row when there is enough width', () => {
    const layout = computeLegendGridLayout(3, 1200) // 1200 / 300 = 4 columns available
    expect(layout.cols).toBe(4)
    expect(layout.rows).toBe(1)
  })

  it('wraps into more rows when entries exceed the available columns', () => {
    const layout = computeLegendGridLayout(10, 600) // 600 / 300 = 2 columns
    expect(layout.cols).toBe(2)
    expect(layout.rows).toBe(5)
  })

  it('never returns zero columns even for a very narrow canvas', () => {
    const layout = computeLegendGridLayout(3, 50)
    expect(layout.cols).toBe(1)
    expect(layout.rows).toBe(3)
  })
})
