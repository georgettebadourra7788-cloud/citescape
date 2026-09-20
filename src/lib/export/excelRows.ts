import { APP_VERSION } from '../appInfo'
import { brand } from '../../brand'
import { clusterDisplayLabel } from '../graph/clusterDisplay'
import { computeCouplingCoverage } from '../graph/couplingCoverage'
import { computeWeightedDegree } from '../graph/weightedDegree'
import type { ExportContext } from './exportContext'
import type { NetworkResult } from '../graph/types'

export interface PapersRow {
  'OpenAlex ID': string
  'Fetch rank': number
  Title: string
  Authors: string
  Year: number | ''
  DOI: string
  Citations: number
  'Coupling cluster': string
  'Co-citation cluster': string
  'Merged duplicate IDs': string
}

/**
 * `Fetch rank` is each paper's 1-indexed position in `context.papers` —
 * the order OpenAlex returned them in (relevance-sorted) — so together
 * with `OpenAlex ID` the exact fetched set can be rebuilt in the same
 * order without re-running the search.
 *
 * `Merged duplicate IDs` is only filled on the row of the paper that
 * *survived* a duplicate merge (see duplicates.ts) — the other IDs it
 * absorbed. Those other papers still get their own row here (this sheet
 * documents everything fetched), but with no coupling cluster of their
 * own, since they aren't a separate node in the map anymore.
 */
export function buildPapersRows(context: ExportContext): PapersRow[] {
  const couplingByPaper = new Map(context.coupling.nodes.map((n) => [n.id, n]))
  const coCitationByPaper = new Map(context.coCitation.nodes.map((n) => [n.id, n]))

  return context.papers.map((paper, index) => ({
    'OpenAlex ID': paper.id,
    'Fetch rank': index + 1,
    Title: paper.title,
    Authors: paper.authors.join(', '),
    Year: paper.year ?? '',
    DOI: paper.doi ?? '',
    Citations: paper.citedByCount,
    'Coupling cluster': couplingLabel(couplingByPaper.get(paper.id)?.cluster),
    'Co-citation cluster': couplingLabel(coCitationByPaper.get(paper.id)?.cluster),
    'Merged duplicate IDs': (context.duplicatePapers[paper.id] ?? []).join(', '),
  }))
}

function couplingLabel(cluster: number | undefined): string {
  return cluster === undefined ? '' : clusterDisplayLabel(cluster)
}

export interface ClustersRow {
  Network: string
  Cluster: string
  Size: number
  'Top 5 works': string
  'Median year': number | ''
  'Top keywords': string
}

export function buildClustersRows(context: ExportContext): ClustersRow[] {
  const rows: ClustersRow[] = []
  const networks: [string, NetworkResult][] = [
    ['Bibliographic coupling', context.coupling],
    ['Co-citation', context.coCitation],
  ]
  for (const [networkName, network] of networks) {
    for (const cluster of network.clusters) {
      rows.push({
        Network: networkName,
        Cluster: clusterDisplayLabel(cluster.cluster),
        Size: cluster.size,
        'Top 5 works': cluster.topPapers.map((p) => p.title).join(' | '),
        'Median year': cluster.medianYear ?? '',
        'Top keywords': cluster.topKeywords.join(', '),
      })
    }
  }
  return rows
}

export interface EdgeRow {
  'Source ID': string
  'Source title': string
  'Target ID': string
  'Target title': string
  Weight: number
}

export function buildEdgesRows(network: NetworkResult): EdgeRow[] {
  const labelById = new Map(network.nodes.map((n) => [n.id, n.label]))
  return network.edges.map((edge) => ({
    'Source ID': edge.source,
    'Source title': labelById.get(edge.source) ?? '',
    'Target ID': edge.target,
    'Target title': labelById.get(edge.target) ?? '',
    Weight: edge.weight,
  }))
}

export interface CoCitationNodeRow {
  'OpenAlex ID': string
  Title: string
  Authors: string
  Year: number | ''
  DOI: string
  'Global citations': number | ''
  'Times co-cited (weighted degree)': number
  Cluster: string
  'In fetched set?': 'Yes' | 'No'
}

/**
 * One row per co-citation node (a referenced work, not necessarily one of
 * our fetched papers) — "Global citations" and "DOI" come from the node's
 * own batched lookup (see fetchWorksByIds), which now fetches both for
 * every resolved reference, not just the ones that also happen to be
 * papers we fetched. "In fetched set?" is still only knowable against our
 * own fetched papers.
 */
