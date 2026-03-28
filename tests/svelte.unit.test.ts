/** @jest-environment jsdom */

/**
 * @verino/svelte — unit tests (jsdom)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the Svelte adapter's adapter-specific behaviour: writable/derived
 * stores, the `action` directive, keyboard/input/paste event wiring, setValue,
 * defaultValue, disabled/readOnly, reset, setError, and the timer store.
 *
 * Strategy
 * ────────
 * The Svelte adapter is a plain function — no Svelte compiler needed. Stores
 * (from `svelte/store`) are pure JS and work in Node/jsdom as-is. The
 * `action(node)` directive registers DOM event listeners on a real HTMLInput
 * element, so tests create one directly and call `action(node)`.
 *
 * Stores are read with Svelte's `get()` helper, which does a one-shot subscribe
 * without needing a real Svelte component.
 */

import { get } from 'svelte/store'
import { useOTP } from '@verino/svelte'
import type { SvelteOTPOptions } from '@verino/svelte'
import type { OTPState } from 'verino/core'


// ─────────────────────────────────────────────────────────────────────────────
// RAF MOCK
// ─────────────────────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushRAF() {
  const q = [...rafQueue]; rafQueue = []
  q.forEach(fn => fn(0))
}

beforeEach(() => {
  rafQueue = []
  Object.defineProperty(global, 'requestAnimationFrame', {
    value: (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length },
    writable: true, configurable: true,
  })
  Object.defineProperty(global, 'cancelAnimationFrame', {
    value: () => {},
    writable: true, configurable: true,
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
  // clean up any dangling inputs
  document.body.querySelectorAll('input').forEach(el => el.remove())
})


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a real input element, mount the action on it, and return the otp
 * instance, the node, and a destroy function.
 */
function mount(options: SvelteOTPOptions = {}): {
  otp:     ReturnType<typeof useOTP>
  node:    HTMLInputElement
  destroy: () => void
} {
  const otp  = useOTP({ autoFocus: false, ...options })
  const node = document.createElement('input')
  document.body.appendChild(node)
  const { destroy } = otp.action(node)
  return { otp, node, destroy }
}

/** Fire a synthetic input event. */
function typeValue(node: HTMLInputElement, value: string) {
  node.value = value
  node.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Fire a synthetic keydown event. */
function keyDown(node: HTMLInputElement, key: string, extra: Record<string, unknown> = {}) {
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
}

/** Fire a synthetic paste event. */
function pasteText(node: HTMLInputElement, text: string, pos = 0) {
  node.setSelectionRange(pos, pos)
  // ClipboardEvent constructor may not exist in jsdom; use base Event + defineProperty
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text },
    enumerable: true,
  })
  node.dispatchEvent(event)
}

/** Read the full OTPState snapshot from the main store. */
function readStore(otp: ReturnType<typeof useOTP>): OTPState {
  let snap: OTPState | null = null
  const unsub = otp.subscribe((s: OTPState) => { snap = s })
  unsub()
  return snap as unknown as OTPState
}


// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — initial state', () => {
  it('store initialises with correct number of empty slots', () => {
    const { otp, destroy } = mount({ length: 4 })
    expect(readStore(otp).slotValues).toEqual(['', '', '', ''])
    destroy()
  })

  it('isComplete store is false on mount', () => {
    const { otp, destroy } = mount({ length: 4 })
    expect(get(otp.isComplete)).toBe(false)
    destroy()
  })

  it('hasError store is false on mount', () => {
    const { otp, destroy } = mount({ length: 4 })
    expect(get(otp.hasError)).toBe(false)
    destroy()
  })

  it('value derived store is empty string on mount', () => {
    const { otp, destroy } = mount({ length: 4 })
    expect(get(otp.value)).toBe('')
    destroy()
  })

  it('getCode() returns empty string on mount', () => {
    const { otp, destroy } = mount({ length: 4 })
    expect(otp.getCode()).toBe('')
    destroy()
  })

  it('timerSeconds store initialises to the configured value', () => {
    const { otp, destroy } = mount({ length: 4, timer: 30 })
    expect(get(otp.timerSeconds)).toBe(30)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// action — INPUT event wiring
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: input events', () => {
  it('typing a value fills slots in order', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    expect(readStore(otp).slotValues).toEqual(['1', '2', '3', '4'])
    destroy()
  })

  it('isComplete becomes true when all slots are filled', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    expect(get(otp.isComplete)).toBe(true)
    destroy()
  })

  it('value store reflects the joined code', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '5678')
    expect(get(otp.value)).toBe('5678')
    destroy()
  })

  it('non-numeric characters are rejected in numeric mode', () => {
    const { otp, node, destroy } = mount({ length: 4, type: 'numeric' })
    typeValue(node, 'ABCD')
    expect(get(otp.value)).toBe('')
    destroy()
  })

  it('onComplete fires synchronously when code is complete', () => {
    const onComplete = jest.fn()
    const { node, destroy } = mount({ length: 4, onComplete })
    typeValue(node, '1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
    destroy()
  })

  it('onChange fires on every interaction', () => {
    const onChange = jest.fn()
    const { node, destroy } = mount({ length: 4, onChange })
    typeValue(node, '12')
    expect(onChange).toHaveBeenCalledWith('12')
    destroy()
  })

  it('clearing the input resets all slots', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    typeValue(node, '')
    expect(get(otp.value)).toBe('')
    expect(get(otp.isComplete)).toBe(false)
    destroy()
  })

  it('typing is blocked when disabled', () => {
    const { otp, node, destroy } = mount({ length: 4, disabled: true })
    typeValue(node, '1234')
    expect(get(otp.value)).toBe('')
    destroy()
  })

  it('typing is blocked when readOnly', () => {
    const { otp, node, destroy } = mount({ length: 4, readOnly: true })
    typeValue(node, '1234')
    expect(get(otp.value)).toBe('')
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// action — KEYBOARD event wiring
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: keyboard events', () => {
  it('Backspace clears current slot when filled', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '123')
    node.setSelectionRange(2, 2)
    keyDown(node, 'Backspace')
    expect(readStore(otp).slotValues[2]).toBe('')
    destroy()
  })

  it('ArrowLeft decrements activeSlot', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    node.setSelectionRange(1, 1)
    keyDown(node, 'ArrowLeft')
    flushRAF()
    expect(get(otp.activeSlot)).toBe(0)
    destroy()
  })

  it('ArrowRight increments activeSlot', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    node.setSelectionRange(0, 0)
    keyDown(node, 'ArrowRight')
    flushRAF()
    expect(get(otp.activeSlot)).toBe(1)
    destroy()
  })

  it('Delete clears the slot without moving cursor', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    node.setSelectionRange(1, 1)
    keyDown(node, 'Delete')
    expect(readStore(otp).slotValues[1]).toBe('')
    expect(readStore(otp).slotValues[0]).toBe('1')
    expect(readStore(otp).slotValues[2]).toBe('3')
    destroy()
  })

  it('Backspace is blocked when readOnly', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    // Fill slots directly via the core (setValue bypasses readOnly restriction at creation time)
    otp.setValue('1234')
    node.setSelectionRange(2, 2)
    // Now enable readOnly and verify Backspace is blocked
    otp.setReadOnly(true)
    keyDown(node, 'Backspace')
    // slot-2 should still be filled
    expect(readStore(otp).slotValues[2]).toBe('3')
    destroy()
  })

  it('Backspace is blocked when disabled', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    otp.setValue('1234')
    otp.setDisabled(true)
    node.setSelectionRange(2, 2)
    keyDown(node, 'Backspace')
    expect(readStore(otp).slotValues[2]).toBe('3')
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// action — PASTE event wiring
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: paste events', () => {
  it('paste from slot 0 fills all slots', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    pasteText(node, '1234', 0)
    expect(get(otp.value)).toBe('1234')
    destroy()
  })

  it('paste triggers onComplete synchronously when code is filled', () => {
    const onComplete = jest.fn()
    const { node, destroy } = mount({ length: 4, onComplete })
    pasteText(node, '1234', 0)
    expect(onComplete).toHaveBeenCalledWith('1234')
    destroy()
  })

  it('paste filters invalid characters in numeric mode', () => {
    const { otp, node, destroy } = mount({ length: 4, type: 'numeric' })
    pasteText(node, '1A2B', 0)
    expect(get(otp.value)).toBe('12')
    destroy()
  })

  it('paste is blocked when disabled', () => {
    const { otp, node, destroy } = mount({ length: 4, disabled: true })
    pasteText(node, '1234', 0)
    expect(get(otp.value)).toBe('')
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// action — wires attributes on the node
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: node attributes', () => {
  it('sets maxLength on the node', () => {
    const { node, destroy } = mount({ length: 4 })
    expect(node.maxLength).toBe(4)
    destroy()
  })

  it('sets inputMode=numeric for type=numeric', () => {
    const { node, destroy } = mount({ type: 'numeric' })
    expect(node.inputMode).toBe('numeric')
    destroy()
  })

  it('sets autocomplete=one-time-code', () => {
    const { node, destroy } = mount()
    expect(node.autocomplete).toBe('one-time-code')
    destroy()
  })

  it('sets type=password when masked=true', () => {
    const { node, destroy } = mount({ masked: true })
    expect(node.type).toBe('password')
    destroy()
  })

  it('sets disabled when disabled=true', () => {
    const { node, destroy } = mount({ disabled: true })
    expect(node.disabled).toBe(true)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// action — destroy() removes event listeners
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: destroy()', () => {
  it('destroy() stops the action from responding to input events', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    destroy()
    typeValue(node, '1234')
    expect(get(otp.value)).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// reset() and setError()
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — reset()', () => {
  it('clears all slots', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    otp.reset()
    expect(get(otp.value)).toBe('')
    destroy()
  })

  it('resets isComplete to false', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    expect(get(otp.isComplete)).toBe(true)
    otp.reset()
    expect(get(otp.isComplete)).toBe(false)
    destroy()
  })
})

describe('useOTP (Svelte) — setError()', () => {
  it('setError(true) sets hasError store', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.setError(true)
    expect(get(otp.hasError)).toBe(true)
    destroy()
  })

  it('setError(false) clears hasError store', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.setError(true)
    otp.setError(false)
    expect(get(otp.hasError)).toBe(false)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setDisabled() and setReadOnly()
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — setDisabled()', () => {
  it('setDisabled(true) blocks subsequent typing', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    otp.setDisabled(true)
    typeValue(node, '1234')
    expect(get(otp.value)).toBe('')
    destroy()
  })

  it('setDisabled(true) updates the isDisabled store', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.setDisabled(true)
    expect(get(otp.isDisabled)).toBe(true)
    destroy()
  })
})

