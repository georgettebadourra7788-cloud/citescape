import { useEffect, useMemo, useRef, useState } from 'react'
import Sigma from 'sigma'
import type { EdgeDisplayData, NodeDisplayData } from 'sigma/types'
import { DIMMED_COLOR, HIGHLIGHTED_EDGE_COLOR } from '../../lib/graph/clusterColors'
import type { NetworkResult } from '../../lib/graph/types'
import {
  buildDisplayGraph,
  type DisplayEdgeAttributes,
  type DisplayNodeAttributes,
} from './buildDisplayGraph'

interface NetworkGraphProps {
  network: NetworkResult
  selectedClusterId: number | null
  selectedNodeId: string | null
  minLinkStrength: number
  onSelectNode: (nodeId: string | null) => void
}

export function NetworkGraph({
  network,
  selectedClusterId,
  selectedNodeId,
  minLinkStrength,
  onSelectNode,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma<DisplayNodeAttributes, DisplayEdgeAttributes> | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const graph = useMemo(() => buildDisplayGraph(network), [network])

  // (Re)create the Sigma instance whenever the underlying graph changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sigma = new Sigma<DisplayNodeAttributes, DisplayEdgeAttributes>(graph, container, {
      minCameraRatio: 0.05,
      maxCameraRatio: 10,
      labelRenderedSizeThreshold: 6,
      defaultEdgeColor: 'rgba(100, 116, 139, 0.25)',
    })
    sigmaRef.current = sigma

    sigma.on('clickNode', ({ node }) => onSelectNode(node))
    sigma.on('clickStage', () => onSelectNode(null))
    sigma.on('enterNode', ({ node }) => setHoveredNodeId(node))
    sigma.on('leaveNode', () => setHoveredNodeId(null))

    const resizeObserver = new ResizeObserver(() => sigma.resize())
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      sigma.kill()
      sigmaRef.current = null
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
    <div
      ref={containerRef}
      className="h-[420px] w-full rounded-lg border border-slate-200 bg-slate-50 sm:h-[560px]"
    />
  )
}
