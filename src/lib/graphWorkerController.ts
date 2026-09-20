import { setGraphState } from '../store/graphStore'
import { brand } from '../brand'
import type { BuildGraphsRequest, GraphBuildOptions, GraphWorkerMessage } from './graph/types'
import type { Paper } from './openalex'

const mailto = brand.openAlexMailto

let activeWorker: Worker | null = null

function finish(worker: Worker): void {
  worker.terminate()
  if (activeWorker === worker) activeWorker = null
}

/**
 * Runs the graph-building worker over `papers`, streaming state into the
 * graph store. `thresholdOptions` lets a reopened saved project restore its
 * original min-weight/max-node thresholds instead of the defaults a fresh
 * search would use.
 */
export function buildGraphs(
  papers: Paper[],
  thresholdOptions: Pick<
    GraphBuildOptions,
    'minCouplingWeight' | 'minCoCitationWeight' | 'maxCoCitationNodes'
  > = {},
): void {
  activeWorker?.terminate()
  const worker = new Worker(new URL('../workers/graphWorker.ts', import.meta.url), {
    type: 'module',
  })
  activeWorker = worker

  setGraphState({ status: 'building', stageMessage: 'Starting…', result: null, error: null })

  worker.onmessage = (event: MessageEvent<GraphWorkerMessage>) => {
    const message = event.data
    switch (message.type) {
      case 'progress':
        setGraphState({ stageMessage: message.message })
        break
      case 'done':
        setGraphState({ status: 'success', stageMessage: null, result: message.result })
        finish(worker)
        break
      case 'error':
        setGraphState({ status: 'error', stageMessage: null, error: message.message })
        finish(worker)
        break
    }
  }

  worker.onerror = (event: ErrorEvent) => {
    setGraphState({
      status: 'error',
      stageMessage: null,
      error: event.message || 'The graph-building worker crashed.',
    })
    finish(worker)
  }

  const request: BuildGraphsRequest = { type: 'build', papers, options: { mailto, ...thresholdOptions } }
  worker.postMessage(request)
}
