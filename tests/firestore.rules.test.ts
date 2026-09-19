import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'

// Exercises firestore.rules against the real Firestore emulator (run via
// `npm run test:rules`, which wraps this in `firebase emulators:exec` so
// FIRESTORE_EMULATOR_HOST is already set). Kept out of the default
// `npm test` — see vite.config.ts — since it needs that emulator running.

const PROJECT_ID = 'citescape-rules-test'
const OWNER_UID = 'owner-uid'
const OTHER_UID = 'other-uid'

let testEnv: RulesTestEnvironment

function validProjectData(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Coastal cities',
    query: 'climate adaptation in coastal cities',
    dateFetched: Timestamp.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    workIds: ['W1', 'W2'],
    excludedIds: [],
    settings: {
      minCouplingWeight: 2,
      minCoCitationWeight: 2,
      maxCoCitationNodes: 200,
      louvainSeed: 42,
      layoutIterations: 600,
      minLinkStrength: 2,
      activeNetwork: 'coupling',
    },
    clusterLabels: {},
    ...overrides,
  }
}

async function seedEntitlement(uid: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'entitlements', uid), data)
  })
}

async function seedProject(uid: string, pid: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid, 'projects', pid), validProjectData(overrides))
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('signed-out users', () => {
  it('cannot read or write entitlements', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'entitlements', OWNER_UID)))
    await assertFails(setDoc(doc(db, 'entitlements', OWNER_UID), { plan: 'pro', expiresAt: null }))
  })

  it('cannot read or write projects', async () => {
    await seedProject(OWNER_UID, 'p1')
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1')))
    await assertFails(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p2'), validProjectData()))
  })
})

describe('cross-user access', () => {
  it("user A cannot read or write user B's projects", async () => {
    await seedProject(OTHER_UID, 'p1')
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(getDoc(doc(db, 'users', OTHER_UID, 'projects', 'p1')))
    await assertFails(
      setDoc(doc(db, 'users', OTHER_UID, 'projects', 'p1'), validProjectData({ name: 'hijacked' })),
    )
    await assertFails(deleteDoc(doc(db, 'users', OTHER_UID, 'projects', 'p1')))
  })
})

describe('entitlements', () => {
  it('a user cannot write their own entitlements document', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(setDoc(doc(db, 'entitlements', OWNER_UID), { plan: 'pro', expiresAt: null }))
  })

  it('an owner can read their own entitlements document', async () => {
    await seedEntitlement(OWNER_UID, { plan: 'pro', expiresAt: null })
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(getDoc(doc(db, 'entitlements', OWNER_UID)))
  })
})

describe('free-plan slot cap (no entitlement doc = free)', () => {
  it('can create p1 through p3', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1'), validProjectData()))
    await assertSucceeds(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p2'), validProjectData()))
    await assertSucceeds(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p3'), validProjectData()))
  })

  it('cannot create p4', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p4'), validProjectData()))
  })

  it('rejects non-slot IDs like "abc" and "p0"', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'abc'), validProjectData()))
    await assertFails(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p0'), validProjectData()))
  })
})

describe('pro-plan slot cap', () => {
  it('an active pro user can create p4', async () => {
    await seedEntitlement(OWNER_UID, { plan: 'pro', expiresAt: null })
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p4'), validProjectData()))
  })

  it('an expired pro entitlement falls back to the free cap', async () => {
    const expiredYesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000)
    await seedEntitlement(OWNER_UID, { plan: 'pro', expiresAt: expiredYesterday })
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p3'), validProjectData()))
    await assertFails(setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p4'), validProjectData()))
  })
})

describe('field validation', () => {
  it('rejects an oversized workIds list', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    const tooMany = Array.from({ length: 5001 }, (_, i) => `W${i}`)
    await assertFails(
      setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1'), validProjectData({ workIds: tooMany })),
    )
  })

  it('accepts exactly the 5,000-entry limit', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    const atLimit = Array.from({ length: 5000 }, (_, i) => `W${i}`)
    await assertSucceeds(
      setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1'), validProjectData({ workIds: atLimit })),
    )
  })

  it('rejects unknown top-level fields', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(
      setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1'), validProjectData({ extra: 'nope' })),
    )
  })

  it('rejects a name that is too long', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(
      setDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1'), validProjectData({ name: 'x'.repeat(120) })),
    )
  })

  it('rejects a create where createdAt is not the server time', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', OWNER_UID, 'projects', 'p1'),
        validProjectData({ createdAt: Timestamp.now() }),
      ),
    )
  })
})

describe('update semantics', () => {
  it('lets the owner rename a project, re-stamping updatedAt', async () => {
    await seedProject(OWNER_UID, 'p1')
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1'), {
        name: 'Renamed',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an update that changes createdAt', async () => {
    await seedProject(OWNER_UID, 'p1')
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', OWNER_UID, 'projects', 'p1'),
        validProjectData({ createdAt: Timestamp.now(), updatedAt: serverTimestamp() }),
      ),
    )
  })

  it('the owner can delete a project', async () => {
    await seedProject(OWNER_UID, 'p1')
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER_UID, 'projects', 'p1')))
  })
})
