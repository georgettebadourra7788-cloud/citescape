import { useSyncExternalStore } from 'react'
import type { NetworkKind } from '../lib/graph/types'

export interface ActiveProjectState {
  /** Slot id ("p1"...) of the currently-open saved project, or null for a fresh search. */
  projectId: string | null
  projectName: string | null
  /** The view a reopened project was saved in — GraphExplorer restores it on mount. */
  initialView: { activeNetwork: NetworkKind; minLinkStrength: number } | null
}

const initialState: ActiveProjectState = {
  projectId: null,
  projectName: null,
  initialView: null,
}

let state = initialState
const listeners = new Set<() => void>()

export function getActiveProjectState(): ActiveProjectState {
  return state
}

export function setActiveProjectState(update: Partial<ActiveProjectState>): void {
  state = { ...state, ...update }
  for (const listener of listeners) listener()
}

/** Clears the active-project link — a fresh search isn't tied to any saved project. */
export function clearActiveProject(): void {
  state = initialState
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useActiveProjectStore(): ActiveProjectState {
  return useSyncExternalStore(subscribe, getActiveProjectState)
}
