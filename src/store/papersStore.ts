import { useSyncExternalStore } from 'react'
import type { Paper } from '../lib/openalex'
import { DEFAULT_TARGET_WORKS } from '../lib/openalex'

export type FetchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

/** What produced the current/pending `papers` — lets a failed fetch retry the right thing. */
export type PapersSource = { type: 'search' } | { type: 'project'; uid: string; pid: string }

export interface PapersState {
  status: FetchStatus
  query: string
  papers: Paper[]
  fetchedCount: number
  targetCount: number
  error: string | null
  /** When the current `papers` finished fetching — used by exports' About sheet. */
  fetchedAt: Date | null
  source: PapersSource
}

const initialState: PapersState = {
  status: 'idle',
  query: '',
  papers: [],
  fetchedCount: 0,
  targetCount: DEFAULT_TARGET_WORKS,
  error: null,
  fetchedAt: null,
  source: { type: 'search' },
}

let state = initialState
const listeners = new Set<() => void>()

export function getPapersState(): PapersState {
  return state
}

export function setPapersState(update: Partial<PapersState>): void {
  state = { ...state, ...update }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reactive read of the shared papers store, for use in React components. */
export function usePapersStore(): PapersState {
  return useSyncExternalStore(subscribe, getPapersState)
}
