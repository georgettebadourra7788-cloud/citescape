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

export function clusterColor(cluster: number): string {
  if (cluster < 0) return '#94a3b8' // slate-400, for any unassigned node
  return PALETTE[cluster % PALETTE.length]
}

/** Used to dim nodes/edges outside the current highlight (cluster select or hover). */
export const DIMMED_COLOR = '#e2e8f0' // slate-200
export const HIGHLIGHTED_EDGE_COLOR = '#475569' // slate-600

