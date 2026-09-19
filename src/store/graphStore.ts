import { useSyncExternalStore } from 'react'
import type { GraphBuildResult } from '../lib/graph/types'

export type GraphStatus = 'idle' | 'building' | 'success' | 'error'

export interface GraphState {
  status: GraphStatus
  stageMessage: string | null
  result: GraphBuildResult | null
  error: string | null
}

const initialState: GraphState = {
  status: 'idle',
  stageMessage: null,
  result: null,
  error: null,
}

let state = initialState
const listeners = new Set<() => void>()

export function getGraphState(): GraphState {
  return state
}

export function setGraphState(update: Partial<GraphState>): void {
  state = { ...state, ...update }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useGraphStore(): GraphState {
  return useSyncExternalStore(subscribe, getGraphState)
}
