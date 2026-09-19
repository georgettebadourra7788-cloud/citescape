import { useMemo, useState } from 'react'
import type { ExportContext } from '../../lib/export/exportContext'
import type { ExportNetworkKind } from '../../lib/export/filename'
import type { GraphBuildResult, GraphNode, NetworkKind, NetworkResult } from '../../lib/graph/types'
import type { Paper } from '../../lib/openalex'
import { computeAutoMinLinkStrength } from './autoMinLinkStrength'
import { ClusterLegend } from './ClusterLegend'
import { ExportMenu } from './ExportMenu'
import { LinkStrengthSlider } from './LinkStrengthSlider'
import { NetworkGraph, type NetworkSigma } from './NetworkGraph'
import { NodeDetailsPanel } from './NodeDetailsPanel'
import { SaveProjectButton } from '../projects/SaveProjectButton'

interface GraphExplorerProps {
  result: GraphBuildResult
  query: string
  papers: Paper[]
  fetchedAt: Date
  /** Restores the view a reopened saved project was left in; a fresh search omits this. */
  initialView?: { activeNetwork: NetworkKind; minLinkStrength: number }
}

const NETWORK_LABELS: Record<NetworkKind, string> = {
  coupling: 'Bibliographic coupling',
  coCitation: 'Co-citation',
}

const UNIT_LABELS: Record<NetworkKind, 'papers' | 'works'> = {
  coupling: 'papers',
  coCitation: 'works',
}

/** Filename-safe slug per network — distinct from the display label above. */
const EXPORT_NETWORK_KINDS: Record<NetworkKind, ExportNetworkKind> = {
  coupling: 'coupling',
  coCitation: 'cocitation',
}

const NETWORK_KINDS = Object.keys(NETWORK_LABELS) as NetworkKind[]

function maxEdgeWeight(network: NetworkResult): number {
  return network.edges.reduce((max, edge) => Math.max(max, edge.weight), 1)
}

export function GraphExplorer({ result, query, papers, fetchedAt, initialView }: GraphExplorerProps) {
  const [activeNetwork, setActiveNetwork] = useState<NetworkKind>(
    () => initialView?.activeNetwork ?? 'coupling',
  )
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [minLinkStrength, setMinLinkStrength] = useState(
    () => initialView?.minLinkStrength ?? computeAutoMinLinkStrength(result.coupling.edges),
  )
  const [sigma, setSigma] = useState<NetworkSigma | null>(null)

  const network = result[activeNetwork]

  // A selected cluster/node/link-strength from one network is meaningless
  // (and can look like "everything vanished") on the other, so reset as
  // part of the toggle action itself rather than in a follow-up effect.
  function handleNetworkChange(kind: NetworkKind) {
    setActiveNetwork(kind)
    setSelectedClusterId(null)
    setSelectedNodeId(null)
    setMinLinkStrength(computeAutoMinLinkStrength(result[kind].edges))
  }

  const selectedNode = useMemo<GraphNode | null>(
    () => network.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [network, selectedNodeId],
  )

  const maxWeight = useMemo(() => maxEdgeWeight(network), [network])
  const visibleEdgeCount = useMemo(
    () => network.edges.filter((edge) => edge.weight >= minLinkStrength).length,
    [network, minLinkStrength],
  )

  const exportContext = useMemo<ExportContext>(
    () => ({
      query,
      papers,
      coupling: result.coupling,
      coCitation: result.coCitation,
      meta: result.meta,
      fetchedAt,
      figure: {
        networkLabel: NETWORK_LABELS[activeNetwork],
        minLinkStrength,
        visibleEdgeCount,
        totalEdgeCount: network.edges.length,
      },
    }),
    [query, papers, result, fetchedAt, activeNetwork, minLinkStrength, visibleEdgeCount, network],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {NETWORK_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleNetworkChange(kind)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeNetwork === kind
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {NETWORK_LABELS[kind]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {network.edges.length > 0 && (
            <LinkStrengthSlider
              value={minLinkStrength}
              max={maxWeight}
              visibleEdgeCount={visibleEdgeCount}
              onChange={setMinLinkStrength}
            />
          )}
          <SaveProjectButton
            query={query}
            papers={papers}
            fetchedAt={fetchedAt}
            meta={result.meta}
            activeNetwork={activeNetwork}
            minLinkStrength={minLinkStrength}
          />
          <ExportMenu
            context={exportContext}
            activeNetwork={network}
            activeNetworkLabel={NETWORK_LABELS[activeNetwork]}
            networkKind={EXPORT_NETWORK_KINDS[activeNetwork]}
            unitLabel={UNIT_LABELS[activeNetwork]}
            minLinkStrength={minLinkStrength}
            sigma={sigma}
          />
        </div>
      </div>

      {network.nodes.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Not enough connected {UNIT_LABELS[activeNetwork]} to map for this network.
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <NetworkGraph
              network={network}
              selectedClusterId={selectedClusterId}
              selectedNodeId={selectedNodeId}
              minLinkStrength={minLinkStrength}
              onSelectNode={setSelectedNodeId}
              onSigmaReady={setSigma}
            />
            <ClusterLegend
              clusters={network.clusters}
              unitLabel={UNIT_LABELS[activeNetwork]}
              selectedClusterId={selectedClusterId}
              onSelectCluster={setSelectedClusterId}
            />
          </div>
          {selectedNode && (
            <NodeDetailsPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
          )}
        </div>
      )}
    </div>
  )
}
