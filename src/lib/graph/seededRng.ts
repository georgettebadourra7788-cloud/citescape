/**
 * Deterministic PRNG (mulberry32) so Louvain can be run with a fixed seed
 * and produce reproducible cluster assignments across runs.
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0
  return function mulberry32(): number {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
