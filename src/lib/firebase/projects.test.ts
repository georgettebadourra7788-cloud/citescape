import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteProject,
  getProject,
  listProjects,
  ProjectCapReachedError,
  ProjectNotFoundError,
  renameProject,
  saveNewProject,
} from './projects'

// A tiny in-memory fake standing in for Firestore: keyed by "path/to/doc"
// strings, exercised through the same function names projects.ts calls.
// This lets slot-selection/cap/rename/delete logic be tested without a
// running emulator (see tests/firestore.rules.test.ts for the real thing).
interface FakeDoc {
  data: Record<string, unknown>
}
const store = new Map<string, FakeDoc>()

function fakeTimestamp(date: Date) {
  return { __timestamp: true, toDate: () => date }
}

function resolveServerTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  const now = new Date()
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    out[key] =
      value && typeof value === 'object' && '__serverTimestamp' in value ? fakeTimestamp(now) : value
  }
  return out
}

vi.mock('./app', () => ({
  getFirebaseFirestore: () => ({ __fakeDb: true }),
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (_db: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
    id: segments[segments.length - 1],
  }),
  getDocs: async (ref: { path: string }) => {
    const prefix = `${ref.path}/`
    const docs = [...store.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, entry]) => ({ id: path.slice(prefix.length), data: () => entry.data }))
    return { docs }
  },
  getDoc: async (ref: { path: string; id: string }) => {
    const found = store.get(ref.path)
    return { exists: () => found !== undefined, id: ref.id, data: () => found?.data }
  },
  updateDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
    const existing = store.get(ref.path)
    if (!existing) throw new Error('No document to update.')
    store.set(ref.path, { data: { ...existing.data, ...resolveServerTimestamps(data) } })
  },
  deleteDoc: async (ref: { path: string }) => {
    store.delete(ref.path)
  },
  runTransaction: async (_db: unknown, updateFn: (tx: unknown) => Promise<void>) => {
    const staged: { entry: { path: string; data: Record<string, unknown> } | null } = { entry: null }
    const tx = {
      get: async (ref: { path: string }) => {
        const found = store.get(ref.path)
        return { exists: () => found !== undefined, data: () => found?.data }
      },
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        staged.entry = { path: ref.path, data: resolveServerTimestamps(data) }
      },
    }
    await updateFn(tx)
    if (staged.entry) store.set(staged.entry.path, { data: staged.entry.data })
  },
  serverTimestamp: () => ({ __serverTimestamp: true }),
  Timestamp: {
    fromDate: (date: Date) => fakeTimestamp(date),
    now: () => fakeTimestamp(new Date()),
  },
}))

function seedProject(uid: string, pid: string, overrides: Record<string, unknown> = {}) {
  store.set(`users/${uid}/projects/${pid}`, {
    data: {
      name: 'Existing',
      query: 'coastal cities',
      dateFetched: fakeTimestamp(new Date('2026-01-01')),
      createdAt: fakeTimestamp(new Date('2026-01-01')),
      updatedAt: fakeTimestamp(new Date('2026-01-01')),
      workIds: ['W1'],
      excludedIds: [],
      settings: {
        minCouplingWeight: 2,
        minCoCitationWeight: 2,
        maxCoCitationNodes: 200,
        louvainSeed: 42,
        layoutIterations: 600,
        minLinkStrength: 2,
        activeNetwork: 'coupling',
      },
      clusterLabels: {},
      ...overrides,
    },
  })
}

function newProjectInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My project',
    query: 'coastal cities',
    dateFetched: new Date('2026-09-19'),
    workIds: ['W1', 'W2'],
    excludedIds: [],
    settings: {
      minCouplingWeight: 2,
      minCoCitationWeight: 2,
      maxCoCitationNodes: 200,
      louvainSeed: 42,
      layoutIterations: 600,
      minLinkStrength: 2,
      activeNetwork: 'coupling' as const,
    },
    clusterLabels: {},
    ...overrides,
  }
}

beforeEach(() => {
  store.clear()
})

