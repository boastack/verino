/**
 * verino/plugins/pm-guard
 * ─────────────────────────────────────────────────────────────────────────────
 * Password manager badge guard for the vanilla adapter.
 *
 * Password managers (LastPass, 1Password, Dashlane, Bitwarden, Keeper) inject
 * a small icon badge into or beside <input> elements they detect as credential
 * fields. On OTP inputs this badge physically overlaps the last visual slot.
 *
 * Fix: detect when any of these extensions are active, then widen the hidden
 * input by ~40px so the badge renders outside the slot boundary.
 *
 * Detection uses a MutationObserver on documentElement to catch late-injecting
 * extensions; if the badge is already present at mount time the fix is applied
 * immediately and the observer is never started.
 */

import { watchForPasswordManagerBadge } from '@verino/core/toolkit/password-manager'
import type { VerinoPlugin, VerinoPluginContext } from './types.js'

/**
 * Password manager badge guard plugin.
 *
 * Detects active password manager extensions (LastPass, 1Password, Dashlane,
 * Bitwarden, Keeper) via DOM attribute/element selectors, then widens the hidden
 * input by `BADGE_OFFSET_PX` so the injected badge renders outside the slot boundary.
 *
 * Uses a `MutationObserver` on `document.documentElement` to catch extensions that
 * inject their badges after the initial mount. The observer is disconnected once
 * a badge is detected (single application is sufficient).
 *
 * Silently no-ops where `MutationObserver` is unavailable (e.g. older environments).
 */
export const pmGuardPlugin: VerinoPlugin = {
  name: 'pm-guard',

  install(ctx: VerinoPluginContext): () => void {
    const { hiddenInputEl, slotRowEl } = ctx

    let disconnect = () => {}
    let destroyed = false
    let rafId: number | null = null

    rafId = requestAnimationFrame(() => {
      if (destroyed) return
      const baseWidthPx = slotRowEl.getBoundingClientRect().width || 0
      disconnect = watchForPasswordManagerBadge(hiddenInputEl, baseWidthPx)
    })

    return () => {
      destroyed = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      disconnect()
      disconnect = () => {}
      rafId = null
    }
  },
}
