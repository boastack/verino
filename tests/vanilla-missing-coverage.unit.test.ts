/** @jest-environment jsdom */

/**
 * vanilla-missing-coverage.unit.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Targets specific uncovered lines/branches in:
 *
 *   packages/vanilla/src/vanilla.ts
 *     273   if (typeof staleRecord[key] === 'function') — false branch
 *           (stale instance has a non-function property)
 *     633   if (!otpCore.state.isDisabled) hiddenInputEl.focus() — true branch
 *           (clearField RAF runs when field is disabled)
 *
 *   packages/vanilla/src/plugins/pm-guard.ts
 *     45    if (destroyed) return — true branch
 *           (destroy() called before RAF fires)
 *     52    if (rafId !== null) — false branch
 *           (destroy() called a second time after rafId is already null)
 *
 *   packages/vanilla/src/plugins/web-otp.ts
 *     36    return false in isExpectedWebOTPError
 *     91    console.warn for unexpected error in .catch()
 *
 * Run: pnpm test tests/vanilla-missing-coverage.unit.test.ts
 */

import { initOTP } from '@verino/vanilla'

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
  document.getElementById('verino-styles')?.remove()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeWrapper(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'verino-wrapper'
  document.body.appendChild(el)
  return el
}

function mount(opts: Parameters<typeof initOTP>[1] = {}) {
  const el = makeWrapper()
  const [instance] = initOTP(el, { autoFocus: false, ...opts })
  return { el, instance }
}


// ─────────────────────────────────────────────────────────────────────────────
// vanilla.ts line 273: double-init with non-function property on stale record
// ─────────────────────────────────────────────────────────────────────────────

