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
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import type { VerinoPlugin, VerinoPluginContext } from './types.js'

const PASSWORD_MANAGER_SELECTORS = [
  '[data-lastpass-icon-root]',
  '[data-lastpass-root]',
  '[data-op-autofill]',
  '[data-1p-ignore]',
  '[data-dashlane-rid]',
  '[data-dashlane-label]',
  '[data-kwimpalastatus]',
  '[data-bwautofill]',
  'com-bitwarden-browser-arctic-modal',
]

const BADGE_OFFSET_PX = 40

/**
 * Returns `true` if any known password manager badge element is present in the DOM.
 *
 * Each selector query is wrapped in a try/catch because some selectors (e.g.
 * attribute selectors with invalid syntax injected by extensions) can throw
 * `SyntaxError` in strict parsers.
 */
function isPasswordManagerActive(): boolean {
  return PASSWORD_MANAGER_SELECTORS.some(sel => {
    try { return document.querySelector(sel) !== null }
    catch { return false }
  })
}

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

    if (typeof MutationObserver === 'undefined') return () => {}

    // Measure slot row width inside a RAF so layout is complete.
    let observer: MutationObserver | null = null

    requestAnimationFrame(() => {
      const baseWidthPx = slotRowEl.getBoundingClientRect().width || 0

      function applyOffset(): void {
        hiddenInputEl.style.width = `${baseWidthPx + BADGE_OFFSET_PX}px`
      }

      if (isPasswordManagerActive()) {
        applyOffset()
        return
      }

      observer = new MutationObserver(() => {
        if (isPasswordManagerActive()) {
          applyOffset()
          observer?.disconnect()
          observer = null
        }
      })

      // attributeFilter narrows mutations to the data-* attributes used by
      // known password managers — prevents the observer from firing on every
      // DOM mutation across the page.
      // Note: Bitwarden's `com-bitwarden-browser-arctic-modal` is a custom
      // *element* (not an attribute), so it is detected via `childList: true`
      // (in the observe() call below) rather than attributeFilter.
      observer.observe(document.documentElement, {
        childList:       true,
        subtree:         true,
        attributes:      true,
        attributeFilter: [
          'data-lastpass-icon-root',
          'data-lastpass-root',
          'data-op-autofill',
          'data-1p-ignore',
          'data-dashlane-rid',
          'data-dashlane-label',
          'data-kwimpalastatus',
          'data-bwautofill',
        ],
      })
    })

    return () => { observer?.disconnect(); observer = null }
  },
}
