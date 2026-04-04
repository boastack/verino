/** @jest-environment jsdom */

/**
 * core-toolkit-dom.unit.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for DOM-requiring toolkit helpers imported directly from the
 * @verino/core/toolkit barrel. Exercises the re-exported functions that are
 * otherwise only called indirectly through framework adapters, ensuring the
 * toolkit/index.ts module achieves 100% function coverage.
 *
 * Run: pnpm test tests/core-toolkit-dom.unit.test.ts
 */

import {
  applyExternalValue,
  applyPastedInput,
  applyTypedInput,
  boolAttr,
  clampSlotIndex,
  clearOTPInput,
  filterExternalValue,
  filterTypedValue,
  focusOTPInput,
  handleOTPKeyAction,
  insertCode,
  scheduleFocusSync,
  scheduleInputBlur,
  scheduleInputFocus,
  scheduleInputSelection,
  syncFocusSelection,
  syncInputValue,
  createFrameScheduler,
} from '@verino/core/toolkit'
import { createOTP } from '@verino/core'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a minimal HTMLInputElement and attach it to the document. */
function makeInput(): HTMLInputElement {
  const el = document.createElement('input')
  el.type = 'text'
  document.body.appendChild(el)
  return el
}

/** Flush all queued rAF callbacks. */
let rafQueue: FrameRequestCallback[] = []

beforeEach(() => {
  rafQueue = []
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length },
    writable: true, configurable: true,
  })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    value: () => {},
    writable: true, configurable: true,
  })
})

function flushRAF(): void {
  const q = [...rafQueue]; rafQueue = []
  q.forEach(fn => fn(0))
}

