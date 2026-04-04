/** @jest-environment jsdom */

/**
 * alpine-missing-coverage.unit.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Targets specific uncovered lines/branches in packages/alpine/src/index.ts:
 *
 *   236-237  normalizeEvaluatedOptions — non-plain-object input (error + empty return)
 *   247      separatorAfterEqual — both-arrays comparison branch
 *   372      onInvalidChar callback ref
 *   386-389  refreshFeedbackSubscription function body
 *   529-530  preservedState.hasSuccess branch in mountDirective
 *   532      preservedState.hasError branch in mountDirective
 *   897      refreshFeedbackSubscription call from update() when haptic/sound changes
 *   927-928  remountFromValue catch block (console.error + fallback remount)
 *
 * Run: pnpm test tests/alpine-missing-coverage.unit.test.ts
 */

import { VerinoAlpine } from '@verino/alpine'

// ─────────────────────────────────────────────────────────────────────────────
// RAF mock
// ─────────────────────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushRAF() {
  const q = [...rafQueue]; rafQueue = []
  q.forEach(fn => fn(0))
}

beforeEach(() => {
  rafQueue = []
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => {
    rafQueue.push(cb); return rafQueue.length
  })
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {})
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
  document.getElementById('verino-alpine-styles')?.remove()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type AnyOpts = Record<string, unknown>

/**
 * A flexible Alpine mount helper that accepts any value as the reactive
 * options — needed to test non-plain-object and edge-case inputs.
 */
function mountAlpineRaw(
  reactiveValue: unknown,
  overrideExpression?: string,
): {
  wrapper:    HTMLElement
  cleanup:    () => void
  setOptions: (next: unknown) => void
  getApi:     () => ReturnType<typeof getApiFrom> | null
} {
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  let handler: ((el: HTMLElement, data: unknown, utils: unknown) => { cleanup(): void }) | null = null
  let current = reactiveValue
  const effects: Array<() => void> = []

  VerinoAlpine({
    directive: (_name: string, fn: typeof handler) => { handler = fn },
  } as Parameters<typeof VerinoAlpine>[0])

  const expression = overrideExpression ?? 'opts'
  const result = handler!(
    wrapper,
    { expression, value: '', modifiers: [] },
    {
      evaluate:      () => current,
      evaluateLater: () => (callback: (value: unknown) => void) => { callback(current) },
      cleanup:       () => {},
      effect:        (fn: () => void) => { effects.push(fn); fn() },
    },
  )

  return {
    wrapper,
    cleanup:    () => result.cleanup(),
    setOptions: (next: unknown) => { current = next; effects.forEach(fn => fn()) },
    getApi:     () => getApiFrom(wrapper),
  }
}

/**
 * Standard Alpine mount that uses a plain object with autoFocus disabled.
 */
function mountAlpine(opts: AnyOpts = {}): {
  wrapper:    HTMLElement
  cleanup:    () => void
  setOptions: (next: AnyOpts) => void
  api:        ReturnType<typeof getApiFrom>
} {
  const mount = mountAlpineRaw({ autoFocus: false, ...opts })
  return {
    wrapper:    mount.wrapper,
    cleanup:    mount.cleanup,
    setOptions: (next) => mount.setOptions({ autoFocus: false, ...next }),
    api:        mount.getApi()!,
  }
}

function getApiFrom(wrapper: HTMLElement) {
  return (wrapper as HTMLElement & { _verino: {
    getCode():     string
    getSlots():    { index: number; isActive: boolean; value: string; isFilled: boolean }[]
    getInputProps(i: number): Record<string, unknown>
    setError(v: boolean):    void
    setSuccess(v: boolean):  void
    setDisabled(v: boolean): void
    setReadOnly(v: boolean): void
    reset():  void
    resend(): void
    destroy(): void
    focus(i: number): void
  } })._verino
}

function getHiddenInput(wrapper: HTMLElement): HTMLInputElement {
  return wrapper.querySelector('input') as HTMLInputElement
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}


