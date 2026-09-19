// Firebase project config, read from VITE_FIREBASE_* env vars (see
// .env.example). All six must be present for saving/accounts to turn on;
// with any missing, `isFirebaseConfigured` is false and callers must hide
// the sign-in/save UI rather than initialize Firebase.

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

function readConfig(): FirebaseConfig | null {
  const env = import.meta.env
  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID
  const appId = env.VITE_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
}

export const firebaseConfig = readConfig()

/** Whether every VITE_FIREBASE_* var is set — gates all sign-in/save UI. */
export const isFirebaseConfigured = firebaseConfig !== null
