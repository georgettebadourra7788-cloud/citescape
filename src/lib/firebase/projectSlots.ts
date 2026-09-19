// Slot-based project IDs — "p1", "p2", ... — instead of a client-writable
// counter, so the cap can't be reset by a malicious client (see
// firestore.rules: create is only allowed when the slot number is within
// the caller's plan cap). This module is pure so slot picking is unit
// testable without a Firestore mock.

const SLOT_ID_PATTERN = /^p([1-9][0-9]*)$/

export function slotNumberFromId(pid: string): number | null {
  const match = SLOT_ID_PATTERN.exec(pid)
  return match ? Number(match[1]) : null
}

export function slotId(slotNumber: number): string {
  return `p${slotNumber}`
}

/**
 * The first unused slot number within 1..cap, or null if every slot up to
 * the cap is already occupied (the caller should show the cap-reached
 * message rather than attempt a write, which the rules would reject).
 */
export function pickNextSlot(usedIds: Iterable<string>, cap: number): number | null {
  const used = new Set<number>()
  for (const id of usedIds) {
    const n = slotNumberFromId(id)
    if (n !== null) used.add(n)
  }
  for (let n = 1; n <= cap; n++) {
    if (!used.has(n)) return n
  }
  return null
}
