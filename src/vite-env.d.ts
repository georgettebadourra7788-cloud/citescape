/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional contact email sent to OpenAlex's polite pool. */
  readonly VITE_OPENALEX_MAILTO?: string

  // Firebase project config — see src/lib/firebase/config.ts. All optional:
  // when any is missing, saving/accounts are disabled but the rest of the
  // app still works.
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /** mailto link shown on the "Pro plan coming soon" cap-reached message. */
  readonly VITE_PRO_WAITLIST_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
