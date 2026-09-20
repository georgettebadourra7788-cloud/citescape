// Pure layout math for the PNG export — kept separate from pngExport.ts
// (which needs a live Sigma instance + canvas and so can't run in tests)
// so the actual cropping/placement decisions are unit testable.

import type { Box } from './labelPlacement'

export interface Bbox {
  x: [number, number]
  y: [number, number]
}

/** Per-side padding fraction added around the graph's bounding box. */
export const MAP_PADDING = 0.06
/** CSS-px baseline for whichever of the padded bbox's two dimensions is longer. */
export const MAP_TARGET_LONG_EDGE = 1200
export const MIN_MAP_EDGE = 300

export interface MapCanvasSize {
  widthCss: number
  heightCss: number
  /** Padded-bbox width / height — >=1 means wider than tall. */
  aspect: number
  /** CSS px per graph-space unit. */
  scale: number
  cx: number
  cy: number
  paddedSpanX: number
  paddedSpanY: number
}

/**
 * Chooses an output map size whose aspect ratio exactly matches the
 * padded bounding box, so framing the graph to that bbox produces zero
 * letterboxing — unlike reusing the on-screen container's aspect ratio,
 * which can leave large empty margins for a graph shaped very differently
 * from the (roughly square) map container.
 */
export function computeMapCanvasSize(
  bbox: Bbox,
  options: { padding?: number; targetLongEdge?: number; minEdge?: number } = {},
): MapCanvasSize {
  const padding = options.padding ?? MAP_PADDING
  const targetLongEdge = options.targetLongEdge ?? MAP_TARGET_LONG_EDGE
  const minEdge = options.minEdge ?? MIN_MAP_EDGE

  const spanX = Math.max(bbox.x[1] - bbox.x[0], 1)
  const spanY = Math.max(bbox.y[1] - bbox.y[0], 1)
  const paddedSpanX = spanX * (1 + padding * 2)
  const paddedSpanY = spanY * (1 + padding * 2)
  const aspect = paddedSpanX / paddedSpanY

  let widthCss: number
  let heightCss: number
  if (aspect >= 1) {
    widthCss = targetLongEdge
    heightCss = targetLongEdge / aspect
  } else {
    heightCss = targetLongEdge
    widthCss = targetLongEdge * aspect
  }
  widthCss = Math.max(widthCss, minEdge)
  heightCss = Math.max(heightCss, minEdge)

  return {
    widthCss,
    heightCss,
    aspect,
    scale: widthCss / paddedSpanX,
    cx: (bbox.x[0] + bbox.x[1]) / 2,
    cy: (bbox.y[0] + bbox.y[1]) / 2,
    paddedSpanX,
    paddedSpanY,
  }
}

/** The padded bbox to hand to Sigma's `setCustomBBox`, matching `computeMapCanvasSize`'s framing. */
export function paddedBBox(mapSize: MapCanvasSize): Bbox {
  return {
    x: [mapSize.cx - mapSize.paddedSpanX / 2, mapSize.cx + mapSize.paddedSpanX / 2],
    y: [mapSize.cy - mapSize.paddedSpanY / 2, mapSize.cy + mapSize.paddedSpanY / 2],
  }
}

/** Graph-space -> map-canvas CSS-px space, y flipped to match Sigma's up-is-up convention. */
export function mapToPixel(mapSize: MapCanvasSize) {
  return (x: number, y: number) => ({
    x: (x - mapSize.cx) * mapSize.scale + mapSize.widthCss / 2,
    y: mapSize.heightCss / 2 - (y - mapSize.cy) * mapSize.scale,
  })
}

export type LegendPlacement = 'beside' | 'below'

/**
 * A wide graph gets a legend below it (adding width on top of an already-
 * wide canvas wastes more space than adding height); a tall graph gets it
 * beside (the reverse).
 */
export function chooseLegendPlacement(aspect: number): LegendPlacement {
  return aspect >= 1 ? 'below' : 'beside'
}

export const LEGEND_COL_WIDTH_CSS = 300
export const LEGEND_ROW_HEIGHT_CSS = 34
export const LEGEND_TOP_PADDING_CSS = 20
export const LEGEND_DOT_RADIUS_CSS = 6
/** >= dot radius + comfortable padding, so a legend dot is never clipped at the canvas's left edge. */
export const LEGEND_LEFT_MARGIN_CSS = 20

export interface LegendGridLayout {
  cols: number
  rows: number
  heightCss: number
}

/** Wraps a "below" legend into as many columns as fit, instead of one very tall list. */
export function computeLegendGridLayout(entryCount: number, availableWidthCss: number): LegendGridLayout {
  if (entryCount === 0) return { cols: 0, rows: 0, heightCss: 0 }
  const cols = Math.max(1, Math.floor(availableWidthCss / LEGEND_COL_WIDTH_CSS))
  const rows = Math.ceil(entryCount / cols)
  return { cols, rows, heightCss: LEGEND_TOP_PADDING_CSS + rows * LEGEND_ROW_HEIGHT_CSS }
}

export interface LegendEntryPosition {
  index: number
  dotCenter: { x: number; y: number }
  dotRadius: number
  textX: number
  textY: number
}

function legendEntryPosition(index: number, x: number, y: number): LegendEntryPosition {
  return { index, dotCenter: { x, y }, dotRadius: LEGEND_DOT_RADIUS_CSS, textX: x + 14, textY: y }
}

/** One legend column to the right of the map, top to bottom. */
export function computeBesideLegendPositions(entryCount: number, mapWidthCss: number): LegendEntryPosition[] {
  const x = mapWidthCss + LEGEND_LEFT_MARGIN_CSS
  return Array.from({ length: entryCount }, (_, i) =>
    legendEntryPosition(i, x, LEGEND_TOP_PADDING_CSS + i * LEGEND_ROW_HEIGHT_CSS),
  )
}

/**
 * A grid below the map, wrapped into as many columns as fit — each column
 * starts `LEGEND_LEFT_MARGIN_CSS` in, so column 0's dots aren't clipped at
 * the canvas's left edge (the bug this was built to fix: a column literally
 * starting at x=0 clips the left half of every dot in it).
 */
export function computeBelowLegendPositions(
  entryCount: number,
  mapWidthCss: number,
  topOffsetCss: number,
): { positions: LegendEntryPosition[]; grid: LegendGridLayout } {
  const grid = computeLegendGridLayout(entryCount, mapWidthCss - LEGEND_LEFT_MARGIN_CSS)
  const cols = Math.max(grid.cols, 1)
  const positions = Array.from({ length: entryCount }, (_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return legendEntryPosition(
      i,
      LEGEND_LEFT_MARGIN_CSS + col * LEGEND_COL_WIDTH_CSS,
      topOffsetCss + LEGEND_TOP_PADDING_CSS + row * LEGEND_ROW_HEIGHT_CSS,
    )
  })
  return { positions, grid }
}

/** The dot's own bounding box, in the same units as `LegendEntryPosition` — used to check nothing clips. */
export function legendDotBoundingBox(position: LegendEntryPosition): Box {
  return {
    x: position.dotCenter.x - position.dotRadius,
    y: position.dotCenter.y - position.dotRadius,
    width: position.dotRadius * 2,
    height: position.dotRadius * 2,
  }
}
