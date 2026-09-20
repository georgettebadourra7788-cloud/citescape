import { useEffect } from 'react'
import { isFirebaseConfigured } from '../../lib/firebase/config'
import { useAuthStore } from '../../store/authStore'
import { Link } from '../Link'
import { AccountMenu } from './AccountMenu'

/**
 * Boots Firebase auth (via a dynamic import, so its SDK never loads for a
 * visitor who never touches accounts) and renders the sign-in/account UI —
 * or, when Firebase isn't configured, a small note instead. The rest of
 * the app never has to check `isFirebaseConfigured` itself.
 *
 * The auth+firestore SDK is a substantial chunk (100+ KB gzip), so even
 * though restoring a signed-in session needs it on every load, the import
 * is scheduled for idle time rather than fired immediately — it shouldn't
 * compete with the search box and map, which work with no login at all.
 */
export function AccountArea() {
  const auth = useAuthStore()

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const load = () => {
      import('../../lib/firebase/authBootstrap').then((m) => m.startAuthBootstrap())
    }
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(load)
      return () => window.cancelIdleCallback(handle)
    }
    const timer = setTimeout(load, 200)
    return () => clearTimeout(timer)
  }, [])

  if (!isFirebaseConfigured) {
    return <span className="text-xs text-slate-400">Saving isn&rsquo;t configured</span>
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <AccountMenu />
      {auth.status === 'signed-out' && (
        <p className="flex gap-2 text-xs text-slate-400">
          <Link to="/privacy" className="hover:text-slate-600 hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-slate-600 hover:underline">
            Terms
          </Link>
        </p>
      )}
    </div>
  )
}