export function buildCoCitationNodesRows(context: ExportContext): CoCitationNodeRow[] {
  const paperById = new Map(context.papers.map((p) => [p.id, p]))
  const weightedDegreeById = computeWeightedDegree(context.coCitation.edges)

  return context.coCitation.nodes.map((node) => ({
    'OpenAlex ID': node.id,
    Title: node.label,
    Authors: (node.authors ?? []).join(', '),
    Year: node.year ?? '',
    DOI: node.doi ?? '',
    'Global citations': node.globalCitations ?? '',
    'Times co-cited (weighted degree)': weightedDegreeById.get(node.id) ?? 0,
    Cluster: clusterDisplayLabel(node.cluster),
    'In fetched set?': paperById.has(node.id) ? 'Yes' : 'No',
  }))
}

export interface AboutRow {
  Field: string
  Value: string
}

export function buildAboutRows(context: ExportContext): AboutRow[] {
  const { figure } = context
  const mergedAwayIds = new Set(Object.values(context.duplicatePapers).flat())
  const coverage = computeCouplingCoverage(context.papers, context.coupling.nodes, mergedAwayIds)
  const notShown = coverage.totalPapers - coverage.shownPapers
  return [
    { Field: 'Query', Value: context.query },
    { Field: 'Data retrieved', Value: context.fetchedAt.toISOString() },
    {
      Field: 'Source',
      Value:
        context.dataSource === 'live'
          ? 'live OpenAlex query'
          : `local cache, originally retrieved on ${context.fetchedAt.toISOString().slice(0, 10)}`,
    },
    { Field: 'Data source', Value: 'OpenAlex (https://openalex.org)' },
    { Field: 'Papers fetched', Value: String(context.papers.length) },
    { Field: 'Papers shown in coupling map', Value: String(coverage.shownPapers) },
    {
      Field: 'Papers not shown in coupling map',
      Value:
        notShown === 0
          ? '0'
          : `${notShown} (${coverage.notShownNoReferences} with no reference list, ` +
            `${coverage.notShownBelowThreshold} below the minimum shared-reference threshold, ` +
            `${coverage.notShownMergedDuplicate} merged into a duplicate record)`,
    },
    {
      Field: 'Bibliographic coupling: minimum shared references',
      Value: String(context.meta.minCouplingWeight),
    },
    {
      Field: 'Co-citation: minimum co-citation count',
      Value: String(context.meta.minCoCitationWeight),
    },
    { Field: 'Co-citation: max nodes', Value: String(context.meta.maxCoCitationNodes) },
    { Field: 'Louvain seeds tried per network', Value: String(context.meta.louvainRuns) },
    {
      Field: 'Bibliographic coupling: Louvain seed used',
      Value: String(context.meta.couplingLouvainSeed),
    },
    {
      Field: 'Bibliographic coupling: modularity',
      Value: context.meta.couplingModularity.toFixed(4),
    },
    {
      Field: 'Co-citation: Louvain seed used',
      Value: String(context.meta.coCitationLouvainSeed),
    },
    { Field: 'Co-citation: modularity', Value: context.meta.coCitationModularity.toFixed(4) },
    { Field: 'ForceAtlas2 layout iterations', Value: String(context.meta.layoutIterations) },
    { Field: 'Duplicate papers merged', Value: String(context.meta.duplicatePapersMerged) },
    { Field: 'Duplicate co-citation nodes merged', Value: String(context.meta.coCitationNodesMerged) },
    { Field: 'Figure network', Value: figure.networkLabel },
    { Field: 'Figure minimum link strength', Value: String(figure.minLinkStrength) },
    {
      Field: 'Edges shown in figure',
      Value: `${figure.visibleEdgeCount} of ${figure.totalEdgeCount}`,
    },
    {
      Field: 'Note: edges in figure vs. exports',
      Value:
        "The GEXF, Pajek, and this workbook's Edges sheets always contain every edge for " +
        "both networks — only the PNG/SVG figure is filtered by the minimum link strength above.",
    },
    {
      Field: "Note: Papers sheet's Co-citation cluster column",
      Value:
        'Only filled for papers that are also co-citation nodes themselves (see the ' +
        "Co-citation nodes sheet) — most papers cite references outside the set, so they won't have one.",
    },
    { Field: `${brand.name} version`, Value: APP_VERSION },
  ]
}