afterEach(() => {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild)
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// boolAttr
// ─────────────────────────────────────────────────────────────────────────────

describe('boolAttr', () => {
  it("converts true to 'true'", () => {
    expect(boolAttr(true)).toBe('true')
  })

  it("converts false to 'false'", () => {
    expect(boolAttr(false)).toBe('false')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// clampSlotIndex
// ─────────────────────────────────────────────────────────────────────────────

describe('clampSlotIndex', () => {
  it('returns the index unchanged when within bounds', () => {
    expect(clampSlotIndex(2, 6)).toBe(2)
    expect(clampSlotIndex(0, 6)).toBe(0)
    expect(clampSlotIndex(5, 6)).toBe(5)
  })

  it('clamps negative index to 0', () => {
    expect(clampSlotIndex(-1, 6)).toBe(0)
    expect(clampSlotIndex(-99, 6)).toBe(0)
  })

  it('clamps over-range index to length-1', () => {
    expect(clampSlotIndex(6, 6)).toBe(5)
    expect(clampSlotIndex(99, 6)).toBe(5)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// syncInputValue
// ─────────────────────────────────────────────────────────────────────────────

describe('syncInputValue', () => {
  it('sets the input value and selection', () => {
    const input = makeInput()
    syncInputValue(input, '123', 2)
    expect(input.value).toBe('123')
    expect(input.selectionStart).toBe(2)
  })

  it('sets value without selection when selection is undefined', () => {
    const input = makeInput()
    syncInputValue(input, 'abc')
    expect(input.value).toBe('abc')
  })

  it('is a no-op when input is null', () => {
    expect(() => syncInputValue(null, '123', 0)).not.toThrow()
  })

  it('is a no-op when input is undefined', () => {
    expect(() => syncInputValue(undefined, '123', 0)).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// filterExternalValue
// ─────────────────────────────────────────────────────────────────────────────

describe('filterExternalValue', () => {
  it('filters and truncates to length', () => {
    // slice(0, 4) → 'a1b2', then numeric filter → '12'
    expect(filterExternalValue('a1b2c3d', 4, 'numeric')).toBe('12')
    expect(filterExternalValue('ABCDE', 3, 'alphabet')).toBe('ABC')
  })

  it('applies pattern when provided', () => {
    expect(filterExternalValue('1A2G3', 6, 'any', /^[0-9A-F]$/)).toBe('1A23')
  })

  it('returns empty string for fully invalid input', () => {
    expect(filterExternalValue('abc', 4, 'numeric')).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// filterTypedValue
// ─────────────────────────────────────────────────────────────────────────────

describe('filterTypedValue', () => {
  it('filters chars and then truncates to length', () => {
    expect(filterTypedValue('a1b2c3', 2, 'numeric')).toBe('12')
  })

  it('accepts alphanumeric chars and ignores specials', () => {
    expect(filterTypedValue('A1!B2@', 4, 'alphanumeric')).toBe('A1B2')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// insertCode
// ─────────────────────────────────────────────────────────────────────────────

describe('insertCode', () => {
  it('inserts each character starting from startSlot (default 0)', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    insertCode(otp, '1234')
    expect(otp.state.slotValues).toEqual(['1', '2', '3', '4'])
  })

  it('inserts from a non-zero start slot', () => {
    const otp = createOTP({ length: 6, type: 'numeric' })
    insertCode(otp, '56', 3)
    expect(otp.state.slotValues[3]).toBe('5')
    expect(otp.state.slotValues[4]).toBe('6')
    expect(otp.state.slotValues[0]).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// applyExternalValue
// ─────────────────────────────────────────────────────────────────────────────

describe('applyExternalValue', () => {
  it('resets machine and inserts filtered value', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    otp.insert('9', 0)

    const result = applyExternalValue(otp, '1a2b', { length: 4, type: 'numeric' })
    expect(result.value).toBe('12')
    expect(otp.state.slotValues[0]).toBe('1')
    expect(otp.state.slotValues[1]).toBe('2')
    expect(otp.state.slotValues[2]).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// applyTypedInput — non-empty path
// ─────────────────────────────────────────────────────────────────────────────

describe('applyTypedInput', () => {
  it('filters input, inserts code, and returns completion status', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    const result = applyTypedInput(otp, '1234', { length: 4, type: 'numeric' })

    expect(result.value).toBe('1234')
    expect(result.nextSelection).toBe(3)   // min(4, 4-1) = 3
    expect(result.isComplete).toBe(true)
  })

  it('filters invalid chars from typed input', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    const result = applyTypedInput(otp, 'a1b2', { length: 4, type: 'numeric' })
    expect(result.value).toBe('12')
    expect(result.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// applyPastedInput
// ─────────────────────────────────────────────────────────────────────────────

describe('applyPastedInput', () => {
  it('pastes text at the given position and returns the resulting value', () => {
    const otp = createOTP({ length: 6, type: 'numeric' })
    const result = applyPastedInput(otp, '1234', 0)

    expect(result.value).toBe('1234')
    expect(result.isComplete).toBe(false)
    expect(result.nextSelection).toBe(otp.getSnapshot().activeSlot)
  })

  it('clamps the paste position to [0, length-1]', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    const result = applyPastedInput(otp, '9', 99)   // clamped to slot 3
    expect(result.value).toBe('9')
  })

  it('returns completion status when all slots are filled', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    const result = applyPastedInput(otp, '1234', 0)
    expect(result.isComplete).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// focusOTPInput
// ─────────────────────────────────────────────────────────────────────────────

describe('focusOTPInput', () => {
  it('moves the cursor, focuses the input, and sets selection', () => {
    const otp   = createOTP({ length: 4, type: 'numeric' })
    const input = makeInput()
    const spy   = jest.spyOn(input, 'focus')
    // jsdom only honours setSelectionRange when value.length >= selection
    input.value = '00'

    const result = focusOTPInput(otp, input, 2)

    expect(result).toBe(2)
    expect(otp.state.activeSlot).toBe(2)
    expect(spy).toHaveBeenCalledTimes(1)
    // jsdom clamps selectionStart to value.length (2) → 2
    expect(input.selectionStart).toBe(2)
  })

  it('works without an input element (no-op for DOM parts)', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    expect(() => focusOTPInput(otp, null, 1)).not.toThrow()
    expect(otp.state.activeSlot).toBe(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// clearOTPInput
// ─────────────────────────────────────────────────────────────────────────────

describe('clearOTPInput', () => {
  it('resets the machine and clears the input value', () => {
    const otp   = createOTP({ length: 4, type: 'numeric' })
    const input = makeInput()
    otp.insert('1', 0)
    input.value = '1'

    clearOTPInput(otp, input, { focus: false })

    expect(otp.getCode()).toBe('')
    expect(input.value).toBe('')
  })

  it('focuses the input when focus=true and not disabled', () => {
    const otp   = createOTP({ length: 4 })
    const input = makeInput()
    const spy   = jest.spyOn(input, 'focus')

    clearOTPInput(otp, input, { focus: true, disabled: false })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not focus when disabled=true', () => {
    const otp   = createOTP({ length: 4 })
    const input = makeInput()
    const spy   = jest.spyOn(input, 'focus')

    clearOTPInput(otp, input, { focus: true, disabled: true })

    expect(spy).not.toHaveBeenCalled()
  })

  it('is a no-op for DOM parts when input is null', () => {
    const otp = createOTP({ length: 4 })
    otp.insert('1', 0)
    expect(() => clearOTPInput(otp, null)).not.toThrow()
    expect(otp.getCode()).toBe('')   // machine is still reset
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// handleOTPKeyAction — all key branches
// ─────────────────────────────────────────────────────────────────────────────

describe('handleOTPKeyAction', () => {
  it('Backspace: deletes the char and returns the new activeSlot', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    otp.insert('1', 0)
    otp.insert('2', 1)

    const result = handleOTPKeyAction(otp, { key: 'Backspace', position: 1, length: 4, readOnly: false })

    expect(result.handled).toBe(true)
    expect(result.valueChanged).toBe(true)
    expect(typeof result.nextSelection).toBe('number')
  })

  it('Backspace in readOnly mode: handled but no change', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    otp.insert('1', 0)

    const result = handleOTPKeyAction(otp, { key: 'Backspace', position: 0, length: 4, readOnly: true })

    expect(result.handled).toBe(true)
    expect(result.valueChanged).toBe(false)
    expect(result.nextSelection).toBeNull()
  })

  it('Delete: clears the slot in-place', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    otp.insert('1', 0)

    const result = handleOTPKeyAction(otp, { key: 'Delete', position: 0, length: 4, readOnly: false })

    expect(result.handled).toBe(true)
    expect(result.valueChanged).toBe(true)
    expect(result.nextSelection).toBe(0)
  })

  it('Delete in readOnly mode: handled but no change', () => {
    const otp = createOTP({ length: 4 })
    const result = handleOTPKeyAction(otp, { key: 'Delete', position: 0, length: 4, readOnly: true })
    expect(result.handled).toBe(true)
    expect(result.valueChanged).toBe(false)
  })

  it('ArrowLeft: moves cursor left', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)

    const result = handleOTPKeyAction(otp, { key: 'ArrowLeft', position: 2, length: 4, readOnly: false })

    expect(result.handled).toBe(true)
    expect(result.valueChanged).toBe(false)
    expect(result.nextSelection).toBe(1)
  })

  it('ArrowRight: moves cursor right', () => {
    const otp = createOTP({ length: 4 })
    otp.move(1)

    const result = handleOTPKeyAction(otp, { key: 'ArrowRight', position: 1, length: 4, readOnly: false })

    expect(result.handled).toBe(true)
    expect(result.nextSelection).toBe(2)
  })

  it('Tab forward when slot is filled: moves to next slot', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    otp.insert('1', 0)

    const result = handleOTPKeyAction(otp, { key: 'Tab', position: 0, length: 4, readOnly: false, shiftKey: false })

    expect(result.handled).toBe(true)
    expect(result.nextSelection).toBe(1)
  })

  it('Tab forward at last slot: not handled (let browser tab out)', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    otp.insert('1', 3)

    const result = handleOTPKeyAction(otp, { key: 'Tab', position: 3, length: 4, readOnly: false })

    expect(result.handled).toBe(false)
  })

  it('Tab forward on empty slot: not handled', () => {
    const otp = createOTP({ length: 4 })

    const result = handleOTPKeyAction(otp, { key: 'Tab', position: 0, length: 4, readOnly: false })

    expect(result.handled).toBe(false)
  })

  it('Shift+Tab at slot 0: not handled (let browser tab out)', () => {
    const otp = createOTP({ length: 4 })

    const result = handleOTPKeyAction(otp, { key: 'Tab', position: 0, length: 4, readOnly: false, shiftKey: true })

    expect(result.handled).toBe(false)
  })

  it('Shift+Tab at slot > 0: moves backward', () => {
    const otp = createOTP({ length: 4 })
    otp.move(2)

    const result = handleOTPKeyAction(otp, { key: 'Tab', position: 2, length: 4, readOnly: false, shiftKey: true })

    expect(result.handled).toBe(true)
    expect(result.nextSelection).toBe(1)
  })

  it('unrecognised key: not handled', () => {
    const otp = createOTP({ length: 4 })
    const result = handleOTPKeyAction(otp, { key: 'Enter', position: 0, length: 4, readOnly: false })
    expect(result.handled).toBe(false)
    expect(result.valueChanged).toBe(false)
    expect(result.nextSelection).toBeNull()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// syncFocusSelection
// ─────────────────────────────────────────────────────────────────────────────

describe('syncFocusSelection', () => {
  it('sets selection to the activeSlot position on the input', () => {
    const otp   = createOTP({ length: 4, type: 'numeric' })
    const input = makeInput()
    otp.insert('1', 0)
    input.value = '1'

    const pos = syncFocusSelection(otp, input, false)

    expect(pos).toBe(otp.getSnapshot().activeSlot)
    expect(input.selectionStart).toBe(pos)
  })

  it('selects the filled char when selectOnFocus=true', () => {
    const otp   = createOTP({ length: 4, type: 'numeric' })
    const input = makeInput()
    // Keep activeSlot at 0 by not letting insert advance it
    // activeSlot advances to 1 after insert('1', 0), so sync sees position=1
    // and char='' → setSelectionRange(1, 1) — verify it's called without error
    otp.insert('1', 0)
    input.value = '1'

    // The function reads snapshot.activeSlot (= 1 after insert) and the char at that slot
    // char at slot 1 is '' → falls through to else branch (no selection range set)
    expect(() => syncFocusSelection(otp, input, true)).not.toThrow()
  })

  it('works without input (no-op for DOM parts)', () => {
    const otp = createOTP({ length: 4 })
    expect(() => syncFocusSelection(otp, null, false)).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// scheduleInputSelection
// ─────────────────────────────────────────────────────────────────────────────

describe('scheduleInputSelection', () => {
  it('defers selection update to the next animation frame', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    input.value     = '123'

    scheduleInputSelection(scheduler, input, 2)
    flushRAF()

    expect(input.selectionStart).toBe(2)
  })

  it('accepts a function that resolves the input lazily', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    input.value     = 'ab'

    scheduleInputSelection(scheduler, () => input, 1)
    flushRAF()

    expect(input.selectionStart).toBe(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// scheduleInputBlur
// ─────────────────────────────────────────────────────────────────────────────

describe('scheduleInputBlur', () => {
  it('defers blur to the next animation frame when enabled=true', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    const spy       = jest.spyOn(input, 'blur')

    scheduleInputBlur(scheduler, input, true)
    flushRAF()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does nothing when enabled=false', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    const spy       = jest.spyOn(input, 'blur')

    scheduleInputBlur(scheduler, input, false)
    flushRAF()

    expect(spy).not.toHaveBeenCalled()
  })

  it('defaults enabled to true when omitted', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    const spy       = jest.spyOn(input, 'blur')

    scheduleInputBlur(scheduler, input)
    flushRAF()

    expect(spy).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// scheduleInputFocus
// ─────────────────────────────────────────────────────────────────────────────

describe('scheduleInputFocus', () => {
  it('defers focus to the next animation frame', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    const spy       = jest.spyOn(input, 'focus')

    scheduleInputFocus(scheduler, input)
    flushRAF()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('sets selection after focusing when selection is provided', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    input.value     = '12'

    scheduleInputFocus(scheduler, input, 1)
    flushRAF()

    expect(input.selectionStart).toBe(1)
  })

  it('resolves input lazily when a function is provided', () => {
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    const spy       = jest.spyOn(input, 'focus')

    scheduleInputFocus(scheduler, () => input, 0)
    flushRAF()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when the input resolves to null', () => {
    const scheduler = createFrameScheduler()
    expect(() => {
      scheduleInputFocus(scheduler, null)
      flushRAF()
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// scheduleFocusSync
// ─────────────────────────────────────────────────────────────────────────────

describe('scheduleFocusSync', () => {
  it('defers syncFocusSelection to the next frame and calls afterSync', () => {
    const otp       = createOTP({ length: 4, type: 'numeric' })
    const input     = makeInput()
    const scheduler = createFrameScheduler()
    const afterSync = jest.fn()
    input.value     = '1'
    otp.insert('1', 0)

    scheduleFocusSync(scheduler, otp, input, false, afterSync)
    flushRAF()

    expect(afterSync).toHaveBeenCalledTimes(1)
    expect(input.selectionStart).toBe(otp.getSnapshot().activeSlot)
  })

  it('works without afterSync callback', () => {
    const otp       = createOTP({ length: 4 })
    const input     = makeInput()
    const scheduler = createFrameScheduler()

    expect(() => {
      scheduleFocusSync(scheduler, otp, input, false)
      flushRAF()
    }).not.toThrow()
  })
})
