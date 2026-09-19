import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import type { ProjectSummary } from '../../lib/firebase/projects'

interface MyProjectsModalProps {
  onClose: () => void
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }

export function MyProjectsModal({ onClose }: MyProjectsModalProps) {
  const auth = useAuthStore()
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const uid = auth.user?.uid ?? null

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    import('../../lib/firebase/projects').then(({ listProjects }) =>
      listProjects(uid)
        .then((list) => {
          if (!cancelled) setProjects(list)
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Could not load your projects.')
          }
        }),
    )
    return () => {
      cancelled = true
    }
  }, [uid])

  async function handleOpen(pid: string) {
    if (!uid) return
    onClose()
    const { openSavedProject } = await import('../../lib/projectController')
    await openSavedProject(uid, pid)
  }

  async function handleDelete(pid: string) {
    if (!uid) return
    setBusyId(pid)
    try {
      const { deleteProject } = await import('../../lib/firebase/projects')
      await deleteProject(uid, pid)
      setProjects((list) => list?.filter((p) => p.id !== pid) ?? list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this project.')
    } finally {
      setBusyId(null)
    }
  }

  function startRename(project: ProjectSummary) {
    setRenamingId(project.id)
    setRenameValue(project.name)
  }

  async function commitRename(pid: string) {
    if (!uid) return
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingId(null)
      return
    }
    setBusyId(pid)
    try {
      const { renameProject } = await import('../../lib/firebase/projects')
      await renameProject(uid, pid, trimmed)
      setProjects(
        (list) => list?.map((p) => (p.id === pid ? { ...p, name: trimmed } : p)) ?? list,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename this project.')
    } finally {
      setBusyId(null)
      setRenamingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">My projects</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        {projects === null && !error && (
          <p className="mt-4 text-sm text-slate-500">Loading your projects&hellip;</p>
        )}

        {projects !== null && projects.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            No saved projects yet. Map a topic, then use &ldquo;Save project&rdquo; to keep it here.
          </p>
        )}

        {projects !== null && projects.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  {renamingId === project.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={() => commitRename(project.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitRename(project.id)
                        if (event.key === 'Escape') setRenamingId(null)
                      }}
                      maxLength={120}
                      autoFocus
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpen(project.id)}
                      className="block truncate text-left text-sm font-medium text-slate-900 hover:text-purple-700"
                      title={project.name}
                    >
                      {project.name}
                    </button>
                  )}
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {project.workIdCount} papers &middot; updated{' '}
                    {project.updatedAt.toLocaleDateString(undefined, DATE_FORMAT)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startRename(project)}
                    disabled={busyId === project.id}
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(project.id)}
                    disabled={busyId === project.id}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
