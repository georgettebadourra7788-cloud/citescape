import { buildGraphs } from './graphWorkerController'
import { getProject, type ProjectRecord } from './firebase/projects'
import { fetchPapersByIds } from './openalex'
import { setActiveProjectState } from '../store/activeProjectStore'
import { setPapersState } from '../store/papersStore'

const mailto = import.meta.env.VITE_OPENALEX_MAILTO as string | undefined

/**
 * Reopens a saved project: reads its stored IDs/settings from Firestore,
 * re-fetches the full papers from OpenAlex by ID (with progress, reusing
 * the same loading UI a fresh search shows), then rebuilds the graph in
 * the worker with the project's original thresholds.
 */
export async function openSavedProject(uid: string, pid: string): Promise<void> {
  setPapersState({
    status: 'loading',
    query: '',
    papers: [],
    fetchedCount: 0,
    targetCount: 0,
    error: null,
    source: { type: 'project', uid, pid },
  })

  let project: ProjectRecord
  try {
    project = await getProject(uid, pid)
  } catch (err) {
    setPapersState({
      status: 'error',
      error: err instanceof Error ? err.message : 'Could not open this project.',
    })
    return
  }

  setPapersState({ query: project.query, targetCount: project.workIds.length })
  setActiveProjectState({
    projectId: pid,
    projectName: project.name,
    initialView: {
      activeNetwork: project.settings.activeNetwork,
      minLinkStrength: project.settings.minLinkStrength,
    },
  })

  try {
    const papers = await fetchPapersByIds(project.workIds, {
      mailto,
      onProgress: (fetched, total) => setPapersState({ fetchedCount: fetched, targetCount: total }),
    })

    setPapersState({
      status: papers.length > 0 ? 'success' : 'empty',
      papers,
      fetchedCount: papers.length,
      // Preserves when the underlying result set was originally fetched,
      // not this re-fetch — that's what the exports' About sheet documents.
      fetchedAt: project.dateFetched,
    })
    if (papers.length > 0) {
      buildGraphs(papers, {
        minCouplingWeight: project.settings.minCouplingWeight,
        minCoCitationWeight: project.settings.minCoCitationWeight,
        maxCoCitationNodes: project.settings.maxCoCitationNodes,
      })
    }
  } catch (err) {
    setPapersState({
      status: 'error',
      error:
        err instanceof Error
          ? err.message
          : 'Something went wrong reopening this project. Please try again.',
    })
  }
}
