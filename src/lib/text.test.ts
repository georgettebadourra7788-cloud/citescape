import { describe, expect, it } from 'vitest'
import { truncateTitle } from './text'

describe('truncateTitle', () => {
  it('leaves short titles untouched', () => {
    expect(truncateTitle('A short title')).toBe('A short title')
  })

  it('truncates long titles to the max length plus an ellipsis', () => {
    const title = 'x'.repeat(200)
    const result = truncateTitle(title, 120)
    expect(result).toBe(`${'x'.repeat(120)}…`)
  })
})
