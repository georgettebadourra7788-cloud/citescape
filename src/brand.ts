// Single source of truth for the app's name and copy — change it here, not
// scattered across the UI, export metadata, and page title. A rename is a
// one-line edit to NAME below; everything else derives from it.

const NAME = 'CiteScape'

const env = import.meta.env

export const brand = {
  name: NAME,
  tagline: 'See the shape of a research field',
  shortDescription:
    `Type a topic and ${NAME} builds a bibliometric map from published research — ` +
    'no software to install, no citation data to prepare.',
  /**
   * The deployed Firebase Hosting URL (see .firebaserc's default project
   * id) — update if a custom domain is attached later.
   */
  siteUrl: 'https://citescape-8407b.web.app',
  /**
   * General contact address — privacy/terms pages, support links. No
   * fabricated fallback: unset until VITE_CONTACT_EMAIL is configured, and
   * the pages that use it say so rather than showing a made-up address.
   */
  contactEmail: env.VITE_CONTACT_EMAIL || undefined,
  /** Sent to OpenAlex as the polite-pool `mailto` param — omitted from requests if unset. */
  openAlexMailto: env.VITE_OPENALEX_MAILTO || undefined,
  /** mailto link shown once a free user hits the saved-project cap. */
  proWaitlistEmail: env.VITE_PRO_WAITLIST_EMAIL || undefined,
} as const
