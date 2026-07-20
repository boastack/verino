/**
 * verino/plugins/timer-ui
 * ─────────────────────────────────────────────────────────────────────────────
 * Built-in countdown timer + resend row for the vanilla adapter.
 *
 * Renders:
 *   .verino-timer   — "Code expires in [0:60]"  (sibling of wrapper)
 *   .verino-resend  — "Didn't receive? [Resend]" (hidden until timer expires)
 *
 * Restarts automatically on OTP RESET so that `instance.reset()` and
 * `instance.resend()` both restart the timer without any direct coupling
 * between the adapter and this plugin.
 *
 * Active only when:
 *   - `timerSeconds > 0`
 *   - `onTickCallback` is NOT provided (custom-tick mode suppresses built-in UI)
 */

import { createTimer, formatCountdown } from '@verino/core/timer'
import { createResendTimer } from '@verino/core/toolkit/timer-policy'
import type { VerinoPlugin, VerinoPluginContext } from './types.js'

/**
 * Built-in countdown timer + resend row plugin.
 *
 * Has two operating modes determined at install time:
 * - **Built-in UI mode** (`onTickCallback` absent): builds `.verino-timer` and
 *   `.verino-resend` DOM elements as siblings of the wrapper element and drives
 *   them with a `createTimer` instance.
 * - **Custom-tick mode** (`onTickCallback` present): runs the timer internally
 *   but skips all DOM work — the caller is responsible for rendering the UI
 *   using the values passed to `onTickCallback`.
 *
 * No-ops entirely when `timerSeconds <= 0`.
 */
export const timerUIPlugin: VerinoPlugin = {
  name: 'timer-ui',

  install(ctx: VerinoPluginContext): () => void {
    const {
      otp, wrapperEl, hiddenInputEl, timerSeconds, resendCooldown,
      onResend, onTickCallback, onExpire, clearField, messages,
    } = ctx

    // Always expose a controller, even when the visual timer is disabled. This
    // keeps the adapter API shape stable for integrations that bind controls
    // before knowing whether a timer was configured.
    if (timerSeconds <= 0) {
      const inactiveTimer = createTimer({ totalSeconds: 0 })
      wrapperEl.__verinoTimerController = inactiveTimer
      return () => {
        inactiveTimer.stop()
        if (wrapperEl.__verinoTimerController === inactiveTimer) {
          wrapperEl.__verinoTimerController = null
        }
      }
    }

    // Custom-tick mode: caller drives their own countdown display via onTick.
    // Fire the timer but skip building any DOM — the caller renders the UI.
    if (onTickCallback) {
      const customCountdown = createTimer({
        totalSeconds: timerSeconds,
        emitInitialTickOnStart: true,
        emitInitialTickOnRestart: true,
        onTick:   onTickCallback,
        onExpire: onExpire,
      })
      customCountdown.start()
      wrapperEl.__verinoTimerController = customCountdown

      const unsubReset = otp.subscribe((_state, event) => {
        if (event.type === 'RESET') customCountdown.restart()
      })

      return () => {
        customCountdown.stop()
        unsubReset()
        if (wrapperEl.__verinoTimerController === customCountdown) {
          wrapperEl.__verinoTimerController = null
        }
      }
    }

    // ── Build DOM ──────────────────────────────────────────────────────────

    // Remove stale footer from a previous mount on this same wrapper.
    wrapperEl.__verinoFooterEl?.remove()
    wrapperEl.__verinoResendRowEl?.remove()
    wrapperEl.__verinoFooterEl    = null
    wrapperEl.__verinoResendRowEl = null

    const footerEl = document.createElement('div')
    footerEl.className = 'verino-timer'
    footerEl.id = `${otp.getGroupId()}-timer`
    footerEl.setAttribute('role', 'timer')
    footerEl.setAttribute('aria-live', 'off')

    const expiresLabel = document.createElement('span')
    expiresLabel.className   = 'verino-timer-label'
    expiresLabel.textContent = messages.expiresIn

    const badgeEl = document.createElement('span')
    badgeEl.className   = 'verino-timer-badge'
    badgeEl.textContent = formatCountdown(timerSeconds)
    footerEl.setAttribute('aria-label', `${messages.expiresIn} ${formatCountdown(timerSeconds)}`)

    footerEl.appendChild(expiresLabel)
    footerEl.appendChild(badgeEl)
    wrapperEl.insertAdjacentElement('afterend', footerEl)

    const resendRowEl = document.createElement('div')
    resendRowEl.className = 'verino-resend'
    resendRowEl.id = `${otp.getGroupId()}-resend`
    resendRowEl.setAttribute('role', 'status')
    resendRowEl.setAttribute('aria-live', 'polite')
    resendRowEl.setAttribute('aria-atomic', 'true')

    const didntReceiveLabel = document.createElement('span')
    didntReceiveLabel.textContent = messages.resendPrompt

    const resendBtn = document.createElement('button')
    resendBtn.className   = 'verino-resend-btn'
    resendBtn.textContent = messages.resendAction
    resendBtn.type        = 'button'
    resendBtn.setAttribute('aria-label', messages.resendButtonLabel)

    resendRowEl.appendChild(didntReceiveLabel)
    resendRowEl.appendChild(resendBtn)
    footerEl.insertAdjacentElement('afterend', resendRowEl)

    // Store on wrapper so the next mount can clean these up.
    wrapperEl.__verinoFooterEl    = footerEl
    wrapperEl.__verinoResendRowEl = resendRowEl
    hiddenInputEl.setAttribute('aria-describedby', footerEl.id)

    // ── Helpers ────────────────────────────────────────────────────────────

    function showResend(): void {
      footerEl.style.display = 'none'
      resendRowEl.classList.add('is-visible')
      hiddenInputEl.setAttribute('aria-describedby', resendRowEl.id)
    }

    function showTimer(remaining: number): void {
      resendRowEl.classList.remove('is-visible')
      footerEl.style.display = 'flex'
      badgeEl.textContent = formatCountdown(remaining)
      footerEl.setAttribute('aria-label', `${messages.expiresIn} ${formatCountdown(remaining)}`)
      hiddenInputEl.setAttribute('aria-describedby', footerEl.id)
    }

    const resendTimer = createResendTimer({
      timerSeconds,
      resendCooldown,
      clearField,
      showTimer,
      showResend,
      onExpire,
      onResend,
    })
    resendTimer.start()
    wrapperEl.__verinoTimerController = resendTimer

    // ── Resend button ──────────────────────────────────────────────────────

    function onResendClick(): void {
      resendTimer.resend()
    }

    resendBtn.addEventListener('click', onResendClick)

    // ── Restart on RESET (fired by instance.reset() / instance.resend()) ──

    const unsubReset = otp.subscribe((_state, event) => {
      if (event.type !== 'RESET') return
      resendTimer.handleExternalReset()
    })

    // ── Cleanup ────────────────────────────────────────────────────────────

    return () => {
      resendTimer.stop()
      resendBtn.removeEventListener('click', onResendClick)
      unsubReset()
      footerEl.remove()
      resendRowEl.remove()
      hiddenInputEl.removeAttribute('aria-describedby')
      wrapperEl.__verinoFooterEl    = null
      wrapperEl.__verinoResendRowEl = null
      if (wrapperEl.__verinoTimerController === resendTimer) {
        wrapperEl.__verinoTimerController = null
      }
    }
  },
}
