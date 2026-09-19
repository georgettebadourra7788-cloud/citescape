import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { MyProjectsModal } from '../projects/MyProjectsModal'

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
}

export function AccountMenu() {
  const auth = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isProjectsOpen, setIsProjectsOpen] = useState(false)

  async function handleSignIn() {
    const { signInWithGoogle } = await import('../../lib/firebase/auth')
    await signInWithGoogle()
  }

  async function handleSignOut() {
    setIsOpen(false)
    const { signOutOfCiteScape } = await import('../../lib/firebase/auth')
    await signOutOfCiteScape()
  }

  if (auth.status === 'loading') {
    return <div className="h-8 w-20 animate-pulse rounded-md bg-slate-100" aria-hidden="true" />
  }

  if (auth.status !== 'signed-in') {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Sign in with Google
      </button>
    )
  }

  const planLabel = auth.entitlement ? (PLAN_LABELS[auth.entitlement.plan] ?? 'Free') : '…'
  const displayName = auth.user?.displayName ?? auth.user?.email ?? 'Account'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        aria-expanded={isOpen}
      >
        {auth.user?.photoURL && (
          <img src={auth.user.photoURL} alt="" className="h-5 w-5 rounded-full" />
        )}
        <span className="max-w-[10rem] truncate">{displayName}</span>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
          {planLabel}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setIsProjectsOpen(true)
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              My projects
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </>
      )}

      {isProjectsOpen && <MyProjectsModal onClose={() => setIsProjectsOpen(false)} />}
    </div>
  )
}
