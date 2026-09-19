import { useEffect, useMemo, useRef, useState } from 'react'
import Sigma from 'sigma'
import type { EdgeDisplayData, NodeDisplayData, PlainObject } from 'sigma/types'
import { DIMMED_COLOR, HIGHLIGHTED_EDGE_COLOR } from '../../lib/graph/clusterColors'
import type { NetworkResult } from '../../lib/graph/types'
import {
  buildDisplayGraph,
  type DisplayEdgeAttributes,
  type DisplayNodeAttributes,
} from './buildDisplayGraph'

const LABEL_SIZE = 11
const LABEL_TEXT_COLOR = '#0f172a' // slate-900
const LABEL_HALO_COLOR = 'rgba(255, 255, 255, 0.85)'

/** Extra margin around the graph's bounding box when framing/resetting the view. */
const VIEW_PADDING_RATIO = 0.08

/** Small white halo behind label text so it stays readable over nodes/edges. */
function drawNodeLabelWithHalo(
  context: CanvasRenderingContext2D,
  data: PlainObject & { x: number; y: number; size: number; label: string | null },
): void {
  if (!data.label) return
  context.font = `${LABEL_SIZE}px sans-serif`
  const x = data.x + data.size + 3
  const y = data.y + LABEL_SIZE / 3
  const textWidth = context.measureText(data.label).width
  const paddingX = 2
  context.fillStyle = LABEL_HALO_COLOR
  context.fillRect(x - paddingX, y - LABEL_SIZE, textWidth + paddingX * 2, LABEL_SIZE * 1.3)
  context.fillStyle = LABEL_TEXT_COLOR
  context.fillText(data.label, x, y)
}

export type NetworkSigma = Sigma<DisplayNodeAttributes, DisplayEdgeAttributes>

/** Fits the camera to the graph's bounding box, with a small margin. */
function fitView(sigma: NetworkSigma, options: { animate?: boolean } = {}): void {
  const bbox = sigma.getBBox()
  const width = bbox.x[1] - bbox.x[0] || 1
  const height = bbox.y[1] - bbox.y[0] || 1
  const padX = width * VIEW_PADDING_RATIO
  const padY = height * VIEW_PADDING_RATIO

  sigma.setCustomBBox({
    x: [bbox.x[0] - padX, bbox.x[1] + padX],
    y: [bbox.y[0] - padY, bbox.y[1] + padY],
  })

  const defaultState = { x: 0.5, y: 0.5, ratio: 1, angle: 0 }
  if (options.animate) {
    sigma.getCamera().animate(defaultState, { duration: 300 })
  } else {
    sigma.getCamera().setState(defaultState)
  }
}

interface NetworkGraphProps {
  network: NetworkResult
  selectedClusterId: number | null
  selectedNodeId: string | null
  minLinkStrength: number
  onSelectNode: (nodeId: string | null) => void
  /** Hands the live Sigma instance up for PNG export; null once it's torn down. */
  onSigmaReady?: (sigma: NetworkSigma | null) => void
}

export function NetworkGraph({
  network,
  selectedClusterId,
  selectedNodeId,
  minLinkStrength,
  onSelectNode,
  onSigmaReady,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<NetworkSigma | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const graph = useMemo(() => buildDisplayGraph(network), [network])

  // (Re)create the Sigma instance whenever the underlying graph changes,
  // and fit the camera to it (initial load and every network toggle).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sigma = new Sigma<DisplayNodeAttributes, DisplayEdgeAttributes>(graph, container, {
      minCameraRatio: 0.05,
      maxCameraRatio: 10,
      labelSize: LABEL_SIZE,
      labelDensity: 1,
      labelGridCellSize: 250,
      labelRenderedSizeThreshold: 4,
      defaultDrawNodeLabel: drawNodeLabelWithHalo,
      defaultEdgeColor: 'rgba(100, 116, 139, 0.25)',
    })
    sigmaRef.current = sigma
    fitView(sigma)
    onSigmaReady?.(sigma)

    sigma.on('clickNode', ({ node }) => onSelectNode(node))
    sigma.on('clickStage', () => onSelectNode(null))
    sigma.on('enterNode', ({ node }) => setHoveredNodeId(node))
    sigma.on('leaveNode', () => setHoveredNodeId(null))

    // Keep the graph framed (and re-fit) whenever the container resizes —
    // a window/orientation change, or the side panel opening/closing.
    const resizeObserver = new ResizeObserver(() => {
      sigma.resize()
      fitView(sigma)
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      sigma.kill()
      sigmaRef.current = null
      onSigmaReady?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // Update the highlight/dim/filter reducers whenever interaction state
  // changes, without rebuilding the graph or the Sigma instance.
  useEffect(() => {
    const sigma = sigmaRef.current
    if (!sigma) return

    const neighbors = hoveredNodeId ? new Set(graph.neighbors(hoveredNodeId)) : null

    sigma.setSetting('nodeReducer', (node, data): Partial<NodeDisplayData> => {
      if (hoveredNodeId) {
        const isFocused = node === hoveredNodeId || (neighbors?.has(node) ?? false)
        if (!isFocused) return { ...data, color: DIMMED_COLOR, label: null, zIndex: 0 }
        return { ...data, zIndex: 1 }
      }
      if (selectedClusterId !== null && data.cluster !== selectedClusterId) {
        return { ...data, color: DIMMED_COLOR, label: null }
      }
      if (node === selectedNodeId) {
        return { ...data, zIndex: 1, forceLabel: true }
      }
      return data
    })

    sigma.setSetting('edgeReducer', (edge, data): Partial<EdgeDisplayData> => {
      if (data.weight < minLinkStrength) return { ...data, hidden: true }

      const [source, target] = graph.extremities(edge)

      if (hoveredNodeId) {
        const touchesHovered = source === hoveredNodeId || target === hoveredNodeId
        if (!touchesHovered) return { ...data, hidden: true }
        return { ...data, color: HIGHLIGHTED_EDGE_COLOR, size: 2 }
      }

      if (selectedClusterId !== null) {
        const sourceCluster = graph.getNodeAttribute(source, 'cluster')
        const targetCluster = graph.getNodeAttribute(target, 'cluster')
        if (sourceCluster !== selectedClusterId || targetCluster !== selectedClusterId) {
          return { ...data, hidden: true }
        }
      }

      return data
    })

    sigma.refresh()
  }, [graph, hoveredNodeId, selectedClusterId, selectedNodeId, minLinkStrength])

  return (
    // The Sigma container must be exclusively its own — its canvases are
    // mounted directly inside via `containerRef` — so the reset button
    // lives in this outer wrapper instead, layered on top.
    <div className="relative h-[420px] w-full sm:h-[560px]">
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg border border-slate-200 bg-slate-50"
      />
      <button
        type="button"
        onClick={() => {
          const sigma = sigmaRef.current
          if (sigma) fitView(sigma, { animate: true })
        }}
        className="absolute right-2 top-2 z-10 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Reset view
      </button>
    </div>
  )
}
