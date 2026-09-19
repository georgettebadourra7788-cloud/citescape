import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRecord } from './firebase/projects'
import { makePaper } from './graph/testFixtures'

const getProject = vi.fn()
const fetchPapersByIds = vi.fn()
const buildGraphs = vi.fn()

vi.mock('./firebase/projects', () => ({ getProject: (...args: unknown[]) => getProject(...args) }))
vi.mock('./openalex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./openalex')>()
  return { ...actual, fetchPapersByIds: (...args: unknown[]) => fetchPapersByIds(...args) }
})
vi.mock('./graphWorkerController', () => ({ buildGraphs: (...args: unknown[]) => buildGraphs(...args) }))

const { openSavedProject } = await import('./projectController')
const { getPapersState } = await import('../store/papersStore')
const { getActiveProjectState } = await import('../store/activeProjectStore')

function makeProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'p2',
    name: 'Coastal cities',
    query: 'climate adaptation in coastal cities',
    dateFetched: new Date('2026-01-15'),
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    workIdCount: 3,
    workIds: ['W1', 'W2', 'W3'],
    excludedIds: [],
    settings: {
      minCouplingWeight: 3,
      minCoCitationWeight: 4,
      maxCoCitationNodes: 150,
      louvainSeed: 42,
      layoutIterations: 600,
      minLinkStrength: 3,
      activeNetwork: 'coCitation',
    },
    clusterLabels: {},
    ...overrides,
  }
}

beforeEach(() => {
  getProject.mockReset()
  fetchPapersByIds.mockReset()
  buildGraphs.mockReset()
})

describe('openSavedProject — batch re-fetch and restore', () => {
  it('re-fetches the saved work IDs and reports progress into the papers store', async () => {
    getProject.mockResolvedValue(makeProject())
    const papers = [makePaper({ id: 'W1' }), makePaper({ id: 'W2' }), makePaper({ id: 'W3' })]
    fetchPapersByIds.mockImplementation(async (_ids: string[], options: { onProgress?: (f: number, t: number) => void }) => {
      options.onProgress?.(2, 3)
      options.onProgress?.(3, 3)
      return papers
    })

    await openSavedProject('uid1', 'p2')

    expect(fetchPapersByIds).toHaveBeenCalledWith(['W1', 'W2', 'W3'], expect.any(Object))
    const state = getPapersState()
    expect(state.status).toBe('success')
    expect(state.papers).toEqual(papers)
    expect(state.fetchedCount).toBe(3)
    expect(state.targetCount).toBe(3)
    // The originally-fetched date is preserved, not the moment of this re-fetch.
    expect(state.fetchedAt).toEqual(new Date('2026-01-15'))
  })

  it("restores the project's original thresholds into buildGraphs", async () => {
    getProject.mockResolvedValue(makeProject())
    fetchPapersByIds.mockResolvedValue([makePaper({ id: 'W1' })])

    await openSavedProject('uid1', 'p2')

    expect(buildGraphs).toHaveBeenCalledWith(expect.any(Array), {
      minCouplingWeight: 3,
      minCoCitationWeight: 4,
      maxCoCitationNodes: 150,
    })
  })

  it("restores the project's saved view (active network, min link strength) into the active-project store", async () => {
    getProject.mockResolvedValue(makeProject())
    fetchPapersByIds.mockResolvedValue([makePaper({ id: 'W1' })])

    await openSavedProject('uid1', 'p2')

    expect(getActiveProjectState()).toMatchObject({
      projectId: 'p2',
      projectName: 'Coastal cities',
      initialView: { activeNetwork: 'coCitation', minLinkStrength: 3 },
    })
  })

  it('sets an empty-results status when the saved works no longer resolve', async () => {
    getProject.mockResolvedValue(makeProject())
    fetchPapersByIds.mockResolvedValue([])

    await openSavedProject('uid1', 'p2')

    expect(getPapersState().status).toBe('empty')
    expect(buildGraphs).not.toHaveBeenCalled()
  })

  it('reports an error status when the project no longer exists', async () => {
    getProject.mockRejectedValue(new Error('This project no longer exists.'))

    await openSavedProject('uid1', 'p2')

    const state = getPapersState()
    expect(state.status).toBe('error')
    expect(state.error).toBe('This project no longer exists.')
  })

  it('reports an error status when the OpenAlex re-fetch fails', async () => {
    getProject.mockResolvedValue(makeProject())
    fetchPapersByIds.mockRejectedValue(new Error('Could not reach OpenAlex.'))

    await openSavedProject('uid1', 'p2')

    expect(getPapersState().status).toBe('error')
  })
})
