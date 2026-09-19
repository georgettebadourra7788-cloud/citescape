import { clusterColor } from '../../lib/graph/clusterColors'
import { clusterDisplayLabel } from '../../lib/graph/clusterDisplay'
import type { GraphNode } from '../../lib/graph/types'

interface NodeDetailsPanelProps {
  node: GraphNode
  onClose: () => void
}

export function NodeDetailsPanel({ node, onClose }: NodeDetailsPanelProps) {
  const isUnresolved = node.resolved === false
  // Every node gets a link: its DOI when it has one, otherwise its
  // OpenAlex page (node.id is always a full https://openalex.org/... url).
  const link = node.doi ?? node.id
  const linkLabel = node.doi ? node.doi : 'View on OpenAlex'

  return (
    <div className="w-full shrink-0 rounded-lg border border-slate-200 p-4 sm:w-72">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-slate-900">
          {isUnresolved ? 'Unknown work (no OpenAlex record)' : node.label}
        </h4>
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
          <dt className="text-slate-500">Cited by (this set)</dt>
          <dd className="text-slate-900">
            {node.inSetCitations} {node.inSetCitations === 1 ? 'paper' : 'papers'}
          </dd>
        </div>
        {node.globalCitations !== null && (
          <div>
            <dt className="text-slate-500">Global citations</dt>
            <dd className="text-slate-900">{node.globalCitations}</dd>
          </div>
        )}
        <div>
          <dt className="text-slate-500">Cluster</dt>
          <dd className="flex items-center gap-1.5 text-slate-900">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: clusterColor(node.cluster) }}
            />
            {clusterDisplayLabel(node.cluster)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Link</dt>
          <dd>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="break-all text-purple-700 hover:underline"
            >
              {linkLabel}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  )
}
