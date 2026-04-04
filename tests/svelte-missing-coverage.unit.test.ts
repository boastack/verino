/** @jest-environment jsdom */

/**
 * svelte-missing-coverage.unit.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Targets specific uncovered lines in packages/svelte/src/index.ts:
 *
 *   229    useOTP default parameter (call without options)
 *   253    autoFocus default parameter branch
 *   342    if (result.changed) false branch — defaultValue unchanged
 *   379    node.selectionStart ?? 0 fallback in onKeydown
 *   410-411 clipboardData?.getData ?? '' + selectionStart ?? 0 in onPaste
 *   496    if (inputEl) false branch in setReadOnly
 *   521-533 getInputProps handler bodies
 *
 * Run: pnpm test tests/svelte-missing-coverage.unit.test.ts
 */

import { get } from 'svelte/store'
import { useOTP } from '@verino/svelte'
import type { SvelteOTPOptions } from '@verino/svelte'

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
// Helpers (mirrors svelte.unit.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

function mount(options: SvelteOTPOptions = {}): {
  otp: ReturnType<typeof useOTP>
  node: HTMLInputElement
  destroy: () => void
} {
  const otp  = useOTP({ autoFocus: false, ...options })
  const node = document.createElement('input')
  document.body.appendChild(node)
  const { destroy } = otp.action(node)
  return { otp, node, destroy }
}

function pasteText(node: HTMLInputElement, text: string | null, pos = 0) {
  node.setSelectionRange(pos, pos)
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: text !== null ? { getData: () => text } : null,
    enumerable: true,
  })
  Object.defineProperty(event, 'preventDefault', { value: () => {}, enumerable: true })
  node.dispatchEvent(event)
}


// ─────────────────────────────────────────────────────────────────────────────
// useOTP default parameter (line 229) — call without options
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — default parameter branch (line 229)', () => {
  it('initialises with defaults when called without options', () => {
    const otp = useOTP()
    const slots = get(otp.slots)
    expect(slots.length).toBe(6) // default length
    // No action mounted — cleanup is a no-op; action.destroy() handles teardown when used
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// autoFocus default=true branch (line 253)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — autoFocus default (line 253)', () => {
  it('does not throw when autoFocus=true and no action mounted', () => {
    expect(() => {
      useOTP({ length: 4, type: 'numeric', autoFocus: true })
      // autoFocus with no mounted action is safe — scheduleInputFocus guards on isConnected
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// if (result.changed) false branch (line 342) — defaultValue stays same
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — defaultValue unchanged (line 342 false branch)', () => {
  it('setValue with same value does not throw (result.changed = false)', () => {
    const { otp, node, destroy } = mount({ length: 4, type: 'numeric', defaultValue: '12' })
    // The defaultValue '12' is seeded on mount. Calling setValue with same value
    // exercises the result.changed=false path.
    expect(() => otp.setValue('12')).not.toThrow()
    expect(otp.getCode()).toBe('12')
    destroy()
    node.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onKeydown selectionStart ?? 0 (line 379) — selectionStart is null
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP action — onKeydown with null selectionStart (line 379)', () => {
  it('handles ArrowLeft when selectionStart returns null', () => {
    const { otp, node, destroy } = mount({ length: 4, type: 'numeric' })
    // Spy on selectionStart to return null
    jest.spyOn(node, 'selectionStart', 'get').mockReturnValue(null)
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
    expect(() => node.dispatchEvent(event)).not.toThrow()
    destroy()
    node.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onPaste clipboardData null fallback (lines 410-411)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP action — onPaste with null clipboardData (lines 410-411)', () => {
  it('handles paste when clipboardData is null (falls back to empty string)', () => {
    const { otp, node, destroy } = mount({ length: 4, type: 'numeric' })
    // Paste with null clipboardData → text = '' → clears field (no-op on empty)
    pasteText(node, null)
    expect(otp.getCode()).toBe('')
    destroy()
    node.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setReadOnly — if (inputEl) false branch (line 496)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — setReadOnly before action is mounted (line 496 false branch)', () => {
  it('setReadOnly works even without an attached input', () => {
    // Call setReadOnly BEFORE mounting the action → inputEl is null → false branch
    const otp = useOTP({ length: 4, type: 'numeric', autoFocus: false })
    expect(() => otp.setReadOnly(true)).not.toThrow()
    // No action mounted — no inputEl, exercises the `if (inputEl)` false branch
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getInputProps — handler bodies (lines 521-533)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — getInputProps handlers (lines 521-533)', () => {
  it('onInput inserts a valid char', () => {
    const { otp, destroy } = mount({ length: 4, type: 'numeric' })
    const props = otp.getInputProps(0)
    ;(props.onInput as (c: string) => void)('7')
    expect(otp.getCode()).toBe('7')
    destroy()
  })

  it('onKeyDown handles Backspace', () => {
    const { otp, destroy } = mount({ length: 4, type: 'numeric' })
    const p0 = otp.getInputProps(0)
    ;(p0.onInput as (c: string) => void)('3')
    const p1 = otp.getInputProps(0)
    ;(p1.onKeyDown as (k: string) => void)('Backspace')
    expect(otp.getCode()).toBe('')
    destroy()
  })

  it('onKeyDown handles unrecognised keys without throwing', () => {
    const { otp, destroy } = mount({ length: 4, type: 'numeric' })
    const props = otp.getInputProps(0)
    expect(() => (props.onKeyDown as (k: string) => void)('Tab')).not.toThrow()
    destroy()
  })

  it('onFocus and onBlur do not throw', () => {
    const { otp, destroy } = mount({ length: 4, type: 'numeric' })
    const props = otp.getInputProps(0)
    expect(() => (props.onFocus as () => void)()).not.toThrow()
    expect(() => (props.onBlur as () => void)()).not.toThrow()
    destroy()
  })
})
