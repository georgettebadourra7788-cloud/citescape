import { DEFAULT_TARGET_WORKS, OpenAlexError, fetchWorksForTopic } from './openalex'
import { setPapersState } from '../store/papersStore'
import { clearActiveProject } from '../store/activeProjectStore'
import { buildGraphs } from './graphWorkerController'
import { brand } from '../brand'

const mailto = brand.openAlexMailto

let activeController: AbortController | null = null

/** Runs a topic search, streaming progress and results into the papers store. */
export async function runSearch(query: string): Promise<void> {
  const trimmed = query.trim()
  if (!trimmed) return

  activeController?.abort()
  const controller = new AbortController()
  activeController = controller

  clearActiveProject()
  setPapersState({
    status: 'loading',
    query: trimmed,
    papers: [],
    fetchedCount: 0,
    targetCount: DEFAULT_TARGET_WORKS,
    error: null,
    source: { type: 'search' },
  })

  try {
    const papers = await fetchWorksForTopic(trimmed, {
      targetCount: DEFAULT_TARGET_WORKS,
      mailto,
      signal: controller.signal,
      onProgress: (fetchedCount, targetCount) => {
        if (controller.signal.aborted) return
        setPapersState({ fetchedCount, targetCount })
      },
    })

    if (controller.signal.aborted) return
    setPapersState({
      status: papers.length > 0 ? 'success' : 'empty',
      papers,
      fetchedCount: papers.length,
      fetchedAt: new Date(),
    })
    if (papers.length > 0) buildGraphs(papers)
  } catch (err) {
    if (controller.signal.aborted) return
    const message =
      err instanceof OpenAlexError
        ? err.message
        : 'Something went wrong fetching results. Please try again.'
    setPapersState({ status: 'error', error: message })
  }
}
