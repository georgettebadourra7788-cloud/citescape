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
  labelPriority,
  selectLabelsWithFocus,
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

/** Fixed regardless of zoom — hover is a focused view of one node, not the whole map. */
const HOVER_LABEL_CAP = 10

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

/** Builds LabelCandidate entries for a set of nodes, skipping unlabeled (unresolved) ones. */
function buildLabelCandidates(
  sigma: NetworkSigma,
  graph: DisplayGraph,
  nodeIds: Iterable<string>,
  priorityFor: (attrs: DisplayNodeAttributes) => number,
): LabelCandidate[] {
  const candidates: LabelCandidate[] = []
  for (const id of nodeIds) {
    const attrs = graph.getNodeAttributes(id)
    if (!attrs.label) continue
    const viewport = sigma.graphToViewport({ x: attrs.x, y: attrs.y })
    candidates.push({
      id,
      x: viewport.x,
      y: viewport.y,
      radius: sigma.scaleSize(attrs.size),
      text: attrs.label,
      priority: priorityFor(attrs),
    })
  }
  return candidates
}

/**
 * The single label-placement routine, covering every state the live map can
 * be in — resting, hovering, or a node selected — so there's exactly one
 * place that decides which labels show and where, never several competing
 * ones that can disagree or go stale:
 *
 * - Hovering: candidates are the hovered node + its neighbors only, ranked
 *   by node size, capped at HOVER_LABEL_CAP — the hovered node's label is
 *   always kept (selectLabelsWithFocus's never-drop guarantee).
 * - A node selected (nothing hovered): candidates are every labeled node
 *   (same set and cluster-tiered priority as resting state), still capped
 *   at the zoom-derived cap, but the selected node is always kept too.
 * - Resting: every labeled node competes solely on priority/collision,
 *   nothing guaranteed a slot.
 *
 * Callers must re-run this — see recomputeLabels in the effect below —
 * whenever the hovered node, the selected node, the zoom, or the canvas
 * size changes; those are the only inputs that can change what it returns.
 */
