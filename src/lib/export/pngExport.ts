import { drawOnCanvas } from '@sigma/export-image'
import type Sigma from 'sigma'
import { buildLegendEntries } from './legendEntries'
import { triggerDownload } from './download'
import { exportFilename } from './filename'
import type { NetworkSigma } from '../../components/graphView/NetworkGraph'
import type { ClusterSummary } from '../graph/types'

const LEGEND_WIDTH = 320
const TITLE_HEIGHT = 56
const RESOLUTION_SCALE = 2

export interface PngExportOptions {
  sigma: NetworkSigma
  clusters: ClusterSummary[]
  unitLabel: 'papers' | 'works'
  title: string
  watermark: boolean
}

/**
 * Renders the map at 2x resolution via @sigma/export-image (which handles
 * WebGL canvas compositing correctly), then draws our own legend, title,
 * and watermark on top — Sigma only knows about the map itself, not the
 * React-rendered legend.
 */
export async function exportPng(options: PngExportOptions, query: string): Promise<void> {
  const { sigma, clusters, unitLabel, title, watermark } = options
  const container = sigma.getContainer()

  // @sigma/export-image's types take the untyped default Sigma<Attributes,
  // Attributes>; our typed instance is behaviorally identical for its
  // purposes (it only reads generic settings/graph data).
  const mapCanvas = await drawOnCanvas(sigma as unknown as Sigma, {
    width: container.clientWidth * RESOLUTION_SCALE,
    height: container.clientHeight * RESOLUTION_SCALE,
  })

  const titleHeightPx = TITLE_HEIGHT * RESOLUTION_SCALE
  const legendWidthPx = LEGEND_WIDTH * RESOLUTION_SCALE

  const outCanvas = document.createElement('canvas')
  outCanvas.width = mapCanvas.width + legendWidthPx
  outCanvas.height = mapCanvas.height + titleHeightPx
  const ctx = outCanvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for PNG export.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height)

  ctx.fillStyle = '#0f172a'
  ctx.font = `${20 * RESOLUTION_SCALE}px sans-serif`
  ctx.fillText(title, 20 * RESOLUTION_SCALE, 34 * RESOLUTION_SCALE)

  ctx.drawImage(mapCanvas, 0, titleHeightPx)

  const legend = buildLegendEntries(clusters, unitLabel)
  let y = titleHeightPx + 28 * RESOLUTION_SCALE
  const legendX = mapCanvas.width + 20 * RESOLUTION_SCALE
  for (const entry of legend) {
    ctx.beginPath()
    ctx.fillStyle = entry.color
    ctx.arc(legendX, y, 6 * RESOLUTION_SCALE, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#0f172a'
    ctx.font = `${12 * RESOLUTION_SCALE}px sans-serif`
    ctx.fillText(entry.label, legendX + 14 * RESOLUTION_SCALE, y + 4 * RESOLUTION_SCALE)

    if (entry.detail) {
      ctx.fillStyle = '#64748b'
      ctx.font = `${10 * RESOLUTION_SCALE}px sans-serif`
      ctx.fillText(entry.detail, legendX + 14 * RESOLUTION_SCALE, y + 18 * RESOLUTION_SCALE)
    }
    y += 34 * RESOLUTION_SCALE
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

  triggerDownload(blob, exportFilename(query, 'png'))
}
