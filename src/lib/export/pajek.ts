import type { NetworkResult } from '../graph/types'

function pajekQuote(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

/**
 * Hand-written Pajek .net format (undirected `*Edges`, matching what
 * VOSviewer and Gephi both import): a `*Vertices N` section of
 * `<1-based index> "label"` lines — Pajek requires numeric ids, so our
 * string OpenAlex ids are mapped to 1..N here and referenced by that
 * index in the edges section — followed by `*Edges` and
 * `<source index> <target index> <weight>` lines.
 */
export function buildPajek(network: NetworkResult): string {
  const indexById = new Map<string, number>()
  network.nodes.forEach((node, i) => indexById.set(node.id, i + 1))

  const lines: string[] = [`*Vertices ${network.nodes.length}`]
  for (const node of network.nodes) {
    lines.push(`${indexById.get(node.id)} ${pajekQuote(node.label)}`)
  }

  lines.push('*Edges')
  for (const edge of network.edges) {
    const sourceIndex = indexById.get(edge.source)
    const targetIndex = indexById.get(edge.target)
    if (sourceIndex === undefined || targetIndex === undefined) continue
    lines.push(`${sourceIndex} ${targetIndex} ${edge.weight}`)
  }

  return lines.join('\n') + '\n'
}
