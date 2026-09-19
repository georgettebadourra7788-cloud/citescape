interface LoadingStateProps {
  fetchedCount: number
  targetCount: number
}

export function LoadingState({ fetchedCount, targetCount }: LoadingStateProps) {
  const percent =
    targetCount > 0 ? Math.min(100, Math.round((fetchedCount / targetCount) * 100)) : 0

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-slate-700">
        Fetched {fetchedCount} of {targetCount} papers&hellip;
      </p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-purple-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

interface ErrorStateProps {
  message: string | null
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 px-6 py-5 text-center">
      <p className="font-medium text-red-800">Couldn&rsquo;t fetch papers</p>
      <p className="mt-1 text-sm text-red-700">{message ?? 'An unknown error occurred.'}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  )
}

interface EmptyStateProps {
  query: string
}

export function EmptyState({ query }: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-md text-center text-slate-600">
      <p>
        No papers found for &ldquo;{query}&rdquo;.
      </p>
      <p className="mt-1 text-sm text-slate-500">Try a broader or differently worded topic.</p>
    </div>
  )
}
