import {
  type User,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { getFirebaseAuth } from './app'

const provider = new GoogleAuthProvider()

/**
 * Sign in with Google via a popup. Popup blockers (and some browsers'
 * strict tracking-prevention modes) can silently refuse the popup, so on
 * the errors that indicate that, fall back to a full-page redirect —
 * `getRedirectResult` below picks the session back up when the user
 * returns.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth()
  try {
    await signInWithPopup(auth, provider)
  } catch (err) {
    const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : ''
    const popupBlocked =
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    if (!popupBlocked) throw err
    await signInWithRedirect(auth, provider)
  }
}

/** Completes a redirect-based sign-in on return; a no-op if none is pending. */
export async function completeRedirectSignIn(): Promise<void> {
  await getRedirectResult(getFirebaseAuth())
}

export async function signOutOfCiteScape(): Promise<void> {
  await signOut(getFirebaseAuth())
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

export type { User }
