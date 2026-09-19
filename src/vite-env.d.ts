/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional contact email sent to OpenAlex's polite pool. */
  readonly VITE_OPENALEX_MAILTO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
