import { drawOnCanvas } from '@sigma/export-image'
import { citationRank } from '../graph/citationRank'
import { buildLegendEntries } from './legendEntries'
import { triggerDownload } from './download'
import { exportFilename, type ExportNetworkKind } from './filename'
import { LABEL_FONT_SIZE, placeLabels } from './labelPlacement'
import {
  chooseLegendPlacement,
  computeBesideLegendPositions,
  computeBelowLegendPositions,
  computeMapCanvasSize,
  mapToPixel,
  paddedBBox,
} from './pngLayout'
import type { LegendEntryPosition } from './pngLayout'
import type { NetworkSigma } from '../../components/graphView/NetworkGraph'
import type { NetworkResult } from '../graph/types'

const LEGEND_WIDTH = 380
const TITLE_HEIGHT = 56
const RESOLUTION_SCALE = 2
const EDGE_COLOR = 'rgba(100, 116, 139, 0.25)' // slate-500 @ 25% — same as the SVG export

export interface PngExportOptions {
  sigma: NetworkSigma
  network: NetworkResult
  unitLabel: 'papers' | 'works'
  minLinkStrength: number
  title: string
  watermark: boolean
}

/**
 * Renders the map at 2x resolution via @sigma/export-image, cropped to the
 * graph's own bounding box (not the on-screen container's aspect ratio, to
 * avoid empty letterboxing), with our own edges, legend, title, watermark,
 * and node labels drawn on top. Edges and labels are drawn ourselves —
 * Sigma's own edge/label rendering is disabled for the capture — using the
 * exact same filtering (minLinkStrength) and label collision-avoidance as
 * the SVG export, so the two figures match.
 */
