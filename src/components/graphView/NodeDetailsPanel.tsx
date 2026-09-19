import { clusterColor } from '../../lib/graph/clusterColors'
import type { GraphNode } from '../../lib/graph/types'

interface NodeDetailsPanelProps {
  node: GraphNode
  onClose: () => void
}

export function NodeDetailsPanel({ node, onClose }: NodeDetailsPanelProps) {
  return (
    <div className="w-full shrink-0 rounded-lg border border-slate-200 p-4 sm:w-72">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-slate-900">{node.label}</h4>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 text-slate-400 hover:text-slate-700"
        >
          &times;
        </button>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-slate-500">Authors</dt>
          <dd className="text-slate-900">
            {node.authors && node.authors.length > 0 ? node.authors.join(', ') : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Year</dt>
          <dd className="text-slate-900">{node.year ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Citations</dt>
          <dd className="text-slate-900">{node.citations}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Cluster</dt>
          <dd className="flex items-center gap-1.5 text-slate-900">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: clusterColor(node.cluster) }}
            />
            Cluster {node.cluster}
          </dd>
        </div>
        {node.doi && (
          <div>
            <dt className="text-slate-500">DOI</dt>
            <dd>
              <a
                href={node.doi}
                target="_blank"
                rel="noreferrer"
                className="break-all text-purple-700 hover:underline"
              >
                {node.doi}
              </a>
            </dd>
          </div>
        )}
        {node.resolved === false && (
          <p className="text-amber-700">No matching OpenAlex record was found for this item.</p>
        )}
      </dl>
    </div>
  )
}
