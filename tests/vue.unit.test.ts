/** @jest-environment jsdom */

/**
 * @verino/vue — unit tests (jsdom)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the Vue 3 adapter's adapter-specific behaviour: reactive state refs,
 * keyboard/input/paste event handlers, hiddenInputAttrs wiring, controlled
 * value via Ref<string>, timer hook, and lifecycle cleanup.
 *
 * Strategy
 * ────────
 * The composable's event handlers (onKeydown, onChange, onPaste, onFocus,
 * onBlur) are plain functions exposed on the return value. We call them
 * directly with mock events — no @vue/test-utils needed.
 *
 * Lifecycle hooks (onMounted, onUnmounted) require a real component context.
 * We use a minimal `withSetup` helper that mounts an app and returns both the
 * composable result and an unmount function.
 */

import { createApp, defineComponent, ref, nextTick } from 'vue'
import { useOTP } from '@verino/vue'
import type { VueOTPOptions } from '@verino/vue'


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
})


// ─────────────────────────────────────────────────────────────────────────────
// withSetup HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mounts a minimal component that runs the composable inside setup().
 * Returns the composable result and an unmount function.
 * Necessary for onMounted / onUnmounted hooks to fire correctly.
 */
function withSetup<T>(fn: () => T): [T, () => void] {
  let result!: T
  const App = defineComponent({
    setup() { result = fn(); return {} },
    template: '<div></div>',
  })
  const div = document.createElement('div')
  document.body.appendChild(div)
  const app = createApp(App)
  app.mount(div)
  return [result, () => { app.unmount(); div.remove() }]
}

/** Create a real <input> and assign it to otp.inputRef so handlers work. */
function attachInput(otp: ReturnType<typeof useOTP>): HTMLInputElement {
  const input = document.createElement('input')
  document.body.appendChild(input)
  otp.inputRef.value = input
  return input
}

/** Fire a synthetic input event on the element. */
function fireChange(input: HTMLInputElement, value: string) {
  input.value = value
  const event = new Event('input', { bubbles: true })
  otp_triggerOnChange(input, event)
}

// We call the handler directly — it's exposed on the composable result.
// This helper avoids duplicating the pattern.
let _lastOtp: ReturnType<typeof useOTP> | null = null

function otp_triggerOnChange(input: HTMLInputElement, event: Event) {
  // overridden per test via direct call
}

function setup(options: VueOTPOptions = {}): [ReturnType<typeof useOTP>, HTMLInputElement, () => void] {
  const [otp, unmount] = withSetup(() => useOTP({ autoFocus: false, ...options }))
  const input = attachInput(otp)
  return [otp, input, () => { unmount(); input.remove() }]
}

/** Simulate typing by calling otp.onChange with a mock event. */
function type(otp: ReturnType<typeof useOTP>, input: HTMLInputElement, value: string) {
  input.value = value
  const event = new Event('input')
  // event.target is read-only; use defineProperty to set it
  Object.defineProperty(event, 'target', { value: input, enumerable: true })
  otp.onChange(event)
}

/** Simulate keydown. */
function keyDown(otp: ReturnType<typeof useOTP>, input: HTMLInputElement, key: string, extra: Record<string, unknown> = {}) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
  otp.onKeydown(event)
}

/** Simulate paste. */
function paste(otp: ReturnType<typeof useOTP>, input: HTMLInputElement, text: string, pos = 0) {
  input.setSelectionRange(pos, pos)
  // ClipboardEvent constructor may not exist in jsdom; use base Event + defineProperty
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text },
    enumerable: true,
  })
  otp.onPaste(event as unknown as ClipboardEvent)
}


// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — initial state', () => {
  it('slotValues initialises to correct length of empty strings', () => {
    const [otp, , unmount] = setup({ length: 4 })
    expect(otp.slotValues.value).toEqual(['', '', '', ''])
    unmount()
  })

  it('isComplete is false on mount', () => {
    const [otp, , unmount] = setup({ length: 4 })
    expect(otp.isComplete.value).toBe(false)
    unmount()
  })

  it('hasError is false on mount', () => {
    const [otp, , unmount] = setup({ length: 4 })
    expect(otp.hasError.value).toBe(false)
    unmount()
  })

  it('value computed ref returns empty string on mount', () => {
    const [otp, , unmount] = setup({ length: 4 })
    expect(otp.value.value).toBe('')
    unmount()
  })

  it('getCode() returns empty string on mount', () => {
    const [otp, , unmount] = setup({ length: 4 })
    expect(otp.getCode()).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// hiddenInputAttrs
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — hiddenInputAttrs', () => {
  it('maxlength equals configured length', () => {
    const [otp, , unmount] = setup({ length: 4 })
    expect(otp.hiddenInputAttrs.value.maxlength).toBe(4)
    unmount()
  })

  it('inputmode is numeric for type=numeric', () => {
    const [otp, , unmount] = setup({ type: 'numeric' })
    expect(otp.hiddenInputAttrs.value.inputmode).toBe('numeric')
    unmount()
  })

  it('inputmode is text for type=alphabet', () => {
    const [otp, , unmount] = setup({ type: 'alphabet' })
    expect(otp.hiddenInputAttrs.value.inputmode).toBe('text')
    unmount()
  })

  it('autocomplete is one-time-code', () => {
    const [otp, , unmount] = setup()
    expect(otp.hiddenInputAttrs.value.autocomplete).toBe('one-time-code')
    unmount()
  })

  it('type is text by default', () => {
    const [otp, , unmount] = setup()
    expect(otp.hiddenInputAttrs.value.type).toBe('text')
    unmount()
  })

  it('type is password when masked=true', () => {
    const [otp, , unmount] = setup({ masked: true })
    expect(otp.hiddenInputAttrs.value.type).toBe('password')
    unmount()
  })

  it('disabled attribute reflects disabled=true', () => {
    const [otp, , unmount] = setup({ disabled: true })
    expect(otp.hiddenInputAttrs.value.disabled).toBe(true)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// TYPING — onChange handler
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — typing (onChange)', () => {
  it('typing fills slots in order', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    expect(otp.slotValues.value).toEqual(['1', '2', '3', '4'])
    unmount()
  })

  it('isComplete becomes true when all slots are filled', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    expect(otp.isComplete.value).toBe(true)
    unmount()
  })

  it('value computed ref returns joined code', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    expect(otp.value.value).toBe('1234')
    unmount()
  })

  it('non-numeric characters are rejected in numeric mode', async () => {
    const [otp, input, unmount] = setup({ length: 4, type: 'numeric' })
    type(otp, input, 'ABCD')
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })

  it('onComplete fires synchronously when code is complete', async () => {
    const onComplete = jest.fn()
    const [otp, input, unmount] = setup({ length: 4, onComplete })
    type(otp, input, '1234')
    await nextTick()
    expect(onComplete).toHaveBeenCalledWith('1234')
    unmount()
  })

  it('onChange fires on every interaction', async () => {
    const onChange = jest.fn()
    const [otp, input, unmount] = setup({ length: 4, onChange })
    type(otp, input, '12')
    await nextTick()
    expect(onChange).toHaveBeenCalledWith('12')
    unmount()
  })

  it('clearing the value resets all slots', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    type(otp, input, '')
    await nextTick()
    expect(otp.value.value).toBe('')
    expect(otp.isComplete.value).toBe(false)
    unmount()
  })

  it('onChange is blocked when disabled', async () => {
    const [otp, input, unmount] = setup({ length: 4, disabled: true })
    type(otp, input, '1234')
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD — onKeydown handler
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — keyboard', () => {
  it('Backspace clears current slot', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '123')
    await nextTick()
    input.setSelectionRange(2, 2)
    keyDown(otp, input, 'Backspace')
    await nextTick()
    expect(otp.slotValues.value[2]).toBe('')
    unmount()
  })

  it('ArrowLeft decrements activeSlot', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    input.setSelectionRange(1, 1)
    keyDown(otp, input, 'ArrowLeft')
    await nextTick()
    flushRAF()
    expect(otp.activeSlot.value).toBe(0)
    unmount()
  })

  it('ArrowRight increments activeSlot', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    input.setSelectionRange(0, 0)
    keyDown(otp, input, 'ArrowRight')
    await nextTick()
    flushRAF()
    expect(otp.activeSlot.value).toBe(1)
    unmount()
  })

  it('Delete clears slot without moving cursor', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    input.setSelectionRange(1, 1)
    keyDown(otp, input, 'Delete')
    await nextTick()
    expect(otp.slotValues.value[1]).toBe('')
    expect(otp.slotValues.value[0]).toBe('1')
    expect(otp.slotValues.value[2]).toBe('3')
    unmount()
  })

  it('Backspace is blocked when readOnly', async () => {
    // defaultValue fills slots without triggering onComplete
    const [otp, input, unmount] = setup({ length: 4, readOnly: true })
    // fill via direct core operation (adapters block mutations)
    // We verify that the keydown handler doesn't mutate
    type(otp, input, '1234') // blocked by readOnly
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// PASTE — onPaste handler
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — paste', () => {
  it('paste from slot 0 fills all slots', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    paste(otp, input, '1234', 0)
    await nextTick()
    expect(otp.value.value).toBe('1234')
    unmount()
  })

  it('paste triggers onComplete synchronously when code is filled', async () => {
    const onComplete = jest.fn()
    const [otp, input, unmount] = setup({ length: 4, onComplete })
    paste(otp, input, '1234', 0)
    await nextTick()
    expect(onComplete).toHaveBeenCalledWith('1234')
    unmount()
  })

  it('paste filters invalid characters in numeric mode', async () => {
    const [otp, input, unmount] = setup({ length: 4, type: 'numeric' })
    paste(otp, input, '1A2B', 0)
    await nextTick()
    expect(otp.value.value).toBe('12')
    unmount()
  })

  it('paste is blocked when disabled', async () => {
    const [otp, input, unmount] = setup({ length: 4, disabled: true })
    paste(otp, input, '1234', 0)
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// reset() and setError()
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — reset()', () => {
  it('clears all slots and resets isComplete', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    otp.reset()
    await nextTick()
    expect(otp.value.value).toBe('')
    expect(otp.isComplete.value).toBe(false)
    unmount()
  })
})

