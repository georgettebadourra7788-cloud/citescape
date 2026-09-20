// Picks which node labels to show on the live map so none ever overlap.
// Pure and Sigma-free (screen-space coordinates are computed by the
// caller) so the collision logic itself is unit testable without a real
// renderer — see NetworkGraph.tsx for how candidates are built each frame.

export interface LabelCandidate {
  id: string
  /** Screen-space (viewport pixel) node center. */
  x: number
  y: number
  /** Screen-space node radius. */
  radius: number
  text: string
  /** Higher wins ties for space — typically citation rank / node size. */
  priority: number
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Label box anchored to the right of the node — the default placement. */
function rightBox(candidate: LabelCandidate, fontSize: number, textWidth: number): Box {
  return {
    x: candidate.x + candidate.radius + 3,
    y: candidate.y - fontSize,
    width: textWidth,
    height: fontSize * 1.3,
  }
}

/** Same box, flipped to the node's left — the fallback when the right side is clipped. */
function leftBox(candidate: LabelCandidate, fontSize: number, textWidth: number): Box {
  return {
    x: candidate.x - candidate.radius - 3 - textWidth,
    y: candidate.y - fontSize,
    width: textWidth,
    height: fontSize * 1.3,
  }
}

function fitsHorizontally(box: Box, viewport: Viewport): boolean {
  return box.x >= 0 && box.x + box.width <= viewport.width
}

/** Nudges a box that would clip the top/bottom edge back into view, without changing its horizontal position. */
function clampVertical(box: Box, viewport: Viewport): Box {
  if (box.height >= viewport.height) return box
  return { ...box, y: Math.min(Math.max(box.y, 0), viewport.height - box.height) }
}

/**
 * Where a label actually gets drawn, relative to its node: which side, and
 * how far its natural vertical anchor was nudged to stay in view (0 if it
 * wasn't). The caller (NetworkGraph's draw callback) needs this — not just
 * whether the label is shown — so the canvas drawing matches the placement
 * this module decided on, rather than always drawing to the node's right.
 */
export interface LabelPlacement {
  side: 'left' | 'right'
  dy: number
}

interface Placement extends LabelPlacement {
  box: Box
}

/**
 * Tries the node's right side first, then its left, returning `null` if the
 * label fits on neither (used by selection, which is allowed to drop a
 * label). With no `viewport` (e.g. in tests that don't care about canvas
 * bounds), the label is always placed to the right.
 */
function tryPlace(
  candidate: LabelCandidate,
  fontSize: number,
  textWidth: number,
  viewport: Viewport | undefined,
): Placement | null {
  const right = rightBox(candidate, fontSize, textWidth)
  if (!viewport) return { box: right, side: 'right', dy: 0 }
  if (fitsHorizontally(right, viewport)) {
    const clamped = clampVertical(right, viewport)
    return { box: clamped, side: 'right', dy: clamped.y - right.y }
  }
  const left = leftBox(candidate, fontSize, textWidth)
  if (fitsHorizontally(left, viewport)) {
    const clamped = clampVertical(left, viewport)
    return { box: clamped, side: 'left', dy: clamped.y - left.y }
  }
  return null
}

/**
 * Same as tryPlace, but for a label that must always be shown regardless of
 * fit (the hovered node, or the selected node — see NetworkGraph.tsx) —
 * picks whichever side overflows the canvas least instead of ever
 * returning `null`. Returns the box too (unlike the public placeLabel
 * below) so selectHoverLabels can seed collision detection with it.
 */
function placeNeverDrop(
  candidate: LabelCandidate,
  fontSize: number,
  textWidth: number,
  viewport: Viewport | undefined,
): Placement {
  const placed = tryPlace(candidate, fontSize, textWidth, viewport)
  if (placed) return placed

  // Neither side fits cleanly — still show it, preferring the side that overflows less.
  const right = rightBox(candidate, fontSize, textWidth)
  const left = leftBox(candidate, fontSize, textWidth)
  const overflow = (box: Box) => Math.max(0, -box.x) + Math.max(0, box.x + box.width - (viewport?.width ?? Infinity))
  return overflow(right) <= overflow(left) ? { box: right, side: 'right', dy: 0 } : { box: left, side: 'left', dy: 0 }
}

/**
 * Same as tryPlace, but for a label that must always be shown regardless of
 * fit (the hovered/selected node — see NetworkGraph.tsx) — picks whichever
 * side overflows the canvas least instead of ever returning `null`.
 */
export function placeLabel(
  candidate: LabelCandidate,
  measureTextWidth: (text: string, fontSize: number) => number,
  fontSize: number,
  viewport?: Viewport,
): LabelPlacement {
  const textWidth = measureTextWidth(candidate.text, fontSize)
  const { side, dy } = placeNeverDrop(candidate, fontSize, textWidth, viewport)
  return { side, dy }
}

export interface SelectLabelsOptions {
  /** Never select more than this many labels, even if more would fit without overlapping. */
  maxLabels?: number
  /**
   * Canvas dimensions, in the same screen-space pixels as the candidates'
   * x/y. When given, a label that would be cut off by either edge is
   * flipped to the node's other side, or dropped if it doesn't fit on
   * either side — see tryPlace.
   */
  viewport?: Viewport
}

/**
 * Greedily keeps the highest-priority label at each screen position,
 * dropping any candidate whose bounding box would overlap one already
 * kept, run off the canvas edge on both sides, or exceed `maxLabels` — so,
 * at any given zoom, no two visible labels overlap and none are clipped.
 * Since the candidates carry screen-space (not graph-space) coordinates,
 * zooming in spreads nodes apart on screen and naturally lets more labels
 * through without any change to this algorithm.
 *
 * Returns each selected label's actual placement (which side of the node,
 * and any vertical nudge) — not just whether it's shown — so the caller's
 * draw code can render it exactly where this module decided it should go.
 */
export function selectNonOverlappingLabels(
  candidates: LabelCandidate[],
  measureTextWidth: (text: string, fontSize: number) => number,
  fontSize: number,
  options: SelectLabelsOptions = {},
): Map<string, LabelPlacement> {
  const { maxLabels = Infinity, viewport } = options
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const placedBoxes: Box[] = []
  const selected = new Map<string, LabelPlacement>()

  for (const candidate of sorted) {
    if (selected.size >= maxLabels) break
    const placement = tryPlace(candidate, fontSize, measureTextWidth(candidate.text, fontSize), viewport)
    if (!placement) continue
    if (placedBoxes.some((placed) => boxesOverlap(placed, placement.box))) continue
    placedBoxes.push(placement.box)
    selected.set(candidate.id, { side: placement.side, dy: placement.dy })
  }

  return selected
}

/**
 * Same collision/edge-clipping rules as selectNonOverlappingLabels, but
 * with one candidate — the hovered node, or, if nothing's hovered, the
 * selected node (see NetworkGraph.tsx) — guaranteed a label, drawn on top,
 * never dropped for the cap, an overlap, or clipping (same never-drop
 * behavior as placeLabel). Every other candidate competes for the
 * remaining `maxLabels` slots by priority, never overlapping the focused
 * label or each other, and can still be flipped or dropped at the canvas
 * edge like any other label. This is the one routine both the resting
 * state's "selected but not hovered" case and the hover-scoped case route
 * through, so a focused node's label is drawn exactly once, consistently,
 * in every state.
 */
export function selectLabelsWithFocus(
  focusId: string,
  candidates: LabelCandidate[],
  measureTextWidth: (text: string, fontSize: number) => number,
  fontSize: number,
  options: SelectLabelsOptions = {},
): Map<string, LabelPlacement> {
  const { maxLabels = Infinity, viewport } = options
  const selected = new Map<string, LabelPlacement>()
  const placedBoxes: Box[] = []

  const focused = candidates.find((c) => c.id === focusId)
  if (focused) {
    const placement = placeNeverDrop(focused, fontSize, measureTextWidth(focused.text, fontSize), viewport)
    selected.set(focused.id, { side: placement.side, dy: placement.dy })
    placedBoxes.push(placement.box)
  }

  const others = [...candidates].filter((c) => c.id !== focusId).sort((a, b) => b.priority - a.priority)
  for (const candidate of others) {
    if (selected.size >= maxLabels) break
    const placement = tryPlace(candidate, fontSize, measureTextWidth(candidate.text, fontSize), viewport)
    if (!placement) continue
    if (placedBoxes.some((box) => boxesOverlap(box, placement.box))) continue
    placedBoxes.push(placement.box)
    selected.set(candidate.id, { side: placement.side, dy: placement.dy })
  }

  return selected
}

const CLUSTER_TOP_TIER_BONUS = 1e9

/**
 * Priority for a label candidate. `clusterTopRank` is 0 for a cluster's
 * single highest-citationRank paper, 1 for its second, -1 for anything
 * else (see buildDisplayGraph.ts) — every cluster's rank-0 candidates
 * outrank every cluster's rank-1 candidates, which in turn outrank
 * everything else, so `selectNonOverlappingLabels` fills at least 2 labels
 * per cluster (when they fit) before giving any cluster a 3rd. Within a
 * tier, or outside all tiers, citation rank breaks ties.
 */
export function labelPriority(clusterTopRank: number, citations: number): number {
  if (clusterTopRank < 0) return citations
  return (2 - clusterTopRank) * CLUSTER_TOP_TIER_BONUS + citations
}

const DEFAULT_LABEL_CAP = 10
const ZOOMED_IN_LABEL_CAP = 40

/**
 * How many labels to allow at the given camera zoom: `defaultCap` (10) at
 * rest (`cameraRatio` at or above 1, i.e. the fitted default view) rising
 * to `zoomedInCap` (40) as the camera approaches `minCameraRatio` (its most
 * zoomed-in state). Interpolated on a log scale since camera ratio is
 * itself a zoom *multiple*, not a linear distance.
 */
export function labelCapForZoom(
  cameraRatio: number,
  minCameraRatio: number,
  options: { defaultCap?: number; zoomedInCap?: number } = {},
): number {
  const defaultCap = options.defaultCap ?? DEFAULT_LABEL_CAP
  const zoomedInCap = options.zoomedInCap ?? ZOOMED_IN_LABEL_CAP
  if (minCameraRatio >= 1) return defaultCap

  const clampedRatio = Math.min(1, Math.max(minCameraRatio, cameraRatio))
  const t = Math.log(1 / clampedRatio) / Math.log(1 / minCameraRatio)
  return Math.round(defaultCap + t * (zoomedInCap - defaultCap))
}
