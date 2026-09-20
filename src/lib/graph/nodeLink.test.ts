import { describe, expect, it } from 'vitest'
import { resolveNodeLink } from './nodeLink'

describe('resolveNodeLink', () => {
  it('links to the DOI when the node has one', () => {
    const link = resolveNodeLink({ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1/xyz' })
    expect(link).toEqual({ href: 'https://doi.org/10.1/xyz', label: 'https://doi.org/10.1/xyz' })
  })

  it('falls back to the OpenAlex page when there is no DOI', () => {
    const link = resolveNodeLink({ id: 'https://openalex.org/W1', doi: null })
    expect(link).toEqual({ href: 'https://openalex.org/W1', label: 'View on OpenAlex' })
  })

  it('falls back to the OpenAlex page when doi is omitted entirely', () => {
    const link = resolveNodeLink({ id: 'https://openalex.org/W1' })
    expect(link).toEqual({ href: 'https://openalex.org/W1', label: 'View on OpenAlex' })
  })
})
