import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OpenAlexError,
  fetchWorksForTopic,
  workToPaper,
  type OpenAlexWork,
} from './openalex'

function makeWork(overrides: Partial<OpenAlexWork> = {}): OpenAlexWork {
  return {
    id: 'https://openalex.org/W1',
    doi: 'https://doi.org/10.1/xyz',
    title: 'A paper',
    publication_year: 2020,
    cited_by_count: 5,
    authorships: [
      {
        author_position: 'first',
        author: { id: 'https://openalex.org/A1', display_name: 'Ada Lovelace' },
      },
    ],
    primary_topic: { id: 'https://openalex.org/T1', display_name: 'Computing' },
    keywords: [{ id: 'https://openalex.org/keywords/x', display_name: 'x', score: 0.9 }],
    referenced_works: ['https://openalex.org/W2'],
    ...overrides,
  }
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'status text',
    json: async () => body,
  } as Response
}

describe('workToPaper', () => {
  it('maps fields and filters authors without a display name', () => {
    const work = makeWork({
      authorships: [
        { author_position: 'first', author: { id: 'A1', display_name: 'Ada Lovelace' } },
        { author_position: 'last', author: null },
      ],
    })

    const paper = workToPaper(work)

    expect(paper).toMatchObject({
      id: 'https://openalex.org/W1',
      doi: 'https://doi.org/10.1/xyz',
      title: 'A paper',
      year: 2020,
      citedByCount: 5,
      authors: ['Ada Lovelace'],
      topic: 'Computing',
      keywords: ['x'],
      referencedWorks: ['https://openalex.org/W2'],
    })
  })

  it('falls back sensibly when optional fields are missing', () => {
    const paper = workToPaper(
      makeWork({
        title: null,
        primary_topic: null,
        keywords: [],
        referenced_works: [],
      }),
    )

    expect(paper.title).toBe('(untitled)')
    expect(paper.topic).toBeNull()
    expect(paper.keywords).toEqual([])
    expect(paper.referencedWorks).toEqual([])
  })
})

describe('fetchWorksForTopic', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns all results from a single page under the target', async () => {
    const works = [makeWork({ id: 'W1' }), makeWork({ id: 'W2' })]
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ meta: { count: 2, next_cursor: null }, results: works }),
    )

    const papers = await fetchWorksForTopic('coastal cities', { targetCount: 500 })

    expect(papers).toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('follows the cursor across pages until the target is reached', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          meta: { count: 4, next_cursor: 'page2' },
          results: [makeWork({ id: 'W1' }), makeWork({ id: 'W2' })],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          meta: { count: 4, next_cursor: null },
          results: [makeWork({ id: 'W3' }), makeWork({ id: 'W4' })],
        }),
      )

    const papers = await fetchWorksForTopic('coastal cities', { targetCount: 3 })

    expect(fetch).toHaveBeenCalledTimes(2)
    // Trimmed to the requested target even though 4 came back.
    expect(papers).toHaveLength(3)
    expect(papers.map((p) => p.id)).toEqual(['W1', 'W2', 'W3'])
  })

  it('stops pagination early if a page comes back empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ meta: { count: 0, next_cursor: 'page2' }, results: [] }),
    )

    const papers = await fetchWorksForTopic('an extremely obscure topic', {
      targetCount: 500,
    })

    expect(papers).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports progress after each page', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          meta: { count: 3, next_cursor: 'page2' },
          results: [makeWork({ id: 'W1' }), makeWork({ id: 'W2' })],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          meta: { count: 3, next_cursor: null },
          results: [makeWork({ id: 'W3' })],
        }),
      )

    const onProgress = vi.fn()
    await fetchWorksForTopic('coastal cities', { targetCount: 3, onProgress })

    expect(onProgress).toHaveBeenNthCalledWith(1, 2, 3)
    expect(onProgress).toHaveBeenNthCalledWith(2, 3, 3)
  })

  it('includes the search, sort, cursor, and mailto params in the request URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ meta: { count: 0, next_cursor: null }, results: [] }),
    )

    await fetchWorksForTopic('coastal cities', {
      targetCount: 1,
      mailto: 'researcher@example.com',
    })

    const requestedUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    expect(requestedUrl.searchParams.get('search')).toBe('coastal cities')
    expect(requestedUrl.searchParams.get('sort')).toBe('relevance_score:desc')
    expect(requestedUrl.searchParams.get('cursor')).toBe('*')
    expect(requestedUrl.searchParams.get('mailto')).toBe('researcher@example.com')
  })

  it('omits the mailto param when not configured', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ meta: { count: 0, next_cursor: null }, results: [] }),
    )

    await fetchWorksForTopic('coastal cities', { targetCount: 1 })

    const requestedUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    expect(requestedUrl.searchParams.has('mailto')).toBe(false)
  })

  it('throws a friendly OpenAlexError on a 429 rate-limit response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { ok: false, status: 429 }))

    await expect(fetchWorksForTopic('coastal cities')).rejects.toThrow(OpenAlexError)
    await expect(fetchWorksForTopic('coastal cities')).rejects.toThrow(/rate limit/i)
  })

  it('throws an OpenAlexError with the status for other non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({}, { ok: false, status: 500 }),
    )

    await expect(fetchWorksForTopic('coastal cities')).rejects.toMatchObject({
      status: 500,
    })
  })

  it('wraps a network failure in an OpenAlexError', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network down'))

    await expect(fetchWorksForTopic('coastal cities')).rejects.toThrow(OpenAlexError)
    await expect(fetchWorksForTopic('coastal cities')).rejects.toThrow(/network/i)
  })
})
