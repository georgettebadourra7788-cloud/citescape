// Shared by the worker (ForceAtlas2's adjustSizes overlap prevention needs
// real node sizes before layout runs) and the renderer (actual node radii),
// so both agree on the same scale.

export const MIN_NODE_SIZE = 6
export const MAX_NODE_SIZE = 18 // exactly 3x MIN_NODE_SIZE

export function nodeSize(value: number, maxValue: number): number {
  if (maxValue <= 0) return MIN_NODE_SIZE
  const t = Math.log1p(value) / Math.log1p(maxValue)
  return MIN_NODE_SIZE + t * (MAX_NODE_SIZE - MIN_NODE_SIZE)
}
