import { type FirebaseApp, initializeApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { type Firestore, getFirestore } from 'firebase/firestore'
import { firebaseConfig, isFirebaseConfigured } from './config'

// Initialized lazily (only when config is present) so the landing page and
// map — which work with no login — never pay for Firebase's init cost, and
// so an unconfigured deployment never crashes: every call site must check
// `isFirebaseConfigured` before touching these.

let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured || !firebaseConfig) {
    throw new Error('Firebase is not configured.')
  }
  app ??= initializeApp(firebaseConfig)
  return app
}

export function getFirebaseAuth(): Auth {
  auth ??= getAuth(ensureApp())
  return auth
}

export function getFirebaseFirestore(): Firestore {
  firestore ??= getFirestore(ensureApp())
  return firestore
}
