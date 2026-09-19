import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFirebaseFirestore } from './app'
import { pickNextSlot, slotId } from './projectSlots'
import { assertWithinSizeLimit } from './projectSize'
import type { NetworkKind } from '../graph/types'

// Keep these two in sync with the matching checks in firestore.rules —
// the client checks exist to fail fast with a friendly message; the rules
// are what actually enforce them.
export const MAX_PROJECT_NAME_LENGTH = 120
export const MAX_ID_LIST_ENTRIES = 5000

export interface ProjectSettings {
  minCouplingWeight: number
  minCoCitationWeight: number
  maxCoCitationNodes: number
  louvainSeed: number
  layoutIterations: number
  minLinkStrength: number
  activeNetwork: NetworkKind
}

export interface ProjectSummary {
  id: string
  name: string
  query: string
  dateFetched: Date
  createdAt: Date
  updatedAt: Date
  workIdCount: number
}

export interface ProjectRecord extends ProjectSummary {
  /** Short-form OpenAlex IDs (e.g. "W123...", not full URLs) of the fetched paper set. */
  workIds: string[]
  /** Short-form IDs the user excluded from the analysis. */
  excludedIds: string[]
  settings: ProjectSettings
  clusterLabels: Record<string, string>
}

export interface NewProjectInput {
  name: string
  query: string
  dateFetched: Date
  workIds: string[]
  excludedIds: string[]
  settings: ProjectSettings
  clusterLabels: Record<string, string>
}

export class ProjectCapReachedError extends Error {
  constructor() {
    super('You have reached your saved-project limit.')
    this.name = 'ProjectCapReachedError'
  }
}

export class ProjectNotFoundError extends Error {
  constructor() {
    super('This project no longer exists.')
    this.name = 'ProjectNotFoundError'
  }
}

interface ProjectDocData extends DocumentData {
  name: string
  query: string
  dateFetched: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  workIds: string[]
  excludedIds: string[]
  settings: ProjectSettings
  clusterLabels: Record<string, string>
}

function projectsCollectionRef(uid: string) {
  return collection(getFirebaseFirestore(), 'users', uid, 'projects')
}

function projectDocRef(uid: string, pid: string) {
  return doc(getFirebaseFirestore(), 'users', uid, 'projects', pid)
}

function validateInput(input: NewProjectInput): void {
  if (!input.name.trim()) throw new Error('Name your project before saving.')
  if (input.name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new Error(`Project names must be under ${MAX_PROJECT_NAME_LENGTH} characters.`)
  }
  if (input.workIds.length > MAX_ID_LIST_ENTRIES || input.excludedIds.length > MAX_ID_LIST_ENTRIES) {
    throw new Error(`This project has too many works to save (limit ${MAX_ID_LIST_ENTRIES}).`)
  }
}

function toFirestoreData(input: NewProjectInput) {
  return {
    name: input.name,
    query: input.query,
    dateFetched: Timestamp.fromDate(input.dateFetched),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    workIds: input.workIds,
    excludedIds: input.excludedIds,
    settings: input.settings,
    clusterLabels: input.clusterLabels,
  }
}

function docToSummary(snap: QueryDocumentSnapshot<DocumentData>): ProjectSummary {
  const data = snap.data() as ProjectDocData
  return {
    id: snap.id,
    name: data.name,
    query: data.query,
    dateFetched: data.dateFetched.toDate(),
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    workIdCount: data.workIds?.length ?? 0,
  }
}

function docToRecord(snap: QueryDocumentSnapshot<DocumentData>): ProjectRecord {
  const data = snap.data() as ProjectDocData
  return {
    ...docToSummary(snap),
    workIds: data.workIds ?? [],
    excludedIds: data.excludedIds ?? [],
    settings: data.settings,
    clusterLabels: data.clusterLabels ?? {},
  }
}

/** Lists a user's saved projects, most recently updated first. */
export async function listProjects(uid: string): Promise<ProjectSummary[]> {
  const snapshot = await getDocs(projectsCollectionRef(uid))
  return snapshot.docs
    .map((d) => docToSummary(d as QueryDocumentSnapshot<DocumentData>))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

/** Reads one saved project (its stored IDs/settings — not the papers themselves). */
export async function getProject(uid: string, pid: string): Promise<ProjectRecord> {
  const snap = await getDoc(projectDocRef(uid, pid))
  if (!snap.exists()) throw new ProjectNotFoundError()
  return docToRecord(snap as QueryDocumentSnapshot<DocumentData>)
}

/**
 * Attempts to create a project doc at exactly this slot, but only if
 * nothing is there yet — a transaction (rather than a plain `setDoc`)
 * guarantees a concurrent write can never silently overwrite another
 * project. Returns whether the slot was free.
 */
async function tryCreateInSlot(uid: string, pid: string, input: NewProjectInput): Promise<boolean> {
  const ref = projectDocRef(uid, pid)
  let created = false
  await runTransaction(getFirebaseFirestore(), async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) return
    tx.set(ref, toFirestoreData(input))
    created = true
  })
  return created
}

/**
 * Saves a new project into the first free slot within `cap` (the caller's
 * plan cap from entitlements). Retries the next slot on a rare create race,
 * and throws `ProjectCapReachedError` once every slot up to `cap` is taken.
 */
export async function saveNewProject(uid: string, cap: number, input: NewProjectInput): Promise<string> {
  validateInput(input)
  assertWithinSizeLimit(input)

  const existing = await listProjects(uid)
  const usedIds = new Set(existing.map((p) => p.id))

  for (let attempt = 0; attempt < cap; attempt++) {
    const nextSlot = pickNextSlot(usedIds, cap)
    if (nextSlot === null) throw new ProjectCapReachedError()
    const pid = slotId(nextSlot)
    if (await tryCreateInSlot(uid, pid, input)) return pid
    usedIds.add(pid) // someone else took it; try the next free slot
  }
  throw new ProjectCapReachedError()
}

export async function renameProject(uid: string, pid: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name your project before saving.')
  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    throw new Error(`Project names must be under ${MAX_PROJECT_NAME_LENGTH} characters.`)
  }
  await updateDoc(projectDocRef(uid, pid), { name: trimmed, updatedAt: serverTimestamp() })
}

/** Deletes a saved project, freeing its slot for reuse. */
export async function deleteProject(uid: string, pid: string): Promise<void> {
  await deleteDoc(projectDocRef(uid, pid))
}
