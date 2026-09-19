import { completeRedirectSignIn, subscribeToAuthState } from './auth'
import { subscribeToEntitlement } from './entitlements'
import { setAuthState } from '../../store/authStore'

let started = false

/**
 * Wires Firebase auth state into the auth store. Only ever called from a
 * dynamic `import()` (see AccountArea) so the Firebase SDK never loads for
 * a visitor who never touches the account UI — calling it more than once
 * is a harmless no-op.
 */
export async function startAuthBootstrap(): Promise<void> {
  if (started) return
  started = true

  let unsubscribeEntitlement: (() => void) | null = null

  subscribeToAuthState((user) => {
    unsubscribeEntitlement?.()
    unsubscribeEntitlement = null

    if (!user) {
      setAuthState({ status: 'signed-out', user: null, entitlement: null })
      return
    }

    setAuthState({
      status: 'signed-in',
      user: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      },
      entitlement: null,
    })
    unsubscribeEntitlement = subscribeToEntitlement(user.uid, (entitlement) => {
      setAuthState({ entitlement })
    })
  })

  // Picks up a just-completed redirect sign-in (popup fallback); harmless
  // no-op otherwise. Errors here (e.g. redirect cancelled) aren't fatal.
  try {
    await completeRedirectSignIn()
  } catch {
    // subscribeToAuthState above still reflects the real signed-in state.
  }
}
