import type { Paper } from '../openalex'

export interface GraphNode {
  id: string
  label: string
  year: number | null
  /** How many papers in *our* fetched set cite this node. Always present. */
  inSetCitations: number
  /**
   * OpenAlex's global `cited_by_count`. Only ever set for coupling nodes
   * (our own fetched papers) — co-citation reference nodes were never
   * fetched with this field, see step 5 — so it's null there.
   */
  globalCitations: number | null
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
  /** Display cluster id: 1..N by size (largest first), or 0 for "Other". */
  cluster: number
  size: number
  /** `citations` here is globalCitations when available, else inSetCitations. */
  topPapers: { id: string; title: string; citations: number }[]
  medianYear: number | null
  topKeywords: string[]
  /** True if every node in this cluster has resolved === false. */
  allUnresolved: boolean
}

export interface NetworkResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  clusters: ClusterSummary[]
  /** Co-citation only: how many nodes had no matching OpenAlex record. */
  unresolvedNodeCount?: number
}

/** The actually-applied thresholds/seeds, echoed back for reproducibility (see exports' About sheet). */
export interface GraphBuildMeta {
  minCouplingWeight: number
  minCoCitationWeight: number
  maxCoCitationNodes: number
  louvainSeed: number
  layoutIterations: number
}

export interface GraphBuildResult {
  coupling: NetworkResult
  coCitation: NetworkResult
  meta: GraphBuildMeta
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
