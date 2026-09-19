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

export interface AboutRow {
  Field: string
  Value: string
}

export function buildAboutRows(context: ExportContext): AboutRow[] {
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
    { Field: 'CiteScape version', Value: APP_VERSION },
  ]
}
