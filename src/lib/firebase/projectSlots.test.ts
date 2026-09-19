import { describe, expect, it } from 'vitest'
import { pickNextSlot, slotId, slotNumberFromId } from './projectSlots'

describe('slotNumberFromId', () => {
  it('parses valid slot ids', () => {
    expect(slotNumberFromId('p1')).toBe(1)
    expect(slotNumberFromId('p42')).toBe(42)
    expect(slotNumberFromId('p200')).toBe(200)
  })

  it('rejects non-slot ids', () => {
    expect(slotNumberFromId('abc')).toBeNull()
    expect(slotNumberFromId('p0')).toBeNull()
    expect(slotNumberFromId('p01')).toBeNull()
    expect(slotNumberFromId('p-1')).toBeNull()
    expect(slotNumberFromId('P1')).toBeNull()
    expect(slotNumberFromId('')).toBeNull()
  })
})

describe('slotId', () => {
  it('formats a slot number back into an id', () => {
    expect(slotId(1)).toBe('p1')
    expect(slotId(200)).toBe('p200')
  })
})

describe('pickNextSlot', () => {
  it('picks slot 1 when nothing is used', () => {
    expect(pickNextSlot([], 3)).toBe(1)
  })

  it('picks the first gap, not just the next number after the max', () => {
    expect(pickNextSlot(['p1', 'p3'], 3)).toBe(2)
  })

  it('picks the next number when slots are used contiguously from 1', () => {
    expect(pickNextSlot(['p1', 'p2'], 3)).toBe(3)
  })

  it('returns null once every slot up to the cap is used (cap reached)', () => {
    expect(pickNextSlot(['p1', 'p2', 'p3'], 3)).toBeNull()
  })

  it('ignores slots beyond the cap and ids that are not valid slots', () => {
    expect(pickNextSlot(['p1', 'p2', 'p50', 'abc'], 3)).toBe(3)
  })

  it('respects a larger cap for a pro plan', () => {
    const used = Array.from({ length: 199 }, (_, i) => `p${i + 1}`)
    expect(pickNextSlot(used, 200)).toBe(200)
    expect(pickNextSlot([...used, 'p200'], 200)).toBeNull()
  })
})
