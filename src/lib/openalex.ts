// OpenAlex API client for fetching works by topic.
//
// Docs (checked 2026-09-19, ourresearch/openalex-docs):
// - No API key required for this usage. Free tier: 100,000 credits/day,
//   100 requests/sec; a `works` list request costs 10 credits regardless
//   of per_page, so ~500 works (3 pages) costs ~30 credits.
// - Optional "polite pool" via a `mailto` param for more consistent
//   response times (see VITE_OPENALEX_MAILTO below).
// - Cursor pagination: per_page max 200, start with cursor=*, follow
//   meta.next_cursor until it's null or a page comes back empty.
// - `select` only supports root-level fields, so nested fields (e.g.
//   authorships[].author.display_name) can't be trimmed server-side.

const OPENALEX_WORKS_URL = 'https://api.openalex.org/works'
const MAX_PER_PAGE = 200
export const DEFAULT_TARGET_WORKS = 500

const SELECT_FIELDS = [
  'id',
  'doi',
  'title',
  'publication_year',
  'cited_by_count',
  'authorships',
  'primary_topic',
  'keywords',
  'referenced_works',
].join(',')

export interface OpenAlexAuthor {
  id: string
  display_name: string
}

export interface OpenAlexAuthorship {
  author_position: 'first' | 'middle' | 'last'
  author: OpenAlexAuthor | null
}

export interface OpenAlexTopic {
  id: string
  display_name: string
}

export interface OpenAlexKeyword {
  id: string
  display_name: string
  score: number
}

export interface OpenAlexWork {
  id: string
  doi: string | null
  title: string | null
  publication_year: number | null
  cited_by_count: number
  authorships: OpenAlexAuthorship[]
  primary_topic: OpenAlexTopic | null
  keywords: OpenAlexKeyword[]
  referenced_works: string[]
}

interface OpenAlexWorksResponse {
  meta: {
    count: number
    next_cursor: string | null
  }
  results: OpenAlexWork[]
}

export interface Paper {
  id: string
  doi: string | null
  title: string
  year: number | null
  citedByCount: number
  authors: string[]
  topic: string | null
  keywords: string[]
  referencedWorks: string[]
}

export class OpenAlexError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'OpenAlexError'
    this.status = status
  }
}

export function workToPaper(work: OpenAlexWork): Paper {
  return {
    id: work.id,
    doi: work.doi,
    title: work.title ?? '(untitled)',
    year: work.publication_year,
    citedByCount: work.cited_by_count ?? 0,
    authors: (work.authorships ?? [])
      .map((a) => a.author?.display_name)
      .filter((name): name is string => Boolean(name)),
    topic: work.primary_topic?.display_name ?? null,
    keywords: (work.keywords ?? []).map((k) => k.display_name),
    referencedWorks: work.referenced_works ?? [],
  }
}

function buildSearchUrl(query: string, cursor: string, mailto?: string): string {
  const url = new URL(OPENALEX_WORKS_URL)
  url.searchParams.set('search', query)
  url.searchParams.set('sort', 'relevance_score:desc')
  url.searchParams.set('per_page', String(MAX_PER_PAGE))
  url.searchParams.set('cursor', cursor)
  url.searchParams.set('select', SELECT_FIELDS)
  if (mailto) url.searchParams.set('mailto', mailto)
  return url.toString()
}

/** Shared fetch + error mapping for any `works` list request. */
async function requestWorks(
  url: string,
  signal: AbortSignal | undefined,
): Promise<OpenAlexWorksResponse> {
  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new OpenAlexError(
      'Could not reach OpenAlex. Check your network connection and try again.',
    )
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new OpenAlexError(
        'OpenAlex rate limit reached. Wait a moment and try again.',
        429,
      )
    }
    throw new OpenAlexError(
      `OpenAlex returned an error (${response.status} ${response.statusText}).`,
      response.status,
    )
  }

  return (await response.json()) as OpenAlexWorksResponse
}

async function fetchPage(
  query: string,
  cursor: string,
  mailto: string | undefined,
  signal: AbortSignal | undefined,
): Promise<OpenAlexWorksResponse> {
  return requestWorks(buildSearchUrl(query, cursor, mailto), signal)
}

export interface FetchWorksOptions {
  /** How many works to fetch, roughly. Default 500. */
  targetCount?: number
  /** Contact email for OpenAlex's polite pool. */
  mailto?: string
  signal?: AbortSignal
  /** Called after each page with the running total and the target. */
  onProgress?: (fetched: number, target: number) => void
}

