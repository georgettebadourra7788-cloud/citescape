import { useSyncExternalStore } from 'react'

/**
 * Minimal client-side router — just enough for a couple of static pages
 * (Privacy, Terms) alongside the main app. No routing library is installed
 * (see CLAUDE.md: ask before adding a dependency), and a full router is
 * disproportionate for two static routes, so this follows the same
 * external-store pattern as graphStore/papersStore instead.
 *
 * Firebase Hosting's catch-all rewrite (see firebase.json) serves
 * index.html for any path, so a direct load of e.g. /privacy resolves
 * correctly in production.
 */

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

const listeners = new Set<() => void>()
let state: string | null = null

function getPathname(): string {
  if (state === null) state = normalizePath(window.location.pathname)
  return state
}

function notify(): void {
  for (const listener of listeners) listener()
}

export function navigate(path: string): void {
  const next = normalizePath(path)
  if (next === getPathname()) return
  window.history.pushState(null, '', next)
  state = next
  window.scrollTo(0, 0)
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    state = normalizePath(window.location.pathname)
    notify()
  })
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getPathname)
}
