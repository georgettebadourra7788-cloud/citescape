/**
 * A single number to rank/size nodes by: OpenAlex's global citation count
 * when we have it (coupling nodes), otherwise the in-set count (co-citation
 * nodes, which never have a global count — see step 5).
 */
export function citationRank(node: { globalCitations: number | null; inSetCitations: number }): number {
  return node.globalCitations ?? node.inSetCitations
}
