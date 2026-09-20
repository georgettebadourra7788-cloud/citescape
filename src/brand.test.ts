import { describe, expect, it } from 'vitest'
import { brand } from './brand'

describe('brand', () => {
  it('has a non-empty name, tagline, and description', () => {
    expect(brand.name.length).toBeGreaterThan(0)
    expect(brand.tagline.length).toBeGreaterThan(0)
    expect(brand.shortDescription.length).toBeGreaterThan(0)
  })

  it('mentions its own name in the short description, so a rename stays consistent', () => {
    expect(brand.shortDescription).toContain(brand.name)
  })

  it('has a well-formed https site URL', () => {
    expect(brand.siteUrl).toMatch(/^https:\/\//)
  })

  it('falls back to undefined (never a fabricated address) for unset email env vars', () => {
    // No VITE_CONTACT_EMAIL/VITE_OPENALEX_MAILTO/VITE_PRO_WAITLIST_EMAIL is
    // set in the test environment.
    expect(brand.contactEmail).toBeUndefined()
    expect(brand.openAlexMailto).toBeUndefined()
    expect(brand.proWaitlistEmail).toBeUndefined()
  })
})
