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
import type { OTPState } from '@verino/core'


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


// ─────────────────────────────────────────────────────────────────────────────
// Tab key navigation (lines 382-395)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: Tab key navigation', () => {
  it('Tab moves forward when slot is filled', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    node.setSelectionRange(0, 0)
    keyDown(node, 'Tab')
    flushRAF()
    expect(get(otp.activeSlot)).toBe(1)
    destroy()
  })

  it('Tab does nothing when slot is empty (no preventDefault)', () => {
    const { node, destroy } = mount({ length: 4 })
    node.setSelectionRange(0, 0)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    node.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    destroy()
  })

  it('Tab does nothing when already at last slot', () => {
    const { node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    node.setSelectionRange(3, 3)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    node.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    destroy()
  })

  it('Shift+Tab moves cursor backward from slot > 0', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    node.setSelectionRange(1, 1)
    keyDown(node, 'Tab', { shiftKey: true })
    flushRAF()
    expect(get(otp.activeSlot)).toBe(0)
    destroy()
  })

  it('Shift+Tab at slot 0 does nothing (no preventDefault)', () => {
    const { node, destroy } = mount({ length: 4 })
    node.setSelectionRange(0, 0)
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    node.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// blurOnComplete in onChange and onPaste (lines 418, 433)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — blurOnComplete', () => {
  it('blurs the node via RAF after typing completes the code', () => {
    const { node, destroy } = mount({ length: 4, blurOnComplete: true })
    const blurSpy = jest.spyOn(node, 'blur')
    typeValue(node, '1234')
    flushRAF()
    expect(blurSpy).toHaveBeenCalled()
    destroy()
  })

  it('blurs the node via RAF after paste completes the code', () => {
    const { node, destroy } = mount({ length: 4, blurOnComplete: true })
    const blurSpy = jest.spyOn(node, 'blur')
    pasteText(node, '1234', 0)
    flushRAF()
    expect(blurSpy).toHaveBeenCalled()
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onFocus and onBlur inside action (lines 442-453)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: focus / blur events', () => {
  it('focus event sets isFocused and calls onFocus callback', () => {
    const onFocus = jest.fn()
    const { node, destroy } = mount({ onFocus })
    node.dispatchEvent(new FocusEvent('focus'))
    expect(onFocus).toHaveBeenCalled()
    destroy()
  })

  it('focus event queues RAF to set selection to activeSlot', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    node.dispatchEvent(new FocusEvent('focus'))
    flushRAF()
    expect(node.selectionStart).toBe(get(otp.activeSlot))
    destroy()
  })

  it('focus with selectOnFocus and filled slot selects the char', () => {
    const { node, destroy } = mount({ length: 4, selectOnFocus: true })
    typeValue(node, '1')
    // move cursor back to slot 0
    node.setSelectionRange(0, 0)
    keyDown(node, 'ArrowLeft')
    flushRAF()
    node.dispatchEvent(new FocusEvent('focus'))
    flushRAF()
    // slot 0 has '1' → selection end should be 1 (pos+1)
    expect(node.selectionEnd).toBe(1)
    destroy()
  })

  it('blur event calls onBlur callback', () => {
    const onBlur = jest.fn()
    const { node, destroy } = mount({ onBlur })
    node.dispatchEvent(new FocusEvent('focus'))
    node.dispatchEvent(new FocusEvent('blur'))
    expect(onBlur).toHaveBeenCalled()
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// autoFocus — RAF path (line 463)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — action: autoFocus', () => {
  it('autoFocus queues a RAF to focus the node', () => {
    const otp = useOTP({ autoFocus: true, length: 4 })
    const node = document.createElement('input')
    document.body.appendChild(node)
    const focusSpy = jest.spyOn(node, 'focus')
    const { destroy } = otp.action(node)
    flushRAF()
    expect(focusSpy).toHaveBeenCalled()
    destroy()
    node.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setSuccess (lines 500-501)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — setSuccess()', () => {
  it('setSuccess(true) sets hasSuccess store', () => {
    const { otp, destroy } = mount()
    otp.setSuccess(true)
    expect(get(otp.hasSuccess)).toBe(true)
    destroy()
  })

  it('setSuccess(false) clears hasSuccess store', () => {
    const { otp, destroy } = mount()
    otp.setSuccess(true)
    otp.setSuccess(false)
    expect(get(otp.hasSuccess)).toBe(false)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setReadOnly — aria-readonly toggling (lines 517-526)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — setReadOnly() aria-readonly', () => {
  it('setReadOnly(true) sets aria-readonly on the input node', () => {
    const { otp, node, destroy } = mount()
    otp.setReadOnly(true)
    expect(node.getAttribute('aria-readonly')).toBe('true')
    destroy()
  })

  it('setReadOnly(false) removes aria-readonly from the input node', () => {
    const { otp, node, destroy } = mount()
    otp.setReadOnly(true)
    otp.setReadOnly(false)
    expect(node.getAttribute('aria-readonly')).toBeNull()
    destroy()
  })

  it('setReadOnly on mount (readOnly option) sets aria-readonly immediately', () => {
    const { node, destroy } = mount({ readOnly: true })
    expect(node.getAttribute('aria-readonly')).toBe('true')
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// focus() method (lines 522-527)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — focus()', () => {
  it('focus(2) moves activeSlot to 2', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.focus(2)
    expect(get(otp.activeSlot)).toBe(2)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getSlots and getInputProps (lines 534-551)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — getSlots()', () => {
  it('returns one SlotEntry per slot', () => {
    const { otp, destroy } = mount({ length: 4 })
    expect(otp.getSlots()).toHaveLength(4)
    destroy()
  })

  it('isFilled is true for a filled slot', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1')
    const slots = otp.getSlots()
    expect(slots[0].isFilled).toBe(true)
    expect(slots[1].isFilled).toBe(false)
    destroy()
  })
})

describe('useOTP (Svelte) — getInputProps()', () => {
  it('returns correct data-first / data-last for boundary slots', () => {
    const { otp, destroy } = mount({ length: 4 })
    expect(otp.getInputProps(0)['data-first']).toBe('true')
    expect(otp.getInputProps(3)['data-last']).toBe('true')
    expect(otp.getInputProps(0)['data-last']).toBe('false')
    destroy()
  })

  it('data-filled reflects slot content', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1')
    expect(otp.getInputProps(0)['data-filled']).toBe('true')
    expect(otp.getInputProps(1)['data-filled']).toBe('false')
    destroy()
  })

  it('onInput callback inserts a character', () => {
    const { otp, destroy } = mount({ length: 4 })
    otp.getInputProps(0).onInput('7')
    expect(otp.getCode()).toBe('7')
    destroy()
  })

  it('onFocus callback in getInputProps sets isFocused and moves cursor', () => {
    const onFocus = jest.fn()
    const { otp, destroy } = mount({ onFocus })
    otp.getInputProps(2).onFocus!()
    expect(get(otp.activeSlot)).toBe(2)
    expect(onFocus).toHaveBeenCalled()
    destroy()
  })

  it('onBlur callback in getInputProps calls onBlur prop', () => {
    const onBlur = jest.fn()
    const { otp, destroy } = mount({ onBlur })
    otp.getInputProps(0).onFocus!()
    otp.getInputProps(0).onBlur!()
    expect(onBlur).toHaveBeenCalled()
    destroy()
  })

  it('onKeyDown Backspace in getInputProps deletes the char', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    otp.getInputProps(2).onKeyDown!('Backspace')
    expect(otp.getCode()).toBe('124')
    destroy()
  })

  it('onKeyDown Delete in getInputProps clears the slot in-place', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '1234')
    otp.getInputProps(1).onKeyDown!('Delete')
    expect(readStore(otp).slotValues[1]).toBe('')
    expect(readStore(otp).slotValues[0]).toBe('1')
    destroy()
  })

  it('onKeyDown ArrowLeft in getInputProps moves cursor back', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    otp.getInputProps(1).onKeyDown!('ArrowLeft')
    expect(get(otp.activeSlot)).toBe(0)
    destroy()
  })

  it('onKeyDown ArrowRight in getInputProps moves cursor forward', () => {
    const { otp, node, destroy } = mount({ length: 4 })
    typeValue(node, '12')
    otp.getInputProps(0).onKeyDown!('ArrowRight')
    expect(get(otp.activeSlot)).toBe(1)
    destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// controlledValue path — setValue (line 310)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Svelte) — controlledValue (value option)', () => {
  it('pre-fills from a string value prop on creation', () => {
    const { otp, destroy } = mount({ length: 4, value: '1234' })
    expect(otp.getCode()).toBe('1234')
    destroy()
  })

  it('does not trigger onComplete when pre-filling via value prop', () => {
    const onComplete = jest.fn()
    const { destroy } = mount({ length: 4, value: '1234', onComplete })
    expect(onComplete).not.toHaveBeenCalled()
    destroy()
  })
})
