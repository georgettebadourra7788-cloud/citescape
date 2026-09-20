import { useEffect, useMemo, useRef, useState } from 'react'
import Sigma from 'sigma'
import type { EdgeDisplayData, NodeDisplayData, PlainObject } from 'sigma/types'
import { DIMMED_COLOR, HIGHLIGHTED_EDGE_COLOR } from '../../lib/graph/clusterColors'
import type { NetworkResult } from '../../lib/graph/types'
import {
  buildDisplayGraph,
  type DisplayEdgeAttributes,
  type DisplayGraph,
  type DisplayNodeAttributes,
} from './buildDisplayGraph'
import {
  labelCapForZoom,
  placeLabel,
  selectNonOverlappingLabels,
  type LabelCandidate,
  type LabelPlacement,
} from './labelCollision'

const LABEL_SIZE = 11
const LABEL_TEXT_COLOR = '#0f172a' // slate-900
const LABEL_HALO_COLOR = 'rgba(255, 255, 255, 0.85)'

/** Extra margin around the graph's bounding box when framing/resetting the view. */
const VIEW_PADDING_RATIO = 0.08

// Shared with the Sigma constructor's camera bounds below, and with
// labelCapForZoom — the label cap ramps from 10 at rest up to 40 as the
// camera approaches this most-zoomed-in ratio.
const MIN_CAMERA_RATIO = 0.05
const MAX_CAMERA_RATIO = 10

/** Cluster-top labels always outrank every non-cluster-top label — see computeVisibleLabels. */
const CLUSTER_TOP_PRIORITY_BONUS = 1e9

/**
 * Small white halo behind label text so it stays readable over nodes/edges.
 * `labelSide`/`labelDy` come from the nodeReducer (see below), which in turn
 * come from labelCollision's placement decision — drawing must match that
 * decision exactly, or a label picked because flipping it left would fit
 * ends up rendered (and clipped) on the right anyway.
 */
function drawNodeLabelWithHalo(
  context: CanvasRenderingContext2D,
  data: PlainObject & {
    x: number
    y: number
    size: number
    label: string | null
    labelSide?: 'left' | 'right'
    labelDy?: number
  },
): void {
  if (!data.label) return
  context.font = `${LABEL_SIZE}px sans-serif`
  const textWidth = context.measureText(data.label).width
  const x = data.labelSide === 'left' ? data.x - data.size - 3 - textWidth : data.x + data.size + 3
  const y = data.y + LABEL_SIZE / 3 + (data.labelDy ?? 0)
  const paddingX = 2
  context.fillStyle = LABEL_HALO_COLOR
  context.fillRect(x - paddingX, y - LABEL_SIZE, textWidth + paddingX * 2, LABEL_SIZE * 1.3)
  context.fillStyle = LABEL_TEXT_COLOR
  context.fillText(data.label, x, y)
}

let measureCanvasContext: CanvasRenderingContext2D | null | undefined
/** Real text metrics via an offscreen canvas — matches the font `drawNodeLabelWithHalo` draws with. */
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

export type NetworkSigma = Sigma<DisplayNodeAttributes, DisplayEdgeAttributes>

/**
 * Which nodes get a label right now, in screen space, so none overlap.
 * Re-run on every camera change (see the 'updated' listener below) —
 * zooming in spreads nodes apart on screen, which is exactly what lets
 * more labels through without any change to the selection logic itself.
 */
function computeVisibleLabels(sigma: NetworkSigma, graph: DisplayGraph): Map<string, LabelPlacement> {
  const candidates: LabelCandidate[] = []
  graph.forEachNode((node, attrs) => {
    if (!attrs.label) return
    const viewport = sigma.graphToViewport({ x: attrs.x, y: attrs.y })
    candidates.push({
      id: node,
      x: viewport.x,
      y: viewport.y,
      radius: sigma.scaleSize(attrs.size),
      text: attrs.label,
      // Each cluster's top paper always outranks every other label, so the
      // default (uncrowded) view fills its ~10-label budget with one label
      // per cluster before any second label from the same cluster appears.
      priority: (attrs.isClusterTop ? CLUSTER_TOP_PRIORITY_BONUS : 0) + attrs.citations,
    })
  })

  return selectNonOverlappingLabels(candidates, measureTextWidth, LABEL_SIZE, {
    maxLabels: labelCapForZoom(sigma.getCamera().ratio, MIN_CAMERA_RATIO),
    viewport: sigma.getDimensions(),
  })
}

/**
 * Where to draw a single node's label — used for the hovered/selected node,
 * which must always show its label even if the last collision pass didn't
 * pick it (dropped for the cap, an overlap, or not yet recomputed).
 */