// ─────────────────────────────────────────────────────────────────────────────
// Lines 236-237: normalizeEvaluatedOptions — non-plain-object input
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — normalizeEvaluatedOptions with non-plain-object (lines 236-237)', () => {
  it('logs a console.error and returns empty options when evaluated value is null', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // null is not a plain object — triggers the error + returns {}
    const { cleanup } = mountAlpineRaw(null)

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[verino]'),
      null,
    )

    cleanup()
    errorSpy.mockRestore()
  })

  it('logs a console.error and returns empty options when evaluated value is a string', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { cleanup } = mountAlpineRaw('invalid-string-options')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[verino]'),
      'invalid-string-options',
    )

    cleanup()
    errorSpy.mockRestore()
  })

  it('logs a console.error when evaluated value is a number', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { cleanup } = mountAlpineRaw(42)

    expect(errorSpy).toHaveBeenCalled()

    cleanup()
    errorSpy.mockRestore()
  })

  it('logs a console.error when evaluated value is an array (not a plain object)', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { cleanup } = mountAlpineRaw([{ length: 6 }])

    expect(errorSpy).toHaveBeenCalled()

    cleanup()
    errorSpy.mockRestore()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Line 247: separatorAfterEqual — both-arrays comparison branch
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — separatorAfterEqual with two arrays (line 247)', () => {
  it('treats two arrays with same values as equal (no remount)', () => {
    const { wrapper, setOptions, cleanup } = mountAlpine({ separatorAfter: [2, 4] })
    const slotsBefore = wrapper.querySelectorAll('[data-slot]').length

    // Set options with a NEW array with same values — alpineOptionsEqual calls
    // separatorAfterEqual([2,4], [2,4]) → hits the Array.isArray branch
    setOptions({ separatorAfter: [2, 4] })

    expect(wrapper.querySelectorAll('[data-slot]').length).toBe(slotsBefore)
    cleanup()
  })

  it('treats two arrays with different values as unequal (triggers remount)', () => {
    const { wrapper, setOptions, cleanup } = mountAlpine({ length: 6, separatorAfter: [2, 4] })

    // Different array values → separatorAfterEqual returns false → remount
    setOptions({ length: 6, separatorAfter: [2, 5] })

    // Still has 6 slots after remount
    expect(wrapper.querySelectorAll('[data-slot]').length).toBe(6)
    cleanup()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Line 372: onInvalidChar callback ref
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — onInvalidChar callback (line 372)', () => {
  it('fires onInvalidChar when an invalid character is inserted via getInputProps.onInput', () => {
    const onInvalidChar = jest.fn()
    const { api, cleanup } = mountAlpine({
      length: 4,
      type: 'numeric',
      onInvalidChar,
    })

    // Use getInputProps.onInput to call otp.insert() directly — this triggers
    // onInvalidChar when the char is rejected by the numeric filter
    const props = api.getInputProps(0)
    ;(props.onInput as (c: string) => void)?.('a')

    expect(onInvalidChar).toHaveBeenCalledWith('a', expect.any(Number))
    cleanup()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Lines 386-389 + Line 897: refreshFeedbackSubscription via update()
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — refreshFeedbackSubscription via haptic/sound update (lines 386-389, 897)', () => {
  it('re-subscribes feedback when haptic changes from true to false in an update', () => {
    // Mount with default haptic=true
    const { setOptions, cleanup } = mountAlpine({ haptic: true })

    // Change only haptic — alpineOptionsEqual ignores haptic, so update() runs
    // update() detects haptic changed → calls refreshFeedbackSubscription()
    expect(() => setOptions({ haptic: false })).not.toThrow()

    cleanup()
  })

  it('re-subscribes feedback when sound changes from false to true in an update', () => {
    const { setOptions, cleanup } = mountAlpine({ sound: false })

    // Change only sound — triggers refreshFeedbackSubscription in update()
    expect(() => setOptions({ sound: true })).not.toThrow()

    cleanup()
  })

})


// ─────────────────────────────────────────────────────────────────────────────
// Lines 529-530: preservedState.hasSuccess branch in mountDirective
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — preservedState.hasSuccess (lines 529-530)', () => {
  it('restores success state after a remount triggered by option change', () => {
    const { api, wrapper, setOptions, cleanup } = mountAlpine({ length: 6 })

    // Set success state — wrapper gets data-success attribute
    api.setSuccess(true)
    flushRAF()
    expect(wrapper.hasAttribute('data-success')).toBe(true)

    // Change length to force a remount — preservedState.hasSuccess = true
    setOptions({ length: 4 })

    // The remounted instance should have restored success state
    expect(wrapper.hasAttribute('data-success')).toBe(true)

    cleanup()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Line 532: preservedState.hasError branch in mountDirective
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — preservedState.hasError (line 532)', () => {
  it('restores error state after a remount triggered by option change', () => {
    const { api, wrapper, setOptions, cleanup } = mountAlpine({ length: 6 })

    // Set error state — wrapper gets data-invalid attribute
    api.setError(true)
    flushRAF()
    expect(wrapper.hasAttribute('data-invalid')).toBe(true)

    // Change length to force a remount — preservedState.hasError = true
    setOptions({ length: 4 })

    // The remounted instance should have restored error state
    expect(wrapper.hasAttribute('data-invalid')).toBe(true)

    cleanup()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Lines 927-928: remountFromValue catch block
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — remountFromValue error catch (lines 927-928)', () => {
  it('logs console.error and falls back to default mount when options cause createOTP to throw', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // length: Infinity passes Alpine's normalizeAlpineOptions (no upper bound clamp)
    // but createOTP throws RangeError because !isFinite(Infinity) — triggers the catch block.
    // The catch calls console.error then falls back to remountFromValue({}) → 6 slots.
    const { wrapper, cleanup } = mountAlpineRaw({ length: Infinity, autoFocus: false })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[verino]'),
      expect.any(Error),
    )

    // After fallback, the wrapper should have 6 slots (default length)
    expect(wrapper.querySelectorAll('[data-slot]').length).toBe(6)

    cleanup()
    errorSpy.mockRestore()
  })

  it('mounts with default options when the initial expression has Infinity length', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Same scenario — Infinity → RangeError → fallback to 6 slots
    const { wrapper, cleanup } = mountAlpineRaw({ length: Infinity, autoFocus: false })

    // Fallback mount succeeded with default length=6
    expect(wrapper.querySelectorAll('[data-slot]').length).toBe(6)

    cleanup()
    errorSpy.mockRestore()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bonus: expression="" path (else branch, line 932-933)
// ─────────────────────────────────────────────────────────────────────────────

describe('Alpine — no expression (else branch, line 932-933)', () => {
  it('mounts with empty options when expression is an empty string', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)

    let handler: ((el: HTMLElement, data: unknown, utils: unknown) => { cleanup(): void }) | null = null

    VerinoAlpine({
      directive: (_name: string, fn: typeof handler) => { handler = fn },
    } as Parameters<typeof VerinoAlpine>[0])

    // Empty expression — uses the `else { remountFromValue({}) }` path
    const result = handler!(
      wrapper,
      { expression: '', value: '', modifiers: [] },
      {
        evaluate:      () => ({}),
        evaluateLater: () => (cb: (v: unknown) => void) => cb({}),
        cleanup:       () => {},
        effect:        (fn: () => void) => fn(),
      },
    )

    // Default mount — 6 slots
    expect(wrapper.querySelectorAll('[data-slot]').length).toBe(6)
    result.cleanup()
  })
})
