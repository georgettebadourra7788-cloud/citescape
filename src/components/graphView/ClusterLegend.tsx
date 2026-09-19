import { clusterColor, OTHER_COLOR } from '../../lib/graph/clusterColors'
import { clusterDisplayLabel } from '../../lib/graph/clusterDisplay'
import { truncateTitle } from '../../lib/text'
import type { ClusterSummary } from '../../lib/graph/types'

interface ClusterLegendProps {
  clusters: ClusterSummary[]
  unitLabel: 'papers' | 'works'
  selectedClusterId: number | null
  onSelectCluster: (clusterId: number | null) => void
}

export function ClusterLegend({
  clusters,
  unitLabel,
  selectedClusterId,
  onSelectCluster,
}: ClusterLegendProps) {
  if (clusters.length === 0) return null

  return (
    <ul className="flex flex-col gap-1">
      {clusters.map((cluster) => {
        const isSelected = selectedClusterId === cluster.cluster
        const labelPaper = cluster.topPapers[0]
        return (
          <li key={cluster.cluster}>
            <button
              type="button"
              onClick={() => onSelectCluster(isSelected ? null : cluster.cluster)}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <span
                aria-hidden="true"
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: cluster.allUnresolved
                    ? OTHER_COLOR
                    : clusterColor(cluster.cluster),
                }}
              />
              <span className="min-w-0">
                <span className="font-medium text-slate-900">
                  {clusterDisplayLabel(cluster.cluster)}
                </span>{' '}
                <span className="text-slate-500">
                  ({cluster.size} {unitLabel})
                </span>
                {labelPaper && (
                  <span className="block truncate text-slate-600" title={labelPaper.title}>
                    {truncateTitle(labelPaper.title, 70)}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