describe('useOTP (Svelte) — setReadOnly()', () => {
  it('setReadOnly(true) blocks typing', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    otp.setReadOnly(true)
    typeValue(node, '1234')
    expect(get(otp.value)).toBe('')
    destroy()
  })

  it('setReadOnly(true) updates the isReadOnly store', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.setReadOnly(true)
    expect(get(otp.isReadOnly)).toBe(true)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setValue()
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — setValue()', () => {
  it('fills slots without triggering onComplete', () => {
    const onComplete = jest.fn()
    const { otp, destroy } = mount({ length: 4, onComplete })
    otp.setValue('1234')
    expect(otp.getCode()).toBe('1234')
    expect(onComplete).not.toHaveBeenCalled()
    destroy()
  })

  it('filters invalid characters', () => {
    const { otp, destroy } = mount({ length: 4, type: 'numeric' })
    otp.setValue('1A2B')
    expect(otp.getCode()).toBe('12')
    destroy()
  })

  it('setValue(undefined) is a no-op', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.setValue(undefined)
    expect(otp.getCode()).toBe('')
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// defaultValue
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — defaultValue', () => {
  it('pre-fills slots on creation', () => {
    const { otp, destroy } = mount({ length: 4, defaultValue: '12' })
    expect(readStore(otp).slotValues[0]).toBe('1')
    expect(readStore(otp).slotValues[1]).toBe('2')
    expect(readStore(otp).slotValues[2]).toBe('')
    destroy()
  })

  it('does NOT trigger onComplete even when pre-fill is complete', () => {
    const onComplete = jest.fn()
    const { destroy } = mount({ length: 4, defaultValue: '1234', onComplete })
    expect(onComplete).not.toHaveBeenCalled()
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// wrapperAttrs derived store
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — wrapperAttrs', () => {
  it('data-complete is present when isComplete', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    expect(get(otp.wrapperAttrs)).toHaveProperty('data-complete')
    destroy()
  })

  it('data-complete is absent when incomplete', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    expect(get(otp.wrapperAttrs)).not.toHaveProperty('data-complete')
    destroy()
  })

  it('data-invalid is present when hasError', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.setError(true)
    expect(get(otp.wrapperAttrs)).toHaveProperty('data-invalid')
    destroy()
  })

  it('data-disabled is present when isDisabled', () => {
    const { otp, destroy } = mount({ length: 4, disabled: true })
    expect(get(otp.wrapperAttrs)).toHaveProperty('data-disabled')
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Timer store
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — timer store', () => {
  it('timerSeconds counts down after action mounts', () => {
    jest.useFakeTimers()
    const { otp, destroy } = mount({ length: 4, timer: 5 })
    // Timer starts when action() is called (which happened in mount())
    jest.advanceTimersByTime(2000)
    expect(get(otp.timerSeconds)).toBeLessThan(5)
    destroy()
  })

  it('onExpire fires when countdown reaches zero', () => {
    jest.useFakeTimers()
    const onExpire = jest.fn()
    const { destroy } = mount({ length: 4, timer: 2, onExpire })
    jest.advanceTimersByTime(3000)
    expect(onExpire).toHaveBeenCalled()
    destroy()
  })
})