describe('vanilla.ts — double-init with non-function property on stale instance (line 273)', () => {
  it('handles a stale instance that has a non-function property without throwing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const el = makeWrapper()
    const [staleInstance] = initOTP(el, { autoFocus: false })
    flushRAF()

    // Add a non-function property to the stale instance record
    // This makes Object.keys() iteration hit the `typeof !== 'function'` false branch
    ;(staleInstance as unknown as Record<string, unknown>).numericProp = 42
    ;(staleInstance as unknown as Record<string, unknown>).boolProp = true
    ;(staleInstance as unknown as Record<string, unknown>).strProp = 'hello'

    // Second init on the same element — triggers double-init path
    expect(() => {
      const [secondInstance] = initOTP(el, { autoFocus: false })
      secondInstance.destroy()
    }).not.toThrow()

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('double-init'),
    )

    warnSpy.mockRestore()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// vanilla.ts line 633: clearField RAF when field is disabled
// ─────────────────────────────────────────────────────────────────────────────

describe('vanilla.ts — clearField RAF with disabled field (line 633)', () => {
  it('does not call focus inside clearField RAF when the field is disabled', () => {
    const { el, instance } = mount({ length: 4 })
    flushRAF()

    // Disable the field, then call reset() which calls clearField()
    instance.setDisabled(true)

    // reset() schedules a RAF via clearField
    instance.reset()

    const hiddenInput = el.querySelector('.verino-hidden-input') as HTMLInputElement
    const focusSpy = jest.spyOn(hiddenInput, 'focus')

    // Flush the RAF scheduled by clearField — disabled=true path skips focus()
    flushRAF()

    expect(focusSpy).not.toHaveBeenCalled()
    instance.destroy()
  })

  it('calls focus inside clearField RAF when the field is enabled', () => {
    const { el, instance } = mount({ length: 4 })
    flushRAF()

    instance.reset()

    const hiddenInput = el.querySelector('.verino-hidden-input') as HTMLInputElement
    const focusSpy = jest.spyOn(hiddenInput, 'focus')

    // Flush the RAF scheduled by clearField — disabled=false path calls focus()
    flushRAF()

    expect(focusSpy).toHaveBeenCalled()
    instance.destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// pm-guard.ts line 45: if (destroyed) return — destroy() before RAF fires
// ─────────────────────────────────────────────────────────────────────────────

describe('pm-guard.ts — destroy before RAF fires (line 45)', () => {
  it('pm-guard RAF callback returns early when destroy() was called before it fired', () => {
    // cancelAnimationFrame is mocked as a no-op, so the RAF stays in the queue
    // even after destroy() is called with `destroyed = true`.
    const { el, instance } = mount({ length: 4 })

    // At this point, pm-guard has queued a RAF (rafId is set).
    // Call destroy() BEFORE flushing the RAF — sets destroyed = true in pm-guard
    instance.destroy()

    // Now flush the RAF queue — pm-guard's callback fires with destroyed=true
    // The `if (destroyed) return` branch (line 45) is executed
    expect(() => flushRAF()).not.toThrow()

    // destroy() clears event listeners and state attributes but does not remove DOM elements
    // (that is the user's responsibility). Verify the wrapper __verinoInstance is null.
    expect((el as unknown as Record<string, unknown>).__verinoInstance).toBeNull()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// pm-guard.ts line 52: if (rafId !== null) — false branch (destroy called twice)
// ─────────────────────────────────────────────────────────────────────────────

describe('pm-guard.ts — destroy called twice hits rafId=null branch (line 52)', () => {
  it('does not throw when the pm-guard cleanup function is called a second time', () => {
    // The pm-guard plugin returns a cleanup function that is stored in pluginCleanups.
    // When destroy() is called, all plugin cleanups run. If destroy() is called a
    // second time, the cleanup runs again — at which point rafId is already null
    // (set to null at the end of the first cleanup call) and cancelAnimationFrame
    // is not called again.
    const { instance } = mount({ length: 4 })
    flushRAF() // Let the pm-guard RAF fire normally first

    instance.destroy()

    // Calling destroy() a second time should not throw even though:
    // - plugin cleanups are already cleared (pluginCleanups.length = 0)
    // The pm-guard cleanup itself has already set rafId = null.
    expect(() => instance.destroy()).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// web-otp.ts line 36 + 91: unexpected error triggers console.warn
// ─────────────────────────────────────────────────────────────────────────────

describe('web-otp.ts — unexpected error triggers console.warn (lines 36, 91)', () => {
  it('calls console.warn when credentials.get rejects with an unexpected error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // Inject a fake credentials API that rejects with a non-AbortError
    const networkError = Object.assign(new Error('Network failure'), { name: 'NetworkError' })
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockRejectedValue(networkError) },
      configurable: true,
      writable: true,
    })

    const el = makeWrapper()
    initOTP(el, { length: 6, autoFocus: false })

    // Wait for the rejected promise to settle
    await new Promise(resolve => setTimeout(resolve, 0))

    // isExpectedWebOTPError returns false for NetworkError → console.warn fires
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('web-otp'),
      expect.any(Error),
    )

    Reflect.deleteProperty(navigator, 'credentials')
    warnSpy.mockRestore()
  })

  it('does NOT call console.warn when credentials.get rejects with message "aborted"', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const abortedError = new Error('aborted')  // name is 'Error', but message is 'aborted'
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockRejectedValue(abortedError) },
      configurable: true,
      writable: true,
    })

    const el = makeWrapper()
    initOTP(el, { length: 6, autoFocus: false })

    await new Promise(resolve => setTimeout(resolve, 0))

    // message.toLowerCase() === 'aborted' → isExpectedWebOTPError returns true → no warn
    expect(warnSpy).not.toHaveBeenCalled()

    Reflect.deleteProperty(navigator, 'credentials')
    warnSpy.mockRestore()
  })

  it('returns false (line 36) for errors that are not AbortError, aborted, or InvalidStateError', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // TypeError is not an expected web-otp error → isExpectedWebOTPError returns false
    const unexpectedError = Object.assign(new TypeError('unexpected'), { name: 'TypeError' })
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockRejectedValue(unexpectedError) },
      configurable: true,
      writable: true,
    })

    const el = makeWrapper()
    initOTP(el, { length: 6, autoFocus: false })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('web-otp'),
      expect.any(TypeError),
    )

    Reflect.deleteProperty(navigator, 'credentials')
    warnSpy.mockRestore()
  })
})
