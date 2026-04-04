/**
 * verino/core/timer
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone countdown timer — re-exported from core for use by adapters and
 * developers who want to drive their own timer UI.
 */

import type { TimerOptions, TimerControls } from './types.js'

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
export function createTimer(options: TimerOptions): TimerControls {
  const {
    totalSeconds,
    onTick,
    onExpire,
    emitInitialTickOnStart   = false,
    emitInitialTickOnRestart = emitInitialTickOnStart,
  } = options

  let remainingSeconds = totalSeconds
  let intervalId: ReturnType<typeof setInterval> | null = null

  /** Stop the running interval. No-op if already stopped. */
  function stop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  /** Stop the interval and restore `remainingSeconds` to `totalSeconds`. Does not restart. */
  function reset(): void {
    stop()
    remainingSeconds = totalSeconds
  }

  /** Begin the interval without touching `remainingSeconds` or stopping first. */
  function beginInterval(): void {
    intervalId = setInterval(() => {
      remainingSeconds -= 1
      onTick?.(remainingSeconds)
      if (remainingSeconds <= 0) {
        stop()
        onExpire?.()
      }
    }, 1000)
  }

  /**
   * Start ticking. Stops any existing interval first to prevent double-ticking.
   * If `totalSeconds <= 0`, fires `onExpire` immediately without creating an interval.
   * When `emitInitialTickOnStart` is true, fires `onTick(totalSeconds)` synchronously
   * before the first interval tick.
   */
  function start(): void {
    stop()
    if (totalSeconds <= 0) { onExpire?.(); return }
    if (emitInitialTickOnStart) onTick?.(totalSeconds)
    beginInterval()
  }

  /** Reset to `totalSeconds` and immediately start ticking. */
  function restart(): void {
    reset()
    if (totalSeconds <= 0) { onExpire?.(); return }
    if (emitInitialTickOnRestart) onTick?.(totalSeconds)
    beginInterval()
  }

  return { start, stop, reset, restart }
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
