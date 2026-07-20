/**
 * verino/core/timer
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone countdown timer — re-exported from core for use by adapters and
 * developers who want to drive their own timer UI.
 */

import type { TimerClock, TimerController, TimerOptions, TimerListener, TimerSnapshot } from './types.js'

/**
 * Create a 1-second countdown timer.
 *
 * Lifecycle notes:
 * - `start()` is idempotent — it stops any running interval before starting a
 *   new one, so calling it twice never produces double-ticking.
 * - If `totalSeconds <= 0`, `onExpire` fires synchronously on `start()` and no
 *   interval is created (avoids decrementing to -1 and passing invalid values).
 * - `reset()` stops and restores remaining seconds without restarting.
 * - `restart()` is shorthand for `reset()` followed immediately by `start()`.
 *   Used by the vanilla adapter's "Resend" button to reset the countdown.
 *
 * @param options - Timer configuration (duration, tick callback, expiry callback).
 * @returns A `TimerControls` object with `start`, `stop`, `reset`, and `restart`.
 *
 * @example
 * ```ts
 * const t = createTimer({ totalSeconds: 60, onTick: (r) => setLabel(r), onExpire: showResend })
 * t.start()
 * // later:
 * t.stop()
 * ```
 */
export function createTimer(options: TimerOptions): TimerController {
  const {
    totalSeconds,
    expiresAt: initialExpiresAt,
    onTick,
    onExpire,
    emitInitialTickOnStart   = false,
    emitInitialTickOnRestart = emitInitialTickOnStart,
    clock: clockOptions,
  } = options

  const clock: TimerClock = {
    now: clockOptions?.now ?? (() => Date.now()),
    setInterval: clockOptions?.setInterval ?? ((callback, delayMs) => setInterval(callback, delayMs)),
    clearInterval: clockOptions?.clearInterval ?? ((id) => clearInterval(id as ReturnType<typeof setInterval>)),
  }

  if (initialExpiresAt !== undefined && !Number.isFinite(initialExpiresAt)) {
    throw new RangeError('expiresAt must be a finite Unix timestamp in milliseconds.')
  }

  const deadlineDuration = initialExpiresAt === undefined
    ? null
    : Math.max(0, Math.ceil((initialExpiresAt - clock.now()) / 1000))
  const resetDuration = totalSeconds ?? deadlineDuration ?? 0

  let remainingSeconds = deadlineDuration ?? resetDuration
  let deadlineMs: number | null = null
  let pendingDeadlineMs: number | null = initialExpiresAt ?? null
  let intervalId: unknown = null
  const listeners = new Set<TimerListener>()

  function getSnapshot(): TimerSnapshot {
    syncRemainingToDeadline()
    return Object.freeze({
      remainingSeconds,
      expiresAt: deadlineMs ?? pendingDeadlineMs,
      isRunning: intervalId !== null,
      isExpired: remainingSeconds <= 0,
    })
  }

  function notify(): void {
    const snapshot = getSnapshot()
    listeners.forEach(listener => listener(snapshot))
  }

  /** Clear the running interval without changing the current deadline. */
  function clearRunningInterval(): void {
    if (intervalId !== null) {
      clock.clearInterval(intervalId)
      intervalId = null
    }
  }

  /** Derive remaining whole seconds from the active deadline. */
  function syncRemainingToDeadline(): number {
    const effectiveDeadline = deadlineMs ?? pendingDeadlineMs
    if (effectiveDeadline !== null) {
      remainingSeconds = Math.max(0, Math.ceil((effectiveDeadline - clock.now()) / 1000))
    }
    return remainingSeconds
  }

  /** Stop and pause the running countdown. No-op if already stopped. */
  function stop(): void {
    syncRemainingToDeadline()
    clearRunningInterval()
    deadlineMs = null
    pendingDeadlineMs = null
    notify()
  }

  /** Stop the interval and restore `remainingSeconds` to `totalSeconds`. Does not restart. */
  function reset(): void {
    clearRunningInterval()
    deadlineMs = null
    pendingDeadlineMs = null
    remainingSeconds = resetDuration
    notify()
  }

  /** Begin the interval using an absolute deadline to avoid accumulated drift. */
  function beginInterval(emitLifecycle = true): void {
    deadlineMs = deadlineMs ?? pendingDeadlineMs ?? (clock.now() + remainingSeconds * 1000)
    pendingDeadlineMs = null
    intervalId = clock.setInterval(() => {
      const previousRemaining = remainingSeconds
      syncRemainingToDeadline()
      if (remainingSeconds !== previousRemaining) onTick?.(remainingSeconds)
      if (remainingSeconds <= 0) {
        clearRunningInterval()
        deadlineMs = null
        notify()
        onExpire?.()
      } else if (remainingSeconds !== previousRemaining) {
        notify()
      }
    }, 1000)
    if (emitLifecycle) notify()
  }

  /**
   * Start ticking. Stops any existing interval first to prevent double-ticking.
   * If `totalSeconds <= 0`, fires `onExpire` immediately without creating an interval.
   * When `emitInitialTickOnStart` is true, fires `onTick(totalSeconds)` synchronously
   * before the first interval tick.
   */
  function start(): void {
    if (intervalId !== null) {
      syncRemainingToDeadline()
      clearRunningInterval()
      deadlineMs = null
    }
    if (pendingDeadlineMs !== null) syncRemainingToDeadline()
    if (remainingSeconds <= 0) {
      pendingDeadlineMs = null
      notify()
      onExpire?.()
      return
    }
    if (emitInitialTickOnStart) onTick?.(remainingSeconds)
    beginInterval()
  }

  /** Reset to `totalSeconds` and immediately start ticking. */
  function restart(): void {
    clearRunningInterval()
    deadlineMs = null
    pendingDeadlineMs = null
    remainingSeconds = resetDuration
    if (remainingSeconds <= 0) {
      notify()
      onExpire?.()
      return
    }
    if (emitInitialTickOnRestart) onTick?.(remainingSeconds)
    beginInterval()
  }

  function setExpiresAt(expiresAt: number): void {
    if (!Number.isFinite(expiresAt)) {
      throw new RangeError('expiresAt must be a finite Unix timestamp in milliseconds.')
    }
    const wasRunning = intervalId !== null
    clearRunningInterval()
    deadlineMs = wasRunning ? expiresAt : null
    pendingDeadlineMs = wasRunning ? null : expiresAt
    syncRemainingToDeadline()
    if (!wasRunning && pendingDeadlineMs !== null) {
      remainingSeconds = Math.max(0, Math.ceil((pendingDeadlineMs - clock.now()) / 1000))
    }
    if (remainingSeconds <= 0) {
      deadlineMs = null
      pendingDeadlineMs = null
      onTick?.(remainingSeconds)
      notify()
      onExpire?.()
      return
    }

    onTick?.(remainingSeconds)
    if (wasRunning) beginInterval(false)
    notify()
  }

  function subscribe(listener: TimerListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  return {
    start,
    stop,
    reset,
    restart,
    pause: stop,
    resume: start,
    getRemaining: () => getSnapshot().remainingSeconds,
    getExpiresAt: () => getSnapshot().expiresAt,
    getSnapshot,
    setExpiresAt,
    subscribe,
  }
}

/**
 * Format a second count as a `m:ss` countdown string (e.g. `"1:05"`, `"0:30"`).
 * Used by the vanilla, alpine, and web-component adapters for their built-in timer UI.
 *
 * @example formatCountdown(65) → "1:05"
 * @example formatCountdown(9)  → "0:09"
 */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `0:${String(seconds).padStart(2, '0')}`
}
