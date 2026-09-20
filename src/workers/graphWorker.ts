/// <reference lib="webworker" />

import { assembleNetwork, type NodeMeta } from '../lib/graph/assemble'
import { stripArtifactReferences } from '../lib/graph/artifactReferences'
import { buildCoCitationGraph, DEFAULT_MIN_COCITATION_WEIGHT, DEFAULT_MAX_COCITATION_NODES } from '../lib/graph/coCitation'
import { buildCouplingGraph, DEFAULT_MIN_COUPLING_WEIGHT } from '../lib/graph/coupling'
import { LAYOUT_ITERATIONS } from '../lib/graph/layout'
import { LOUVAIN_SEED } from '../lib/graph/louvain'
import { fetchWorksByIds } from '../lib/openalex'
import type { BuildGraphsRequest, GraphWorkerMessage } from '../lib/graph/types'
import type { Paper } from '../lib/openalex'

function post(message: GraphWorkerMessage): void {
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(message)
}

self.onmessage = async (event: MessageEvent<BuildGraphsRequest>) => {
  if (event.data.type !== 'build') return
  const { papers: rawPapers, options = {} } = event.data
  // Strip known OpenAlex data-quality artifacts (see artifactReferences.ts)
  // before either network sees the reference lists.
  const papers: Paper[] = rawPapers.map((p) => {
    const referencedWorks = stripArtifactReferences(p.referencedWorks)
    return referencedWorks === p.referencedWorks ? p : { ...p, referencedWorks }
  })

  // How many papers *in our own set* cite each paper *in our own set* —
  // distinct from OpenAlex's global cited_by_count (see NodeMeta docs).
  const paperIdSet = new Set(papers.map((p) => p.id))
  const inSetCitersByPaperId = new Map<string, Set<string>>()
  for (const paper of papers) {
    for (const ref of paper.referencedWorks) {
      if (!paperIdSet.has(ref)) continue
      let citers = inSetCitersByPaperId.get(ref)
      if (!citers) {
        citers = new Set()
        inSetCitersByPaperId.set(ref, citers)
      }
      citers.add(paper.id)
    }
  }

  try {
    post({
      type: 'progress',
      stage: 'coupling',
      message: 'Building bibliographic coupling network…',
    })
    const couplingGraph = buildCouplingGraph(papers, options.minCouplingWeight)
    const couplingMeta = new Map<string, NodeMeta>(
      papers.map((p) => [
        p.id,
        {
          label: p.title,
          year: p.year,
          inSetCitations: inSetCitersByPaperId.get(p.id)?.size ?? 0,
          globalCitations: p.citedByCount,
          authors: p.authors,
          doi: p.doi,
        },
      ]),
    )
    const couplingKeywords = new Map(papers.map((p) => [p.id, p.keywords]))
    const coupling = assembleNetwork(couplingGraph, couplingMeta, couplingKeywords)

    post({
      type: 'progress',
      stage: 'co-citation',
      message: 'Building co-citation network…',
    })
    const { graph: coCitationGraph, citingPapersByRef } = buildCoCitationGraph(papers, {
      minEdgeWeight: options.minCoCitationWeight,
      maxNodes: options.maxCoCitationNodes,
    })

    const refIds = coCitationGraph.nodes()
    post({
      type: 'progress',
      stage: 'reference-metadata',
      message: `Fetching details for ${refIds.length} references…`,
      fetched: 0,
      total: refIds.length,
    })

    const refWorks = await fetchWorksByIds(refIds, {
      mailto: options.mailto,
      onProgress: (fetched, total) =>
        post({
          type: 'progress',
          stage: 'reference-metadata',
          message: `Fetched details for ${fetched} of ${total} references…`,
          fetched,
          total,
        }),
    })

    const coCitationMeta = new Map<string, NodeMeta>()
    const coCitationKeywords = new Map<string, string[]>()
    let unresolvedNodeCount = 0
    for (const refId of refIds) {
      const work = refWorks.get(refId)
      const resolved = refWorks.has(refId)
      if (!resolved) unresolvedNodeCount += 1
      const citers = citingPapersByRef.get(refId) ?? new Set<string>()
      coCitationMeta.set(refId, {
        label: work?.title ?? 'Unknown work (no OpenAlex record)',
        year: work?.year ?? null,
        inSetCitations: citers.size,
        globalCitations: null,
        authors: work?.authors,
        resolved,
      })

      // The reference's own topic/keywords (concepts as a fallback — see
      // paperTerms in openalex.ts), not an aggregate of the citing papers'
      // keywords — we now have real data for the reference itself.
      coCitationKeywords.set(refId, work?.keywords ?? [])
    }

    post({ type: 'progress', stage: 'clustering', message: 'Running clustering and layout…' })
    const coCitation = assembleNetwork(coCitationGraph, coCitationMeta, coCitationKeywords)
    coCitation.unresolvedNodeCount = unresolvedNodeCount

    post({
      type: 'done',
      result: {
        coupling,
        coCitation,
        meta: {
          minCouplingWeight: options.minCouplingWeight ?? DEFAULT_MIN_COUPLING_WEIGHT,
          minCoCitationWeight: options.minCoCitationWeight ?? DEFAULT_MIN_COCITATION_WEIGHT,
          maxCoCitationNodes: options.maxCoCitationNodes ?? DEFAULT_MAX_COCITATION_NODES,
          louvainSeed: LOUVAIN_SEED,
          layoutIterations: LAYOUT_ITERATIONS,
        },
      },
    })
  } catch (err) {
    post({
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown error building networks.',
    })
  }
}
