import { doc, onSnapshot, Timestamp } from 'firebase/firestore'
import { getFirebaseFirestore } from './app'
import { effectiveEntitlement, type EffectiveEntitlement, type Plan, type RawEntitlement } from './entitlementLogic'

interface EntitlementDoc {
  plan?: Plan
  expiresAt?: Timestamp | null
}

/**
 * Subscribes to entitlements/{uid} (readable by that user only, never
 * client-writable — see firestore.rules) and reports the *effective* plan
 * and project cap, already folding in "missing or expired means free".
 */
export function subscribeToEntitlement(
  uid: string,
  callback: (entitlement: EffectiveEntitlement) => void,
): () => void {
  const ref = doc(getFirebaseFirestore(), 'entitlements', uid)
  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.data() as EntitlementDoc | undefined
      const raw: RawEntitlement | null = data
        ? { plan: data.plan ?? 'free', expiresAt: data.expiresAt ? data.expiresAt.toDate() : null }
        : null
      callback(effectiveEntitlement(raw))
    },
    () => {
      // Permission-denied (signed out mid-flight) or offline — free is the
      // safe default, never block the rest of the app on this.
      callback(effectiveEntitlement(null))
    },
  )
}