describe('saveNewProject — slot selection', () => {
  it('creates the first project in slot p1', async () => {
    const pid = await saveNewProject('uid1', 3, newProjectInput())
    expect(pid).toBe('p1')
    expect(store.has('users/uid1/projects/p1')).toBe(true)
  })

  it('fills the first free gap rather than always appending', async () => {
    seedProject('uid1', 'p1')
    const pid = await saveNewProject('uid1', 3, newProjectInput())
    expect(pid).toBe('p2')
  })

  it('skips over a higher slot to fill an earlier gap', async () => {
    seedProject('uid1', 'p1')
    seedProject('uid1', 'p3')
    const pid = await saveNewProject('uid1', 3, newProjectInput())
    expect(pid).toBe('p2')
  })

  it("does not touch another user's projects when picking a slot", async () => {
    seedProject('uid2', 'p1')
    const pid = await saveNewProject('uid1', 3, newProjectInput())
    expect(pid).toBe('p1')
  })
})

describe('saveNewProject — cap reached', () => {
  it('throws ProjectCapReachedError once every slot up to the cap is used', async () => {
    seedProject('uid1', 'p1')
    seedProject('uid1', 'p2')
    seedProject('uid1', 'p3')
    await expect(saveNewProject('uid1', 3, newProjectInput())).rejects.toBeInstanceOf(
      ProjectCapReachedError,
    )
  })

  it('a pro cap of 200 allows a 4th project', async () => {
    seedProject('uid1', 'p1')
    seedProject('uid1', 'p2')
    seedProject('uid1', 'p3')
    const pid = await saveNewProject('uid1', 200, newProjectInput())
    expect(pid).toBe('p4')
  })
})

describe('saveNewProject — validation', () => {
  it('rejects an empty name without writing anything', async () => {
    await expect(saveNewProject('uid1', 3, newProjectInput({ name: '  ' }))).rejects.toThrow(
      /name/i,
    )
    expect(store.size).toBe(0)
  })

  it('rejects an oversized workIds list', async () => {
    const workIds = Array.from({ length: 5001 }, (_, i) => `W${i}`)
    await expect(saveNewProject('uid1', 3, newProjectInput({ workIds }))).rejects.toThrow(/too many/i)
  })
})

describe('listProjects', () => {
  it('returns a summary per project, most recently updated first', async () => {
    seedProject('uid1', 'p1', { name: 'Older', updatedAt: fakeTimestamp(new Date('2026-01-01')) })
    seedProject('uid1', 'p2', { name: 'Newer', updatedAt: fakeTimestamp(new Date('2026-02-01')) })

    const projects = await listProjects('uid1')

    expect(projects.map((p) => p.name)).toEqual(['Newer', 'Older'])
    expect(projects[0].workIdCount).toBe(1)
  })
})

describe('getProject', () => {
  it('reads back a full project record', async () => {
    seedProject('uid1', 'p1', { name: 'Mine', workIds: ['W1', 'W2', 'W3'] })
    const project = await getProject('uid1', 'p1')
    expect(project.name).toBe('Mine')
    expect(project.workIds).toEqual(['W1', 'W2', 'W3'])
  })

  it('throws ProjectNotFoundError for a missing project', async () => {
    await expect(getProject('uid1', 'p1')).rejects.toBeInstanceOf(ProjectNotFoundError)
  })
})

describe('renameProject', () => {
  it('updates the name and bumps updatedAt', async () => {
    seedProject('uid1', 'p1', { name: 'Old name' })
    await renameProject('uid1', 'p1', 'New name')
    const project = await getProject('uid1', 'p1')
    expect(project.name).toBe('New name')
  })
})

describe('deleteProject', () => {
  it('removes the project, freeing its slot', async () => {
    seedProject('uid1', 'p1')
    await deleteProject('uid1', 'p1')
    expect(store.has('users/uid1/projects/p1')).toBe(false)

    const pid = await saveNewProject('uid1', 3, newProjectInput())
    expect(pid).toBe('p1')
  })
})
