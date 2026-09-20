import type { GraphBuildMeta, NetworkResult } from '../graph/types'
import type { Paper } from '../openalex'

/** Everything an exporter needs, bundled once by the UI. */
export interface ExportContext {
  query: string
  papers: Paper[]
  coupling: NetworkResult
  coCitation: NetworkResult
  meta: GraphBuildMeta
  fetchedAt: Date
  /**
   * 'live' for data just fetched from a fresh topic search; 'cache' for a
   * reopened saved project — `fetchedAt` there is the project's original
   * fetch date, not this reopen, so the About sheet can say so honestly.
   */
  dataSource: 'live' | 'cache'
  /**
   * State of whichever network is currently on screen — reported on the
   * About sheet since it's what the PNG/SVG "figure" exports reflect
   * (GEXF/Pajek/Excel always contain every edge, regardless of this).
   */
  figure: {
    networkLabel: string
    minLinkStrength: number
    visibleEdgeCount: number
    totalEdgeCount: number
  }
}
