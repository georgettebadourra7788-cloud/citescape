import { citationRank } from '../graph/citationRank'
import { clusterColor, OTHER_COLOR } from '../graph/clusterColors'
import { nodeSize } from '../graph/nodeSize'
import { buildLegendEntries } from './legendEntries'
import { downloadText } from './download'
import { exportFilename, type ExportNetworkKind } from './filename'
import { escapeXml, truncateTitle } from '../text'
import type { NetworkResult } from '../graph/types'

const MAP_SIZE = 1400
const LEGEND_WIDTH = 380
const TITLE_HEIGHT = 56
const EDGE_COLOR = '#64748b' // slate-500
const LABEL_COLOR = '#0f172a' // slate-900
const LABEL_FONT_SIZE = 11
/** One label per cluster's top item, but capped so the map doesn't get busy. */
const MAX_LABELS = 12

function fitTransform(nodes: { x: number; y: number }[], size: number, padding = 0.08) {
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY, 1) * (1 + padding * 2)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const scale = size / span
  return (x: number, y: number) => ({
    x: size / 2 + (x - cx) * scale,
    y: size / 2 + (y - cy) * scale,
  })
}

let measureCanvasContext: CanvasRenderingContext2D | null | undefined
/** Real text metrics when a canvas is available (always true in-app); a rough estimate otherwise (e.g. tests). */
function measureTextWidth(text: string, fontSize: number): number {
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

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export interface SvgExportOptions {
  network: NetworkResult
  unitLabel: 'papers' | 'works'
  minLinkStrength: number
  title: string
  watermark: boolean
}

/**
 * Draws the current map straight from graph data (nodes' x/y layout,
 * cluster colors, edge weights) as a standalone SVG — not a Sigma
 * screenshot — so it opens as fully editable vector shapes/text in
 * Illustrator or Inkscape.
 */
export function buildSvg({ network, unitLabel, minLinkStrength, title, watermark }: SvgExportOptions): string {
  const width = MAP_SIZE + LEGEND_WIDTH
  const height = TITLE_HEIGHT + MAP_SIZE

  if (network.nodes.length === 0) {
    return svgDocument(width, TITLE_HEIGHT + 80, [
      `<text x="20" y="30" font-size="20" font-family="sans-serif" fill="${LABEL_COLOR}">${escapeXml(title)}</text>`,
      `<text x="20" y="70" font-size="14" font-family="sans-serif" fill="#64748b">No connected ${unitLabel} to map.</text>`,
    ])
  }

  const transform = fitTransform(network.nodes, MAP_SIZE, 0.08)
  const maxRank = Math.max(0, ...network.nodes.map(citationRank))

  const visibleEdges = network.edges.filter((e) => e.weight >= minLinkStrength)

  const edgeShapes = visibleEdges
    .map((edge) => {
      const source = network.nodes.find((n) => n.id === edge.source)
      const target = network.nodes.find((n) => n.id === edge.target)
      if (!source || !target) return ''
      const p1 = transform(source.x, source.y)
      const p2 = transform(target.x, target.y)
      return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${EDGE_COLOR}" stroke-width="0.75" stroke-opacity="0.25"/>`
    })
    .join('\n')

  // Candidate labels: one per cluster's top item, biggest clusters first
  // (network.clusters is already sorted that way, "Other" last). Greedily
  // place up to MAX_LABELS, skipping any whose bounding box would collide
  // with an already-placed label.
  const nodeById = new Map(network.nodes.map((n) => [n.id, n]))
  const placedBoxes: Box[] = []
  const labelTextByNodeId = new Map<string, string>()
  for (const cluster of network.clusters) {
    if (labelTextByNodeId.size >= MAX_LABELS) break
    const candidateId = cluster.topPapers[0]?.id
    if (!candidateId) continue
    const node = nodeById.get(candidateId)
    if (!node || node.resolved === false) continue

    const p = transform(node.x, node.y)
    const r = nodeSize(citationRank(node), maxRank)
    const text = truncateTitle(node.label, 60)
    const textWidth = measureTextWidth(text, LABEL_FONT_SIZE)
    const box: Box = {
      x: p.x + r + 4,
      y: p.y - LABEL_FONT_SIZE,
      width: textWidth,
      height: LABEL_FONT_SIZE * 1.3,
    }
    if (placedBoxes.some((placed) => boxesOverlap(placed, box))) continue

    placedBoxes.push(box)
    labelTextByNodeId.set(candidateId, text)
  }

  const nodeShapes = network.nodes
    .map((node) => {
      const p = transform(node.x, node.y)
      const r = nodeSize(citationRank(node), maxRank)
      const fill = node.resolved === false ? OTHER_COLOR : clusterColor(node.cluster)
      const circle = `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="0.85"/>`
      const labelText = labelTextByNodeId.get(node.id)
      if (!labelText) return circle
      const label = escapeXml(labelText)
      const text =
        `<text x="${(p.x + r + 4).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" font-size="${LABEL_FONT_SIZE}" font-family="sans-serif" ` +
        `fill="${LABEL_COLOR}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${label}</text>`
      return circle + '\n' + text
    })
    .join('\n')

  const legend = buildLegendEntries(network.clusters, unitLabel)
  const legendShapes = legend
    .map((entry, i) => {
      const y = TITLE_HEIGHT + 28 + i * 34
      return (
        `<circle cx="${MAP_SIZE + 20}" cy="${y}" r="6" fill="${entry.color}"/>` +
        `<text x="${MAP_SIZE + 34}" y="${y + 4}" font-size="12" font-family="sans-serif" fill="${LABEL_COLOR}">` +
        `${escapeXml(entry.label)}</text>` +
        (entry.detail
          ? `<text x="${MAP_SIZE + 34}" y="${y + 18}" font-size="10" font-family="sans-serif" fill="#64748b">` +
            `${escapeXml(entry.detail)}</text>`
          : '')
      )
    })
    .join('\n')

  const elements = [
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
    `<text x="20" y="34" font-size="20" font-family="sans-serif" fill="${LABEL_COLOR}">${escapeXml(title)}</text>`,
    `<g transform="translate(0, ${TITLE_HEIGHT})">`,
    edgeShapes,
    nodeShapes,
    '</g>',
    legendShapes,
    watermark
      ? `<text x="${width - 12}" y="${height - 12}" font-size="11" font-family="sans-serif" fill="#94a3b8" text-anchor="end">Made with CiteScape</text>`
      : '',
  ]

  return svgDocument(width, height, elements)
}

function svgDocument(width: number, height: number, elements: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">\n` +
    elements.filter(Boolean).join('\n') +
    '\n</svg>\n'
  )
}

export function exportSvg(options: SvgExportOptions, query: string, network: ExportNetworkKind): void {
  const svg = buildSvg(options)
  downloadText(svg, exportFilename(query, 'svg', { network }), 'image/svg+xml')
}