export async function exportPng(
  options: PngExportOptions,
  query: string,
  network: ExportNetworkKind,
): Promise<void> {
  const { sigma, network: net, unitLabel, minLinkStrength, title, watermark } = options

  const bbox = sigma.getBBox()
  const mapSize = computeMapCanvasSize(bbox)
  const mapWidthPx = mapSize.widthCss * RESOLUTION_SCALE
  const mapHeightPx = mapSize.heightCss * RESOLUTION_SCALE

  // Temporarily frame exactly the padded bbox for the capture, restoring
  // the live view's own framing right after — see pngLayout.ts. The
  // restore happens synchronously (before any await), so the on-screen
  // map never visibly changes.
  const originalBBox = sigma.getCustomBBox()
  sigma.setCustomBBox(paddedBBox(mapSize))
  // @sigma/export-image's types take the untyped default Sigma<Attributes,
  // Attributes>; our typed instance is behaviorally identical for its
  // purposes (it only reads generic settings/graph data). Edges are hidden
  // for this capture — we draw our own filtered set below instead.
  const mapCanvasPromise = drawOnCanvas(sigma as unknown as Parameters<typeof drawOnCanvas>[0], {
    width: mapWidthPx,
    height: mapHeightPx,
    sigmaSettings: { renderLabels: false, edgeReducer: () => ({ hidden: true }) },
  })
  sigma.setCustomBBox(originalBBox)
  const mapCanvas = await mapCanvasPromise

  const legend = buildLegendEntries(net.clusters, unitLabel)
  const legendPlacement = chooseLegendPlacement(mapSize.aspect)
  const besidePositions = legendPlacement === 'beside' ? computeBesideLegendPositions(legend.length, mapSize.widthCss) : []
  const below =
    legendPlacement === 'below' ? computeBelowLegendPositions(legend.length, mapSize.widthCss, mapSize.heightCss) : null

  const titleHeightPx = TITLE_HEIGHT * RESOLUTION_SCALE
  const legendWidthPx = LEGEND_WIDTH * RESOLUTION_SCALE
  const legendHeightPx = (below?.grid.heightCss ?? 0) * RESOLUTION_SCALE

  const outCanvas = document.createElement('canvas')
  outCanvas.width = mapCanvas.width + (legendPlacement === 'beside' ? legendWidthPx : 0)
  outCanvas.height = mapCanvas.height + titleHeightPx + (legendPlacement === 'below' ? legendHeightPx : 0)
  const ctx = outCanvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for PNG export.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height)

  ctx.fillStyle = '#0f172a'
  ctx.font = `${20 * RESOLUTION_SCALE}px sans-serif`
  ctx.fillText(title, 20 * RESOLUTION_SCALE, 34 * RESOLUTION_SCALE)

  // Edges first, so nodes (drawn next, via the Sigma capture) paint over
  // their endpoints — matches the SVG export's line style exactly.
  const toPixel = mapToPixel(mapSize)
  const nodeById = new Map(net.nodes.map((n) => [n.id, n]))
  const visibleEdges = net.edges.filter((e) => e.weight >= minLinkStrength)
  ctx.strokeStyle = EDGE_COLOR
  ctx.lineWidth = 0.75 * RESOLUTION_SCALE
  for (const edge of visibleEdges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) continue
    const p1 = toPixel(source.x, source.y)
    const p2 = toPixel(target.x, target.y)
    ctx.beginPath()
    ctx.moveTo(p1.x * RESOLUTION_SCALE, p1.y * RESOLUTION_SCALE + titleHeightPx)
    ctx.lineTo(p2.x * RESOLUTION_SCALE, p2.y * RESOLUTION_SCALE + titleHeightPx)
    ctx.stroke()
  }

  ctx.drawImage(mapCanvas, 0, titleHeightPx)

  // Labels: same candidate selection + collision avoidance as the SVG
  // export, positioned in the map's own pixel space (mapToPixel), then
  // offset onto the composited canvas and scaled to @2x.
  const maxRank = Math.max(0, ...net.nodes.map(citationRank))
  const placedLabels = placeLabels(net.clusters, nodeById, toPixel, maxRank, LABEL_FONT_SIZE)
  for (const { text, box } of placedLabels) {
    const haloPad = 2
    const rectX = (box.x - haloPad) * RESOLUTION_SCALE
    const rectY = box.y * RESOLUTION_SCALE + titleHeightPx
    const rectW = (box.width + haloPad * 2) * RESOLUTION_SCALE
    const rectH = box.height * RESOLUTION_SCALE

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.fillRect(rectX, rectY, rectW, rectH)

    ctx.fillStyle = '#0f172a'
    ctx.font = `${LABEL_FONT_SIZE * RESOLUTION_SCALE}px sans-serif`
    ctx.fillText(text, box.x * RESOLUTION_SCALE, box.y * RESOLUTION_SCALE + box.height * RESOLUTION_SCALE * 0.75 + titleHeightPx)
  }

  if (legendPlacement === 'beside') {
    for (const [i, position] of besidePositions.entries()) {
      drawLegendEntry(ctx, legend[i], position, titleHeightPx, RESOLUTION_SCALE)
    }
  } else if (below) {
    for (const [i, position] of below.positions.entries()) {
      drawLegendEntry(ctx, legend[i], position, titleHeightPx, RESOLUTION_SCALE)
    }
  }

  if (watermark) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${11 * RESOLUTION_SCALE}px sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(
      'Made with CiteScape',
      outCanvas.width - 12 * RESOLUTION_SCALE,
      outCanvas.height - 12 * RESOLUTION_SCALE,
    )
    ctx.textAlign = 'left'
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not generate PNG.'))), 'image/png')
  })

  triggerDownload(blob, exportFilename(query, 'png', { network }))
}

function drawLegendEntry(
  ctx: CanvasRenderingContext2D,
  entry: { color: string; label: string; detail: string },
  position: LegendEntryPosition,
  titleHeightPx: number,
  scale: number,
): void {
  const x = position.dotCenter.x * scale
  const y = position.dotCenter.y * scale + titleHeightPx

  ctx.beginPath()
  ctx.fillStyle = entry.color
  ctx.arc(x, y, position.dotRadius * scale, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#0f172a'
  ctx.font = `${12 * scale}px sans-serif`
  ctx.fillText(entry.label, position.textX * scale, y + 4 * scale)

  if (entry.detail) {
    ctx.fillStyle = '#64748b'
    ctx.font = `${10 * scale}px sans-serif`
    ctx.fillText(entry.detail, position.textX * scale, y + 18 * scale)
  }
}
