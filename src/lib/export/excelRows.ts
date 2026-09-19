import { APP_VERSION } from '../appInfo'
import { clusterDisplayLabel } from '../graph/clusterDisplay'
import type { ExportContext } from './exportContext'
import type { NetworkResult } from '../graph/types'

export interface PapersRow {
  Title: string
  Authors: string
  Year: number | ''
  DOI: string
  Citations: number
  'Coupling cluster': string
  'Co-citation cluster': string
}

export function buildPapersRows(context: ExportContext): PapersRow[] {
  const couplingByPaper = new Map(context.coupling.nodes.map((n) => [n.id, n]))
  const coCitationByPaper = new Map(context.coCitation.nodes.map((n) => [n.id, n]))

  return context.papers.map((paper) => ({
    Title: paper.title,
    Authors: paper.authors.join(', '),
    Year: paper.year ?? '',
    DOI: paper.doi ?? '',
    Citations: paper.citedByCount,
    'Coupling cluster': couplingLabel(couplingByPaper.get(paper.id)?.cluster),
    'Co-citation cluster': couplingLabel(coCitationByPaper.get(paper.id)?.cluster),
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
  'Global citations': number | ''
  'Times co-cited (weighted degree)': number
  Cluster: string
  'In fetched set?': 'Yes' | 'No'
}

/**
 * One row per co-citation node (a referenced work, not necessarily one of
 * our fetched papers). "Global citations" and "In fetched set?" are only
 * knowable for the subset that also happen to be papers we fetched — we
 * never fetch cited_by_count for reference-only nodes (see step 5).
 */
export function buildCoCitationNodesRows(context: ExportContext): CoCitationNodeRow[] {
  const paperById = new Map(context.papers.map((p) => [p.id, p]))

  const weightedDegreeById = new Map<string, number>()
  for (const edge of context.coCitation.edges) {
    weightedDegreeById.set(edge.source, (weightedDegreeById.get(edge.source) ?? 0) + edge.weight)
    weightedDegreeById.set(edge.target, (weightedDegreeById.get(edge.target) ?? 0) + edge.weight)
  }

  return context.coCitation.nodes.map((node) => {
    const paper = paperById.get(node.id)
    return {
      'OpenAlex ID': node.id,
      Title: node.label,
      Authors: (node.authors ?? []).join(', '),
      Year: node.year ?? '',
      'Global citations': paper ? paper.citedByCount : '',
      'Times co-cited (weighted degree)': weightedDegreeById.get(node.id) ?? 0,
      Cluster: clusterDisplayLabel(node.cluster),
      'In fetched set?': paper ? 'Yes' : 'No',
    }
  })
}

export interface AboutRow {
  Field: string
  Value: string
}

export function buildAboutRows(context: ExportContext): AboutRow[] {
  const { figure } = context
  return [
    { Field: 'Query', Value: context.query },
    { Field: 'Date fetched', Value: context.fetchedAt.toISOString() },
    { Field: 'Data source', Value: 'OpenAlex (https://openalex.org)' },
    { Field: 'Papers fetched', Value: String(context.papers.length) },
    {
      Field: 'Bibliographic coupling: minimum shared references',
      Value: String(context.meta.minCouplingWeight),
    },
    {
      Field: 'Co-citation: minimum co-citation count',
      Value: String(context.meta.minCoCitationWeight),
    },
    { Field: 'Co-citation: max nodes', Value: String(context.meta.maxCoCitationNodes) },
    { Field: 'Louvain clustering seed', Value: String(context.meta.louvainSeed) },
    { Field: 'ForceAtlas2 layout iterations', Value: String(context.meta.layoutIterations) },
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
    { Field: 'CiteScape version', Value: APP_VERSION },
  ]
}
