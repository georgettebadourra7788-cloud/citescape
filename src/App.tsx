import { useState } from 'react'

function App() {
  const [topic, setTopic] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const query = topic.trim()
    if (!query) return
    // Wired up to OpenAlex search in the next step.
    console.log('search topic:', query)
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

      <main className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          See the shape of a research field
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Type a topic and CiteScape builds a bibliometric map from
          published research &mdash; no software to install, no citation
          data to prepare.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
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
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-purple-600 px-6 py-3 text-base font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!topic.trim()}
          >
            Map this topic
          </button>
        </form>
      </main>

      <footer className="w-full border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        Built on open citation data from OpenAlex.
      </footer>
    </div>
  )
}

export default App
