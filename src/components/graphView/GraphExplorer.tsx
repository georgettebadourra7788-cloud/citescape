import { useMemo, useState } from 'react'
import type { GraphBuildResult, GraphNode, NetworkResult } from '../../lib/graph/types'
import { ClusterLegend } from './ClusterLegend'
import { LinkStrengthSlider } from './LinkStrengthSlider'
import { NetworkGraph } from './NetworkGraph'
import { NodeDetailsPanel } from './NodeDetailsPanel'

type NetworkKind = 'coupling' | 'coCitation'

interface GraphExplorerProps {
  result: GraphBuildResult
}

const NETWORK_LABELS: Record<NetworkKind, string> = {
  coupling: 'Bibliographic coupling',
  coCitation: 'Co-citation',
}

const UNIT_LABELS: Record<NetworkKind, 'papers' | 'works'> = {
  coupling: 'papers',
  coCitation: 'works',
}

const NETWORK_KINDS = Object.keys(NETWORK_LABELS) as NetworkKind[]

function maxEdgeWeight(network: NetworkResult): number {
  return network.edges.reduce((max, edge) => Math.max(max, edge.weight), 1)
}

export function GraphExplorer({ result }: GraphExplorerProps) {
  const [activeNetwork, setActiveNetwork] = useState<NetworkKind>('coupling')
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [minLinkStrength, setMinLinkStrength] = useState(1)

  const network = result[activeNetwork]

  // A selected cluster/node/link-strength from one network is meaningless
  // (and can look like "everything vanished") on the other, so reset as
  // part of the toggle action itself rather than in a follow-up effect.
  function handleNetworkChange(kind: NetworkKind) {
    setActiveNetwork(kind)
    setSelectedClusterId(null)
    setSelectedNodeId(null)
    setMinLinkStrength(1)
  }

  const selectedNode = useMemo<GraphNode | null>(
    () => network.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [network, selectedNodeId],
  )

  const maxWeight = useMemo(() => maxEdgeWeight(network), [network])

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

        {network.edges.length > 0 && (
          <LinkStrengthSlider value={minLinkStrength} max={maxWeight} onChange={setMinLinkStrength} />
        )}
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
