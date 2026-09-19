/**
 * Canonical, order-independent key for an unordered pair of ids, always
 * `${smaller}|${larger}`. Safe to split back apart with `key.split('|')`
 * since OpenAlex ids never contain "|".
 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
