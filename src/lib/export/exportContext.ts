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
}
