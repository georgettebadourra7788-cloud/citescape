import { citationRank } from '../graph/citationRank'
import { nodeSize } from '../graph/nodeSize'
import { truncateTitle } from '../text'
import type { ClusterSummary, GraphNode } from '../graph/types'

/** One label per cluster's top item, but capped so the map doesn't get busy. */
export const MAX_LABELS = 12
export const LABEL_FONT_SIZE = 11
/** Extra horizontal gap between a node's edge and its label's left edge. */
const LABEL_GAP = 4

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

let measureCanvasContext: CanvasRenderingContext2D | null | undefined
/** Real text metrics when a canvas is available (always true in-app); a rough estimate otherwise (e.g. tests). */
export function measureTextWidth(text: string, fontSize: number): number {
  if (measureCanvasContext === undefined) {
    measureCanvasContext =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (measureCanvasContext) {
    measureCanvasContext.font = `${fontSize}px sans-serif`
    return measureCanvasContext.measureText(text).width
  }
  return text.length * fontSize * 0.55
}

export interface PlacedLabel {
  nodeId: string
  text: string
  /** Anchor for the text's left/baseline point (after the node's own radius). */
  x: number
  y: number
  box: Box
}

/**
 * Picks one label per cluster's top-ranked item (biggest clusters first —
 * `clusters` is already sorted that way), greedily skipping any whose
 * bounding box would collide with an already-placed label, up to
 * `MAX_LABELS`. Shared by the SVG and PNG exporters so both draw exactly
 * the same labels in exactly the same places.
 */
export function placeLabels(
  clusters: ClusterSummary[],
  nodeById: Map<string, GraphNode>,
  toPixel: (x: number, y: number) => { x: number; y: number },
  maxRank: number,
  fontSize: number = LABEL_FONT_SIZE,
): PlacedLabel[] {
  const placed: PlacedLabel[] = []
  const placedBoxes: Box[] = []

  for (const cluster of clusters) {
    if (placed.length >= MAX_LABELS) break
    const candidateId = cluster.topPapers[0]?.id
    if (!candidateId) continue
    const node = nodeById.get(candidateId)
    if (!node || node.resolved === false) continue

    const p = toPixel(node.x, node.y)
    const r = nodeSize(citationRank(node), maxRank)
    const text = truncateTitle(node.label, 60)
    const textWidth = measureTextWidth(text, fontSize)
    const box: Box = {
      x: p.x + r + LABEL_GAP,
      y: p.y - fontSize,
      width: textWidth,
      height: fontSize * 1.3,
    }
    if (placedBoxes.some((placed) => boxesOverlap(placed, box))) continue

    placedBoxes.push(box)
    placed.push({ nodeId: candidateId, text, x: box.x, y: p.y + fontSize / 3, box })
  }

  return placed
}
