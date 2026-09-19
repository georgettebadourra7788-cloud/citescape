import { useSyncExternalStore } from 'react'
import { isFirebaseConfigured } from '../lib/firebase/config'
import type { EffectiveEntitlement } from '../lib/firebase/entitlementLogic'

export type AuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in'

export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** null until the entitlements read resolves for a signed-in user. */
  entitlement: EffectiveEntitlement | null
}

const initialState: AuthState = {
  status: isFirebaseConfigured ? 'loading' : 'unconfigured',
  user: null,
  entitlement: null,
}

let state = initialState
const listeners = new Set<() => void>()

export function getAuthState(): AuthState {
  return state
}

export function setAuthState(update: Partial<AuthState>): void {
  state = { ...state, ...update }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAuthStore(): AuthState {
  return useSyncExternalStore(subscribe, getAuthState)
}