function computeSingleLabelPlacement(
  sigma: NetworkSigma,
  data: { x: number; y: number; size: number; label: string | null },
): LabelPlacement {
  const viewport = sigma.graphToViewport({ x: data.x, y: data.y })
  const candidate: LabelCandidate = {
    id: '',
    x: viewport.x,
    y: viewport.y,
    radius: sigma.scaleSize(data.size),
    text: data.label ?? '',
    priority: 0,
  }
  return placeLabel(candidate, measureTextWidth, LABEL_SIZE, sigma.getDimensions())
}

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
  // Which nodes currently get a label, recomputed on every camera change —
  // read by the nodeReducer below (a ref so recomputing never has to wait
  // on/trigger a React re-render just to reach the reducer).
  const visibleLabelsRef = useRef<Map<string, LabelPlacement>>(new Map())

  const graph = useMemo(() => buildDisplayGraph(network), [network])

  // (Re)create the Sigma instance whenever the underlying graph changes,
  // and fit the camera to it (initial load and every network toggle).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sigma = new Sigma<DisplayNodeAttributes, DisplayEdgeAttributes>(graph, container, {
      minCameraRatio: MIN_CAMERA_RATIO,
      maxCameraRatio: MAX_CAMERA_RATIO,
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

    // Labels depend on screen-space positions, so every pan/zoom needs a
    // fresh collision pass — rAF-throttled since the camera can emit many
    // 'updated' events per second during a drag or scroll-zoom.
    let recomputeScheduled = false
    function scheduleLabelRecompute() {
      if (recomputeScheduled) return
      recomputeScheduled = true
      requestAnimationFrame(() => {
        recomputeScheduled = false
        visibleLabelsRef.current = computeVisibleLabels(sigma, graph)
        sigma.refresh()
      })
    }
    sigma.getCamera().on('updated', scheduleLabelRecompute)
    // Populated synchronously (not through the throttled path above) so
    // the very first paint already has the right labels, no flash.
    visibleLabelsRef.current = computeVisibleLabels(sigma, graph)

    sigma.on('clickNode', ({ node }) => onSelectNode(node))
    sigma.on('clickStage', () => onSelectNode(null))
    sigma.on('enterNode', ({ node }) => setHoveredNodeId(node))
    sigma.on('leaveNode', () => setHoveredNodeId(null))

    // Keep the graph framed (and re-fit) whenever the container resizes —
    // a window/orientation change, or the side panel opening/closing. A
    // resize can change screen-space label positions even when the camera's
    // own state doesn't, so recompute explicitly rather than relying only
    // on the 'updated' listener above.
    const resizeObserver = new ResizeObserver(() => {
      sigma.resize()
      fitView(sigma)
      scheduleLabelRecompute()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      sigma.getCamera().removeListener('updated', scheduleLabelRecompute)
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

    // Sigma's own NodeDisplayData type doesn't know about labelSide/labelDy
    // (our custom attributes, read by drawNodeLabelWithHalo above) — widen
    // the return type so returning them isn't a TS excess-property error.
    type ReducedNodeData = Partial<NodeDisplayData> & Pick<DisplayNodeAttributes, 'labelSide' | 'labelDy'>
    sigma.setSetting('nodeReducer', (node, data): ReducedNodeData => {
      if (hoveredNodeId) {
        const isFocused = node === hoveredNodeId || (neighbors?.has(node) ?? false)
        if (!isFocused) return { ...data, color: DIMMED_COLOR, label: null, zIndex: 0 }
        // The hovered node itself always shows its label, on top of
        // everything else — its neighbors are only highlighted, not labeled.
        if (node === hoveredNodeId) {
          const placement = visibleLabelsRef.current.get(node) ?? computeSingleLabelPlacement(sigma, data)
          return { ...data, zIndex: 2, forceLabel: true, labelSide: placement.side, labelDy: placement.dy }
        }
        return { ...data, zIndex: 1 }
      }
      if (selectedClusterId !== null && data.cluster !== selectedClusterId) {
        return { ...data, color: DIMMED_COLOR, label: null }
      }
      if (node === selectedNodeId) {
        const placement = visibleLabelsRef.current.get(node) ?? computeSingleLabelPlacement(sigma, data)
        return { ...data, zIndex: 2, forceLabel: true, labelSide: placement.side, labelDy: placement.dy }
      }
      // Default (resting) state: only nodes the last collision pass picked
      // get a label — see computeVisibleLabels/labelCollision.ts. Forced
      // since we've already decided this exact label shouldn't be hidden
      // by Sigma's own density heuristic. labelSide/labelDy tell the draw
      // callback exactly where that pass placed it (see drawNodeLabelWithHalo).
      const placement = visibleLabelsRef.current.get(node)
      if (!placement) return { ...data, label: null }
      return { ...data, forceLabel: true, labelSide: placement.side, labelDy: placement.dy }
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
