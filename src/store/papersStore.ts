import { useSyncExternalStore } from 'react'
import type { Paper } from '../lib/openalex'
import { DEFAULT_TARGET_WORKS } from '../lib/openalex'

export type FetchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export interface PapersState {
  status: FetchStatus
  query: string
  papers: Paper[]
  fetchedCount: number
  targetCount: number
  error: string | null
}

const initialState: PapersState = {
  status: 'idle',
  query: '',
  papers: [],
  fetchedCount: 0,
  targetCount: DEFAULT_TARGET_WORKS,
  error: null,
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
