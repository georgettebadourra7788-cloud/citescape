import { LegalPageLayout } from './LegalPageLayout'
import { brand } from '../../brand'

// DRAFT — written to be accurate about what the app actually does, but not
// reviewed by a lawyer. Have this checked before relying on it for launch.
const LAST_UPDATED = 'September 20, 2026'

export function TermsPage() {
  return (
    <LegalPageLayout title="Terms" lastUpdated={LAST_UPDATED}>
      <p>These are the terms for using {brand.name}. By using the app, you agree to them.</p>

      <h2>Free and Pro plans</h2>
      <p>
        {brand.name} is free to use without an account. Signing in with Google lets you save
        projects; the free plan includes up to 3 saved projects at a time. A paid Pro plan, with a
        higher project limit, is planned but not yet available
        {brand.proWaitlistEmail && (
          <>
            {' '}
            —{' '}
            <a href={`mailto:${brand.proWaitlistEmail}`} className="text-purple-700 underline">
              join the waitlist
            </a>
          </>
        )}
        .
      </p>

      <h2>No warranty on results</h2>
      <p>
        {brand.name} builds bibliometric maps automatically from publication and citation data. It
        is provided &ldquo;as is,&rdquo; without warranty of any kind. We don&rsquo;t guarantee
        that the data, clusters, or maps are complete, accurate, or fit for any particular
        purpose — always sanity-check results before relying on them, for example in published
        research.
      </p>

      <h2>Data source</h2>
      <p>
        Publication and citation data comes from{' '}
        <a
          href="https://openalex.org"
          target="_blank"
          rel="noreferrer"
          className="text-purple-700 underline"
        >
          OpenAlex
        </a>
        , released under a CC0 (public domain) waiver. {brand.name} is not affiliated with
        OpenAlex.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don&rsquo;t attempt to disrupt, overload, or circumvent the app&rsquo;s infrastructure</li>
        <li>Don&rsquo;t use the app to violate OpenAlex&rsquo;s own terms of use</li>
        <li>Don&rsquo;t attempt to access another user&rsquo;s saved projects or account</li>
      </ul>
      <p>
        We may suspend or terminate access for use that violates these terms. These terms may be
        updated from time to time; continued use after a change means you accept the update.
      </p>

      <h2>Contact</h2>
      <p>
        {brand.contactEmail ? (
          <>
            Questions about these terms?{' '}
            <a href={`mailto:${brand.contactEmail}`} className="text-purple-700 underline">
              {brand.contactEmail}
            </a>
          </>
        ) : (
          <>A contact address for these terms hasn&rsquo;t been published yet.</>
        )}
      </p>
    </LegalPageLayout>
  )
}
