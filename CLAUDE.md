# CiteScape

## Brief

CiteScape is a free-to-launch, freemium web app that lets non-coder
researchers create bibliometric maps (bibliographic coupling, co-citation,
science mapping) by typing a topic. The target user has never used VOSviewer
or any bibliometric tool — the UI must stay simple enough for them to get a
useful map with no prior knowledge.

## Stack & constraints

- Vite + React + TypeScript + Tailwind CSS
- Firebase Hosting on the **free Spark plan** — static hosting only
- **No Cloud Functions, no Cloud Storage, no paid Firebase services.**
  Everything must work as a static site.
- All heavy computation (network construction, clustering, layout) runs
  **in the browser**, off the main thread in a Web Worker.
- Data source: [OpenAlex API](https://docs.openalex.org/) — check current
  docs for auth/rate-limit requirements (e.g. polite pool `mailto` param)
  before implementing fetch logic.
- Network analysis: [graphology](https://graphology.github.io/) (+
  graphology-communities-louvain for clustering)
- Rendering: [Sigma.js](https://www.sigmajs.org/)
- Ask before adding any dependency not already listed above or required by
  a build step below.

## Build order

Work through these one at a time. Pause after each step for manual testing
before starting the next.

1. **Scaffold** — clean landing page with a topic search box. No data
   fetching yet.
2. **OpenAlex fetch** — fetch the top ~500 works for a query, including
   `referenced_works`. Handle pagination (cursor-based) and errors
   (rate limits, network failures, empty results).
3. **Network build (Web Worker)** — using graphology, build:
   - a bibliographic coupling network (edge weight = shared references
     between two papers in the set)
   - a co-citation network (edge weight = number of papers in the set that
     cite both of a pair of references)
   Run Louvain clustering on the result. Add unit tests with a small fixture
   dataset (a handful of papers with hand-checkable shared/co-cited refs).
4. **Sigma.js rendering** — render the network with clusters colored by
   community and node size scaled by citation count. Clicking a node shows
   title, authors, year, and DOI.

## Working conventions

- Keep components small and the landing page uncluttered — this is a tool
  for first-time users, not power users.
- No premature abstraction: build what each step needs, not a general
  framework for hypothetical future steps.
- Run `npm run build` and `npm run test` (once tests exist) before calling a
  step done.
