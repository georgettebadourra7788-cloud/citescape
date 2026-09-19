import type { Paper } from '../openalex'

/** Minimal Paper builder for graph unit tests — not itself a test file. */
export function makePaper(overrides: Partial<Paper> & { id: string }): Paper {
  return {
    doi: null,
    title: overrides.id,
    year: 2020,
    citedByCount: 0,
    authors: [],
    topic: null,
    keywords: [],
    referencedWorks: [],
    ...overrides,
  }
}
