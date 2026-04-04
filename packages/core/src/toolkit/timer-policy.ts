/**
 * Shared resend policy helper for adapter-level timer UI.
 *
 * The pure core machine stores timer configuration, while adapters and DOM
 * wrappers delegate live countdown behavior to `createTimer` (from core) and
 * the resend-aware `createResendTimer` below.
 */
import { createTimer } from '../timer.js'

/**
 * Lifecycle for resend-aware timer UIs that swap between countdown and resend
 * affordances.
 */
export type ResendTimer = {
  start: () => void
  restartMain: () => void
  handleExternalReset: () => void
  resend: () => void
  stop: () => void
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
    return {
      start: noop,
      restartMain: noop,
      handleExternalReset: noop,
      resend: () => { clearField(); onResend?.() },
      stop: noop,
    }
  }

  const mainCountdown = createTimer({
    totalSeconds: timerSeconds,
    emitInitialTickOnStart: true,
    emitInitialTickOnRestart: true,
    onTick: showTimer,
    onExpire: () => {
      showResend()
      onExpire?.()
    },
  })

  let resendCountdown: ReturnType<typeof createTimer> | null = null
  let suppressNextExternalReset = false

  function stopCooldown(): void {
    resendCountdown?.stop()
    resendCountdown = null
  }

  function restartMain(): void {
    suppressNextExternalReset = false
    stopCooldown()
    mainCountdown.restart()
  }

  return {
    start(): void {
      mainCountdown.start()
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
      resendCountdown = createTimer({
        totalSeconds: resendCooldown,
        emitInitialTickOnStart: true,
        onTick: showTimer,
        onExpire: showResend,
      })
      resendCountdown.start()
      onResend?.()
    },
    stop(): void {
      suppressNextExternalReset = false
      mainCountdown.stop()
      stopCooldown()
    },
  }
}
