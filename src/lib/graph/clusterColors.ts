// A brand-neutral categorical palette, distinguishable in both count and
// hue. Cycles (with a lightness shift) if there are more clusters than
// colors, which is rare — most searches resolve to well under 12 clusters.
const PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#d97706', // amber
  '#9333ea', // purple
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ea580c', // orange
  '#4f46e5', // indigo
  '#0d9488', // teal
  '#be123c', // rose
]

/** Neutral gray for the "Other" bucket (cluster <= 0) and unresolved nodes. */
export const OTHER_COLOR = '#94a3b8' // slate-400

/** Solid color for legend swatches and other small, opaque UI chips. */
export function clusterColor(cluster: number): string {
  if (cluster <= 0) return OTHER_COLOR
  return PALETTE[(cluster - 1) % PALETTE.length]
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Slightly transparent version of clusterColor, for node fills so overlaps stay readable. */
export function clusterNodeColor(cluster: number, alpha = 0.85): string {
  const [r, g, b] = hexToRgb(clusterColor(cluster))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Used to dim nodes/edges outside the current highlight (cluster select or hover). */
export const DIMMED_COLOR = '#e2e8f0' // slate-200
export const HIGHLIGHTED_EDGE_COLOR = '#475569' // slate-600