/**
 * Fetch the top `targetCount` works for a relevance-sorted query,
 * following cursor pagination until the target is reached or OpenAlex
 * runs out of results.
 */
export async function fetchWorksForTopic(
  query: string,
  options: FetchWorksOptions = {},
): Promise<Paper[]> {
  const target = options.targetCount ?? DEFAULT_TARGET_WORKS
  const papers: Paper[] = []
  let cursor = '*'

  while (papers.length < target) {
    const page = await fetchPage(query, cursor, options.mailto, options.signal)
    for (const work of page.results) {
      papers.push(workToPaper(work))
    }
    options.onProgress?.(Math.min(papers.length, target), target)

    if (!page.meta.next_cursor || page.results.length === 0) break
    cursor = page.meta.next_cursor
  }

  return papers.slice(0, target)
}

// --- Batch lookup by ID (used for co-citation reference metadata) ---
//
// The `ids.openalex` filter (alias `openalex`) ORs together up to 100
// pipe-separated IDs per the docs' filter-combination limit. `select` is
// still root-level only.

const ID_FILTER_BATCH_SIZE = 100

const MINIMAL_SELECT_FIELDS = ['id', 'title', 'publication_year', 'authorships'].join(',')

export interface MinimalWork {
  id: string
  title: string
  year: number | null
  authors: string[]
}

export function shortOpenAlexId(id: string): string {
  return id.replace(/^https:\/\/openalex\.org\//, '')
}

function buildIdFilterUrl(ids: string[], select: string, mailto?: string): string {
  const url = new URL(OPENALEX_WORKS_URL)
  url.searchParams.set('filter', `ids.openalex:${ids.map(shortOpenAlexId).join('|')}`)
  url.searchParams.set('per_page', String(ID_FILTER_BATCH_SIZE))
  url.searchParams.set('select', select)
  if (mailto) url.searchParams.set('mailto', mailto)
  return url.toString()
}

export interface FetchWorksByIdsOptions {
  mailto?: string
  signal?: AbortSignal
  /** Called after each batch with the running total and the overall total. */
  onProgress?: (fetched: number, total: number) => void
}

/**
 * Look up minimal metadata (title, year, authors) for a list of OpenAlex
 * work IDs, batching requests at the API's 100-values-per-filter limit.
 */
export async function fetchWorksByIds(
  ids: string[],
  options: FetchWorksByIdsOptions = {},
): Promise<Map<string, MinimalWork>> {
  const result = new Map<string, MinimalWork>()
  if (ids.length === 0) return result

  for (let i = 0; i < ids.length; i += ID_FILTER_BATCH_SIZE) {
    const batch = ids.slice(i, i + ID_FILTER_BATCH_SIZE)
    const page = await requestWorks(
      buildIdFilterUrl(batch, MINIMAL_SELECT_FIELDS, options.mailto),
      options.signal,
    )
    for (const work of page.results) {
      result.set(work.id, {
        id: work.id,
        title: work.title ?? '(untitled)',
        year: work.publication_year,
        authors: (work.authorships ?? [])
          .map((a) => a.author?.display_name)
          .filter((name): name is string => Boolean(name)),
      })
    }
    options.onProgress?.(Math.min(i + batch.length, ids.length), ids.length)
  }

  return result
}

export interface FetchPapersByIdsOptions {
  mailto?: string
  signal?: AbortSignal
  /** Called after each batch with the running total and the overall total. */
  onProgress?: (fetched: number, total: number) => void
}

/**
 * Re-fetches full `Paper` records (including `referencedWorks`, needed to
 * rebuild the graph) for a list of OpenAlex work IDs — used to reopen a
 * saved project, which only stores IDs rather than paper content. Order of
 * the result is not guaranteed to match `ids`; a work OpenAlex has since
 * removed or merged is simply absent.
 */
export async function fetchPapersByIds(
  ids: string[],
  options: FetchPapersByIdsOptions = {},
): Promise<Paper[]> {
  const papers: Paper[] = []
  if (ids.length === 0) return papers

  for (let i = 0; i < ids.length; i += ID_FILTER_BATCH_SIZE) {
    const batch = ids.slice(i, i + ID_FILTER_BATCH_SIZE)
    const page = await requestWorks(
      buildIdFilterUrl(batch, SELECT_FIELDS, options.mailto),
      options.signal,
    )
    for (const work of page.results) {
      papers.push(workToPaper(work))
    }
    options.onProgress?.(Math.min(i + batch.length, ids.length), ids.length)
  }

  return papers
}
