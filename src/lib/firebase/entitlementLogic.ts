// Pure entitlement math — no Firebase imports, so it's cheap to unit test
// and safe to import from security-rules-adjacent code without pulling in
// the SDK. Mirrors the cap logic in firestore.rules; keep both in sync.

export type Plan = 'free' | 'pro' | 'team'

export interface RawEntitlement {
  plan: Plan
  expiresAt: Date | null
}

export interface EffectiveEntitlement {
  /** The plan actually in effect right now — an expired pro/team reads as 'free'. */
  plan: Plan
  /** Max saved projects for that effective plan. */
  cap: number
}

export const FREE_PROJECT_CAP = 3
export const PRO_PROJECT_CAP = 200

/**
 * A missing document, or an expired pro/team plan, both fall back to free
 * — the entitlements/{uid} doc is optional-by-default so a user who has
 * never been granted anything just gets the free cap.
 */
export function effectiveEntitlement(
  raw: RawEntitlement | null,
  now: Date = new Date(),
): EffectiveEntitlement {
  if (!raw || raw.plan === 'free') return { plan: 'free', cap: FREE_PROJECT_CAP }
  if (raw.expiresAt && raw.expiresAt.getTime() <= now.getTime()) {
    return { plan: 'free', cap: FREE_PROJECT_CAP }
  }
  return { plan: raw.plan, cap: PRO_PROJECT_CAP }
}
