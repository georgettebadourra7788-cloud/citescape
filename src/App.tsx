import { useState, type FormEvent } from 'react'
import { EmptyState, ErrorState, LoadingState } from './components/StatusStates'
import { GraphSummary } from './components/GraphSummary'
import { GraphExplorer } from './components/graphView/GraphExplorer'
import { PapersTable } from './components/PapersTable'
import { ResultsSummary } from './components/ResultsSummary'
import { runSearch } from './lib/searchController'
import { usePapersStore } from './store/papersStore'
import { useGraphStore } from './store/graphStore'

function App() {
  const [topic, setTopic] = useState('')
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const { status, query, papers, fetchedCount, targetCount, error, fetchedAt } = usePapersStore()
  const graph = useGraphStore()
  const isLoading = status === 'loading'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    runSearch(topic)
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-white">
      <header className="w-full border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <span className="text-lg font-semibold text-slate-900">
            CiteScape
          </span>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            See the shape of a research field
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Type a topic and CiteScape builds a bibliometric map from
            published research &mdash; no software to install, no citation
            data to prepare.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="topic" className="sr-only">
              Research topic
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. climate adaptation in coastal cities"
              disabled={isLoading}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={!topic.trim() || isLoading}
              className="shrink-0 rounded-lg bg-purple-600 px-6 py-3 text-base font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Mapping…' : 'Map this topic'}
            </button>
          </form>
        </div>

        <div className="mt-12 w-full max-w-6xl">
          {status === 'loading' && (
            <LoadingState fetchedCount={fetchedCount} targetCount={targetCount} />
          )}
          {status === 'error' && (
            <ErrorState message={error} onRetry={() => runSearch(query)} />
          )}
          {status === 'empty' && <EmptyState query={query} />}
          {status === 'success' && (
            <div className="flex flex-col gap-6 text-left">
              <ResultsSummary papers={papers} />

              {graph.status === 'building' && (
                <p className="text-sm text-slate-600">
                  {graph.stageMessage ?? 'Building networks…'}
                </p>
              )}
              {graph.status === 'error' && (
                <p className="text-sm text-red-700">
                  Couldn&rsquo;t build networks: {graph.error}
                </p>
              )}
              {graph.status === 'success' && graph.result && fetchedAt && (
                <>
                  <GraphSummary
                    coupling={graph.result.coupling}
                    coCitation={graph.result.coCitation}
                  />
                  <GraphExplorer
                    result={graph.result}
                    query={query}
                    papers={papers}
                    fetchedAt={fetchedAt}
                  />
                </>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setIsTableExpanded((expanded) => !expanded)}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
                  aria-expanded={isTableExpanded}
                >
                  <span aria-hidden="true">{isTableExpanded ? '▾' : '▸'}</span>
                  {isTableExpanded ? 'Hide' : 'Show'} all {papers.length} papers
                </button>
                {isTableExpanded && (
                  <div className="mt-3">
                    <PapersTable papers={papers} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        Built on open citation data from OpenAlex.
      </footer>
    </div>
  )
}

export default App
