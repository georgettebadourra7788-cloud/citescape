import { LegalPageLayout } from './LegalPageLayout'
import { brand } from '../../brand'

// DRAFT — written to be accurate about what the app actually does, but not
// reviewed by a lawyer. Have this checked before relying on it for launch.
const LAST_UPDATED = 'September 20, 2026'

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy" lastUpdated={LAST_UPDATED}>
      <p>
        {brand.name} is a small, self-funded tool. This page explains what we store about you,
        what we don&rsquo;t, who else handles your data, and how to delete your account.
      </p>

      <h2>What we store</h2>
      <p>If you sign in with Google to save projects, we store:</p>
      <ul>
        <li>Your Google account name, email address, and a unique account ID (uid)</li>
        <li>
          The bibliometric projects you choose to save (your search topic, the list of papers, and
          your map settings)
        </li>
        <li>Your entitlement status (free or Pro), used to enforce the free plan&rsquo;s project limit</li>
      </ul>
      <p>
        If you don&rsquo;t sign in, {brand.name} stores nothing about you — searches and maps
        happen entirely in your browser and are never sent to us.
      </p>

      <h2>What we don&rsquo;t store</h2>
      <ul>
        <li>No passwords (sign-in is handled entirely by Google)</li>
        <li>No payment or billing information</li>
        <li>No tracking cookies or analytics — we don&rsquo;t use Google Analytics or similar tools</li>
        <li>No advertising identifiers</li>
      </ul>

      <h2>Who processes your data</h2>
      <ul>
        <li>
          <strong>Firebase / Google</strong> hosts this app, handles sign-in, and stores saved
          projects and entitlement status (Firestore).
        </li>
        <li>
          <strong>OpenAlex</strong> is the source of the publication and citation data used to
          build your maps. {brand.name} has no server of its own — your browser talks to
          OpenAlex&rsquo;s API directly, so OpenAlex sees requests coming from your own device,
          not from a {brand.name} server.
        </li>
      </ul>

      <h2>Retention</h2>
      <p>
        Saved projects and your entitlement status are kept until you delete them, or until you
        delete your account (see below). We don&rsquo;t keep backups beyond what Firebase itself
        retains briefly for reliability.
      </p>

      <h2>Deleting your account</h2>
      <p>
        Open the account menu and choose Delete account. This permanently removes your saved
        projects, your entitlement record, and your sign-in — there is no recovery once it&rsquo;s
        done. Signing up again afterwards starts fresh, with the full 3 free project slots
        available.
      </p>

      <h2>Contact</h2>
      <p>
        {brand.contactEmail ? (
          <>
            Questions about this policy?{' '}
            <a href={`mailto:${brand.contactEmail}`} className="text-purple-700 underline">
              {brand.contactEmail}
            </a>
          </>
        ) : (
          <>A contact address for this policy hasn&rsquo;t been published yet.</>
        )}
      </p>
    </LegalPageLayout>
  )
}
