/** @jest-environment jsdom */

import {
  createFrameScheduler,
  createResendTimer,
  migrateProgrammaticValue,
  PASSWORD_MANAGER_BADGE_OFFSET_PX,
  seedProgrammaticValue,
  isPasswordManagerActive,
  migrateValueForConfigChange,
  syncProgrammaticValue,
  syncExternalValue,
  watchForPasswordManagerBadge,
} from '@verino/core/toolkit'
import { createOTP, createTimer } from '@verino/core'

describe('@verino/core/toolkit password-manager helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.innerHTML = '<head></head><body></body>'
  })

  it('detects a matching password-manager badge selector', () => {
    const badge = document.createElement('div')
    badge.setAttribute('data-lastpass-icon-root', '')
    document.body.appendChild(badge)

    expect(isPasswordManagerActive()).toBe(true)
  })

  it('returns false when a selector throws during lookup', () => {
    expect(isPasswordManagerActive(['['])).toBe(false)
  })

  it('applies the width offset immediately when a badge is already present', () => {
    const hiddenInput = document.createElement('input')
    document.body.appendChild(hiddenInput)

    const badge = document.createElement('div')
    badge.setAttribute('data-lastpass-root', '')
    document.body.appendChild(badge)

    const cleanup = watchForPasswordManagerBadge(hiddenInput, 120)

    expect(hiddenInput.style.width).toBe(`${120 + PASSWORD_MANAGER_BADGE_OFFSET_PX}px`)
    expect(typeof cleanup).toBe('function')
    cleanup()
  })

  it('returns a noop cleanup when MutationObserver is unavailable', () => {
    const originalMutationObserver = globalThis.MutationObserver
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: undefined,
    })

    const hiddenInput = document.createElement('input')
    const cleanup = watchForPasswordManagerBadge(hiddenInput, 80)

    expect(hiddenInput.style.width).toBe('')
    expect(typeof cleanup).toBe('function')
    cleanup()

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: originalMutationObserver,
    })
  })

  it('observes until a badge appears, then applies the width offset and disconnects', () => {
    const hiddenInput = document.createElement('input')
    document.body.appendChild(hiddenInput)

    const disconnect = jest.fn()
    let mutationCallback: MutationCallback = () => {}

    class MockMutationObserver {
      constructor(callback: MutationCallback) {
        mutationCallback = callback
      }

      observe() {}
      disconnect = disconnect
    }

    const originalMutationObserver = globalThis.MutationObserver
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: MockMutationObserver,
    })

    const cleanup = watchForPasswordManagerBadge(hiddenInput, 90, 24, ['[data-bwautofill]'])
    expect(hiddenInput.style.width).toBe('')

    const badge = document.createElement('div')
    badge.setAttribute('data-bwautofill', '')
    document.body.appendChild(badge)
    mutationCallback([], {} as MutationObserver)

    expect(hiddenInput.style.width).toBe('114px')
    expect(disconnect).toHaveBeenCalledTimes(1)

    cleanup()
    expect(disconnect).toHaveBeenCalledTimes(1)

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: originalMutationObserver,
    })
  })

  it('reuses a single global observer until the last watcher unsubscribes', () => {
    const hiddenInputA = document.createElement('input')
    const hiddenInputB = document.createElement('input')
    document.body.appendChild(hiddenInputA)
    document.body.appendChild(hiddenInputB)

    const disconnect = jest.fn()
    const observe = jest.fn()
    const construct = jest.fn()

    class MockMutationObserver {
      constructor(_callback: MutationCallback) {
        construct()
      }

      observe = observe
      disconnect = disconnect
    }

    const originalMutationObserver = globalThis.MutationObserver
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: MockMutationObserver,
    })

    const cleanupA = watchForPasswordManagerBadge(hiddenInputA, 100)
    const cleanupB = watchForPasswordManagerBadge(hiddenInputB, 120)

    expect(construct).toHaveBeenCalledTimes(1)
    expect(observe).toHaveBeenCalledTimes(1)

    cleanupA()
    expect(disconnect).not.toHaveBeenCalled()

    cleanupB()
    expect(disconnect).toHaveBeenCalledTimes(1)

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: originalMutationObserver,
    })
  })
})

describe('@verino/core/toolkit frame scheduler', () => {
  it('cancels queued animation frames before they run', () => {
    let nextId = 0
    const queued = new Map<number, FrameRequestCallback>()

    const originalRequestAnimationFrame = globalThis.requestAnimationFrame
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame

    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        nextId += 1
        queued.set(nextId, callback)
        return nextId
      },
    })

    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: (frameId: number) => {
        queued.delete(frameId)
      },
    })

    const scheduler = createFrameScheduler(() => true)
    const callback = jest.fn()

    scheduler.schedule(callback)
    scheduler.cancelAll()

    queued.forEach((frame) => frame(0))
    expect(callback).not.toHaveBeenCalled()

    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: originalRequestAnimationFrame,
    })
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: originalCancelAnimationFrame,
    })
  })
})

