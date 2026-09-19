import { describe, expect, it } from 'vitest'
import { assertWithinSizeLimit, estimateDocBytes, MAX_PROJECT_DOC_BYTES, ProjectTooLargeError } from './projectSize'

describe('assertWithinSizeLimit', () => {
  it('does not throw for a small document', () => {
    expect(() => assertWithinSizeLimit({ name: 'small', workIds: ['W1', 'W2'] })).not.toThrow()
  })

  it('throws a ProjectTooLargeError once the estimated size exceeds the limit', () => {
    const workIds = Array.from({ length: 200_000 }, (_, i) => `W${i}`)
    const bytes = estimateDocBytes({ workIds })
    expect(bytes).toBeGreaterThan(MAX_PROJECT_DOC_BYTES)
    expect(() => assertWithinSizeLimit({ workIds })).toThrow(ProjectTooLargeError)
  })
})
