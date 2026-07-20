/**
 * Shared resend policy helper for adapter-level timer UI.
 *
 * The pure core machine stores timer configuration, while adapters and DOM
 * wrappers delegate live countdown behavior to `createTimer` (from core) and
 * the resend-aware `createResendTimer` below.
 */
import { createTimer } from '../timer.js'
import type { TimerController, TimerListener, TimerSnapshot } from '../types.js'

/**
 * Lifecycle for resend-aware timer UIs that swap between countdown and resend
 * affordances.
 */
export type ResendTimer = TimerController & {
  /** The OTP validity countdown. Remains available after expiry. */
  expiryTimer: TimerController
  /** The resend throttling countdown. Starts only after `resend()`. */
  cooldownTimer: TimerController
  restartMain: () => void
  handleExternalReset: () => void
  resend: () => void
}

/**
 * Options for the shared resend/timer policy.
 */
export type ResendTimerOptions = {
  timerSeconds: number
  resendCooldown: number
  showTimer: (remaining: number) => void
  showResend: () => void
  clearField: () => void
  onExpire?: () => void
  onResend?: () => void
}

const noop = (): void => {}

/**
 * Create the shared resend/timer behavior used by adapters that expose a
 * built-in resend flow.
 */
export function createResendTimer(options: ResendTimerOptions): ResendTimer {
  const {
    timerSeconds,
    resendCooldown,
    showTimer,
    showResend,
    clearField,
    onExpire,
    onResend,
  } = options

  if (timerSeconds <= 0) {
    const expiryTimer = createTimer({ totalSeconds: 0 })
    const cooldownTimer = createTimer({ totalSeconds: Math.max(0, resendCooldown) })
    return {
      ...expiryTimer,
      expiryTimer,
      cooldownTimer,
      restartMain: noop,
      handleExternalReset: noop,
      resend: () => { clearField(); onResend?.() },
    }
  }

  const expiryTimer = createTimer({
    totalSeconds: timerSeconds,
    emitInitialTickOnStart: true,
    emitInitialTickOnRestart: true,
    onTick: showTimer,
    onExpire: () => {
      showResend()
      onExpire?.()
    },
  })

  const cooldownTimer = createTimer({
    totalSeconds: Math.max(0, resendCooldown),
    emitInitialTickOnStart: true,
    onTick: showTimer,
    onExpire: showResend,
  })

  let suppressNextExternalReset = false
  let activeCountdown: TimerController = expiryTimer
  const listeners = new Set<TimerListener>()
  let unsubscribeActive = activeCountdown.subscribe(forwardSnapshot)

  function forwardSnapshot(snapshot: TimerSnapshot): void {
    listeners.forEach(listener => listener(snapshot))
  }

  function setActiveCountdown(next: TimerController, emitSnapshot = true): void {
    if (activeCountdown === next) return
    unsubscribeActive()
    activeCountdown = next
    unsubscribeActive = activeCountdown.subscribe(forwardSnapshot)
    if (emitSnapshot) forwardSnapshot(activeCountdown.getSnapshot())
  }

  function stopCooldown(emitSnapshot = false): void {
    if (activeCountdown === cooldownTimer) setActiveCountdown(expiryTimer, emitSnapshot)
    cooldownTimer.stop()
  }

  function restartMain(): void {
    suppressNextExternalReset = false
    stopCooldown()
    expiryTimer.restart()
  }

  return {
    start(): void {
      activeCountdown.start()
    },
    restartMain,
    handleExternalReset(): void {
      if (suppressNextExternalReset) {
        suppressNextExternalReset = false
        return
      }
      restartMain()
    },
    resend(): void {
      suppressNextExternalReset = true
      clearField()
      stopCooldown()
      setActiveCountdown(cooldownTimer)
      cooldownTimer.restart()
      onResend?.()
    },
    stop(): void {
      suppressNextExternalReset = false
      expiryTimer.stop()
      stopCooldown(true)
    },
    pause(): void {
      activeCountdown.pause()
    },
    resume(): void {
      activeCountdown.resume()
    },
    reset(): void {
      activeCountdown.reset()
    },
    restart(): void {
      activeCountdown.restart()
    },
    getRemaining(): number {
      return activeCountdown.getRemaining()
    },
    getExpiresAt(): number | null {
      return activeCountdown.getExpiresAt()
    },
    getSnapshot(): TimerSnapshot {
      return activeCountdown.getSnapshot()
    },
    setExpiresAt(expiresAt: number): void {
      activeCountdown.setExpiresAt(expiresAt)
    },
    subscribe(listener: TimerListener): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    expiryTimer,
    cooldownTimer,
  }
}
