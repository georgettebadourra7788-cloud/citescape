import { describe, expect, it } from 'vitest'
import { stripArtifactReferences } from './artifactReferences'

describe('stripArtifactReferences', () => {
  it('removes the known deleted-work placeholder id', () => {
    const result = stripArtifactReferences([
      'https://openalex.org/W1',
      'https://openalex.org/W4285719527',
      'https://openalex.org/W2',
    ])
    expect(result).toEqual(['https://openalex.org/W1', 'https://openalex.org/W2'])
  })

  it('returns the same array reference when nothing needs stripping', () => {
    const refs = ['https://openalex.org/W1', 'https://openalex.org/W2']
    expect(stripArtifactReferences(refs)).toBe(refs)
  })
})
