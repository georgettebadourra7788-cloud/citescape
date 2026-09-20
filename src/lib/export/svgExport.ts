import { brand } from '../../brand'
import { citationRank } from '../graph/citationRank'
import { clusterColor, OTHER_COLOR } from '../graph/clusterColors'
import { nodeSize } from '../graph/nodeSize'
import { buildLegendEntries } from './legendEntries'
import { downloadText } from './download'
import { exportFilename, type ExportNetworkKind } from './filename'
import { LABEL_FONT_SIZE, placeLabels } from './labelPlacement'
import { escapeXml } from '../text'
import type { NetworkResult } from '../graph/types'

const MAP_SIZE = 1400
const LEGEND_WIDTH = 380
const TITLE_HEIGHT = 56
const EDGE_COLOR = '#64748b' // slate-500
const LABEL_COLOR = '#0f172a' // slate-900
const LABEL_HALO_COLOR = '#ffffff'

/**
 * Maps graph-space coordinates into the SVG's pixel square. Sigma renders
 * with y pointing *up* (see NetworkGraph/PNG export, whose on-screen and
 * exported orientation both come straight from Sigma) while SVG's y points
 * *down* — flip it here so this export isn't a vertical mirror of the map.
 */
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
    y: size / 2 - (y - cy) * scale,
  })
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

  const nodeShapes = network.nodes
    .map((node) => {
      const p = transform(node.x, node.y)
      const r = nodeSize(citationRank(node), maxRank)
      const fill = node.resolved === false ? OTHER_COLOR : clusterColor(node.cluster)
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="0.85"/>`
    })
    .join('\n')

  // Labels are drawn in their own layer, after every node and edge, so a
  // later-drawn node circle can never paint over an earlier label (SVG
  // paints strictly in document order) — same candidate selection and
  // collision-avoidance as the PNG export (see labelPlacement.ts).
  const nodeById = new Map(network.nodes.map((n) => [n.id, n]))
  const placedLabels = placeLabels(network.clusters, nodeById, transform, maxRank)
  const labelShapes = placedLabels
    .map(({ text, box, x, y }) => {
      const label = escapeXml(text)
      const haloPad = 2
      const rect =
        `<rect x="${(box.x - haloPad).toFixed(1)}" y="${box.y.toFixed(1)}" width="${(box.width + haloPad * 2).toFixed(1)}" ` +
        `height="${box.height.toFixed(1)}" fill="${LABEL_HALO_COLOR}" fill-opacity="0.85"/>`
      const textEl =
        `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${LABEL_FONT_SIZE}" font-family="sans-serif" fill="${LABEL_COLOR}">${label}</text>`
      return rect + '\n' + textEl
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
    labelShapes,
    '</g>',
    legendShapes,
    watermark
      ? `<text x="${width - 12}" y="${height - 12}" font-size="11" font-family="sans-serif" fill="#94a3b8" text-anchor="end">Made with ${escapeXml(brand.name)}</text>`
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
