/**
 * verino/plugins/web-otp
 * ─────────────────────────────────────────────────────────────────────────────
 * Web OTP API (SMS autofill) for the vanilla adapter.
 *
 * When supported (Android Chrome), calls `navigator.credentials.get` with
 * `{ otp: { transport: ['sms'] } }` to intercept incoming OTP SMSes without
 * any user gesture. Fills OTP slots directly via the core state machine.
 *
 * Cleanup:
 *   - The AbortController is signalled on destroy() to cancel the pending request.
 *   - A 5-minute safety timeout prevents the controller from leaking past page
 *     navigation in long-lived SPAs.
 *
 * No-op in all environments that do not support `navigator.credentials`.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import { filterString } from '../../core/index.js'
import type { VerinoPlugin, VerinoPluginContext } from './types.js'

/** Maximum wait for an SMS OTP — matches the typical validity window. */
const WEB_OTP_TIMEOUT_MS = 5 * 60 * 1000

// The Web OTP spec adds OTPCredential to the Credential type but it is not
// yet in TypeScript's standard DOM lib. Declare it locally.
interface OTPCredential extends Credential { code: string }

/**
 * Web OTP API (SMS autofill) plugin.
 *
 * Calls `navigator.credentials.get({ otp: { transport: ['sms'] } })` once at
 * mount time. When the browser intercepts a matching OTP SMS, the credential's
 * code is filtered, inserted into slots, and the hidden input cursor is advanced.
 *
 * - Silently no-ops in environments without `navigator.credentials`.
 * - The AbortController is signalled on `destroy()` to cancel the pending request.
 * - A 5-minute safety timeout aborts the request to prevent leaks in long-lived SPAs.
 */
export const webOTPPlugin: VerinoPlugin = {
  name: 'web-otp',

  install(ctx: VerinoPluginContext): () => void {
    const { otp, hiddenInputEl, slotCount, inputType, pattern, syncSlots } = ctx

    if (typeof navigator === 'undefined' || !('credentials' in navigator)) {
      return () => {}
    }

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), WEB_OTP_TIMEOUT_MS)

    // Guard against the promise resolving after destroy() — the component may
    // have unmounted before the SMS arrives. Any otp/DOM access after destroy
    // would throw or produce stale side-effects.
    let destroyed = false

    ;(navigator.credentials.get as (opts: object) => Promise<OTPCredential | null>)({
      otp:    { transport: ['sms'] },
      signal: controller.signal,
    }).then((credential) => {
      clearTimeout(timeoutId)
      if (destroyed || !credential?.code) return

      const valid = filterString(credential.code, inputType, pattern).slice(0, slotCount)
      if (!valid) return

      otp.reset()
      for (let i = 0; i < valid.length; i++) otp.insert(valid[i], i)

      const nextCursor = Math.min(valid.length, slotCount - 1)
      hiddenInputEl.value = valid
      hiddenInputEl.setSelectionRange(nextCursor, nextCursor)
      otp.move(nextCursor)
      syncSlots()
    }).catch((err: unknown) => {
      clearTimeout(timeoutId)
      // AbortError is expected on destroy() or timeout — anything else is unexpected
      if ((err as { name?: string })?.name !== 'AbortError') {
        console.warn('[verino] web-otp: unexpected error', err)
      }
    })

    return () => {
      destroyed = true
      clearTimeout(timeoutId)
      controller.abort()
    }
  },
}
