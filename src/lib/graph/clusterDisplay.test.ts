import { describe, expect, it } from 'vitest'
import { clusterDisplayLabel, OTHER_CLUSTER_ID, remapClustersForDisplay } from './clusterDisplay'

function raw(entries: [string, number][]): Map<string, number> {
  return new Map(entries)
}

describe('remapClustersForDisplay', () => {
  it('renumbers clusters 1..N by size, largest first', () => {
    // raw cluster 7 has 2 nodes, raw cluster 3 has 5 nodes, raw cluster 1 has 3 nodes.
    const result = remapClustersForDisplay(
      raw([
        ['a', 3],
        ['b', 3],
        ['c', 3],
        ['d', 7],
        ['e', 7],
        ['f', 1],
        ['g', 1],
        ['h', 1],
        ['i', 1],
        ['j', 1],
      ]),
    )

    expect(result.get('f')).toBe(1) // raw cluster 1, size 5 -> display 1
    expect(result.get('a')).toBe(2) // raw cluster 3, size 3 -> display 2
    expect(result.get('d')).toBe(3) // raw cluster 7, size 2 -> display 3
  })

  it('groups clusters under 3% of all nodes into OTHER_CLUSTER_ID', () => {
    // 100 nodes total: 97 in one big cluster, 3 scattered as singletons (<3%).
    const entries: [string, number][] = []
    for (let i = 0; i < 97; i++) entries.push([`big${i}`, 0])
    entries.push(['tiny1', 1], ['tiny2', 2], ['tiny3', 3])

    const result = remapClustersForDisplay(raw(entries))

    expect(result.get('big0')).toBe(1)
    expect(result.get('tiny1')).toBe(OTHER_CLUSTER_ID)
    expect(result.get('tiny2')).toBe(OTHER_CLUSTER_ID)
    expect(result.get('tiny3')).toBe(OTHER_CLUSTER_ID)
  })

  it('breaks size ties deterministically by raw cluster id', () => {
    const result = remapClustersForDisplay(
      raw([
        ['a', 5],
        ['b', 5],
        ['c', 2],
        ['d', 2],
      ]),
    )
    // Raw clusters 2 and 5 are tied at size 1 each; lower raw id wins display 1.
    expect(result.get('c')).toBe(1)
    expect(result.get('a')).toBe(2)
  })

  it('returns an empty map for no nodes', () => {
    expect(remapClustersForDisplay(new Map()).size).toBe(0)
  })
})

describe('clusterDisplayLabel', () => {
  it('labels the Other bucket and numbered clusters', () => {
    expect(clusterDisplayLabel(OTHER_CLUSTER_ID)).toBe('Other')
    expect(clusterDisplayLabel(1)).toBe('Cluster 1')
    expect(clusterDisplayLabel(5)).toBe('Cluster 5')
  })
})
