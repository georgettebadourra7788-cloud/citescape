/**
 * The outbound link shown for a node in the details panel: its DOI when it
 * has one, otherwise its OpenAlex page — `id` is always a full
 * https://openalex.org/... URL, so it always resolves to *something*.
 */
export function resolveNodeLink(node: { id: string; doi?: string | null }): {
  href: string
  label: string
} {
  return node.doi ? { href: node.doi, label: node.doi } : { href: node.id, label: 'View on OpenAlex' }
}
