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

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function candidateBox(candidate: LabelCandidate, fontSize: number, textWidth: number): Box {
  return {
    x: candidate.x + candidate.radius + 3,
    y: candidate.y - fontSize,
    width: textWidth,
    height: fontSize * 1.3,
  }
}

/**
 * Greedily keeps the highest-priority label at each screen position,
 * dropping any candidate whose bounding box would overlap one already
 * kept — so, at any given zoom, no two visible labels overlap. Since the
 * candidates carry screen-space (not graph-space) coordinates, zooming in
 * spreads nodes apart on screen and naturally lets more labels through
 * without any change to this algorithm.
 */
export function selectNonOverlappingLabels(
  candidates: LabelCandidate[],
  measureTextWidth: (text: string, fontSize: number) => number,
  fontSize: number,
): Set<string> {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const placedBoxes: Box[] = []
  const selected = new Set<string>()

  for (const candidate of sorted) {
    const box = candidateBox(candidate, fontSize, measureTextWidth(candidate.text, fontSize))
    if (placedBoxes.some((placed) => boxesOverlap(placed, box))) continue
    placedBoxes.push(box)
    selected.add(candidate.id)
  }

  return selected
}
