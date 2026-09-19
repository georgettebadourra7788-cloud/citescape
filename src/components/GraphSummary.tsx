import type { NetworkResult } from '../lib/graph/types'

function NetworkSummary({ title, network }: { title: string; network: NetworkResult }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {network.nodes.length} nodes &middot; {network.edges.length} edges &middot;{' '}
        {network.clusters.length} clusters
      </p>
      {network.clusters.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
          {network.clusters.map((cluster) => (
            <li key={cluster.cluster}>
              <span className="font-medium text-slate-900">Cluster {cluster.cluster}</span>{' '}
              <span className="text-slate-500">({cluster.size} papers)</span>
              {cluster.topPapers[0] && <> &mdash; {cluster.topPapers[0].title}</>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No clusters (not enough connected papers).</p>
      )}
    </div>
  )
}

interface GraphSummaryProps {
  coupling: NetworkResult
  coCitation: NetworkResult
}

export function GraphSummary({ coupling, coCitation }: GraphSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <NetworkSummary title="Bibliographic coupling" network={coupling} />
      <NetworkSummary title="Co-citation" network={coCitation} />
    </div>
  )
}
