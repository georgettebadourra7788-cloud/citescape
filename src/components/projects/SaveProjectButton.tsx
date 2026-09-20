import { useState } from 'react'
import { isFirebaseConfigured } from '../../lib/firebase/config'
import { shortOpenAlexId } from '../../lib/openalex'
import { useAuthStore } from '../../store/authStore'
import { setActiveProjectState } from '../../store/activeProjectStore'
import type { GraphBuildMeta, NetworkKind } from '../../lib/graph/types'
import type { Paper } from '../../lib/openalex'

const WAITLIST_EMAIL = import.meta.env.VITE_PRO_WAITLIST_EMAIL as string | undefined

interface SaveProjectButtonProps {
  query: string
  papers: Paper[]
  fetchedAt: Date
  meta: GraphBuildMeta
  activeNetwork: NetworkKind
  minLinkStrength: number
}

export function SaveProjectButton({
  query,
  papers,
  fetchedAt,
  meta,
  activeNetwork,
  minLinkStrength,
}: SaveProjectButtonProps) {
  const auth = useAuthStore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [name, setName] = useState(query)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capReached, setCapReached] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)

  if (!isFirebaseConfigured) return null

  async function handleSignIn() {
    const { signInWithGoogle } = await import('../../lib/firebase/auth')
    await signInWithGoogle()
  }

  function openDialog() {
    setName(query)
    setError(null)
    setCapReached(false)
    setSavedName(null)
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!auth.user || !auth.entitlement) return
    setIsSaving(true)
    setError(null)
    setCapReached(false)
    try {
      const { saveNewProject } = await import('../../lib/firebase/projects')
      const pid = await saveNewProject(auth.user.uid, auth.entitlement.cap, {
        name: name.trim(),
        query,
        dateFetched: fetchedAt,
        workIds: papers.map((p) => shortOpenAlexId(p.id)),
        excludedIds: [],
        clusterLabels: {},
        settings: {
          minCouplingWeight: meta.minCouplingWeight,
          minCoCitationWeight: meta.minCoCitationWeight,
          maxCoCitationNodes: meta.maxCoCitationNodes,
          louvainSeed: meta.couplingLouvainSeed,
          layoutIterations: meta.layoutIterations,
          minLinkStrength,
          activeNetwork,
        },
      })
      setActiveProjectState({
        projectId: pid,
        projectName: name.trim(),
        initialView: { activeNetwork, minLinkStrength },
      })
      setSavedName(name.trim())
    } catch (err) {
      const { ProjectCapReachedError } = await import('../../lib/firebase/projects')
      if (err instanceof ProjectCapReachedError) {
        setCapReached(true)
      } else {
        setError(err instanceof Error ? err.message : 'Could not save this project.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (auth.status === 'loading') {
    return (
      <button
        type="button"
        disabled
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-400 shadow-sm"
      >
        Save project
      </button>
    )
  }

  if (auth.status !== 'signed-in') {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Sign in to save
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Save project
      </button>

      {isDialogOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            {savedName ? (
              <>
                <h2 className="text-base font-semibold text-slate-900">Project saved</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Saved &ldquo;{savedName}&rdquo;. Find it any time under My projects.
                </p>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsDialogOpen(false)}
                    className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : capReached ? (
              <>
                <h2 className="text-base font-semibold text-slate-900">Pro plan coming soon</h2>
                <p className="mt-2 text-sm text-slate-600">
                  You&rsquo;ve used all {auth.entitlement?.cap ?? 3} of your saved-project slots on
                  the free plan.
                  {WAITLIST_EMAIL && (
                    <>
                      {' '}
                      <a href={`mailto:${WAITLIST_EMAIL}`} className="text-purple-700 underline">
                        Join the waitlist
                      </a>{' '}
                      to hear when Pro (up to 200 projects) is available.
                    </>
                  )}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDialogOpen(false)}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-slate-900">Save project</h2>
                <label htmlFor="project-name" className="mt-3 block text-sm text-slate-600">
                  Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSaving}
                  maxLength={120}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:bg-slate-50"
                  autoFocus
                />
                {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
                {!auth.entitlement && (
                  <p className="mt-2 text-xs text-slate-500">Loading your plan&hellip;</p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSaving}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !name.trim() || !auth.entitlement}
                    className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
