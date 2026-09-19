import { describe, expect, it } from 'vitest'
import { exportFilename, slugify } from './filename'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Climate Adaptation in Coastal Cities')).toBe(
      'climate-adaptation-in-coastal-cities',
    )
  })

  it('collapses punctuation and trims leading/trailing hyphens', () => {
    expect(slugify('  --Weird!! Query?? --  ')).toBe('weird-query')
  })

  it('falls back to "query" for an empty/all-punctuation input', () => {
    expect(slugify('   ??!!  ')).toBe('query')
  })

  it('truncates very long queries', () => {
    const long = 'a'.repeat(200)
    expect(slugify(long).length).toBeLessThanOrEqual(60)
  })
})

describe('exportFilename', () => {
  it('builds citescape-<slug>-<date>.<ext>', () => {
    const date = new Date('2026-09-19T12:00:00Z')
    expect(exportFilename('coastal cities', 'xlsx', date)).toBe(
      'citescape-coastal-cities-2026-09-19.xlsx',
    )
  })
})