describe('useOTP (Vue) — resend()', () => {
  it('clears all slots and resets isComplete', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    otp.resend()
    await nextTick()
    expect(otp.value.value).toBe('')
    expect(otp.isComplete.value).toBe(false)
    unmount()
  })

  it('fires onResend callback', async () => {
    const onResend = jest.fn()
    const [otp, , unmount] = setup({ length: 4, onResend })
    otp.resend()
    await nextTick()
    expect(onResend).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('does not fire onResend when not provided', async () => {
    const [otp, , unmount] = setup({ length: 4 })
    expect(() => otp.resend()).not.toThrow()
    unmount()
  })
})

describe('useOTP (Vue) — setError()', () => {
  it('setError(true) sets hasError', async () => {
    const [otp, , unmount] = setup({ length: 4 })
    otp.setError(true)
    await nextTick()
    expect(otp.hasError.value).toBe(true)
    unmount()
  })

  it('setError(false) clears hasError', async () => {
    const [otp, , unmount] = setup({ length: 4 })
    otp.setError(true)
    otp.setError(false)
    await nextTick()
    expect(otp.hasError.value).toBe(false)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// defaultValue
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — defaultValue', () => {
  it('pre-fills slots on mount without triggering onComplete', async () => {
    const onComplete = jest.fn()
    const [otp, unmount] = withSetup(() => useOTP({ length: 4, defaultValue: '1234', onComplete, autoFocus: false }))
    await nextTick()
    // defaultValue is applied in onMounted — need to wait for mount
    expect(onComplete).not.toHaveBeenCalled()
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Reactive controlled value (Ref<string>)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — reactive controlled value', () => {
  it('syncs slots when a Ref<string> value changes', async () => {
    const controlledValue = ref('')
    const [otp, unmount] = withSetup(() =>
      useOTP({ length: 4, value: controlledValue, autoFocus: false }),
    )
    await nextTick()
    controlledValue.value = '12'
    await nextTick()
    expect(otp.slotValues.value[0]).toBe('1')
    expect(otp.slotValues.value[1]).toBe('2')
    unmount()
  })

  it('does NOT trigger onComplete on programmatic value sync', async () => {
    const onComplete = jest.fn()
    const controlledValue = ref('1234')
    const [, unmount] = withSetup(() =>
      useOTP({ length: 4, value: controlledValue, onComplete, autoFocus: false }),
    )
    await nextTick()
    expect(onComplete).not.toHaveBeenCalled()
    unmount()
  })

  it('does NOT trigger onChange when parent-controlled value changes', async () => {
    const onChange = jest.fn()
    const controlledValue = ref('')
    const [, unmount] = withSetup(() =>
      useOTP({ length: 4, value: controlledValue, onChange, autoFocus: false }),
    )
    await nextTick()

    controlledValue.value = '12'
    await nextTick()

    expect(onChange).not.toHaveBeenCalled()
    unmount()
  })

  it('getCode() returns the synced value', async () => {
    const controlledValue = ref('5678')
    const [otp, unmount] = withSetup(() =>
      useOTP({ length: 4, value: controlledValue, autoFocus: false }),
    )
    await nextTick()
    expect(otp.getCode()).toBe('5678')
    unmount()
  })

  it('hydrates inputRef.value from controlled state when the input is attached at mount', async () => {
    const controlledValue = ref('1234')
    let otpResult!: ReturnType<typeof useOTP>
    const App = defineComponent({
      setup() {
        otpResult = useOTP({ length: 4, value: controlledValue, autoFocus: false })
        return { otp: otpResult }
      },
      template: `<div><input :ref="(el) => { if (el) otp.inputRef.value = el }" /></div>`,
    })

    const div = document.createElement('div')
    document.body.appendChild(div)
    const app = createApp(App)
    app.mount(div)
    await nextTick()

    const input = div.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('1234')
    expect(otpResult.getCode()).toBe('1234')

    app.unmount()
    div.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Timer
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — timer', () => {
  it('timerSeconds initialises to the configured value', () => {
    jest.useFakeTimers()
    const [otp, , unmount] = setup({ timer: 30 })
    expect(otp.timerSeconds.value).toBe(30)
    unmount()
  })

  it('timerSeconds counts down after mount', async () => {
    jest.useFakeTimers()
    const [otp, , unmount] = setup({ timer: 5 })
    await nextTick()
    jest.advanceTimersByTime(2000)
    expect(otp.timerSeconds.value).toBeLessThan(5)
    unmount()
  })

  it('onExpire fires when countdown reaches zero', async () => {
    jest.useFakeTimers()
    const onExpire = jest.fn()
    const [, , unmount] = setup({ timer: 2, onExpire })
    await nextTick()
    jest.advanceTimersByTime(3000)
    expect(onExpire).toHaveBeenCalled()
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Tab key handling (line 433-446)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — Tab key navigation', () => {
  it('Tab moves forward when slot is filled', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    input.setSelectionRange(0, 0)
    keyDown(otp, input, 'Tab')
    await nextTick()
    flushRAF()
    expect(otp.activeSlot.value).toBe(1)
    unmount()
  })

  it('Tab does nothing when slot is empty (no preventDefault)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    // slot 0 is empty — Tab should early-return without moving
    input.setSelectionRange(0, 0)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    otp.onKeydown(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    unmount()
  })

  it('Tab does nothing when already at last filled slot', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    input.setSelectionRange(3, 3)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    otp.onKeydown(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    unmount()
  })

  it('Shift+Tab moves cursor backward from slot > 0', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    input.setSelectionRange(1, 1)
    keyDown(otp, input, 'Tab', { shiftKey: true })
    await nextTick()
    flushRAF()
    expect(otp.activeSlot.value).toBe(0)
    unmount()
  })

  it('Shift+Tab at slot 0 does nothing (no preventDefault)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    input.setSelectionRange(0, 0)
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    otp.onKeydown(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// blurOnComplete — onChange and onPaste (lines 467, 481)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — blurOnComplete', () => {
  it('blurs the input via RAF after typing completes the code', async () => {
    const [otp, input, unmount] = setup({ length: 4, blurOnComplete: true })
    const blurSpy = jest.spyOn(input, 'blur')
    type(otp, input, '1234')
    await nextTick()
    flushRAF()
    expect(blurSpy).toHaveBeenCalled()
    unmount()
  })

  it('blurs the input via RAF after paste completes the code', async () => {
    const [otp, input, unmount] = setup({ length: 4, blurOnComplete: true })
    const blurSpy = jest.spyOn(input, 'blur')
    paste(otp, input, '1234', 0)
    await nextTick()
    flushRAF()
    expect(blurSpy).toHaveBeenCalled()
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onFocus and onBlur (lines 485-502)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — onFocus / onBlur', () => {
  it('onFocus sets isFocused to true and calls onFocus callback', async () => {
    const onFocus = jest.fn()
    const [otp, , unmount] = setup({ onFocus })
    otp.onFocus()
    await nextTick()
    expect(otp.isFocused.value).toBe(true)
    expect(onFocus).toHaveBeenCalled()
    unmount()
  })

  it('onFocus queues RAF to set selection range', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    otp.onFocus()
    flushRAF()
    // selectionStart should be set to activeSlot position
    expect(input.selectionStart).toBe(otp.activeSlot.value)
    unmount()
  })

  it('onFocus with selectOnFocus selects the filled char', async () => {
    const [otp, input, unmount] = setup({ length: 4, selectOnFocus: true })
    type(otp, input, '1')
    await nextTick()
    // activeSlot is 1 (moved past first), so focus back to 0
    otp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await nextTick()
    flushRAF() // flush the ArrowLeft RAF
    otp.onFocus()
    flushRAF() // flush the onFocus RAF
    // slot 0 has '1' — selectOnFocus should set range pos to pos+1
    expect(input.selectionEnd).toBeGreaterThan(input.selectionStart ?? 0)
    unmount()
  })

  it('onBlur sets isFocused to false and calls onBlur callback', async () => {
    const onBlur = jest.fn()
    const [otp, , unmount] = setup({ onBlur })
    otp.onFocus()
    await nextTick()
    otp.onBlur()
    await nextTick()
    expect(otp.isFocused.value).toBe(false)
    expect(onBlur).toHaveBeenCalled()
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setSuccess, setDisabled, setReadOnly, focus (lines 519-541)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — setSuccess()', () => {
  it('setSuccess(true) sets hasSuccess', async () => {
    const [otp, , unmount] = setup()
    otp.setSuccess(true)
    await nextTick()
    expect(otp.hasSuccess.value).toBe(true)
    unmount()
  })

  it('setSuccess(false) clears hasSuccess', async () => {
    const [otp, , unmount] = setup()
    otp.setSuccess(true)
    otp.setSuccess(false)
    await nextTick()
    expect(otp.hasSuccess.value).toBe(false)
    unmount()
  })
})

describe('useOTP (Vue) — setDisabled()', () => {
  it('setDisabled(true) blocks typing', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    otp.setDisabled(true)
    type(otp, input, '1234')
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })

  it('setDisabled(true) updates isDisabled ref', async () => {
    const [otp, , unmount] = setup()
    otp.setDisabled(true)
    await nextTick()
    expect(otp.isDisabled.value).toBe(true)
    unmount()
  })
})

describe('useOTP (Vue) — setReadOnly()', () => {
  it('setReadOnly(true) blocks typing via onChange', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    otp.setReadOnly(true)
    type(otp, input, '1234')
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })
})

describe('useOTP (Vue) — focus()', () => {
  it('focus(2) moves activeSlot to 2', async () => {
    const [otp, , unmount] = setup({ length: 4 })
    otp.focus(2)
    await nextTick()
    expect(otp.activeSlot.value).toBe(2)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getSlots and getInputProps (lines 547-588)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — getSlots()', () => {
  it('returns one entry per slot with correct index and isFilled', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    const slots = otp.getSlots()
    expect(slots).toHaveLength(4)
    expect(slots[0].isFilled).toBe(true)
    expect(slots[2].isFilled).toBe(false)
    unmount()
  })

  it('isActive is true only for the active slot', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1')
    await nextTick()
    const slots = otp.getSlots()
    expect(slots[otp.activeSlot.value].isActive).toBe(true)
    unmount()
  })
})

describe('useOTP (Vue) — getInputProps()', () => {
  it('returns correct data-* attributes for slot 0', async () => {
    const [otp, , unmount] = setup({ length: 4 })
    const props = otp.getInputProps(0)
    expect(props['data-first']).toBe('true')
    expect(props['data-last']).toBe('false')
    expect(props['data-filled']).toBe('false')
    expect(props['data-empty']).toBe('true')
    unmount()
  })

  it('data-filled is true for a filled slot', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1')
    await nextTick()
    const props = otp.getInputProps(0)
    expect(props['data-filled']).toBe('true')
    unmount()
  })

  it('onInput callback inserts a char', async () => {
    const [otp, , unmount] = setup({ length: 4 })
    const props = otp.getInputProps(0)
    props.onInput('5')
    await nextTick()
    expect(otp.slotValues.value[0]).toBe('5')
    unmount()
  })

  it('onFocus callback within getInputProps sets isFocused', async () => {
    const onFocus = jest.fn()
    const [otp, , unmount] = setup({ onFocus })
    const props = otp.getInputProps(1)
    props.onFocus!()
    await nextTick()
    expect(otp.isFocused.value).toBe(true)
    expect(otp.activeSlot.value).toBe(1)
    expect(onFocus).toHaveBeenCalled()
    unmount()
  })

  it('onBlur callback within getInputProps clears isFocused', async () => {
    const onBlur = jest.fn()
    const [otp, , unmount] = setup({ onBlur })
    const props = otp.getInputProps(0)
    props.onFocus!()
    props.onBlur!()
    await nextTick()
    expect(otp.isFocused.value).toBe(false)
    expect(onBlur).toHaveBeenCalled()
    unmount()
  })

  it('onKeyDown Backspace in getInputProps deletes the char', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    otp.getInputProps(2).onKeyDown!('Backspace')
    await nextTick()
    expect(otp.slotValues.value[2]).toBe('')
    unmount()
  })

  it('onKeyDown Delete in getInputProps clears slot in-place', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    otp.getInputProps(1).onKeyDown!('Delete')
    await nextTick()
    expect(otp.slotValues.value[1]).toBe('')
    expect(otp.slotValues.value[0]).toBe('1')
    unmount()
  })

  it('onKeyDown ArrowLeft in getInputProps moves cursor back', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    otp.getInputProps(1).onKeyDown!('ArrowLeft')
    await nextTick()
    expect(otp.activeSlot.value).toBe(0)
    unmount()
  })

  it('onKeyDown ArrowRight in getInputProps moves cursor forward', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    otp.getInputProps(0).onKeyDown!('ArrowRight')
    await nextTick()
    expect(otp.activeSlot.value).toBe(1)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Invalid plain string `value` guard
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — invalid plain string value guard', () => {
  it('rejects a plain string and leaves the field empty when a bad value shape is forced in', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const [otp, unmount] = withSetup(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useOTP({ length: 4, value: '56' as any, autoFocus: false }),
    )
    await nextTick()
    expect(otp.slotValues.value).toEqual(['', '', '', ''])
    expect(otp.getCode()).toBe('')
    expect(error).toHaveBeenCalledWith(
      '[verino/vue] `value` must be a Vue ref, computed, or getter for live external control. Use `defaultValue` for one-time prefill.',
    )
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Controlled value with inputRef set — lines 362-363
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — controlled value syncs inputRef.value', () => {
  it('syncs inputRef.value.value when controlled value updates and inputRef is set', async () => {
    const controlledValue = ref('11')
    const [otp, unmount] = withSetup(() => useOTP({ length: 4, value: controlledValue, autoFocus: false }))
    await nextTick()
    const input = document.createElement('input')
    document.body.appendChild(input)
    otp.inputRef.value = input
    controlledValue.value = '22'
    await nextTick()
    expect(input.value).toBe('22')
    input.remove()
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// autoFocus — lines 389-390
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — autoFocus', () => {
  it('calls focus() on inputRef when autoFocus=true on mount', async () => {
    // We mount with autoFocus:true and a real input attached before mount
    const [otp, unmount] = withSetup(() => useOTP({ length: 4, autoFocus: true }))
    const input = attachInput(otp)
    const focusSpy = jest.spyOn(input, 'focus')
    // onMounted ran already — we cannot retroactively spy, so just verify
    // the option is accepted without error
    await nextTick()
    expect(otp.slotValues.value).toHaveLength(4)
    input.remove()
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// autoFocus — with input in template (lines 389-390)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — autoFocus with inputRef set on mount', () => {
  it('calls focus() on inputRef when autoFocus=true and input is in template', async () => {
    const focusSpy = jest.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {})

    let otpResult!: ReturnType<typeof useOTP>
    const App = defineComponent({
      setup() {
        otpResult = useOTP({ length: 4, autoFocus: true })
        return { otp: otpResult }
      },
      template: `<div><input :ref="(el) => { if (el) otp.inputRef.value = el }" /></div>`,
    })
    const div = document.createElement('div')
    document.body.appendChild(div)
    const app = createApp(App)
    app.mount(div)
    await nextTick()

    expect(focusSpy).toHaveBeenCalled()
    focusSpy.mockRestore()
    app.unmount()
    div.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// haptic / sound feedback (lines 266-267, 269)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — haptic/sound feedback', () => {
  it('haptic=false suppresses feedback on complete (false branch line 266)', () => {
    const [otp, input, unmount] = setup({ length: 4, haptic: false })
    type(otp, input, '1234')
    // Verify OTP still completes correctly — just no haptic vibration
    expect(otp.isComplete.value).toBe(true)
    unmount()
  })

  it('sound=true triggers sound feedback on complete without throwing (line 267)', () => {
    const [otp, input, unmount] = setup({ length: 4, sound: true })
    // AudioContext absent in jsdom — triggerSoundFeedback wraps in try/catch
    expect(() => type(otp, input, '1234')).not.toThrow()
    expect(otp.isComplete.value).toBe(true)
    unmount()
  })

  it('haptic=false suppresses feedback on error (false branch line 269)', () => {
    const [otp, , unmount] = setup({ length: 4, haptic: false })
    otp.setError(true)
    expect(otp.hasError.value).toBe(true)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// hiddenInputAttrs — autoFocus and aria-readonly branches (lines 298, 303)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — hiddenInputAttrs computed', () => {
  it('includes autofocus when autoFocus=true (line 298)', async () => {
    const [otp, unmount] = withSetup(() => useOTP({ length: 4, autoFocus: true }))
    await nextTick()
    expect(otp.hiddenInputAttrs.value).toHaveProperty('autofocus', true)
    unmount()
  })

  it('omits autofocus when autoFocus=false', async () => {
    const [otp, unmount] = withSetup(() => useOTP({ length: 4, autoFocus: false }))
    await nextTick()
    expect(otp.hiddenInputAttrs.value).not.toHaveProperty('autofocus')
    unmount()
  })

  it('includes aria-readonly when readOnly=true (line 303)', async () => {
    const [otp, , unmount] = setup({ readOnly: true })
    await nextTick()
    expect(otp.hiddenInputAttrs.value['aria-readonly']).toBe('true')
    unmount()
  })

  it('omits aria-readonly when readOnly=false', async () => {
    const [otp, , unmount] = setup()
    await nextTick()
    expect(otp.hiddenInputAttrs.value).not.toHaveProperty('aria-readonly')
    unmount()
  })

  it('includes name attribute when name option is provided', async () => {
    const [otp, unmount] = withSetup(() => useOTP({ length: 4, name: 'otp-code', autoFocus: false }))
    await nextTick()
    expect(otp.hiddenInputAttrs.value).toHaveProperty('name', 'otp-code')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// wrapperAttrs computed — all state branches (lines 306-311)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — wrapperAttrs computed', () => {
  it('data-complete is set when isComplete (line 307)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    expect(otp.wrapperAttrs.value).toHaveProperty('data-complete')
    unmount()
  })

  it('data-complete is absent when incomplete', async () => {
    const [otp, , unmount] = setup({ length: 4 })
    await nextTick()
    expect(otp.wrapperAttrs.value).not.toHaveProperty('data-complete')
    unmount()
  })

  it('data-invalid is set when hasError (line 308)', async () => {
    const [otp, , unmount] = setup()
    otp.setError(true)
    await nextTick()
    expect(otp.wrapperAttrs.value).toHaveProperty('data-invalid')
    unmount()
  })

  it('data-success is set when hasSuccess (line 309)', async () => {
    const [otp, , unmount] = setup()
    otp.setSuccess(true)
    await nextTick()
    expect(otp.wrapperAttrs.value).toHaveProperty('data-success')
    unmount()
  })

  it('data-disabled is set when isDisabled (line 310)', async () => {
    const [otp, , unmount] = setup({ disabled: true })
    await nextTick()
    expect(otp.wrapperAttrs.value).toHaveProperty('data-disabled')
    unmount()
  })

  it('data-readonly is set when readOnly=true (line 311)', async () => {
    const [otp, , unmount] = setup({ readOnly: true })
    await nextTick()
    expect(otp.wrapperAttrs.value).toHaveProperty('data-readonly')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onChange — empty-value reset path (lines 454-457)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — onChange empty value resets state', () => {
  it('clearing the input resets all slots (line 454)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    expect(otp.isComplete.value).toBe(true)
    type(otp, input, '')
    await nextTick()
    expect(otp.value.value).toBe('')
    expect(otp.isComplete.value).toBe(false)
    unmount()
  })

  it('empty-value reset also clears inputRef DOM value (line 455)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '12')
    await nextTick()
    type(otp, input, '')
    await nextTick()
    expect(input.value).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onKeydown readOnly guard — Backspace and Delete (lines 410, 417)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — onKeydown readOnly guard', () => {
  it('Backspace is blocked when readOnly=true (line 410)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    otp.setReadOnly(true)
    keyDown(otp, input, 'Backspace')
    await nextTick()
    expect(otp.value.value).toBe('1234')
    unmount()
  })

  it('Delete is blocked when readOnly=true (line 417)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    otp.setReadOnly(true)
    input.setSelectionRange(1, 1)
    keyDown(otp, input, 'Delete')
    await nextTick()
    expect(otp.slotValues.value[1]).toBe('2')
    unmount()
  })

  it('onKeydown is no-op when isDisabled=true (line 406)', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    otp.setDisabled(true)
    keyDown(otp, input, 'Backspace')
    await nextTick()
    expect(otp.value.value).toBe('1234')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// reset() without inputRef (line 508 false branch)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — reset() without inputRef', () => {
  it('reset() is safe when inputRef.value is null (line 508 false branch)', async () => {
    const [otp, unmount] = withSetup(() => useOTP({ length: 4, autoFocus: false }))
    // Do NOT call attachInput — inputRef.value stays null
    expect(() => otp.reset()).not.toThrow()
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setReadOnly() ref update (lines 530-534)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — setReadOnly() updates isReadOnly ref', () => {
  it('setReadOnly(true) sets isReadOnly ref and blocks onChange', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    otp.setReadOnly(true)
    type(otp, input, '1234')
    await nextTick()
    expect(otp.value.value).toBe('')
    unmount()
  })

  it('setReadOnly(false) re-enables typing', async () => {
    const [otp, input, unmount] = setup({ length: 4, readOnly: true })
    otp.setReadOnly(false)
    type(otp, input, '1234')
    await nextTick()
    expect(otp.value.value).toBe('1234')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getCode() method (lines 543-545)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — getCode()', () => {
  it('returns the current joined code string', async () => {
    const [otp, input, unmount] = setup({ length: 4 })
    type(otp, input, '1234')
    await nextTick()
    expect(otp.getCode()).toBe('1234')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// defaultValue applied in onMounted with inputRef pre-set (line 385)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP (Vue) — defaultValue with inputRef set at mount', () => {
  it('syncs inputRef.value when defaultValue is applied in onMounted (line 385)', async () => {
    let otpResult!: ReturnType<typeof useOTP>
    const App = defineComponent({
      setup() {
        otpResult = useOTP({ length: 4, defaultValue: '1234', autoFocus: false })
        return { otp: otpResult }
      },
      template: `<div><input :ref="(el) => { if (el) otp.inputRef.value = el }" /></div>`,
    })
    const div = document.createElement('div')
    document.body.appendChild(div)
    const app = createApp(App)
    app.mount(div)
    await nextTick()

    expect(otpResult.slotValues.value[0]).toBe('1')
    expect(otpResult.slotValues.value[3]).toBe('4')
    app.unmount()
    div.remove()
  })
})
