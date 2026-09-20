import { brand } from '../../brand'
import { citationRank } from '../graph/citationRank'
import { clusterColor, hexToRgb } from '../graph/clusterColors'
import { nodeSize } from '../graph/nodeSize'
import { escapeXml } from '../text'
import type { NetworkResult } from '../graph/types'

export interface GexfOptions {
  title: string
  description?: string
  generatedAt?: Date
}

/**
 * Hand-written GEXF 1.3 (with the viz module for color/position/size),
 * matching the structure documented at https://gexf.net and produced by
 * well-tested writers like NetworkX's — attributes declared once in
 * <attributes>, then referenced by id in each node's <attvalues>.
 */
export function buildGexf(network: NetworkResult, options: GexfOptions): string {
  const generatedAt = (options.generatedAt ?? new Date()).toISOString().slice(0, 10)

  const attributeDefs = [
    { id: '0', title: 'year', type: 'integer' },
    { id: '1', title: 'citations', type: 'integer' },
    { id: '2', title: 'cluster', type: 'integer' },
    { id: '3', title: 'doi', type: 'string' },
  ]

  const maxRank = Math.max(0, ...network.nodes.map(citationRank))

  const nodesXml = network.nodes
    .map((node) => {
      const [r, g, b] = hexToRgb(clusterColor(node.cluster))
      const attvalues = [
        node.year !== null ? `<attvalue for="0" value="${node.year}"/>` : '',
        `<attvalue for="1" value="${citationRank(node)}"/>`,
        `<attvalue for="2" value="${node.cluster}"/>`,
        node.doi ? `<attvalue for="3" value="${escapeXml(node.doi)}"/>` : '',
      ]
        .filter(Boolean)
        .join('')

      return (
        `<node id="${escapeXml(node.id)}" label="${escapeXml(node.label)}">` +
        `<attvalues>${attvalues}</attvalues>` +
        `<viz:color r="${r}" g="${g}" b="${b}" a="1.0"/>` +
        `<viz:position x="${node.x}" y="${node.y}" z="0"/>` +
        `<viz:size value="${nodeSize(citationRank(node), maxRank)}"/>` +
        `</node>`
      )
    })
    .join('')

  const edgesXml = network.edges
    .map(
      (edge, i) =>
        `<edge id="${i}" source="${escapeXml(edge.source)}" target="${escapeXml(edge.target)}" weight="${edge.weight}"/>`,
    )
    .join('')

  const attributesXml = attributeDefs
    .map((a) => `<attribute id="${a.id}" title="${a.title}" type="${a.type}"/>`)
    .join('')

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gexf xmlns="http://gexf.net/1.3" xmlns:viz="http://gexf.net/1.3/viz" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://gexf.net/1.3 http://gexf.net/1.3/gexf.xsd" version="1.3">\n' +
    `<meta lastmodifieddate="${generatedAt}"><creator>${escapeXml(brand.name)}</creator>` +
    `<description>${escapeXml(options.description ?? options.title)}</description></meta>\n` +
    `<graph mode="static" defaultedgetype="undirected">\n` +
    `<attributes class="node">${attributesXml}</attributes>\n` +
    `<nodes>${nodesXml}</nodes>\n` +
    `<edges>${edgesXml}</edges>\n` +
    '</graph>\n' +
    '</gexf>\n'
  )
}
