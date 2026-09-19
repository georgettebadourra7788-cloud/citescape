import { describe, expect, it } from 'vitest'
import { effectiveEntitlement, FREE_PROJECT_CAP, PRO_PROJECT_CAP } from './entitlementLogic'

describe('effectiveEntitlement', () => {
  it('treats a missing document as free', () => {
    expect(effectiveEntitlement(null)).toEqual({ plan: 'free', cap: FREE_PROJECT_CAP })
  })

  it('treats an explicit free plan as free', () => {
    expect(effectiveEntitlement({ plan: 'free', expiresAt: null })).toEqual({
      plan: 'free',
      cap: FREE_PROJECT_CAP,
    })
  })

  it('grants the pro cap for an active pro plan with no expiry', () => {
    expect(effectiveEntitlement({ plan: 'pro', expiresAt: null })).toEqual({
      plan: 'pro',
      cap: PRO_PROJECT_CAP,
    })
  })

  it('grants the pro cap for a pro plan that expires in the future', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const future = new Date('2026-06-01T00:00:00Z')
    expect(effectiveEntitlement({ plan: 'pro', expiresAt: future }, now)).toEqual({
      plan: 'pro',
      cap: PRO_PROJECT_CAP,
    })
  })

  it('falls back to free once a pro plan has expired', () => {
    const now = new Date('2026-06-02T00:00:00Z')
    const past = new Date('2026-06-01T00:00:00Z')
    expect(effectiveEntitlement({ plan: 'pro', expiresAt: past }, now)).toEqual({
      plan: 'free',
      cap: FREE_PROJECT_CAP,
    })
  })

  it('falls back to free exactly at the expiry instant', () => {
    const at = new Date('2026-06-01T00:00:00Z')
    expect(effectiveEntitlement({ plan: 'pro', expiresAt: at }, at)).toEqual({
      plan: 'free',
      cap: FREE_PROJECT_CAP,
    })
  })

  it('grants the pro cap for team plans the same as pro', () => {
    expect(effectiveEntitlement({ plan: 'team', expiresAt: null })).toEqual({
      plan: 'team',
      cap: PRO_PROJECT_CAP,
    })
  })
})
