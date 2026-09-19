import { clusterColor, OTHER_COLOR } from '../graph/clusterColors'
import { clusterDisplayLabel } from '../graph/clusterDisplay'
import { truncateTitle } from '../text'
import type { ClusterSummary } from '../graph/types'

export interface LegendEntry {
  color: string
  label: string
  detail: string
}

/** Keeps legend text short enough not to clip at the figure's right edge. */
const LEGEND_LABEL_MAX_CHARS = 45

/** Shared between the SVG and PNG exporters so their legends stay in sync. */
export function buildLegendEntries(
  clusters: ClusterSummary[],
  unitLabel: 'papers' | 'works',
): LegendEntry[] {
  return clusters.map((cluster) => ({
    color: cluster.allUnresolved ? OTHER_COLOR : clusterColor(cluster.cluster),
    label: truncateTitle(
      `${clusterDisplayLabel(cluster.cluster)} (${cluster.size} ${unitLabel})`,
      LEGEND_LABEL_MAX_CHARS,
    ),
    detail: cluster.topPapers[0]
      ? truncateTitle(cluster.topPapers[0].title, LEGEND_LABEL_MAX_CHARS)
      : '',
  }))
}
