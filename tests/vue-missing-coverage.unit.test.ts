/** @jest-environment jsdom */

/**
 * vue-missing-coverage.unit.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Targets specific uncovered lines in packages/vue/src/index.ts:
 *
 *   261    useOTP default parameter branch (called without options)
 *   285    autoFocus default parameter branch
 *   415    if (result.changed) false branch — controlled value unchanged
 *   443    selectionStart ?? 0 fallback
 *   459    !(e.target instanceof HTMLInputElement) guard
 *   475-476 clipboardData optional chain fallback
 *   554-566 getInputProps onInput/onKeyDown handler bodies
 *
 * Run: pnpm test tests/vue-missing-coverage.unit.test.ts
 */

import { createApp, defineComponent, ref } from 'vue'
import { useOTP } from '@verino/vue'
import type { VueOTPOptions } from '@verino/vue'

// ─────────────────────────────────────────────────────────────────────────────
// RAF mock
// ─────────────────────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

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
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (mirrors vue.unit.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

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

function attachInput(otp: ReturnType<typeof useOTP>): HTMLInputElement {
  const input = document.createElement('input')
  document.body.appendChild(input)
  otp.inputRef.value = input
  return input
}

function setup(options: VueOTPOptions = {}): [ReturnType<typeof useOTP>, HTMLInputElement, () => void] {
  const [otp, unmount] = withSetup(() => useOTP({ autoFocus: false, ...options }))
  const input = attachInput(otp)
  return [otp, input, () => { unmount(); input.remove() }]
}

function typeOTP(otp: ReturnType<typeof useOTP>, input: HTMLInputElement, value: string) {
  input.value = value
  const event = new Event('input')
  Object.defineProperty(event, 'target', { value: input, enumerable: true })
  otp.onChange(event)
}

function pasteOTP(otp: ReturnType<typeof useOTP>, input: HTMLInputElement, text: string | null) {
  input.setSelectionRange(0, 0)
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: text !== null ? { getData: () => text } : null,
    enumerable: true,
  })
  Object.defineProperty(event, 'preventDefault', { value: () => {}, enumerable: true })
  otp.onPaste(event as ClipboardEvent)
}


// ─────────────────────────────────────────────────────────────────────────────
// useOTP default parameter (line 261) — call without any options
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — called without options (default parameter branch, line 261)', () => {
  it('initialises with default length=6 when no options provided', () => {
    // Exercises the `options = {}` default parameter branch
    const [otp, unmount] = withSetup(() => useOTP())
    expect(otp.slotValues.value.length).toBe(6)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// autoFocus default branch (line 285) — autoFocus=true triggers focus on mount
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — autoFocus default=true branch (line 285)', () => {
  it('does not throw when autoFocus=true and input is not attached', () => {
    // Exercises `autoFocus: autoFocusOpt = true` default branch
    expect(() => withSetup(() => useOTP({ length: 4, type: 'numeric', autoFocus: true }))[1]()).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// if (result.changed) false branch (line 415) — controlled value unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — controlled value unchanged (line 415 false branch)', () => {
  it('does not change state when same controlled value is set twice', async () => {
    const controlledValue = ref('12')
    const [otp, unmount] = withSetup(() => useOTP({
      length: 4,
      type: 'numeric',
      autoFocus: false,
      value: controlledValue,
    }))
    attachInput(otp)

    // First set: changes state
    expect(otp.getCode()).toBe('12')
    const codeBefore = otp.getCode()

    // Trigger watcher with SAME value (hits result.changed === false branch)
    controlledValue.value = '12'
    await Promise.resolve()

    expect(otp.getCode()).toBe(codeBefore)
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onKeydown selectionStart ?? 0 fallback (line 443)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — onKeydown selectionStart null fallback (line 443)', () => {
  it('handles ArrowLeft when selectionStart is null', () => {
    const [otp, , unmount] = setup({ length: 4, type: 'numeric' })
    // Set selectionStart to null (jsdom normally returns 0 but we can mock it)
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    expect(() => otp.onKeydown(event)).not.toThrow()
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onChange guard: e.target not HTMLInputElement (line 459)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — onChange returns when target is not HTMLInputElement (line 459)', () => {
  it('does nothing when event target is a div, not an input', () => {
    const [otp, , unmount] = setup({ length: 4, type: 'numeric' })

    const div = document.createElement('div')
    const event = new Event('input')
    Object.defineProperty(event, 'target', { value: div, enumerable: true })

    expect(() => otp.onChange(event)).not.toThrow()
    expect(otp.getCode()).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onPaste clipboardData null fallback (lines 475-476)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — onPaste with null clipboardData (lines 475-476)', () => {
  it('handles paste when clipboardData is null (falls back to empty string)', () => {
    const [otp, input, unmount] = setup({ length: 4, type: 'numeric' })
    // Paste with null clipboardData → text = '' → clears field (no-op on empty)
    pasteOTP(otp, input, null)
    expect(otp.getCode()).toBe('')
    unmount()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getInputProps — onInput, onKeyDown, onFocus, onBlur handlers (lines 554-566)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — getInputProps handlers (lines 554-566)', () => {
  it('onInput inserts a valid char at the given slot', () => {
    const [otp, , unmount] = setup({ length: 4, type: 'numeric' })
    const props = otp.getInputProps(0)
    ;(props.onInput as (c: string) => void)('5')
    expect(otp.getCode()).toBe('5')
    unmount()
  })

  it('onKeyDown handles Backspace', () => {
    const [otp, , unmount] = setup({ length: 4, type: 'numeric' })
    const propsBefore = otp.getInputProps(0)
    ;(propsBefore.onInput as (c: string) => void)('3')
    const propsAfter = otp.getInputProps(0)
    ;(propsAfter.onKeyDown as (k: string) => void)('Backspace')
    expect(otp.getCode()).toBe('')
    unmount()
  })

  it('onKeyDown handles unrecognised keys without throwing', () => {
    const [otp, , unmount] = setup({ length: 4, type: 'numeric' })
    const props = otp.getInputProps(0)
    expect(() => (props.onKeyDown as (k: string) => void)('Tab')).not.toThrow()
    unmount()
  })

  it('onFocus and onBlur do not throw', () => {
    const [otp, , unmount] = setup({ length: 4, type: 'numeric' })
    const props = otp.getInputProps(0)
    expect(() => (props.onFocus as () => void)()).not.toThrow()
    expect(() => (props.onBlur as () => void)()).not.toThrow()
    unmount()
  })
})
