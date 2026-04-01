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
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import { createTimer, formatCountdown } from '@verino/core'
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
      otp, wrapperEl, timerSeconds, resendCooldown,
      onResend, onTickCallback, onExpire,
    } = ctx

    // No timer configured — nothing to do.
    if (timerSeconds <= 0) return () => {}

    // Custom-tick mode: caller drives their own countdown display via onTick.
    // Fire the timer but skip building any DOM — the caller renders the UI.
    if (onTickCallback) {
      const customCountdown = createTimer({
        totalSeconds: timerSeconds,
        onTick:   onTickCallback,
        onExpire: onExpire,
      })
      customCountdown.start()

      const unsubReset = otp.subscribe((_state, event) => {
        if (event.type === 'RESET') customCountdown.restart()
      })

      return () => { customCountdown.stop(); unsubReset() }
    }

    // ── Build DOM ──────────────────────────────────────────────────────────

    // Remove stale footer from a previous mount on this same wrapper.
    wrapperEl.__verinoFooterEl?.remove()
    wrapperEl.__verinoResendRowEl?.remove()
    wrapperEl.__verinoFooterEl    = null
    wrapperEl.__verinoResendRowEl = null

    const footerEl = document.createElement('div')
    footerEl.className = 'verino-timer'

    const expiresLabel = document.createElement('span')
    expiresLabel.className   = 'verino-timer-label'
    expiresLabel.textContent = 'Code expires in'

    const badgeEl = document.createElement('span')
    badgeEl.className   = 'verino-timer-badge'
    badgeEl.textContent = formatCountdown(timerSeconds)

    footerEl.appendChild(expiresLabel)
    footerEl.appendChild(badgeEl)
    wrapperEl.insertAdjacentElement('afterend', footerEl)

    const resendRowEl = document.createElement('div')
    resendRowEl.className = 'verino-resend'

    const didntReceiveLabel = document.createElement('span')
    didntReceiveLabel.textContent = 'Didn\u2019t receive the code?'

    const resendBtn = document.createElement('button')
    resendBtn.className   = 'verino-resend-btn'
    resendBtn.textContent = 'Resend'
    resendBtn.type        = 'button'

    resendRowEl.appendChild(didntReceiveLabel)
    resendRowEl.appendChild(resendBtn)
    footerEl.insertAdjacentElement('afterend', resendRowEl)

    // Store on wrapper so the next mount can clean these up.
    wrapperEl.__verinoFooterEl    = footerEl
    wrapperEl.__verinoResendRowEl = resendRowEl

    // ── Helpers ────────────────────────────────────────────────────────────

    let resendCountdown: ReturnType<typeof createTimer> | null = null

    function showResend(): void {
      footerEl.style.display = 'none'
      resendRowEl.classList.add('is-visible')
    }

    function showTimer(remaining: number): void {
      resendRowEl.classList.remove('is-visible')
      footerEl.style.display = 'flex'
      badgeEl.textContent = formatCountdown(remaining)
    }

    // ── Main countdown ─────────────────────────────────────────────────────

    const mainCountdown = createTimer({
      totalSeconds: timerSeconds,
      onTick:   (r) => { badgeEl.textContent = formatCountdown(r) },
      onExpire: () => { showResend(); onExpire?.() },
    })
    mainCountdown.start()

    // ── Resend button ──────────────────────────────────────────────────────

    function onResendClick(): void {
      showTimer(resendCooldown)
      resendCountdown?.stop()
      resendCountdown = createTimer({
        totalSeconds: resendCooldown,
        onTick:   (r) => { badgeEl.textContent = formatCountdown(r) },
        onExpire: () => { showResend() },
      })
      resendCountdown.start()
      onResend?.()
    }

    resendBtn.addEventListener('click', onResendClick)

    // ── Restart on RESET (fired by instance.reset() / instance.resend()) ──

    const unsubReset = otp.subscribe((_state, event) => {
      if (event.type !== 'RESET') return
      resendCountdown?.stop()
      resendCountdown = null
      showTimer(timerSeconds)
      mainCountdown.restart()
    })

    // ── Cleanup ────────────────────────────────────────────────────────────

    return () => {
      mainCountdown.stop()
      resendCountdown?.stop()
      resendBtn.removeEventListener('click', onResendClick)
      unsubReset()
      footerEl.remove()
      resendRowEl.remove()
      wrapperEl.__verinoFooterEl    = null
      wrapperEl.__verinoResendRowEl = null
    }
  },
}
