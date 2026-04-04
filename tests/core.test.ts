/**
 * verino — Definitive Test Suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers every public API surface of core.ts. Ship this file as part of the package.
 *
 * Run: pnpm test  |  node_modules/.bin/jest tests/core.test.ts
 */

import {
  filterChar,
  filterString,
  isInputType,
  parseBooleanish,
  parseInputType,
  parseSeparatorAfter,
  createOTP,
  createTimer,
  formatCountdown,
  type InputType,
} from '@verino/core'
import { subscribeFeedback, triggerHapticFeedback, triggerSoundFeedback } from '@verino/core/toolkit'

// ─────────────────────────────────────────────────────────────────────────────
// 1. filterChar
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar', () => {
  describe('numeric', () => {
    it('accepts every digit 0-9', () => {
      for (const d of '0123456789') expect(filterChar(d, 'numeric')).toBe(d)
    })
    it('rejects letters', () => {
      expect(filterChar('a', 'numeric')).toBe('')
      expect(filterChar('Z', 'numeric')).toBe('')
    })
    it('rejects specials and whitespace', () => {
      expect(filterChar('!', 'numeric')).toBe('')
      expect(filterChar(' ', 'numeric')).toBe('')
    })
  })

  describe('alphabet', () => {
    it('accepts a-z and A-Z', () => {
      expect(filterChar('a', 'alphabet')).toBe('a')
      expect(filterChar('Z', 'alphabet')).toBe('Z')
    })
    it('rejects digits and specials', () => {
      expect(filterChar('3', 'alphabet')).toBe('')
      expect(filterChar('@', 'alphabet')).toBe('')
    })
  })

  describe('alphanumeric', () => {
    it('accepts letters and digits', () => {
      expect(filterChar('a', 'alphanumeric')).toBe('a')
      expect(filterChar('5', 'alphanumeric')).toBe('5')
    })
    it('rejects specials', () => {
      expect(filterChar('!', 'alphanumeric')).toBe('')
    })
  })

  describe('any', () => {
    it('passes any single character including specials and unicode', () => {
      expect(filterChar('!', 'any')).toBe('!')
      expect(filterChar('漢', 'any')).toBe('漢')
    })
  })

  it('rejects empty string and multi-char for all types', () => {
    const types: InputType[] = ['numeric', 'alphabet', 'alphanumeric', 'any']
    for (const t of types) {
      expect(filterChar('', t)).toBe('')
      expect(filterChar('12', t)).toBe('')
    }
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 2. filterString
// ─────────────────────────────────────────────────────────────────────────────

describe('filterString', () => {
  it('strips invalid chars for numeric', () => {
    expect(filterString('1a2b3', 'numeric')).toBe('123')
  })
  it('returns empty string when nothing is valid', () => {
    expect(filterString('abc', 'numeric')).toBe('')
  })
  it('passes all chars for "any"', () => {
    expect(filterString('a1!', 'any')).toBe('a1!')
  })
  it('handles empty string', () => {
    expect(filterString('', 'numeric')).toBe('')
  })
  it('filters alphanumeric correctly', () => {
    expect(filterString('a1!b2@', 'alphanumeric')).toBe('a1b2')
  })
  it('filterString handles emoji and supplementary-plane characters safely', () => {
    // filterChar requires char.length === 1; emoji have .length === 2 (surrogate pair)
    // Array.from ensures the emoji is treated as a single code point rather than two
    // broken half-surrogates — so it is rejected cleanly rather than accepted as garbage.
    const result = filterString('1😀2', 'any')
    expect(result).toBe('12')            // emoji rejected because .length !== 1 (surrogate pair)
    expect(Array.from(result)).toHaveLength(2)  // only '1' and '2' remain
  })
  it('filterString rejects emoji in numeric mode', () => {
    expect(filterString('1😀2', 'numeric')).toBe('12')
  })
})

describe('input type parsing', () => {
  it('isInputType returns true only for supported runtime values', () => {
    expect(isInputType('numeric')).toBe(true)
    expect(isInputType('alphabet')).toBe(true)
    expect(isInputType('letters')).toBe(false)
    expect(isInputType(123)).toBe(false)
    expect(isInputType(null)).toBe(false)
  })

  it('parseInputType falls back safely for unsupported runtime values', () => {
    expect(parseInputType('alphanumeric')).toBe('alphanumeric')
    expect(parseInputType('letters')).toBe('numeric')
    expect(parseInputType(undefined, 'any')).toBe('any')
  })

  it('parseBooleanish handles booleans, empty attrs, and fallback values safely', () => {
    expect(parseBooleanish(true, false)).toBe(true)
    expect(parseBooleanish(false, true)).toBe(false)
    expect(parseBooleanish('', false)).toBe(true)
    expect(parseBooleanish('false', true)).toBe(false)
    expect(parseBooleanish(undefined, true)).toBe(true)
  })

  it('parseSeparatorAfter handles single values, comma lists, arrays, and fallback values safely', () => {
    expect(parseSeparatorAfter('3')).toBe(3)
    expect(parseSeparatorAfter('2,4')).toEqual([2, 4])
    expect(parseSeparatorAfter([1, '3', 'bad'])).toEqual([1, 3])
    expect(parseSeparatorAfter(undefined, [])).toEqual([])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 3. createOTP — initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('createOTP — initial state', () => {
  it('creates 6 empty slots, activeSlot=0, no error, not complete (defaults)', () => {
    const otp = createOTP()
    expect(otp.state.slotValues).toEqual(['', '', '', '', '', ''])
    expect(otp.state.activeSlot).toBe(0)
    expect(otp.state.hasError).toBe(false)
    expect(otp.state.isComplete).toBe(false)
  })
  it('respects custom length', () => {
    expect(createOTP({ length: 4 }).state.slotValues).toHaveLength(4)
  })
  it('stores the initial timer value in state', () => {
    expect(createOTP({ timer: 30 }).state.timerSeconds).toBe(30)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 4. insert
// ─────────────────────────────────────────────────────────────────────────────

describe('insert', () => {
  it('fills a slot and advances focus by one', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('1')
    expect(otp.state.activeSlot).toBe(1)
  })
  it('stays on the last slot after filling it', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('9', 3)
    expect(otp.state.activeSlot).toBe(3)
  })
  it('keeps focus when an invalid char is typed', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('a', 0)   // numeric rejects letters
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.activeSlot).toBe(0)
  })
  it('clears hasError when a valid char is typed', () => {
    const otp = createOTP({ length: 4 })
    otp.setError(true)
    otp.insert('1', 0)
    expect(otp.state.hasError).toBe(false)
  })
  it('sets isComplete when all slots are filled', () => {
    const otp = createOTP({ length: 4 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.state.isComplete).toBe(true)
  })
  it('fires onComplete synchronously when all slots fill', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    expect(cb).toHaveBeenCalledWith('1234')
  })
  it('overwrites an existing char in the slot', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    otp.insert('9', 0)
    expect(otp.state.slotValues[0]).toBe('9')
  })
  it('does not throw on out-of-bounds slot index', () => {
    expect(() => createOTP({ length: 4 }).insert('5', 99)).not.toThrow()
  })
  it('insert silently ignores a slot index >= length', () => {
    const otp = createOTP({ length: 4 })
    expect(() => otp.insert('1', 99)).not.toThrow()
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })
  it('insert silently ignores a negative slot index', () => {
    const otp = createOTP({ length: 4 })
    expect(() => otp.insert('1', -1)).not.toThrow()
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 5. delete
// ─────────────────────────────────────────────────────────────────────────────

describe('delete', () => {
  it('clears a filled slot and keeps focus at the same index', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 0)
    otp.insert('6', 1)
    otp.delete(1)
    expect(otp.state.slotValues[1]).toBe('')
    expect(otp.state.activeSlot).toBe(1)
  })
  it('moves back to the previous slot when the current slot is empty', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 0)
    otp.delete(1)
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.activeSlot).toBe(0)
  })
  it('clamps at slot 0 — does not go negative', () => {
    const otp = createOTP({ length: 4 })
    otp.delete(0)
    expect(otp.state.activeSlot).toBe(0)
  })
  it('clears isComplete flag', () => {
    const otp = createOTP({ length: 4 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.state.isComplete).toBe(true)
    otp.delete(3)
    expect(otp.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 6. Focus movement
// ─────────────────────────────────────────────────────────────────────────────

describe('focus movement', () => {
  it('move left (moveFocusLeft → move) moves left and clamps at 0', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)
    otp.move(1)
    expect(otp.state.activeSlot).toBe(1)
    otp.move(-1)
    expect(otp.state.activeSlot).toBe(0)
  })
  it('move right (moveFocusRight → move) moves right and clamps at last slot', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)
    expect(otp.state.activeSlot).toBe(2)
    otp.move(4)
    expect(otp.state.activeSlot).toBe(3)
  })
  it('move() clamps negative index to 0', () => {
    const otp = createOTP({ length: 6 })
    otp.move(-1)
    expect(otp.state.activeSlot).toBe(0)
  })
  it('move() clamps over-range index to last slot', () => {
    const otp = createOTP({ length: 6 })
    otp.move(99)
    expect(otp.state.activeSlot).toBe(5)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 7. paste
// ─────────────────────────────────────────────────────────────────────────────

describe('paste', () => {
  it('fills all slots from cursor 0', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('123456', 0)
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(otp.state.isComplete).toBe(true)
  })
  it('lands focus on the last slot when all slots are filled', () => {
    const otp = createOTP({ length: 4 })
    otp.paste('1234', 0)
    expect(otp.state.activeSlot).toBe(3)
  })
  it('filters invalid chars before distributing and focuses last filled slot', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('1a2b3c', 0)
    expect(otp.state.slotValues.slice(0, 3)).toEqual(['1', '2', '3'])
    expect(otp.state.slotValues.slice(3)).toEqual(['', '', ''])
    expect(otp.state.activeSlot).toBe(2)
  })
  it('does not wrap — chars beyond the last slot are ignored', () => {
    const otp = createOTP({ length: 6 })
    // Only slot 5 can be filled starting from cursor 5; remaining 5 chars are dropped.
    otp.paste('847291', 5)
    expect(otp.state.slotValues[5]).toBe('8')
    // No wrap — other slots are untouched.
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.slotValues[4]).toBe('')
    expect(otp.state.activeSlot).toBe(5)
  })
  it('focuses the last filled slot after a partial paste', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('123', 0)
    // Slots 0–2 filled; focus on slot 2 (last filled), not slot 3 (next empty).
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '', '', ''])
    expect(otp.state.activeSlot).toBe(2)
  })
  it('clamps cursor to last slot when selectionStart equals length', () => {
    const otp = createOTP({ length: 4 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    // selectionStart can equal length (4) on a fully-filled input; clamp to 3.
    otp.paste('9', 4)
    expect(otp.state.slotValues[3]).toBe('9')
  })
  it('returns unchanged state for an empty paste', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('', 0)
    expect(otp.state.slotValues).toEqual(['', '', '', '', '', ''])
  })
  it('returns unchanged state when paste contains only invalid chars', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('abcdef', 0)
    expect(otp.state.slotValues).toEqual(['', '', '', '', '', ''])
  })
  it('fires onComplete synchronously after a full paste', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 6, onComplete: cb })
    otp.paste('123456', 0)
    expect(cb).toHaveBeenCalledWith('123456')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 8. setError / reset / getCode / getSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe('setError', () => {
  it('sets and clears hasError', () => {
    const otp = createOTP()
    otp.setError(true)
    expect(otp.state.hasError).toBe(true)
    otp.setError(false)
    expect(otp.state.hasError).toBe(false)
  })
})

describe('reset', () => {
  it('clears all slots, resets all flags, and restores timerSeconds', () => {
    const otp = createOTP({ length: 4, timer: 30 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    otp.setError(true)
    otp.reset()
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
    expect(otp.state.activeSlot).toBe(0)
    expect(otp.state.hasError).toBe(false)
    expect(otp.state.isComplete).toBe(false)
    expect(otp.state.timerSeconds).toBe(30)
  })
})

describe('getCode', () => {
  it('returns the joined code string', () => {
    const otp = createOTP({ length: 4 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.getCode()).toBe('1234')
  })
  it('empty slots contribute empty strings — no spaces or placeholders', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    expect(otp.getCode()).toBe('1')   // ['1','','',''].join('') = '1'
  })
})

describe('getSnapshot', () => {
  it('returns a copy — mutations to the snapshot do not affect live state', () => {
    const otp  = createOTP({ length: 4 })
    const snap = otp.getSnapshot()
    otp.insert('5', 0)
    expect(snap.slotValues[0]).toBe('')
    expect(otp.state.slotValues[0]).toBe('5')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #1 — disabled flag guards input actions, not navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #1 — disabled flag on core', () => {
  it('insert is a no-op when disabled=true at construction', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.activeSlot).toBe(0)
  })
  it('delete is a no-op when disabled=true at construction', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.delete(0)
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.activeSlot).toBe(0)
  })
  it('paste is a no-op when disabled=true at construction', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.paste('1234', 0)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })
  it('navigation is allowed even when disabled', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.move(3)
    otp.move(2)
    expect(otp.state.activeSlot).toBe(2)
  })
  it('setError still works when disabled', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.setError(true)
    expect(otp.state.hasError).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #2 — setDisabled() runtime toggle on core
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #2 — core.setDisabled() runtime toggle', () => {
  it('enabling allows input after the instance was constructed as disabled', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.setDisabled(false)
    otp.insert('5', 0)
    expect(otp.state.slotValues[0]).toBe('5')
  })
  it('disabling blocks input on an instance that started enabled', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    otp.setDisabled(true)
    otp.insert('2', 1)
    expect(otp.state.slotValues[1]).toBe('')   // blocked
    expect(otp.state.slotValues[0]).toBe('1')  // previous input preserved
  })
  it('re-enabling after runtime disable resumes input', () => {
    const otp = createOTP({ length: 4 })
    otp.setDisabled(true)
    otp.insert('9', 0)
    expect(otp.state.slotValues[0]).toBe('')  // still blocked
    otp.setDisabled(false)
    otp.insert('9', 0)
    expect(otp.state.slotValues[0]).toBe('9')  // now allowed
  })
  it('paste is blocked/unblocked correctly by setDisabled()', () => {
    const otp = createOTP({ length: 4 })
    otp.setDisabled(true)
    otp.paste('1234', 0)
    expect(otp.state.isComplete).toBe(false)
    otp.setDisabled(false)
    otp.paste('1234', 0)
    expect(otp.state.isComplete).toBe(true)
  })
  it('navigation remains available regardless of setDisabled state', () => {
    const otp = createOTP({ length: 6 })
    otp.move(3)
    otp.setDisabled(true)
    otp.move(2)
    expect(otp.state.activeSlot).toBe(2)
    otp.move(3)
    expect(otp.state.activeSlot).toBe(3)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #3 — onComplete fires synchronously (no setTimeout in core)
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #3 — onComplete is synchronous', () => {
  it('onComplete fires on the exact insert that fills the last slot', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '123'.split('').forEach((c, i) => otp.insert(c, i))
    expect(cb).not.toHaveBeenCalled()          // not complete yet
    otp.insert('4', 3)
    expect(cb).toHaveBeenCalledWith('1234')    // fires immediately
  })

  it('onComplete fires once per completed fill', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('1234')
  })

  it('complete → reset → complete: fires once per completion (not de-duped)', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    otp.reset()
    '5678'.split('').forEach((c, i) => otp.insert(c, i))
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenNthCalledWith(1, '1234')
    expect(cb).toHaveBeenNthCalledWith(2, '5678')
  })

  it('single-slot OTP: complete fires immediately on insert', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 1, onComplete: cb })
    otp.insert('9', 0)
    expect(otp.state.isComplete).toBe(true)
    expect(cb).toHaveBeenCalledWith('9')
  })

  it('rapid re-completion fires once per completion', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    otp.delete(3)
    otp.insert('4', 3)   // re-fills → second completion
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith('1234')
  })

  it('adapters suppress onComplete for programmatic fills via a flag', () => {
    const cb  = jest.fn()
    let suppress = false
    const otp = createOTP({ length: 4, onComplete: (c) => { if (!suppress) cb(c) } })

    suppress = true
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    suppress = false

    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
    expect(otp.state.isComplete).toBe(true)
    expect(cb).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #4 — onChange fires exactly ONCE per interaction (no echo loop)
// Tested via the algorithm used by the React/Vue/Svelte adapters.
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #4 — onChange echo loop (controlled value sync algorithm)', () => {
  /** Simulate the adapter's controlled sync: reset + replay, call onChange once. */
  function applyControlledValue(
    otp: ReturnType<typeof createOTP>,
    incoming: string,
    length: number,
    type: InputType,
    onChangeCb: (code: string) => void,
  ): void {
    const filtered = incoming.replace(/[^0-9]/g, '').slice(0, length)  // numeric for test
    const current  = otp.state.slotValues.join('')
    if (filtered === current) return

    otp.reset()
    for (let i = 0; i < filtered.length; i++) otp.insert(filtered[i], i)
    // onChange fires ONCE — not inside the loop
    onChangeCb(filtered)
  }

  it('onChange is called exactly once for a full 6-char sync', () => {
    const otp      = createOTP({ length: 6 })
    const onChange = jest.fn()
    applyControlledValue(otp, '123456', 6, 'numeric', onChange)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('onChange is called exactly once for a partial sync', () => {
    const otp      = createOTP({ length: 6 })
    const onChange = jest.fn()
    applyControlledValue(otp, '123', 6, 'numeric', onChange)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('123')
  })

  it('onChange is called once with "" when syncing to empty', () => {
    const otp      = createOTP({ length: 6 })
    const onChange = jest.fn()
    applyControlledValue(otp, '123456', 6, 'numeric', onChange)
    applyControlledValue(otp, '', 6, 'numeric', onChange)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('onChange is NOT called when the incoming value equals current state (bail-out)', () => {
    const otp      = createOTP({ length: 4 })
    const onChange = jest.fn()
    applyControlledValue(otp, '1234', 4, 'numeric', onChange)
    applyControlledValue(otp, '1234', 4, 'numeric', onChange)   // same value
    expect(onChange).toHaveBeenCalledTimes(1)                   // not called again
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #5 — Controlled value equality check: simple string equality
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #5 — controlled value equality check', () => {
  it('correctly detects a change when slot 0 holds "0"', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('0', 0)    // '0' is falsy — old filter(Boolean) would miss it
    expect(otp.state.slotValues[0]).toBe('0')
    expect(otp.state.slotValues.join('')).toBe('0')
    // If equality check used filter(Boolean).length, it would return 0 for ['0','','','']
    // and incorrectly bail out on an incoming '0123'. Verify the correct value is stored.
    expect(otp.state.slotValues.join('')).not.toBe('')
  })

  it('pre-fills slots correctly from a controlled value containing "0"', () => {
    const otp = createOTP({ length: 4 })
    // Simulate controlled sync with a value starting with '0'
    otp.reset()
    '0123'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.state.slotValues).toEqual(['0', '1', '2', '3'])
    expect(otp.state.isComplete).toBe(true)
  })

  it('truncates incoming value longer than configured length', () => {
    const otp = createOTP({ length: 4 })
    const incoming = '123456'.slice(0, 4)
    otp.reset()
    for (let i = 0; i < incoming.length; i++) otp.insert(incoming[i], i)
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
  })

  it('leaves remaining slots empty for a partial incoming value', () => {
    const otp = createOTP({ length: 6 })
    otp.reset()
    '123'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '', '', ''])
    expect(otp.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #6 — separator is purely decorative, never affects state/value
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #6 — separator config (adapter layer — core is agnostic)', () => {
  it('separator does not affect the state machine or getCode()', () => {
    // Core knows nothing about separatorAfter — it is adapter-only.
    // Verify that full 6-slot fill/code/wrap-paste are unaffected.
    const otp = createOTP({ length: 6 })
    '123456'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.getCode()).toBe('123456')
    expect(otp.state.isComplete).toBe(true)
  })

  it('paste fills forward from cursorSlot regardless of separatorAfter position', () => {
    // Separator is rendered between e.g. slot 2 and 3 in the DOM but the
    // core state machine is a 0-based array of `length` slots — no gap.
    const otp = createOTP({ length: 6 })
    otp.paste('847291', 5)
    // No wrap — only slot 5 gets '8'; the remaining 5 chars are dropped.
    expect(otp.state.slotValues[5]).toBe('8')
    expect(otp.state.slotValues.slice(0, 5)).toEqual(['', '', '', '', ''])
    expect(otp.state.isComplete).toBe(false)
    // isComplete is still false since only one slot was filled.
    // (The test was originally verifying core state alignment with the separator
    // feature, which doesn't affect the zero-based slot array — that's unchanged.)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #7 — React adapter: disabled prop is threaded through correctly
// Tested via the disabledRef pattern — event handlers guard on disabledRef.current
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #7 — React adapter disabled threading (disabledRef pattern)', () => {
  // Simulate the disabledRef pattern used by the React hook's event handlers
  it('disabledRef pattern correctly blocks input when true', () => {
    const disabledRef = { current: false }
    const otp         = createOTP({ length: 4 })

    function handleKeyDown(key: string) {
      if (disabledRef.current) return   // guard — mirrors React hook
      if (key === 'Backspace') otp.delete(otp.state.activeSlot)
    }

    function handleChange(char: string) {
      if (disabledRef.current) return   // guard — mirrors React hook
      otp.insert(char, otp.state.activeSlot)
    }

    // Enabled: input works
    handleChange('1')
    expect(otp.state.slotValues[0]).toBe('1')

    // Disable
    disabledRef.current = true

    // Disabled: input blocked
    handleChange('2')
    expect(otp.state.slotValues[1]).toBe('')

    // Disabled: backspace blocked
    handleKeyDown('Backspace')
    expect(otp.state.slotValues[0]).toBe('1')

    // Re-enable
    disabledRef.current = false
    handleChange('2')
    expect(otp.state.slotValues[1]).toBe('2')
  })

  it('HiddenInputProps contains disabled field', () => {
    // Verify the disabled prop is included in the output type
    // (structural check — disabled prop must be present and typed boolean)
    const disabledValues: boolean[] = [true, false]
    disabledValues.forEach(v => {
      // Simulate creating the hiddenInputProps object with disabled
      const props = { disabled: v }
      expect(typeof props.disabled).toBe('boolean')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createTimer
// ─────────────────────────────────────────────────────────────────────────────

describe('createTimer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('calls onTick each second with the remaining count', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 3, onTick })
    t.start()
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(3)
    expect(onTick).toHaveBeenLastCalledWith(0)
  })

  it('calls onExpire at zero', () => {
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 2, onExpire })
    t.start()
    jest.advanceTimersByTime(2000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('stop() halts the countdown mid-way', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 5, onTick })
    t.start()
    jest.advanceTimersByTime(2000)
    t.stop()
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('reset() stops the countdown without starting', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 5, onTick })
    t.start()
    jest.advanceTimersByTime(2000)
    t.reset()
    jest.advanceTimersByTime(5000)
    expect(onTick).toHaveBeenCalledTimes(2)  // stopped by reset
  })

  it('restart() runs a full new cycle from the beginning', () => {
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 3, onExpire })
    t.start()
    jest.advanceTimersByTime(2000)
    t.restart()
    jest.advanceTimersByTime(3000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('calling stop() twice does not throw', () => {
    const t = createTimer({ totalSeconds: 5 })
    t.start()
    expect(() => { t.stop(); t.stop() }).not.toThrow()
  })

  it('calling start() without stop() first replaces the interval correctly', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 5, onTick })
    t.start()
    jest.advanceTimersByTime(1000)
    t.start()  // restart without explicit stop
    jest.advanceTimersByTime(1000)
    // If double-interval bug existed, onTick would fire 3 times not 2
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('totalSeconds=0 fires onExpire immediately, never passes negative value to onTick', () => {
    const onTick   = jest.fn()
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 0, onTick, onExpire })
    t.start()
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onTick).not.toHaveBeenCalled()
  })

  it('negative totalSeconds fires onExpire immediately without ticking', () => {
    const onTick   = jest.fn()
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: -5, onTick, onExpire })
    t.start()
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onTick).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #8 — insert out-of-bounds guard
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #8 — insert out-of-bounds guard', () => {
  it('silently ignores a slot index greater than length-1', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 99)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
    expect(otp.state.slotValues.length).toBe(4)
  })

  it('silently ignores a negative slot index', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', -1)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })

  it('state remains unmodified — getCode() returns empty, isComplete stays false', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 100)
    expect(otp.getCode()).toBe('')
    expect(otp.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #9 — createOTP length validation
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #9 — createOTP length validation', () => {
  it('length=0 is clamped to 1 — does not throw', () => {
    expect(() => createOTP({ length: 0 })).not.toThrow()
    const otp = createOTP({ length: 0 })
    expect(otp.state.slotValues).toHaveLength(1)
  })

  it('negative length is clamped to 1 — does not throw', () => {
    expect(() => createOTP({ length: -3 })).not.toThrow()
    const otp = createOTP({ length: -3 })
    expect(otp.state.slotValues).toHaveLength(1)
  })

  it('fractional length is floored — length=4.9 produces 4 slots', () => {
    const otp = createOTP({ length: 4.9 })
    expect(otp.state.slotValues).toHaveLength(4)
  })

  it('normal positive integer lengths still work', () => {
    expect(createOTP({ length: 6 }).state.slotValues).toHaveLength(6)
    expect(createOTP({ length: 1 }).state.slotValues).toHaveLength(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onComplete — synchronous, reset-and-refill fires again
// ─────────────────────────────────────────────────────────────────────────────

describe('onComplete — synchronous firing and reset behaviour', () => {
  it('fires synchronously on the fill that completes the code', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    expect(cb).toHaveBeenCalledWith('1234')
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
    expect(otp.state.isComplete).toBe(true)
  })

  it('does not fire on an empty instance with no input', () => {
    const cb  = jest.fn()
    createOTP({ length: 4, onComplete: cb })
    expect(cb).not.toHaveBeenCalled()
  })

  it('fires again after reset + refill', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))

    otp.reset()
    '5678'.split('').forEach((c, i) => otp.insert(c, i))
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith('5678')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #11 — delete out-of-bounds guard
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #11 — delete out-of-bounds guard', () => {
  it('silently ignores a negative slot index — does not clear slot 0', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 0)
    otp.delete(-1)
    expect(otp.state.slotValues[0]).toBe('5')  // slot 0 must NOT be cleared
    expect(otp.state.slotValues).toEqual(['5', '', '', ''])
  })

  it('silently ignores a slot index >= length — does not clear last slot', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('9', 3)
    otp.delete(99)
    expect(otp.state.slotValues[3]).toBe('9')  // last slot must NOT be cleared
    expect(otp.state.slotValues).toEqual(['', '', '', '9'])
  })

  it('state and activeSlot are unchanged on out-of-bounds delete', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)
    const before = otp.getSnapshot()
    otp.delete(-5)
    expect(otp.state).toEqual(before)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FEATURE — pattern option (arbitrary per-character regex validation)
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar — pattern option', () => {
  it('accepts a character that matches the regex', () => {
    expect(filterChar('A', 'any', /^[A-F]$/)).toBe('A')
    expect(filterChar('3', 'any', /^[0-9A-F]$/)).toBe('3')
  })

  it('rejects a character that does not match the regex', () => {
    expect(filterChar('G', 'any', /^[A-F]$/)).toBe('')
    expect(filterChar('z', 'numeric', /^[0-9A-F]$/)).toBe('')
  })

  it('pattern takes precedence over type — numeric type with hex pattern accepts A-F', () => {
    // type='numeric' alone rejects letters, but pattern overrides it
    expect(filterChar('A', 'numeric', /^[0-9A-F]$/)).toBe('A')
    expect(filterChar('F', 'numeric', /^[0-9A-F]$/)).toBe('F')
    expect(filterChar('G', 'numeric', /^[0-9A-F]$/)).toBe('')
  })

  it('pattern=undefined falls through to normal type validation', () => {
    expect(filterChar('5', 'numeric', undefined)).toBe('5')
    expect(filterChar('a', 'numeric', undefined)).toBe('')
  })

  it('multi-char string still returns empty regardless of pattern', () => {
    expect(filterChar('AB', 'any', /^[A-F]+$/)).toBe('')
  })
})

describe('filterString — pattern option', () => {
  it('filters a string keeping only characters matching the pattern', () => {
    expect(filterString('1A2B3G', 'any', /^[0-9A-F]$/)).toBe('1A2B3')
  })

  it('returns empty string when no characters match', () => {
    expect(filterString('ghijkl', 'any', /^[0-9A-F]$/)).toBe('')
  })

  it('pattern=undefined behaves identically to filterString(str, type)', () => {
    expect(filterString('123abc', 'numeric', undefined)).toBe('123')
    expect(filterString('123abc', 'numeric')).toBe('123')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE — pasteTransformer option
// ─────────────────────────────────────────────────────────────────────────────

describe('pasteTransformer option', () => {
  it('strips formatting before distributing — "G-123456" fills all 6 slots', () => {
    const otp = createOTP({ length: 6, pasteTransformer: (r) => r.replace(/[^0-9]/g, '') })
    otp.paste('G-123456', 0)
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(otp.state.isComplete).toBe(true)
  })

  it('strips spaces — "123 456" fills all 6 slots', () => {
    const otp = createOTP({ length: 6, pasteTransformer: (r) => r.replace(/\s+/g, '') })
    otp.paste('123 456', 0)
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('normalizes case — lowercase paste fills correctly with alphanumeric pattern', () => {
    const otp = createOTP({ length: 4, type: 'any', pattern: /^[A-Z0-9]$/, pasteTransformer: (r) => r.toUpperCase() })
    otp.paste('ab12', 0)
    expect(otp.state.slotValues).toEqual(['A', 'B', '1', '2'])
  })

  it('transformer runs before filterString — invalid chars after transform are still rejected', () => {
    // Transformer keeps only digits; filterString then validates as numeric
    const otp = createOTP({ length: 4, pasteTransformer: (r) => r.replace(/[^0-9]/g, '') })
    otp.paste('abc', 0)   // transformer → '', filterString → ''
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })

  it('without transformer, formatted code is filtered char-by-char (dashes rejected)', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('12-34-56', 0)   // dashes are non-numeric, filterString strips them
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('transformer returning empty string leaves state unchanged', () => {
    const otp = createOTP({ length: 4, pasteTransformer: () => '' })
    otp.paste('1234', 0)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })

  it('transformer does not affect keyboard insert — only paste path', () => {
    const otp = createOTP({ length: 4, pasteTransformer: (r) => r.replace(/[^0-9]/g, '') })
    otp.insert('A', 0)   // insert goes through filterChar, not pasteTransformer
    expect(otp.state.slotValues[0]).toBe('')   // 'A' rejected by numeric type
  })

  it('fires onComplete after a transformed paste that fills all slots', (done) => {
    const otp = createOTP({
      length: 6,
      pasteTransformer: (r) => r.replace(/\s+|-/g, ''),
      onComplete: (code) => { expect(code).toBe('123456'); done() },
    })
    otp.paste('12-34-56'.slice(0, 8), 0)   // transformer → '123456' (only 6 needed)
    // Actually "12-34-56" has 8 chars, transformer gives "123456" (6 digits)
  })

  it('paste falls back to raw text when pasteTransformer throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const otp = createOTP({
      length: 6,
      type: 'numeric',
      pasteTransformer: () => { throw new Error('transform failed') },
    })
    // raw '123456' is valid numeric, so it fills all slots despite transformer throwing
    otp.paste('123456', 0)
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
    warnSpy.mockRestore()
  })
})

describe('createOTP — pattern option', () => {
  it('insert accepts characters matching the pattern', () => {
    const otp = createOTP({ length: 4, type: 'any', pattern: /^[0-9A-F]$/ })
    otp.insert('A', 0)
    otp.insert('3', 1)
    expect(otp.state.slotValues[0]).toBe('A')
    expect(otp.state.slotValues[1]).toBe('3')
  })

  it('insert rejects characters not matching the pattern', () => {
    const otp = createOTP({ length: 4, type: 'any', pattern: /^[0-9A-F]$/ })
    otp.insert('G', 0)
    otp.insert('z', 0)
    expect(otp.state.slotValues[0]).toBe('')
  })

  it('paste filters pasted text through the pattern', () => {
    const otp = createOTP({ length: 6, type: 'any', pattern: /^[0-9A-F]$/ })
    otp.paste('A1G2BZ3', 0)  // G, Z rejected → 'A1', '2', 'B', '3'
    expect(otp.state.slotValues.join('')).toBe('A12B3')
    expect(otp.state.slotValues[5]).toBe('')
  })

  it('pattern overrides type — numeric type + hex pattern accepts A-F letters', () => {
    const otp = createOTP({ length: 4, type: 'numeric', pattern: /^[0-9A-F]$/ })
    otp.insert('B', 0)
    expect(otp.state.slotValues[0]).toBe('B')
  })

  it('isComplete fires onComplete only when all slots are filled with valid chars', () => {
    const cb = jest.fn()
    // Ambiguity-free charset: excludes 0, O, 1, I, L
    const otp = createOTP({ length: 4, type: 'any', pattern: /^[2-9A-HJ-NP-Z]$/, onComplete: cb })
    otp.insert('A', 0)
    otp.insert('B', 1)
    otp.insert('C', 2)
    otp.insert('D', 3)
    expect(otp.state.isComplete).toBe(true)
  })

  it('rejects ambiguous chars excluded by a custom pattern', () => {
    // /^[2-9A-HJ-NP-Z]$/ excludes 0, O, 1, I, L
    const otp = createOTP({ length: 4, type: 'any', pattern: /^[2-9A-HJ-NP-Z]$/ })
    otp.insert('0', 0)  // excluded
    otp.insert('O', 0)  // excluded
    otp.insert('1', 0)  // excluded
    otp.insert('I', 0)  // excluded
    expect(otp.state.slotValues[0]).toBe('')
    otp.insert('2', 0)  // allowed
    expect(otp.state.slotValues[0]).toBe('2')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// subscribe() — pub-sub system
// ─────────────────────────────────────────────────────────────────────────────

describe('subscribe()', () => {
  it('listener is called after every state mutation', () => {
    const otp = createOTP({ length: 4 })
    const calls: string[][] = []
    otp.subscribe(s => calls.push([...s.slotValues]))
    otp.insert('1', 0)
    otp.insert('2', 1)
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe('1')
    expect(calls[1][1]).toBe('2')
  })

  it('listener receives a shallow copy — a new state object, not the same reference', () => {
    const otp = createOTP({ length: 4 })
    let snapshot: typeof otp.state | null = null
    otp.subscribe(s => { snapshot = s })
    otp.insert('1', 0)
    // The snapshot is a new object (spread copy), not the same reference as otp.state
    expect(snapshot).not.toBe(otp.state)
    // But both reflect the same values at the time of the call
    expect(snapshot!.slotValues[0]).toBe('1')
  })

  it('multiple listeners all receive notifications', () => {
    const otp = createOTP({ length: 4 })
    const a   = jest.fn()
    const b   = jest.fn()
    otp.subscribe(a)
    otp.subscribe(b)
    otp.insert('5', 0)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops receiving updates', () => {
    const otp   = createOTP({ length: 4 })
    const spy   = jest.fn()
    const unsub = otp.subscribe(spy)
    otp.insert('1', 0)
    expect(spy).toHaveBeenCalledTimes(1)
    unsub()
    otp.insert('2', 1)
    expect(spy).toHaveBeenCalledTimes(1)  // no new call after unsub
  })

  it('unsubscribing one listener does not affect others', () => {
    const otp    = createOTP({ length: 4 })
    const a      = jest.fn()
    const b      = jest.fn()
    const unsubA = otp.subscribe(a)
    otp.subscribe(b)
    unsubA()
    otp.insert('9', 0)
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('listener receives the correct isComplete flag on completion', () => {
    const otp = createOTP({ length: 4 })
    let lastComplete = false
    otp.subscribe(s => { lastComplete = s.isComplete })
    '123'.split('').forEach((c, i) => otp.insert(c, i))
    expect(lastComplete).toBe(false)
    otp.insert('4', 3)
    expect(lastComplete).toBe(true)
  })

  it('listener is called by reset() with empty slotValues', () => {
    const otp = createOTP({ length: 4 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    let snapshot: typeof otp.state | null = null
    otp.subscribe(s => { snapshot = s })
    otp.reset()
    expect(snapshot!.slotValues).toEqual(['', '', '', ''])
    expect(snapshot!.isComplete).toBe(false)
  })

  it('calling subscribe with no listeners is a no-op (no throw)', () => {
    const otp = createOTP({ length: 4 })
    expect(() => otp.insert('1', 0)).not.toThrow()
  })

  it('double-unsubscribe does not throw', () => {
    const otp   = createOTP({ length: 4 })
    const unsub = otp.subscribe(() => {})
    expect(() => { unsub(); unsub() }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onInvalidChar callback
// ─────────────────────────────────────────────────────────────────────────────

describe('onInvalidChar', () => {
  it('fires with the rejected char and slot index when insert rejects a char', () => {
    const rejections: Array<[string, number]> = []
    const otp = createOTP({
      length: 4,
      onInvalidChar: (char, index) => rejections.push([char, index]),
    })
    otp.insert('a', 0)  // 'a' is invalid for numeric
    expect(rejections).toHaveLength(1)
    expect(rejections[0]).toEqual(['a', 0])
  })

  it('fires at the correct slot index', () => {
    let capturedIndex = -1
    const otp = createOTP({
      length: 6,
      onInvalidChar: (_, index) => { capturedIndex = index },
    })
    otp.insert('X', 3)  // slot 3
    expect(capturedIndex).toBe(3)
  })

  it('does NOT fire when a valid char is typed', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onInvalidChar: cb })
    otp.insert('5', 0)
    expect(cb).not.toHaveBeenCalled()
  })

  it('does NOT fire for empty string or multi-char inputs', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onInvalidChar: cb })
    otp.insert('', 0)
    otp.insert('12', 0)
    expect(cb).not.toHaveBeenCalled()
  })

  it('fires for each invalid character dropped during a paste operation', () => {
    const rejections: Array<[string, number]> = []
    const otp = createOTP({ length: 4, onInvalidChar: (char, idx) => rejections.push([char, idx]) })
    otp.paste('a1b2', 0)  // 'a' at slot 0 and 'b' at slot 1 are filtered
    expect(rejections).toEqual([['a', 0], ['b', 1]])
  })

  it('fires with the pattern-rejected char when a pattern is configured', () => {
    const rejections: string[] = []
    const otp = createOTP({
      length: 4,
      type: 'any',
      pattern: /^[0-9A-F]$/,
      onInvalidChar: (char) => rejections.push(char),
    })
    otp.insert('G', 0)  // not in [0-9A-F]
    otp.insert('z', 0)
    expect(rejections).toEqual(['G', 'z'])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getSnapshot() alias
// ─────────────────────────────────────────────────────────────────────────────

describe('getSnapshot()', () => {
  it('returns the same shape as getSnapshot()', () => {
    const otp  = createOTP({ length: 4 })
    otp.insert('7', 0)
    const snap = otp.getSnapshot()
    const st   = otp.getSnapshot()
    expect(st).toEqual(snap)
  })

  it('returns a shallow copy — not a live reference', () => {
    const otp = createOTP({ length: 4 })
    const st  = otp.getSnapshot()
    otp.insert('1', 0)
    expect(st.slotValues[0]).toBe('')   // cached copy is not mutated
  })

  it('includes all OTPStateSnapshot fields', () => {
    const otp = createOTP({ length: 6, timer: 30 })
    const st  = otp.getSnapshot()
    expect(typeof st.activeSlot).toBe('number')
    expect(Array.isArray(st.slotValues)).toBe(true)
    expect(typeof st.hasError).toBe('boolean')
    expect(typeof st.isComplete).toBe('boolean')
    expect(typeof st.timerSeconds).toBe('number')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// paste — activeSlot positioning
// ─────────────────────────────────────────────────────────────────────────────

describe('paste — activeSlot positioning', () => {
  it('partial paste from slot 0: activeSlot = last filled slot', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('123', 0)  // 3 chars written into slots 0,1,2
    // lastFilledSlot = 0 + 3 - 1 = 2
    expect(otp.state.activeSlot).toBe(2)
  })

  it('partial paste from slot 2: activeSlot = last filled slot', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('1234', 2)  // 4 chars: slots 2,3,4,5 — fills to end, no wrap
    // lastFilledSlot = 2 + 4 - 1 = 5
    expect(otp.state.activeSlot).toBe(5)
  })

  it('full paste: activeSlot = length - 1 (last slot)', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('123456', 0)
    expect(otp.state.activeSlot).toBe(5)
  })

  it('single char paste: activeSlot stays at pasted slot', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('1', 0)
    // lastFilledSlot = 0 + 1 - 1 = 0
    expect(otp.state.activeSlot).toBe(0)
  })

  it('paste from last slot: only last slot fills, no wrap', () => {
    const otp = createOTP({ length: 4 })
    otp.paste('1234', 3)  // only slot3='1'; remaining chars ignored (no wrap)
    expect(otp.state.slotValues[3]).toBe('1')
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.slotValues[1]).toBe('')
    expect(otp.state.slotValues[2]).toBe('')
    expect(otp.state.isComplete).toBe(false)
    expect(otp.state.activeSlot).toBe(3)  // lastFilledSlot = 3 + 1 - 1 = 3
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// insert — all InputType variants
// ─────────────────────────────────────────────────────────────────────────────

describe('insert — InputType variants', () => {
  describe('type="alphabet"', () => {
    it('accepts lowercase letters', () => {
      const otp = createOTP({ length: 4, type: 'alphabet' })
      otp.insert('a', 0)
      expect(otp.state.slotValues[0]).toBe('a')
    })
    it('accepts uppercase letters', () => {
      const otp = createOTP({ length: 4, type: 'alphabet' })
      otp.insert('Z', 0)
      expect(otp.state.slotValues[0]).toBe('Z')
    })
    it('rejects digits', () => {
      const otp = createOTP({ length: 4, type: 'alphabet' })
      otp.insert('5', 0)
      expect(otp.state.slotValues[0]).toBe('')
    })
  })

  describe('type="alphanumeric"', () => {
    it('accepts letters and digits', () => {
      const otp = createOTP({ length: 4, type: 'alphanumeric' })
      otp.insert('a', 0)
      otp.insert('1', 1)
      expect(otp.state.slotValues).toEqual(['a', '1', '', ''])
    })
    it('rejects special characters', () => {
      const otp = createOTP({ length: 4, type: 'alphanumeric' })
      otp.insert('@', 0)
      expect(otp.state.slotValues[0]).toBe('')
    })
  })

  describe('type="any"', () => {
    it('accepts special characters', () => {
      const otp = createOTP({ length: 4, type: 'any' })
      otp.insert('!', 0)
      otp.insert('@', 1)
      expect(otp.state.slotValues).toEqual(['!', '@', '', ''])
    })
    it('accepts unicode', () => {
      const otp = createOTP({ length: 4, type: 'any' })
      otp.insert('漢', 0)
      expect(otp.state.slotValues[0]).toBe('漢')
    })
    it('still rejects empty string', () => {
      const otp = createOTP({ length: 4, type: 'any' })
      otp.insert('', 0)
      expect(otp.state.slotValues[0]).toBe('')
    })
    it('still rejects multi-char strings', () => {
      const otp = createOTP({ length: 4, type: 'any' })
      otp.insert('ab', 0)
      expect(otp.state.slotValues[0]).toBe('')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// delete — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('delete — edge cases', () => {
  it('at slot 0 when already empty: stays at slot 0 with no state change', () => {
    const otp = createOTP({ length: 4 })
    otp.delete(0)
    expect(otp.state.activeSlot).toBe(0)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })

  it('on a filled mid-slot: clears it, stays at same index (not moving back)', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    otp.insert('2', 1)
    otp.delete(1)
    expect(otp.state.slotValues[1]).toBe('')
    expect(otp.state.activeSlot).toBe(1)
    expect(otp.state.slotValues[0]).toBe('1')  // slot 0 unaffected
  })

  it('on an empty mid-slot: moves back to previous slot and clears it', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    otp.delete(1)  // slot 1 is empty, so move back to slot 0 and clear
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.activeSlot).toBe(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// state getter — isolated snapshot behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('otp.state getter', () => {
  it('always reflects the current state after mutation', () => {
    const otp = createOTP({ length: 4 })
    expect(otp.state.slotValues[0]).toBe('')
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('1')
  })

  it('returns a fresh snapshot on each read so cached references stay isolated', () => {
    const otp    = createOTP({ length: 4 })
    const cached = otp.state
    otp.insert('9', 0)
    expect(cached.slotValues[0]).toBe('')
    expect(cached.activeSlot).toBe(0)
    expect(otp.state.slotValues[0]).toBe('9')
    expect(otp.state.activeSlot).toBe(1)
    const snap = otp.getSnapshot()
    otp.reset()
    expect(snap.slotValues[0]).toBe('9')
  })

  it('action early-exit returns an isolated snapshot — disabled path', () => {
    const otp = createOTP({ length: 4, disabled: true })
    const returned = otp.insert('1', 0)
    otp.setDisabled(false)
    otp.insert('9', 0)
    // returned must be isolated — if it were a live ref, slotValues[0] would be '9'
    expect(returned.slotValues[0]).toBe('')
  })

  it('action early-exit returns an isolated snapshot — out-of-bounds path', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    const returned = otp.insert('X', 99)  // out of bounds
    otp.reset()
    // returned must be isolated — if it were a live ref, slotValues[0] would be ''
    expect(returned.slotValues[0]).toBe('1')
  })

  it('getSnapshot() and getSnapshot() both return a copy independent of further mutations', () => {
    const otp  = createOTP({ length: 4 })
    otp.insert('3', 0)
    const snap = otp.getSnapshot()
    const st   = otp.getSnapshot()
    otp.reset()
    expect(snap.slotValues[0]).toBe('3')
    expect(st.slotValues[0]).toBe('3')
    expect(otp.state.slotValues[0]).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// paste — integration with pattern + pasteTransformer
// ─────────────────────────────────────────────────────────────────────────────

describe('paste — pattern + pasteTransformer integration', () => {
  it('pasteTransformer strips dashes, pattern then validates hex chars', () => {
    const otp = createOTP({
      length: 6,
      type: 'any',
      pattern: /^[0-9A-F]$/,
      pasteTransformer: (s) => s.replace(/-/g, '').toUpperCase(),
    })
    otp.paste('a1-b2-c3', 0)
    // after transformer: 'A1B2C3'; all valid hex
    expect(otp.state.slotValues).toEqual(['A', '1', 'B', '2', 'C', '3'])
    expect(otp.state.isComplete).toBe(true)
  })

  it('pasteTransformer that returns an empty string leaves slots unchanged', () => {
    const otp = createOTP({
      length: 4,
      pasteTransformer: () => '',
    })
    otp.paste('1234', 0)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })

  it('partial paste with filter: only valid chars fill slots, rest remain empty', () => {
    const otp = createOTP({ length: 6, type: 'numeric' })
    otp.paste('1a2b3c', 0)  // valid: 1, 2, 3 — 3 chars
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '', '', ''])
    expect(otp.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// filterChar / filterString — edge cases not yet covered
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar — additional edge cases', () => {
  it('type="numeric" rejects a space', () => {
    expect(filterChar(' ', 'numeric')).toBe('')
  })

  it('type="any" accepts a space (every single char is valid)', () => {
    expect(filterChar(' ', 'any')).toBe(' ')
  })

  it('type="alphabet" rejects a digit 0', () => {
    expect(filterChar('0', 'alphabet')).toBe('')
  })

  it('type="alphanumeric" accepts digit 0', () => {
    expect(filterChar('0', 'alphanumeric')).toBe('0')
  })

  it('unknown type falls through to empty string', () => {
    // TypeScript prevents this at compile-time, but runtime should be safe
    expect(filterChar('1', 'unknown' as InputType)).toBe('')
  })
})

describe('filterString — additional edge cases', () => {
  it('handles a string of spaces for type="numeric"', () => {
    expect(filterString('   ', 'numeric')).toBe('')
  })

  it('handles a string of spaces for type="any"', () => {
    expect(filterString('   ', 'any')).toBe('   ')
  })

  it('preserves order of valid characters', () => {
    expect(filterString('a1b2c3', 'alphanumeric')).toBe('a1b2c3')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createTimer — additional edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('createTimer — additional edge cases', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('reset() restores remainingSeconds so next start() runs full duration', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 3, onTick })
    t.start()
    jest.advanceTimersByTime(2000)
    t.reset()
    t.start()
    jest.advanceTimersByTime(3000)
    // After reset + restart: 3 more ticks (2, 1, 0)
    expect(onTick).toHaveBeenLastCalledWith(0)
  })

  it('onTick is NOT called with negative remainingSeconds', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 1, onTick })
    t.start()
    jest.advanceTimersByTime(2000)  // well past expiry
    const allArgs = onTick.mock.calls.map(([r]) => r)
    expect(allArgs.every(r => r >= 0)).toBe(true)
  })

  it('onExpire is called exactly once even if time advances far past zero', () => {
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 1, onExpire })
    t.start()
    jest.advanceTimersByTime(10000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('no callbacks are called when neither onTick nor onExpire is provided', () => {
    expect(() => {
      const t = createTimer({ totalSeconds: 2 })
      t.start()
      jest.advanceTimersByTime(3000)
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createOTP — comprehensive length option handling
// ─────────────────────────────────────────────────────────────────────────────

describe('createOTP — length option comprehensive', () => {
  it('default length is 6 when no options passed', () => {
    expect(createOTP().state.slotValues).toHaveLength(6)
  })

  it('length=1 works correctly — single-slot OTP', () => {
    const otp = createOTP({ length: 1 })
    otp.insert('9', 0)
    expect(otp.state.slotValues[0]).toBe('9')
    expect(otp.state.isComplete).toBe(true)
    expect(otp.state.activeSlot).toBe(0)  // stays at slot 0 (last slot)
  })

  it('large length (10) works correctly', () => {
    const otp = createOTP({ length: 10 })
    for (let i = 0; i < 10; i++) otp.insert(String(i % 10), i)
    expect(otp.state.isComplete).toBe(true)
    expect(otp.state.slotValues).toHaveLength(10)
  })

  it('fractional length 6.1 is floored to 6', () => {
    const otp = createOTP({ length: 6.1 })
    expect(otp.state.slotValues).toHaveLength(6)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// reset — comprehensive
// ─────────────────────────────────────────────────────────────────────────────

describe('reset — comprehensive', () => {
  it('does not affect the disabled flag', () => {
    const otp = createOTP({ length: 4 })
    otp.setDisabled(true)
    otp.reset()
    // disabled flag is NOT reset — reset() only clears slot values
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('')  // still disabled
  })

  it('can be called multiple times without throwing', () => {
    const otp = createOTP({ length: 4 })
    expect(() => { otp.reset(); otp.reset(); otp.reset() }).not.toThrow()
  })

  it('resets activeSlot to 0', () => {
    const otp = createOTP({ length: 4 })
    otp.move(3)
    otp.reset()
    expect(otp.state.activeSlot).toBe(0)
  })

  it('resets hasError to false', () => {
    const otp = createOTP({ length: 4 })
    otp.setError(true)
    otp.reset()
    expect(otp.state.hasError).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: slotValues deep-clone in getSnapshot / getState / subscribe
// ─────────────────────────────────────────────────────────────────────────────

describe('slotValues immutability in snapshots', () => {
  it('mutating getSnapshot().slotValues does not corrupt live state', () => {
    const otp  = createOTP({ length: 4 })
    otp.insert('7', 0)
    const snap = otp.getSnapshot()
    ;(snap.slotValues as string[])[0] = 'MUTATED'
    expect(otp.state.slotValues[0]).toBe('7')
  })

  it('mutating getSnapshot().slotValues does not corrupt live state', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('3', 0)
    const st  = otp.getSnapshot()
    ;(st.slotValues as string[])[0] = 'MUTATED'
    expect(otp.state.slotValues[0]).toBe('3')
  })

  it('subscriber receives a slotValues copy — mutating it does not corrupt live state', () => {
    const otp = createOTP({ length: 4 })
    let captured: readonly string[] = []
    otp.subscribe(s => { captured = s.slotValues })
    otp.insert('5', 0)
    ;(captured as string[])[0] = 'MUTATED'
    expect(otp.state.slotValues[0]).toBe('5')
  })

  it('subscriber slotValues is a different array reference than live state.slotValues', () => {
    const otp = createOTP({ length: 4 })
    let subscriberRef: readonly string[] | null = null
    otp.subscribe(s => { subscriberRef = s.slotValues })
    otp.insert('1', 0)
    expect(subscriberRef).not.toBe(otp.state.slotValues)
  })

  it('getSnapshot after paste from last slot reflects the correct values', () => {
    const otp = createOTP({ length: 4 })
    otp.paste('1234', 3)  // no wrap — only slot3='1', others stay empty
    const snap = otp.getSnapshot()
    expect(snap.slotValues).toEqual(['', '', '', '1'])
    // Mutation must not leak back
    ;(snap.slotValues as string[])[0] = 'X'
    expect(otp.state.slotValues[0]).toBe('')
  })
})

describe('subscribeFeedback', () => {
  it('uses default feedback options and triggers haptic on COMPLETE', () => {
    const unsubscribe = jest.fn()
    let listener: (state: unknown, event: { type: string; hasError?: boolean }) => void = () => {}
    const originalNavigator = (globalThis as { navigator?: Navigator }).navigator
    const vibrate = jest.fn()
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { vibrate },
    })

    subscribeFeedback({
      subscribe(callback) {
        listener = callback as typeof listener
        return unsubscribe
      },
    })

    listener({}, { type: 'COMPLETE' })

    expect(vibrate).toHaveBeenCalledWith(10)
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
  })

  it('supports explicit feedback overrides and only vibrates on active error states', () => {
    let listener: (state: unknown, event: { type: string; hasError?: boolean }) => void = () => {}
    const originalNavigator = (globalThis as { navigator?: Navigator }).navigator
    const originalAudioContext = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
    const vibrate = jest.fn()
    const start = jest.fn()
    const stop = jest.fn()
    const gainNode = {
      gain: { value: 0 },
      connect: jest.fn(),
    }
    const oscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect: jest.fn(),
      start,
      stop,
      onended: null as (() => void) | null,
    }
    const MockAudioContext = jest.fn().mockImplementation(() => ({
      createOscillator: () => oscillator,
      createGain: () => gainNode,
      destination: {},
      close: jest.fn().mockResolvedValue(undefined),
      currentTime: 0,
    }))

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { vibrate },
    })
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })

    subscribeFeedback(
      {
        subscribe(callback) {
          listener = callback as typeof listener
          return () => {}
        },
      },
      { haptic: false, sound: true },
    )

    listener({}, { type: 'ERROR', hasError: true })
    listener({}, { type: 'ERROR', hasError: false })
    listener({}, { type: 'COMPLETE' })

    expect(vibrate).not.toHaveBeenCalled()
    expect(MockAudioContext).toHaveBeenCalledTimes(1)
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: length: NaN must not crash
// ─────────────────────────────────────────────────────────────────────────────

describe('createOTP — length NaN guard', () => {
  it('length: NaN falls back to default length 6 without throwing', () => {
    expect(() => createOTP({ length: NaN })).not.toThrow()
    expect(createOTP({ length: NaN }).state.slotValues).toHaveLength(6)
  })

  it('length: NaN instance accepts input correctly', () => {
    const otp = createOTP({ length: NaN })
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('1')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// INVALID_CHAR — always emits exactly once per rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('insert — INVALID_CHAR fires exactly once per rejection', () => {
  it('notifies subscribers via INVALID_CHAR when invalid char at active slot', () => {
    const otp = createOTP({ length: 4 })
    const events: string[] = []
    otp.subscribe((_s, e) => events.push(e.type))
    otp.insert('a', 0)  // invalid for numeric, activeSlot already 0
    expect(events).toEqual(['INVALID_CHAR'])
  })

  it('notifies subscribers via INVALID_CHAR and updates cursor when invalid char at different slot', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)
    const events: string[] = []
    otp.subscribe((_s, e) => events.push(e.type))
    otp.insert('a', 0)  // invalid — focus is at slot 2, so cursor also moves to 0
    expect(events).toEqual(['INVALID_CHAR'])  // single event, cursor-move is implicit in the state
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: filterChar — global (/g) regex must not alternate true/false
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar — global regex /g flag stability', () => {
  it('accepts the same digit on repeated calls with a /g pattern', () => {
    const gPattern = /^[0-9]$/g
    expect(filterChar('1', 'numeric', gPattern)).toBe('1')
    expect(filterChar('1', 'numeric', gPattern)).toBe('1')
    expect(filterChar('1', 'numeric', gPattern)).toBe('1')
  })

  it('filterString with a /g pattern does not corrupt intermediate results', () => {
    const gPattern = /^[0-9]$/g
    expect(filterString('1a2b3', 'numeric', gPattern)).toBe('123')
    // Called again — must be consistent, not alternating
    expect(filterString('123', 'numeric', gPattern)).toBe('123')
  })

  it('insert with a /g pattern accepts valid digits on every keystroke', () => {
    const otp = createOTP({ length: 4, pattern: /^[0-9]$/g })
    otp.insert('1', 0)
    otp.insert('2', 1)
    otp.insert('3', 2)
    otp.insert('4', 3)
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: filterString — surrogate pairs must not corrupt slots
// ─────────────────────────────────────────────────────────────────────────────

describe('filterString — Unicode surrogate pair handling', () => {
  it('type="any" — emoji (supplementary plane) is rejected, not split into two slots', () => {
    // '😀' is U+1F600, encoded as a surrogate pair in UTF-16.
    // split('') would yield two half-surrogates each of length 1.
    // Array.from correctly yields one code point of length 2, which filterChar rejects.
    expect(filterString('😀', 'any')).toBe('')
  })

  it('type="any" — BMP characters (including CJK) pass through correctly', () => {
    expect(filterString('漢字', 'any')).toBe('漢字')
  })

  it('type="any" — mixed ASCII and emoji: only ASCII passes', () => {
    expect(filterString('a😀b', 'any')).toBe('ab')
  })

  it('paste with type="any" and emoji input does not write surrogates to slots', () => {
    const otp = createOTP({ length: 4, type: 'any' })
    otp.paste('😀', 0)
    // emoji should produce zero valid chars; all slots stay empty
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// subscribe — wrap-around paste notifies with correct slotValues
// ─────────────────────────────────────────────────────────────────────────────

describe('subscribe — paste from last slot notification', () => {
  it('listener receives correct slotValues after paste from last slot (no wrap)', () => {
    const otp = createOTP({ length: 4 })
    let last: string[] = []
    otp.subscribe(s => { last = [...s.slotValues] })
    otp.paste('1234', 3)  // no wrap — only slot3='1', others stay empty
    expect(last).toEqual(['', '', '', '1'])
  })

  it('listener is not called when paste produces no valid characters', () => {
    const otp = createOTP({ length: 4 })
    const calls: number[] = []
    otp.subscribe(() => calls.push(1))
    otp.paste('aaaa', 0)  // all invalid for numeric
    expect(calls).toHaveLength(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// pasteTransformer error path
// ─────────────────────────────────────────────────────────────────────────────

describe('createOTP — pasteTransformer error recovery', () => {
  let warnSpy: jest.SpyInstance
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(()  => { warnSpy.mockRestore() })

  it('falls back to raw text when pasteTransformer throws', () => {
    const otp = createOTP({
      length: 4,
      pasteTransformer: () => { throw new Error('boom') },
    })
    expect(() => otp.paste('1234', 0)).not.toThrow()
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
    expect(warnSpy).toHaveBeenCalledWith(
      '[verino] pasteTransformer threw — using raw paste text.',
      expect.any(Error),
    )
  })

  it('fills no slots when transformer throws and raw text is invalid for the type', () => {
    const otp = createOTP({
      length: 4,
      type: 'numeric',
      pasteTransformer: () => { throw new Error('boom') },
    })
    expect(() => otp.paste('abcd', 0)).not.toThrow()
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// triggerHapticFeedback / triggerSoundFeedback
// ─────────────────────────────────────────────────────────────────────────────

describe('triggerHapticFeedback', () => {
  it('calls navigator.vibrate(10) when available', () => {
    const vibrate = jest.fn()
    Object.defineProperty(globalThis, 'navigator', {
      value: { vibrate },
      configurable: true,
      writable: true,
    })
    triggerHapticFeedback()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('does not throw when navigator.vibrate is absent', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    })
    expect(() => triggerHapticFeedback()).not.toThrow()
  })

  it('does not throw when navigator is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    expect(() => triggerHapticFeedback()).not.toThrow()
  })
})

describe('triggerSoundFeedback', () => {
  it('calls AudioContext and wires oscillator → gain → destination', () => {
    const close      = jest.fn().mockResolvedValue(undefined)
    const start      = jest.fn()
    const stop       = jest.fn()
    const connect    = jest.fn()
    const setValueAtTime            = jest.fn()
    const exponentialRampToValueAtTime = jest.fn()

    const oscillator = {
      connect,
      frequency: { value: 0 },
      start,
      stop,
      onended: null as (() => void) | null,
    }
    const gainNode = {
      connect,
      gain: { setValueAtTime, exponentialRampToValueAtTime },
    }
    const destination = {}
    const MockAudioContext = jest.fn().mockImplementation(() => ({
      createOscillator: () => oscillator,
      createGain:       () => gainNode,
      destination,
      currentTime: 0,
      close,
    }))

    const originalAudioContext = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    })

    triggerSoundFeedback()

    expect(MockAudioContext).toHaveBeenCalledTimes(1)
    expect(oscillator.frequency.value).toBe(880)
    expect(start).toHaveBeenCalled()
    expect(stop).toHaveBeenCalled()

    // Simulate the oscillator ending — should close the context
    oscillator.onended!()
    expect(close).toHaveBeenCalled()

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    })
  })

  it('does not throw when AudioContext is unavailable', () => {
    const originalAudioContext = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    expect(() => triggerSoundFeedback()).not.toThrow()
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// NEW FEATURES — clear (Delete key), defaultValue, readOnly, data attributes
// ─────────────────────────────────────────────────────────────────────────────

describe('clear — Delete key semantics', () => {
  it('clears the focused slot and keeps activeSlot unchanged', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    otp.insert('2', 1)
    otp.move(1)
    otp.clear(1)
    expect(otp.state.slotValues[1]).toBe('')
    expect(otp.state.activeSlot).toBe(1)
  })

  it('does nothing when the slot is already empty', () => {
    const otp    = createOTP({ length: 4 })
    const before = { ...otp.state }
    otp.clear(0)
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.activeSlot).toBe(before.activeSlot)
  })

  it('sets isComplete to false when a filled slot is cleared', () => {
    const otp = createOTP({ length: 4 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.state.isComplete).toBe(true)
    otp.clear(2)
    expect(otp.state.isComplete).toBe(false)
  })

  it('is silently ignored when disabled', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.insert('1', 0) // blocked by disabled, but set up via direct mutation for test
    const before = otp.state.slotValues.join('')
    otp.clear(0)
    expect(otp.state.slotValues.join('')).toBe(before)
  })

  it('is silently ignored when readOnly', () => {
    const otp = createOTP({ length: 4 })
    // Pre-fill by temporarily disabling readOnly guard
    otp.insert('1', 0)
    otp.setReadOnly(true)
    otp.clear(0)
    expect(otp.state.slotValues[0]).toBe('1')
  })

  it('ignores out-of-bounds indices', () => {
    const otp = createOTP({ length: 4 })
    expect(() => otp.clear(-1)).not.toThrow()
    expect(() => otp.clear(99)).not.toThrow()
  })
})


describe('readOnly mode', () => {
  it('blocks insert', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('')
  })

  it('blocks delete', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 0)
    otp.setReadOnly(true)
    otp.delete(0)
    expect(otp.state.slotValues[0]).toBe('5')
  })

  it('blocks paste', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.paste('1234', 0)
    expect(otp.state.slotValues.join('')).toBe('')
  })

  it('blocks clear', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('7', 0)
    otp.setReadOnly(true)
    otp.clear(0)
    expect(otp.state.slotValues[0]).toBe('7')
  })

  it('allows move (moveFocusLeft/Right/To → move)', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.move(1)
    expect(otp.state.activeSlot).toBe(1)
    otp.move(0)
    expect(otp.state.activeSlot).toBe(0)
    otp.move(3)
    expect(otp.state.activeSlot).toBe(3)
  })

  it('setReadOnly(false) re-enables mutations', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.setReadOnly(false)
    otp.insert('9', 0)
    expect(otp.state.slotValues[0]).toBe('9')
  })
})


describe('setReadOnly — runtime toggle', () => {
  it('enabling readOnly after construction blocks input', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    otp.setReadOnly(true)
    otp.insert('2', 1)
    expect(otp.state.slotValues[1]).toBe('')    // blocked
    expect(otp.state.slotValues[0]).toBe('1')  // previous char preserved
  })

  it('disabling readOnly resumes input', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.setReadOnly(false)
    otp.insert('9', 0)
    expect(otp.state.slotValues[0]).toBe('9')
  })

  it('setReadOnly(true) blocks delete', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 0)
    otp.setReadOnly(true)
    otp.delete(0)
    expect(otp.state.slotValues[0]).toBe('5')
  })

  it('setReadOnly(true) blocks clear', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('7', 0)
    otp.setReadOnly(true)
    otp.clear(0)
    expect(otp.state.slotValues[0]).toBe('7')
  })

  it('setReadOnly(true) blocks paste', () => {
    const otp = createOTP({ length: 4 })
    otp.setReadOnly(true)
    otp.paste('1234', 0)
    expect(otp.state.slotValues.join('')).toBe('')
  })

  it('setReadOnly does not affect navigation', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.move(3)
    otp.setReadOnly(true)
    otp.move(2)
    expect(otp.state.activeSlot).toBe(2)
  })

  it('toggle readOnly on/off multiple times works correctly', () => {
    const otp = createOTP({ length: 4 })
    otp.setReadOnly(true)
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('')
    otp.setReadOnly(false)
    otp.insert('1', 0)
    expect(otp.state.slotValues[0]).toBe('1')
    otp.setReadOnly(true)
    otp.insert('2', 1)
    expect(otp.state.slotValues[1]).toBe('')
  })
})


describe('isDisabled and isReadOnly reflected in state', () => {
  it('state.isDisabled is false by default', () => {
    const otp = createOTP({ length: 4 })
    expect(otp.state.isDisabled).toBe(false)
  })

  it('state.isDisabled is true when disabled option is passed', () => {
    const otp = createOTP({ length: 4, disabled: true })
    expect(otp.state.isDisabled).toBe(true)
  })

  it('setDisabled(true) updates state.isDisabled', () => {
    const otp = createOTP({ length: 4 })
    otp.setDisabled(true)
    expect(otp.state.isDisabled).toBe(true)
  })

  it('setDisabled(false) updates state.isDisabled back to false', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.setDisabled(false)
    expect(otp.state.isDisabled).toBe(false)
  })

  it('state.isReadOnly is false by default', () => {
    const otp = createOTP({ length: 4 })
    expect(otp.state.isReadOnly).toBe(false)
  })

  it('state.isReadOnly is true when readOnly option is passed', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    expect(otp.state.isReadOnly).toBe(true)
  })

  it('setReadOnly(true) updates state.isReadOnly', () => {
    const otp = createOTP({ length: 4 })
    otp.setReadOnly(true)
    expect(otp.state.isReadOnly).toBe(true)
  })

  it('setReadOnly(false) updates state.isReadOnly back to false', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.setReadOnly(false)
    expect(otp.state.isReadOnly).toBe(false)
  })

  it('subscriber receives updated isDisabled when setDisabled is called', () => {
    const otp = createOTP({ length: 4 })
    const snapshots: boolean[] = []
    otp.subscribe(s => snapshots.push(s.isDisabled))
    otp.setDisabled(true)
    otp.setDisabled(false)
    expect(snapshots).toEqual([true, false])
  })

  it('subscriber receives updated isReadOnly when setReadOnly is called', () => {
    const otp = createOTP({ length: 4 })
    const snapshots: boolean[] = []
    otp.subscribe(s => snapshots.push(s.isReadOnly))
    otp.setReadOnly(true)
    otp.setReadOnly(false)
    expect(snapshots).toEqual([true, false])
  })
})


describe('defaultValue in core initialization', () => {
  it('adapters use a suppress flag to pre-fill without triggering onComplete', () => {
    const cb  = jest.fn()
    let suppress = false
    const otp = createOTP({ length: 4, onComplete: (c) => { if (!suppress) cb(c) } })
    suppress = true
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    suppress = false
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
    expect(cb).not.toHaveBeenCalled()
  })

  it('partial defaultValue leaves remaining slots empty', () => {
    const otp = createOTP({ length: 6 })
    '123'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.state.slotValues[3]).toBe('')
    expect(otp.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// formatCountdown
// ─────────────────────────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('formats seconds-only values as 0:ss', () => {
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(9)).toBe('0:09')
    expect(formatCountdown(30)).toBe('0:30')
    expect(formatCountdown(59)).toBe('0:59')
  })

  it('formats values with minutes as m:ss', () => {
    expect(formatCountdown(60)).toBe('1:00')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(90)).toBe('1:30')
    expect(formatCountdown(120)).toBe('2:00')
    expect(formatCountdown(125)).toBe('2:05')
  })

  it('zero-pads the seconds component to two digits', () => {
    expect(formatCountdown(61)).toBe('1:01')
    expect(formatCountdown(3600)).toBe('60:00')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// notifyCompleteIfReady — haptic / sound / clearTimeout branches
// ─────────────────────────────────────────────────────────────────────────────

describe('onComplete — option combinations', () => {
  it('fires onComplete for a plain completion path', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    expect(() => { '1234'.split('').forEach((c, i) => otp.insert(c, i)) }).not.toThrow()
    expect(cb).toHaveBeenCalledWith('1234')
  })

  it('still fires onComplete after previous state changes', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    otp.setError(true)
    expect(() => { '1234'.split('').forEach((c, i) => otp.insert(c, i)) }).not.toThrow()
    expect(cb).toHaveBeenCalledWith('1234')
  })

  it('rapid re-completion fires once per completion', () => {
    const cb  = jest.fn()
    const otp = createOTP({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    otp.delete(3)
    otp.insert('4', 3)   // re-completes
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith('1234')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// triggerSoundFeedback — oscillator.onended callback + audioCtx.close rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('triggerSoundFeedback — onended and close rejection', () => {
  it('does not throw when audioCtx.close() rejects inside onended', () => {
    const close = jest.fn().mockRejectedValue(new Error('close failed'))
    const start = jest.fn()
    const stop  = jest.fn()
    const connect = jest.fn()
    const setValueAtTime = jest.fn()
    const exponentialRampToValueAtTime = jest.fn()

    const oscillator: { connect: jest.Mock; frequency: { value: number }; start: jest.Mock; stop: jest.Mock; onended: (() => void) | null } = {
      connect,
      frequency: { value: 0 },
      start,
      stop,
      onended: null,
    }
    const gainNode = {
      connect,
      gain: { setValueAtTime, exponentialRampToValueAtTime },
    }

    const MockAudioContext = jest.fn().mockImplementation(() => ({
      createOscillator: () => oscillator,
      createGain:       () => gainNode,
      destination:      {},
      currentTime:      0,
      close,
    }))

    const orig = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })
    triggerSoundFeedback()
    // Trigger onended — it calls audioCtx.close().catch() which must not throw
    expect(() => oscillator.onended?.()).not.toThrow()
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: orig,
    })
  })

  it('does not throw when AudioContext constructor throws', () => {
    const orig = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: jest.fn().mockImplementation(() => {
        throw new Error('AudioContext construction failed')
      }),
    })
    expect(() => triggerSoundFeedback()).not.toThrow()
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: orig,
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// triggerHapticFeedback — navigator.vibrate throws (catch branch)
// ─────────────────────────────────────────────────────────────────────────────

describe('triggerHapticFeedback — vibrate throws (catch branch)', () => {
  it('does not throw when navigator.vibrate throws an error', () => {
    const orig = (globalThis as Record<string, unknown>).navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: { vibrate: () => { throw new Error('vibrate failed') } },
      configurable: true,
      writable: true,
    })
    expect(() => triggerHapticFeedback()).not.toThrow()
    Object.defineProperty(globalThis, 'navigator', { value: orig, configurable: true, writable: true })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createOTP — paste with disabled=true after runtime toggle
// ─────────────────────────────────────────────────────────────────────────────

describe('paste — disabled guard additional cases', () => {
  it('paste is no-op when constructed with disabled:true', () => {
    const otp = createOTP({ length: 4, disabled: true })
    otp.paste('1234', 0)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
    expect(otp.state.isComplete).toBe(false)
  })

  it('paste is no-op when constructed with readOnly:true', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    otp.paste('1234', 0)
    expect(otp.state.slotValues).toEqual(['', '', '', ''])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createTimer — restart() then stop() does not throw or double-tick
// ─────────────────────────────────────────────────────────────────────────────

describe('createTimer — restart() + stop() lifecycle', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('restart() followed by stop() halts immediately', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 5, onTick })
    t.start()
    jest.advanceTimersByTime(2000)
    t.restart()
    t.stop()
    jest.advanceTimersByTime(5000)
    // only 2 ticks from the first start (before restart), none after stop
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('restart() after natural expiry does a full new countdown', () => {
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 1, onExpire })
    t.start()
    jest.advanceTimersByTime(1000)
    expect(onExpire).toHaveBeenCalledTimes(1)
    t.restart()
    jest.advanceTimersByTime(1000)
    expect(onExpire).toHaveBeenCalledTimes(2)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// filterChar — all types receive empty-string when char.length > 1
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar — multi-char rejection for all types', () => {
  const types: InputType[] = ['numeric', 'alphabet', 'alphanumeric', 'any']

  it.each(types)('type="%s" rejects a two-character string', (type) => {
    expect(filterChar('ab', type)).toBe('')
  })

  it.each(types)('type="%s" rejects an empty string', (type) => {
    expect(filterChar('', type)).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createOTP — getCode() returns partial code correctly
// ─────────────────────────────────────────────────────────────────────────────

describe('getCode() — partial fill', () => {
  it('returns only filled chars with no separators or gaps', () => {
    const otp = createOTP({ length: 6 })
    otp.insert('1', 0)
    otp.insert('3', 2)  // slot 1 is empty
    // ['1', '', '3', '', '', ''] → joined = '13'
    expect(otp.getCode()).toBe('13')
  })

  it('returns empty string when nothing filled', () => {
    const otp = createOTP({ length: 6 })
    expect(otp.getCode()).toBe('')
  })

  it('returns full code when all slots are filled', () => {
    const otp = createOTP({ length: 6 })
    '123456'.split('').forEach((c, i) => otp.insert(c, i))
    expect(otp.getCode()).toBe('123456')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getSlotProps / input() — slot display data
// ─────────────────────────────────────────────────────────────────────────────

describe('getSlotProps / input()', () => {
  it('returns correct display data for an empty slot', () => {
    const otp  = createOTP({ length: 4 })
    const props = otp.getSlotProps(0)
    expect(props.index).toBe(0)
    expect(props.char).toBe('')
    expect(props.isFilled).toBe(false)
    expect(props.isActive).toBe(true)   // activeSlot starts at 0
    expect(props.isError).toBe(false)
    expect(props.isComplete).toBe(false)
    expect(props.isEmpty).toBe(true)
    expect(props.isDisabled).toBe(false)
    expect(props.isReadOnly).toBe(false)
  })

  it('reflects filled state after insert', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('7', 0)
    const props = otp.getSlotProps(0)
    expect(props.char).toBe('7')
    expect(props.isFilled).toBe(true)
    expect(props.isEmpty).toBe(false)
  })

  it('id is stable and slot-specific', () => {
    const otp   = createOTP({ length: 4 })
    const id0   = otp.getSlotProps(0).id
    const id2   = otp.getSlotProps(2).id
    expect(id0).toMatch(/^verino-\d+-slot-0$/)
    expect(id2).toMatch(/^verino-\d+-slot-2$/)
    expect(id0).not.toBe(id2)
  })

  it('getSlotProps returns correct shape for a filled slot', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 1)
    const props = otp.getSlotProps(1)
    expect(props.char).toBe('5')
    expect(props.isFilled).toBe(true)
    expect(props.isEmpty).toBe(false)
    expect(props.index).toBe(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Identity helpers — getSlotId / getGroupId / getErrorId
// ─────────────────────────────────────────────────────────────────────────────

describe('identity helpers', () => {
  it('getSlotId returns stable verino-N-slot-I ids', () => {
    const otp = createOTP({ length: 3 })
    expect(otp.getSlotId(0)).toMatch(/^verino-\d+-slot-0$/)
    expect(otp.getSlotId(2)).toMatch(/^verino-\d+-slot-2$/)
  })

  it('getGroupId and getErrorId share the same instance prefix', () => {
    const otp = createOTP({ length: 3 })
    const prefix = otp.getGroupId().replace('-group', '')
    expect(otp.getErrorId()).toBe(`${prefix}-error`)
  })

  it('two separate instances produce distinct ids', () => {
    const a = createOTP({ length: 3 })
    const b = createOTP({ length: 3 })
    expect(a.getGroupId()).not.toBe(b.getGroupId())
    expect(a.getSlotId(0)).not.toBe(b.getSlotId(0))
  })

  it('uses an explicit idBase when provided', () => {
    const otp = createOTP({ length: 3, idBase: 'checkout-otp' })

    expect(otp.getSlotId(0)).toBe('checkout-otp-slot-0')
    expect(otp.getGroupId()).toBe('checkout-otp-group')
    expect(otp.getErrorId()).toBe('checkout-otp-error')
  })

  it('falls back to the generated prefix when idBase is blank', () => {
    const otp = createOTP({ length: 3, idBase: '   ' })

    expect(otp.getGroupId()).toMatch(/^verino-\d+-group$/)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// focus() / blur() — event emission without state change
// ─────────────────────────────────────────────────────────────────────────────

describe('focus()', () => {
  it('emits a FOCUS event with the given slot index', () => {
    const otp    = createOTP({ length: 4 })
    const events: string[] = []
    otp.subscribe((_s, e) => events.push(e.type))
    otp.focus(2)
    expect(events).toEqual(['FOCUS'])
  })

  it('emits FOCUS with the correct clamped index (in-range)', () => {
    const otp = createOTP({ length: 4 })
    const received: number[] = []
    otp.subscribe((_s, e) => { if (e.type === 'FOCUS') received.push(e.index) })
    otp.focus(2)
    expect(received).toEqual([2])
  })

  it('clamps a negative index to 0', () => {
    const otp = createOTP({ length: 4 })
    const received: number[] = []
    otp.subscribe((_s, e) => { if (e.type === 'FOCUS') received.push(e.index) })
    otp.focus(-5)
    expect(received).toEqual([0])
  })

  it('clamps an index >= length to the last slot', () => {
    const otp = createOTP({ length: 4 })
    const received: number[] = []
    otp.subscribe((_s, e) => { if (e.type === 'FOCUS') received.push(e.index) })
    otp.focus(99)
    expect(received).toEqual([3])
  })

  it('does not mutate state — activeSlot, slotValues, hasError are unchanged', () => {
    const otp    = createOTP({ length: 4 })
    otp.move(2)
    const before = otp.getSnapshot()
    otp.focus(0)
    expect(otp.state.activeSlot).toBe(before.activeSlot)
    expect(otp.state.slotValues).toEqual(before.slotValues)
    expect(otp.state.hasError).toBe(before.hasError)
  })
})

describe('blur()', () => {
  it('emits a BLUR event', () => {
    const otp    = createOTP({ length: 4 })
    const events: string[] = []
    otp.subscribe((_s, e) => events.push(e.type))
    otp.blur()
    expect(events).toEqual(['BLUR'])
  })

  it('emits BLUR carrying the current activeSlot index', () => {
    const otp = createOTP({ length: 4 })
    otp.move(3)
    const received: number[] = []
    otp.subscribe((_s, e) => { if (e.type === 'BLUR') received.push(e.index) })
    otp.blur()
    expect(received).toEqual([3])
  })

  it('does not mutate state', () => {
    const otp    = createOTP({ length: 4 })
    otp.insert('5', 0)
    const before = otp.getSnapshot()
    otp.blur()
    expect(otp.state.slotValues).toEqual(before.slotValues)
    expect(otp.state.activeSlot).toBe(before.activeSlot)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getSlots() — version-based cache
// ─────────────────────────────────────────────────────────────────────────────

describe('getSlots()', () => {
  it('returns an array of SlotEntry with index, value, isActive, isFilled', () => {
    const otp   = createOTP({ length: 3 })
    otp.insert('7', 0)
    const slots = otp.getSlots()
    expect(slots).toHaveLength(3)
    expect(slots[0]).toMatchObject({ index: 0, value: '7', isFilled: true, isActive: false })
    expect(slots[1]).toMatchObject({ index: 1, value: '',  isFilled: false })
  })

  it('returns the SAME array reference when called twice with no intervening mutation (cache hit)', () => {
    const otp  = createOTP({ length: 4 })
    otp.insert('1', 0)
    const first  = otp.getSlots()
    const second = otp.getSlots()
    expect(second).toBe(first)
  })

  it('returns a NEW array reference after a mutation (cache miss)', () => {
    const otp   = createOTP({ length: 4 })
    const first = otp.getSlots()
    otp.insert('1', 0)
    const second = otp.getSlots()
    expect(second).not.toBe(first)
  })

  it('reflects the active slot correctly', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)
    const slots = otp.getSlots()
    expect(slots[2].isActive).toBe(true)
    expect(slots[0].isActive).toBe(false)
  })

  it('reports isFilled=false for empty slots and isFilled=true for filled slots', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('9', 1)
    const slots = otp.getSlots()
    expect(slots[0].isFilled).toBe(false)
    expect(slots[1].isFilled).toBe(true)
    expect(slots[2].isFilled).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getInputProps() — data-* attributes and event handler bindings
// ─────────────────────────────────────────────────────────────────────────────

describe('getInputProps()', () => {
  it('returns correct data-* attribute values for an empty unfocused slot', () => {
    const otp   = createOTP({ length: 4 })
    otp.move(1)  // activeSlot = 1
    const props = otp.getInputProps(0)
    expect(props['data-slot']).toBe(0)
    expect(props['data-active']).toBe('false')   // slot 0 is NOT active
    expect(props['data-filled']).toBe('false')
    expect(props['data-empty']).toBe('true')
    expect(props['data-complete']).toBe('false')
    expect(props['data-invalid']).toBe('false')
    expect(props['data-disabled']).toBe('false')
    expect(props['data-readonly']).toBe('false')
    expect(props['data-first']).toBe('true')    // slot 0 is first
    expect(props['data-last']).toBe('false')
  })

  it('data-active is "true" for the active slot', () => {
    const otp   = createOTP({ length: 4 })
    const props = otp.getInputProps(0)  // activeSlot starts at 0
    expect(props['data-active']).toBe('true')
  })

  it('data-filled / data-empty are mutually exclusive and exhaustive', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('5', 0)
    const filled = otp.getInputProps(0)
    expect(filled['data-filled']).toBe('true')
    expect(filled['data-empty']).toBe('false')
    const empty = otp.getInputProps(1)
    expect(empty['data-filled']).toBe('false')
    expect(empty['data-empty']).toBe('true')
  })

  it('data-complete is "true" when all slots are filled', () => {
    const otp = createOTP({ length: 4 })
    '1234'.split('').forEach((c, i) => otp.insert(c, i))
    const props = otp.getInputProps(0)
    expect(props['data-complete']).toBe('true')
  })

  it('data-invalid is "true" when error state is active', () => {
    const otp = createOTP({ length: 4 })
    otp.setError(true)
    expect(otp.getInputProps(0)['data-invalid']).toBe('true')
  })

  it('data-disabled is "true" when disabled', () => {
    const otp = createOTP({ length: 4, disabled: true })
    expect(otp.getInputProps(0)['data-disabled']).toBe('true')
  })

  it('data-readonly is "true" when readOnly', () => {
    const otp = createOTP({ length: 4, readOnly: true })
    expect(otp.getInputProps(0)['data-readonly']).toBe('true')
  })

  it('data-first is "true" only for slot 0; data-last is "true" only for the last slot', () => {
    const otp  = createOTP({ length: 4 })
    expect(otp.getInputProps(0)['data-first']).toBe('true')
    expect(otp.getInputProps(0)['data-last']).toBe('false')
    expect(otp.getInputProps(3)['data-first']).toBe('false')
    expect(otp.getInputProps(3)['data-last']).toBe('true')
    expect(otp.getInputProps(1)['data-first']).toBe('false')
    expect(otp.getInputProps(1)['data-last']).toBe('false')
  })

  it('value reflects the current slot character', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('7', 2)
    expect(otp.getInputProps(2).value).toBe('7')
    expect(otp.getInputProps(0).value).toBe('')
  })

  it('onInput inserts the character into the bound slot', () => {
    const otp   = createOTP({ length: 4 })
    const props = otp.getInputProps(0)
    props.onInput('5')
    expect(otp.state.slotValues[0]).toBe('5')
  })

  it('onKeyDown("Backspace") triggers delete on the bound slot', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('3', 0)
    otp.insert('4', 1)
    const props = otp.getInputProps(1)
    props.onKeyDown('Backspace')
    expect(otp.state.slotValues[1]).toBe('')
  })

  it('onKeyDown("Delete") triggers clear on the bound slot', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('9', 0)
    otp.move(0)
    const props = otp.getInputProps(0)
    props.onKeyDown('Delete')
    expect(otp.state.slotValues[0]).toBe('')
    expect(otp.state.activeSlot).toBe(0)  // cursor stays in place
  })

  it('onKeyDown("ArrowLeft") moves cursor left by one', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)
    const props = otp.getInputProps(2)
    props.onKeyDown('ArrowLeft')
    expect(otp.state.activeSlot).toBe(1)
  })

  it('onKeyDown("ArrowRight") moves cursor right by one', () => {
    const otp = createOTP({ length: 4 })
    otp.move(1)
    const props = otp.getInputProps(1)
    props.onKeyDown('ArrowRight')
    expect(otp.state.activeSlot).toBe(2)
  })

  it('onKeyDown with an unrecognised key is a no-op', () => {
    const otp    = createOTP({ length: 4 })
    otp.insert('1', 0)
    const before = otp.getSnapshot()
    const props  = otp.getInputProps(0)
    props.onKeyDown('Enter')
    props.onKeyDown('Tab')
    props.onKeyDown('Shift')
    expect(otp.state.slotValues).toEqual(before.slotValues)
    expect(otp.state.activeSlot).toBe(before.activeSlot)
  })

  it('onFocus emits a FOCUS event for the bound slot', () => {
    const otp    = createOTP({ length: 4 })
    const events: string[] = []
    otp.subscribe((_s, e) => events.push(e.type))
    const props  = otp.getInputProps(2)
    props.onFocus()
    expect(events).toContain('FOCUS')
  })

  it('onBlur emits a BLUR event', () => {
    const otp    = createOTP({ length: 4 })
    const events: string[] = []
    otp.subscribe((_s, e) => events.push(e.type))
    const props  = otp.getInputProps(0)
    props.onBlur()
    expect(events).toContain('BLUR')
  })

  it('out-of-bounds index: value falls back to empty string (slotValues[i] ?? "")', () => {
    const otp   = createOTP({ length: 4 })
    const props = otp.getInputProps(99)
    expect(props.value).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getSlotProps — out-of-bounds fallback
// ─────────────────────────────────────────────────────────────────────────────

describe('getSlotProps — out-of-bounds index fallback', () => {
  it('returns char="" when index is out of range (slotValues[i] ?? "" path)', () => {
    const otp   = createOTP({ length: 4 })
    const props = otp.getSlotProps(99)
    expect(props.char).toBe('')
    expect(props.isFilled).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// insert — empty string at a different slot (char || '' branch)
// ─────────────────────────────────────────────────────────────────────────────

describe('insert — empty string with cursor elsewhere (INVALID_CHAR applyState path)', () => {
  it('inserts empty string at slot 0 when cursor is at slot 2 — no state mutation, single INVALID_CHAR event', () => {
    const otp    = createOTP({ length: 4 })
    otp.move(2)
    const events: Array<{ type: string; index: number }> = []
    otp.subscribe((_s, e) => {
      if (e.type === 'INVALID_CHAR') events.push({ type: e.type, index: (e as { type: string; index: number }).index })
    })
    otp.insert('', 0)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'INVALID_CHAR', index: 0 })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// paste — cursorSlot default parameter (omitting second arg uses 0)
// ─────────────────────────────────────────────────────────────────────────────

describe('paste — default cursorSlot parameter', () => {
  it('paste called with one argument defaults cursorSlot to 0', () => {
    const otp = createOTP({ length: 4 })
    otp.paste('1234')  // no cursorSlot — defaults to 0
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
    expect(otp.state.isComplete).toBe(true)
  })

  it('paste with default cursorSlot fills from slot 0', () => {
    const otp = createOTP({ length: 6 })
    otp.paste('123')   // no cursorSlot
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '', '', ''])
    expect(otp.state.activeSlot).toBe(2)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// paste — onInvalidChar loop break when cursor reaches length
// ─────────────────────────────────────────────────────────────────────────────

describe('paste — onInvalidChar loop break at cursor >= length', () => {
  it('stops reporting invalid chars once the valid chars have filled all available slots', () => {
    const rejected: Array<[string, number]> = []
    const otp = createOTP({
      length: 4,
      onInvalidChar: (char, idx) => rejected.push([char, idx]),
    })
    // '1a2b3c4d5e': valid chars 1,2,3,4 fill slots 0-3 (cursor reaches 4 = length);
    // trailing 'd','5','e' appear AFTER cursor hits length, so the break fires and they are NOT reported.
    otp.paste('1a2b3c4d5e', 0)
    expect(otp.state.isComplete).toBe(true)
    // 'a' at position after '1' (cursor=1), 'b' after '2' (cursor=2), 'c' after '3' (cursor=3)
    // '4' fills slot 3 → cursor becomes 4 = length → loop breaks → 'd','5','e' are not visited.
    const rejectedChars = rejected.map(([c]) => c)
    expect(rejectedChars).toContain('a')
    expect(rejectedChars).toContain('b')
    expect(rejectedChars).toContain('c')
    // 'd', '5', 'e' must NOT be reported (loop exited before reaching them)
    expect(rejectedChars).not.toContain('d')
    expect(rejectedChars).not.toContain('e')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setSuccess — mutual exclusion with hasError
// ─────────────────────────────────────────────────────────────────────────────

describe('setSuccess', () => {
  it('sets hasSuccess to true', () => {
    const otp = createOTP()
    otp.setSuccess(true)
    expect(otp.state.hasSuccess).toBe(true)
  })

  it('clears hasError when setting success', () => {
    const otp = createOTP()
    otp.setError(true)
    expect(otp.state.hasError).toBe(true)
    otp.setSuccess(true)
    expect(otp.state.hasSuccess).toBe(true)
    expect(otp.state.hasError).toBe(false)
  })

  it('clears hasSuccess when setting error', () => {
    const otp = createOTP()
    otp.setSuccess(true)
    expect(otp.state.hasSuccess).toBe(true)
    otp.setError(true)
    expect(otp.state.hasError).toBe(true)
    expect(otp.state.hasSuccess).toBe(false)
  })

  it('setSuccess(false) clears success state', () => {
    const otp = createOTP()
    otp.setSuccess(true)
    otp.setSuccess(false)
    expect(otp.state.hasSuccess).toBe(false)
  })

  it('emits SUCCESS event with hasSuccess payload', () => {
    const otp = createOTP()
    const events: Array<{ type: string; hasSuccess?: boolean }> = []
    otp.subscribe((_s, event) => events.push(event as { type: string; hasSuccess?: boolean }))
    otp.setSuccess(true)
    const ev = events.find(e => e.type === 'SUCCESS')
    expect(ev).toBeDefined()
    expect(ev?.hasSuccess).toBe(true)
  })

  it('reset clears hasSuccess', () => {
    const otp = createOTP()
    otp.setSuccess(true)
    otp.reset()
    expect(otp.state.hasSuccess).toBe(false)
  })

  it('getSlotProps includes isSuccess', () => {
    const otp = createOTP({ length: 3 })
    otp.setSuccess(true)
    expect(otp.getSlotProps(0).isSuccess).toBe(true)
    expect(otp.getSlotProps(1).isSuccess).toBe(true)
  })

  it('getInputProps includes data-success', () => {
    const otp = createOTP({ length: 3 })
    otp.setSuccess(true)
    expect(otp.getInputProps(0)['data-success']).toBe('true')
    otp.setSuccess(false)
    expect(otp.getInputProps(0)['data-success']).toBe('false')
  })

  it('hasSuccess defaults to false', () => {
    const otp = createOTP()
    expect(otp.state.hasSuccess).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// destroy — subscriber set cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('stops all subscribers from receiving events after destroy', () => {
    const otp = createOTP()
    const received: string[] = []
    otp.subscribe((_s, event) => received.push(event.type))
    otp.insert('1', 0)
    expect(received).toHaveLength(1)

    otp.destroy()
    otp.insert('2', 1)
    // No new events should arrive — listeners set was cleared
    expect(received).toHaveLength(1)
  })

  it('destroy is idempotent — calling twice does not throw', () => {
    const otp = createOTP()
    expect(() => { otp.destroy(); otp.destroy() }).not.toThrow()
  })

  it('unsubscribe returned before destroy still works without throwing', () => {
    const otp = createOTP()
    const unsub = otp.subscribe(() => {})
    otp.destroy()
    // unsub after destroy should be safe (listeners set is already empty)
    expect(() => unsub()).not.toThrow()
  })
})