describe('@verino/core/toolkit timer policy', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('emits the initial tick and restarts a shared countdown policy', () => {
    const onTick = jest.fn()
    const onExpire = jest.fn()
    const countdown = createTimer({
      totalSeconds: 3,
      emitInitialTickOnStart: true,
      emitInitialTickOnRestart: true,
      onTick,
      onExpire,
    })

    countdown.start()
    expect(onTick).toHaveBeenNthCalledWith(1, 3)

    jest.advanceTimersByTime(2000)
    expect(onTick).toHaveBeenNthCalledWith(2, 2)
    expect(onTick).toHaveBeenNthCalledWith(3, 1)

    countdown.restart()
    expect(onTick).toHaveBeenNthCalledWith(4, 3)

    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenLastCalledWith(0)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('can emit the initial tick only on first start but not on restart', () => {
    const onTick = jest.fn()
    const countdown = createTimer({
      totalSeconds: 3,
      emitInitialTickOnStart: true,
      emitInitialTickOnRestart: false,
      onTick,
    })

    countdown.start()
    expect(onTick).toHaveBeenNthCalledWith(1, 3)

    jest.advanceTimersByTime(1000)
    expect(onTick).toHaveBeenNthCalledWith(2, 2)

    onTick.mockClear()
    countdown.restart()

    jest.advanceTimersByTime(1000)
    expect(onTick).toHaveBeenCalledTimes(1)
    expect(onTick).toHaveBeenCalledWith(2)
  })

  it('runs built-in resend policy through main expiry, resend cooldown, and explicit reset events', () => {
    const showTimer = jest.fn()
    const showResend = jest.fn()
    const clearField = jest.fn()
    const onExpire = jest.fn()
    const onResend = jest.fn()

    const resendTimer = createResendTimer({
      timerSeconds: 3,
      resendCooldown: 2,
      showTimer,
      showResend,
      clearField,
      onExpire,
      onResend,
    })

    resendTimer.start()
    expect(showTimer).toHaveBeenNthCalledWith(1, 3)

    jest.advanceTimersByTime(3000)
    expect(showTimer).toHaveBeenNthCalledWith(4, 0)
    expect(showResend).toHaveBeenCalledTimes(1)
    expect(onExpire).toHaveBeenCalledTimes(1)

    resendTimer.resend()
    expect(clearField).toHaveBeenCalledTimes(1)
    expect(showTimer).toHaveBeenNthCalledWith(5, 2)
    expect(onResend).toHaveBeenCalledTimes(1)

    // The reset caused by clearField should be ignored once.
    resendTimer.handleExternalReset()
    jest.advanceTimersByTime(1000)
    expect(showTimer).toHaveBeenNthCalledWith(6, 1)

    // A later external reset should restart the main timer.
    resendTimer.handleExternalReset()
    expect(showTimer).toHaveBeenNthCalledWith(7, 3)
  })
})

describe('@verino/core/toolkit external value sync', () => {
  it('applies an external value once and reports unchanged syncs as no-ops', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })

    const first = syncExternalValue(otp, '12', { length: 4, type: 'numeric' })
    expect(first.changed).toBe(true)
    expect(first.value).toBe('12')
    expect(first.snapshot.slotValues).toEqual(['1', '2', '', ''])

    const second = syncExternalValue(otp, '12', { length: 4, type: 'numeric' })
    expect(second.changed).toBe(false)
    expect(second.value).toBe('12')
  })

  it('re-filters existing code when config rules tighten', () => {
    const otp = createOTP({ length: 4, type: 'alphanumeric' })
    syncExternalValue(otp, '1A2B', { length: 4, type: 'alphanumeric' })
    otp.move(3)

    const migrated = migrateValueForConfigChange(otp, { length: 4, type: 'numeric' })

    expect(migrated.changed).toBe(true)
    expect(migrated.value).toBe('12')
    expect(migrated.snapshot.slotValues).toEqual(['1', '2', '', ''])
    expect(migrated.snapshot.activeSlot).toBe(1)
  })

  it('reports input-end selection for live programmatic value sync', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })

    const result = syncProgrammaticValue(otp, '12', { length: 4, type: 'numeric' }, 'input-end')

    expect(result.changed).toBe(true)
    expect(result.value).toBe('12')
    expect(result.nextSelection).toBe(2)
    expect(result.snapshot.slotValues).toEqual(['1', '2', '', ''])
  })

  it('preserves the requested active slot when seeding rebuilt state', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })

    const result = seedProgrammaticValue(
      otp,
      '1234',
      { length: 4, type: 'numeric' },
      { preserveActiveSlot: 1 },
    )

    expect(result.changed).toBe(true)
    expect(result.value).toBe('1234')
    expect(result.nextSelection).toBe(1)
    expect(result.snapshot.activeSlot).toBe(1)
  })

  it('exposes the migrated active slot as the next selection', () => {
    const otp = createOTP({ length: 4, type: 'alphanumeric' })
    syncExternalValue(otp, '1A2B', { length: 4, type: 'alphanumeric' })
    otp.move(3)

    const migrated = migrateProgrammaticValue(otp, { length: 4, type: 'numeric' })

    expect(migrated.changed).toBe(true)
    expect(migrated.value).toBe('12')
    expect(migrated.nextSelection).toBe(1)
    expect(migrated.snapshot.activeSlot).toBe(1)
  })
})
