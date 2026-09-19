/// <reference lib="webworker" />

import { assembleNetwork, type NodeMeta } from '../lib/graph/assemble'
import { buildCoCitationGraph } from '../lib/graph/coCitation'
import { buildCouplingGraph } from '../lib/graph/coupling'
import { fetchWorksByIds } from '../lib/openalex'
import type { BuildGraphsRequest, GraphWorkerMessage } from '../lib/graph/types'

function post(message: GraphWorkerMessage): void {
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(message)
}

self.onmessage = async (event: MessageEvent<BuildGraphsRequest>) => {
  if (event.data.type !== 'build') return
  const { papers, options = {} } = event.data

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
        { label: p.title, year: p.year, citations: p.citedByCount, authors: p.authors, doi: p.doi },
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

    const paperKeywordsById = new Map(papers.map((p) => [p.id, p.keywords]))
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
    for (const refId of refIds) {
      const work = refWorks.get(refId)
      const citers = citingPapersByRef.get(refId) ?? new Set<string>()
      coCitationMeta.set(refId, {
        label: work?.title ?? refId,
        year: work?.year ?? null,
        citations: citers.size,
        authors: work?.authors,
      })

      const keywords: string[] = []
      for (const citerId of citers) {
        const citerKeywords = paperKeywordsById.get(citerId)
        if (citerKeywords) keywords.push(...citerKeywords)
      }
      coCitationKeywords.set(refId, keywords)
    }

    post({ type: 'progress', stage: 'clustering', message: 'Running clustering…' })
    const coCitation = assembleNetwork(coCitationGraph, coCitationMeta, coCitationKeywords)

    post({ type: 'done', result: { coupling, coCitation } })
  } catch (err) {
    post({
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown error building networks.',
    })
  }
}
