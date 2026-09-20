import type Graph from 'graphology'
import type { MinimalWork, Paper } from '../openalex'

/** Lowercases, strips diacritics and punctuation, and collapses whitespace, for exact-match comparison. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeAuthorName(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim()
}

export interface DedupeCandidate {
  id: string
  title: string
  firstAuthor: string | null
  year: number | null
}

/**
 * Groups records that are almost certainly the same work: an exact match on
 * normalized title AND first author, with publication years no more than 1
 * apart (chained transitively within a bucket — e.g. 2019/2020/2021 all
 * group together even though 2019 and 2021 are 2 apart). A record missing a
 * title, first author, or year never groups with anything: we can't confirm
 * a match without all three signals, so — deliberately — two records with a
 * generic title (or no listed author) never merge just because the title
 * matches. Every input record appears in exactly one output group; a group
 * of size 1 means "no duplicate found," not an error.
 */
export function groupDuplicates<T extends DedupeCandidate>(records: T[]): T[][] {
  const buckets = new Map<string, T[]>()
  const groups: T[][] = []

  for (const record of records) {
    const title = normalizeTitle(record.title)
    const author = record.firstAuthor ? normalizeAuthorName(record.firstAuthor) : ''
    if (!title || !author || record.year === null) {
      groups.push([record])
      continue
    }
    const key = `${title}|${author}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = []
      buckets.set(key, bucket)
    }
    bucket.push(record)
  }

  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      groups.push(bucket)
      continue
    }
    // Split the bucket (already title+author matched) into year-chains.
    const sorted = [...bucket].sort((a, b) => a.year! - b.year! || a.id.localeCompare(b.id))
    let start = 0
    for (let i = 1; i <= sorted.length; i++) {
      const isBoundary = i === sorted.length || sorted[i].year! - sorted[i - 1].year! > 1
      if (isBoundary) {
        groups.push(sorted.slice(start, i))
        start = i
      }
    }
  }

  return groups
}

export interface PaperMergeResult {
  /** One record per group: the merged record for any group of duplicates, the original record otherwise. */
  papers: Paper[]
  /** Survivor paper id -> ids of the other papers merged into it. Only present when a group actually merged. */
  mergedIdsBySurvivor: Map<string, string[]>
}

/**
 * Merges duplicate paper records (see groupDuplicates): within a group, the
 * record with the most citations survives — its id, title, DOI, authors,
 * etc. are kept as-is — with citedByCount replaced by the group's total and
 * referencedWorks replaced by the union of the group's reference lists, so
 * the merged node's edges reflect every reference any copy of the record
 * cited.
 */
export function mergeDuplicatePapers(papers: Paper[]): PaperMergeResult {
  const candidates = papers.map((paper) => ({
    id: paper.id,
    title: paper.title,
    firstAuthor: paper.authors[0] ?? null,
    year: paper.year,
    paper,
  }))

  const resultPapers: Paper[] = []
  const mergedIdsBySurvivor = new Map<string, string[]>()

  for (const group of groupDuplicates(candidates)) {
    if (group.length === 1) {
      resultPapers.push(group[0].paper)
      continue
    }
    const sorted = [...group].sort(
      (a, b) => b.paper.citedByCount - a.paper.citedByCount || a.id.localeCompare(b.id),
    )
    const survivor = sorted[0]
    const citedByCount = group.reduce((sum, r) => sum + r.paper.citedByCount, 0)
    const referencedWorks = [...new Set(group.flatMap((r) => r.paper.referencedWorks))]
    resultPapers.push({ ...survivor.paper, citedByCount, referencedWorks })
    mergedIdsBySurvivor.set(
      survivor.id,
      sorted.slice(1).map((r) => r.id),
    )
  }

  return { papers: resultPapers, mergedIdsBySurvivor }
}

export interface CoCitationMergeResult {
  /** Surviving reference ids, in `refIds`' original relative order. */
  refIds: string[]
  refWorks: Map<string, MinimalWork>
  citingPapersByRef: Map<string, Set<string>>
  mergedIdsBySurvivor: Map<string, string[]>
}

/**
 * Merges duplicate co-citation reference nodes — two different OpenAlex ids
 * that turn out to be the same work (see groupDuplicates) — directly on
 * `graph`: the merged-away node's edges are redirected onto the survivor
 * (summing weight when both already connect to the same third node), its
 * citing-paper set is unioned in, and it's dropped from the graph. An
 * unresolved reference (no MinimalWork) never merges — there's nothing to
 * compare it against.
 */
export function mergeDuplicateCoCitationNodes(
  graph: Graph,
  refIds: string[],
  refWorks: Map<string, MinimalWork>,
  citingPapersByRef: Map<string, Set<string>>,
): CoCitationMergeResult {
  const resolvable = refIds
    .map((id) => {
      const work = refWorks.get(id)
      return work ? { id, title: work.title, firstAuthor: work.authors[0] ?? null, year: work.year, work } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  const nextRefWorks = new Map(refWorks)
  const nextCitingPapersByRef = new Map(citingPapersByRef)
  const survivingRefIds = new Set(refIds)
  const mergedIdsBySurvivor = new Map<string, string[]>()

  for (const group of groupDuplicates(resolvable)) {
    if (group.length === 1) continue

    const sorted = [...group].sort(
      (a, b) => b.work.citedByCount - a.work.citedByCount || a.id.localeCompare(b.id),
    )
    const survivorId = sorted[0].id
    const others = sorted.slice(1).map((r) => r.id)

    const citedByCount = group.reduce((sum, r) => sum + r.work.citedByCount, 0)
    nextRefWorks.set(survivorId, { ...sorted[0].work, citedByCount })

    const survivorCiters = new Set(nextCitingPapersByRef.get(survivorId) ?? [])
    for (const id of others) {
      for (const citer of nextCitingPapersByRef.get(id) ?? []) survivorCiters.add(citer)
    }
    nextCitingPapersByRef.set(survivorId, survivorCiters)

    for (const id of others) {
      if (graph.hasNode(id)) {
        graph.forEachEdge(id, (_edge, attributes, source, target) => {
          const other = source === id ? target : source
          if (other === survivorId) return // would become a self-loop between merged duplicates
          const weight = (attributes.weight as number | undefined) ?? 1
          if (graph.hasEdge(survivorId, other)) {
            const existing = (graph.getEdgeAttribute(survivorId, other, 'weight') as number | undefined) ?? 0
            graph.setEdgeAttribute(survivorId, other, 'weight', existing + weight)
          } else {
            graph.addEdge(survivorId, other, { weight })
          }
        })
        graph.dropNode(id)
      }
      nextRefWorks.delete(id)
      nextCitingPapersByRef.delete(id)
      survivingRefIds.delete(id)
    }

    mergedIdsBySurvivor.set(survivorId, others)
  }

  return {
    refIds: refIds.filter((id) => survivingRefIds.has(id)),
    refWorks: nextRefWorks,
    citingPapersByRef: nextCitingPapersByRef,
    mergedIdsBySurvivor,
  }
}
