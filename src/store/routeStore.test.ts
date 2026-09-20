import { describe, expect, it } from 'vitest'
import { normalizePath } from './routeStore'

describe('normalizePath', () => {
  it('leaves a root path as "/"', () => {
    expect(normalizePath('/')).toBe('/')
  })

  it('strips a trailing slash', () => {
    expect(normalizePath('/privacy/')).toBe('/privacy')
  })

  it('leaves a path with no trailing slash unchanged', () => {
    expect(normalizePath('/terms')).toBe('/terms')
  })

  it('falls back to "/" for an empty path', () => {
    expect(normalizePath('')).toBe('/')
  })

  it('collapses multiple trailing slashes', () => {
    expect(normalizePath('/privacy///')).toBe('/privacy')
  })
})