function computeLabelPlacements(
  sigma: NetworkSigma,
  graph: DisplayGraph,
  focus: { hoveredId: string | null; selectedId: string | null },
): Map<string, LabelPlacement> {
  const viewport = sigma.getDimensions()

  if (focus.hoveredId && graph.hasNode(focus.hoveredId)) {
    const ids = [focus.hoveredId, ...graph.neighbors(focus.hoveredId)]
    // Node size only during hover — no cluster-top tiering, unlike the
    // resting/selected candidates below.
    const candidates = buildLabelCandidates(sigma, graph, ids, (attrs) => attrs.citations)
    return selectLabelsWithFocus(focus.hoveredId, candidates, measureTextWidth, LABEL_SIZE, {
      maxLabels: HOVER_LABEL_CAP,
      viewport,
    })
  }

  // Every cluster's top 2 papers always outrank the rest, so the default
  // (uncrowded) view fills at least 2 labels per cluster before any
  // cluster gets a 3rd — see labelPriority.
  const candidates = buildLabelCandidates(sigma, graph, graph.nodes(), (attrs) =>
    labelPriority(attrs.clusterTopRank, attrs.citations),
  )
  const maxLabels = labelCapForZoom(sigma.getCamera().ratio, MIN_CAMERA_RATIO)

  if (focus.selectedId && graph.hasNode(focus.selectedId)) {
    return selectLabelsWithFocus(focus.selectedId, candidates, measureTextWidth, LABEL_SIZE, { maxLabels, viewport })
  }

  return selectNonOverlappingLabels(candidates, measureTextWidth, LABEL_SIZE, { maxLabels, viewport })
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
  // Mirrors hoveredNodeId/selectedNodeId, but readable synchronously — by
  // the Sigma event handlers below, and by the resize observer — without
  // waiting for a React re-render, so a recompute triggered from outside
  // React always sees the current focus, never a stale one.
  const hoveredNodeIdRef = useRef<string | null>(null)
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId)
  // Which nodes currently get a label, and where — the one label-placement
  // routine's last result (computeLabelPlacements), read by the nodeReducer
  // below. A ref so recomputing never has to wait on/trigger a React
  // re-render just to reach the reducer.
  const labelPlacementsRef = useRef<Map<string, LabelPlacement>>(new Map())
  // Holds the current recomputeLabels closure (defined inside the effect
  // below, rebuilt whenever the Sigma instance is) so effects that don't
  // own that closure — the selectedNodeId watcher below — can still
  // trigger it.
  const recomputeLabelsRef = useRef<(() => void) | null>(null)

  const graph = useMemo(() => buildDisplayGraph(network), [network])

  // (Re)create the Sigma instance whenever the underlying graph changes,
  // and fit the camera to it (initial load and every network toggle).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // A hover carried over from the previous graph (e.g. switching
    // networks) would refer to a node that may not exist here.
    hoveredNodeIdRef.current = null
    setHoveredNodeId(null)

    const sigma = new Sigma<DisplayNodeAttributes, DisplayEdgeAttributes>(graph, container, {
      minCameraRatio: MIN_CAMERA_RATIO,
      maxCameraRatio: MAX_CAMERA_RATIO,
      labelSize: LABEL_SIZE,
      labelDensity: 1,
      labelGridCellSize: 250,
      labelRenderedSizeThreshold: 4,
      defaultDrawNodeLabel: drawNodeLabelWithHalo,
      // Sigma has its own built-in "hovered node" rendering, entirely
      // independent of our nodeReducer/defaultDrawNodeLabel above — it
      // tracks hover internally and, by default, draws that node's label
      // a SECOND time (always to the right, ignoring any flip) on a
      // separate layer on top of everything. Since we already render the
      // hovered node's label ourselves — correctly placed, exactly once,
      // via forceLabel — silence this second pass entirely, or every
      // hover shows two overlapping copies of the same label.
      defaultDrawNodeHover: () => {},
      defaultEdgeColor: 'rgba(100, 116, 139, 0.25)',
    })
    sigmaRef.current = sigma
    fitView(sigma)
    onSigmaReady?.(sigma)

    // The one label-placement routine, re-run whenever anything it depends
    // on changes: screen-space positions (pan/zoom, canvas resize) or focus
    // (hover/selection) — see computeLabelPlacements.
    function recomputeLabels() {
      labelPlacementsRef.current = computeLabelPlacements(sigma, graph, {
        hoveredId: hoveredNodeIdRef.current,
        selectedId: selectedNodeIdRef.current,
      })
      sigma.refresh()
    }
    recomputeLabelsRef.current = recomputeLabels

    // rAF-throttled since the camera can emit many 'updated' events per
    // second during a drag or scroll-zoom.
    let recomputeScheduled = false
    function scheduleLabelRecompute() {
      if (recomputeScheduled) return
      recomputeScheduled = true
      requestAnimationFrame(() => {
        recomputeScheduled = false
        recomputeLabels()
      })
    }
    sigma.getCamera().on('updated', scheduleLabelRecompute)
    // Populated synchronously (not through the throttled path above) so
    // the very first paint already has the right labels, no flash.
    recomputeLabels()

    sigma.on('clickNode', ({ node }) => onSelectNode(node))
    sigma.on('clickStage', () => onSelectNode(null))
    sigma.on('enterNode', ({ node }) => {
      hoveredNodeIdRef.current = node
      setHoveredNodeId(node)
      // Not throttled (unlike scheduleLabelRecompute): hover starts/ends
      // once per gesture, not many times a frame, and should feel instant.
      recomputeLabels()
    })
    sigma.on('leaveNode', () => {
      hoveredNodeIdRef.current = null
      setHoveredNodeId(null)
      recomputeLabels()
    })

    // Keep the graph framed (and re-fit) whenever the container resizes —
    // a window/orientation change, or the side panel opening/closing. A
    // resize changes screen-space label positions and the viewport bounds
    // labels are clipped against, even when the camera's own state
    // doesn't, so recompute explicitly rather than relying only on the
    // 'updated' listener above.
    const resizeObserver = new ResizeObserver(() => {
      sigma.resize()
      fitView(sigma)
      recomputeLabels()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      sigma.getCamera().removeListener('updated', scheduleLabelRecompute)
      recomputeLabelsRef.current = null
      sigma.kill()
      sigmaRef.current = null
      onSigmaReady?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // The selected node is a prop, not a Sigma-internal event — keep the ref
  // in sync and re-run the one label-placement routine whenever it changes,
  // so a newly-selected node's label is placed immediately rather than
  // waiting for the next camera/hover-triggered recompute.
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
    recomputeLabelsRef.current?.()
  }, [selectedNodeId])

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
      } else if (selectedClusterId !== null && data.cluster !== selectedClusterId) {
        return { ...data, color: DIMMED_COLOR, label: null }
      }

      // The focused node (hovered, or else selected) always shows its
      // label, on top of everything else, exactly once — see
      // computeLabelPlacements/selectLabelsWithFocus. Everything else
      // (neighbors while hovering, or any other visible node otherwise)
      // is labeled only if that same pass picked it, so nothing overlaps
      // the focused label or each other.
      const placement = labelPlacementsRef.current.get(node)
      const isFocusNode = node === (hoveredNodeId ?? selectedNodeId)
      if (isFocusNode) {
        if (!placement) return { ...data, zIndex: 2 }
        return { ...data, zIndex: 2, forceLabel: true, labelSide: placement.side, labelDy: placement.dy }
      }
      if (hoveredNodeId) {
        if (!placement) return { ...data, zIndex: 1, label: null }
        return { ...data, zIndex: 1, forceLabel: true, labelSide: placement.side, labelDy: placement.dy }
      }
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
