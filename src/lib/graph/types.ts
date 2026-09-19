import type { Paper } from '../openalex'

export interface GraphNode {
  id: string
  label: string
  year: number | null
  /**
   * Coupling network: the paper's OpenAlex `cited_by_count`.
   * Co-citation network: how many papers in *our* fetched set cite this
   * reference (a "local" citation count — we don't fetch global counts
   * for reference nodes, see step 5).
   */
  citations: number
  cluster: number
  degree: number
  x: number
  y: number
  authors?: string[]
  doi?: string | null
  /**
   * Co-citation nodes only: whether the batched `ids.openalex` lookup
   * actually returned a record for this id. `undefined`/omitted (coupling
   * nodes, which always come from our own fetched papers) is treated as
   * resolved. False means OpenAlex's response never included this id —
   * distinct from OpenAlex returning a record with a blank title.
   */
  resolved?: boolean
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface ClusterSummary {
  cluster: number
  size: number
  topPapers: { id: string; title: string; citations: number }[]
  medianYear: number | null
  topKeywords: string[]
}

export interface NetworkResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  clusters: ClusterSummary[]
  /** Co-citation only: how many nodes had no matching OpenAlex record. */
  unresolvedNodeCount?: number
}

export interface GraphBuildResult {
  coupling: NetworkResult
  coCitation: NetworkResult
}

export interface GraphBuildOptions {
  minCouplingWeight?: number
  minCoCitationWeight?: number
  maxCoCitationNodes?: number
  mailto?: string
}

export interface BuildGraphsRequest {
  type: 'build'
  papers: Paper[]
  options?: GraphBuildOptions
}

export type GraphWorkerStage = 'coupling' | 'co-citation' | 'reference-metadata' | 'clustering'

export type GraphWorkerMessage =
  | { type: 'progress'; stage: GraphWorkerStage; message: string; fetched?: number; total?: number }
  | { type: 'done'; result: GraphBuildResult }
  | { type: 'error'; message: string }
