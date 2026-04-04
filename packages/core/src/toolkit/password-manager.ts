/**
 * @verino/core/toolkit/password-manager
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared password-manager badge guard utilities for browser adapters.
 *
 * Password managers (LastPass, 1Password, Dashlane, Bitwarden, Keeper) inject
 * a small icon badge into or beside <input> elements they detect as credential
 * fields. On OTP inputs this badge can overlap the final visual slot.
 *
 * These helpers let adapters widen the hidden input just enough so the badge
 * renders outside the visible slot row.
 */

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

export const PASSWORD_MANAGER_BADGE_OFFSET_PX = 40

type QueryRoot = Pick<ParentNode, 'querySelector'>

type PasswordManagerWatch = {
  hiddenInputEl: HTMLInputElement
  baseWidthPx:   number
  offsetPx:      number
  selectors:     readonly string[]
}

type PasswordManagerObserverState = {
  observer: MutationObserver
  watches:  Set<PasswordManagerWatch>
}

const passwordManagerObservers = new WeakMap<Document, PasswordManagerObserverState>()

/**
 * Returns `true` when a known password-manager badge is present in the DOM.
 * Each query is wrapped because extension-injected selectors can be malformed.
 */
export function isPasswordManagerActive(
  selectors: readonly string[] = PASSWORD_MANAGER_SELECTORS,
  root: QueryRoot = document,
): boolean {
  return selectors.some((selector) => {
    try {
      return root.querySelector(selector) !== null
    } catch {
      return false
    }
  })
}

function applyPasswordManagerOffset(watch: PasswordManagerWatch): void {
  watch.hiddenInputEl.style.width = `${watch.baseWidthPx + watch.offsetPx}px`
}

function releasePasswordManagerWatch(doc: Document, watch: PasswordManagerWatch): void {
  const state = passwordManagerObservers.get(doc)
  if (!state) return

  state.watches.delete(watch)
  if (state.watches.size > 0) return

  state.observer.disconnect()
  passwordManagerObservers.delete(doc)
}

function getPasswordManagerObserver(doc: Document): PasswordManagerObserverState | null {
  if (typeof MutationObserver === 'undefined') return null

  const existing = passwordManagerObservers.get(doc)
  if (existing) return existing

  const watches = new Set<PasswordManagerWatch>()
  const observer = new MutationObserver(() => {
    for (const watch of Array.from(watches)) {
      if (!watch.hiddenInputEl.isConnected) {
        releasePasswordManagerWatch(doc, watch)
        continue
      }

      if (isPasswordManagerActive(watch.selectors, doc)) {
        applyPasswordManagerOffset(watch)
        releasePasswordManagerWatch(doc, watch)
      }
    }
  })

  observer.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  })

  const state = { observer, watches }
  passwordManagerObservers.set(doc, state)
  return state
}

/**
 * Widen a hidden input when password-manager badges are detected.
 *
 * Returns a disconnect function that unsubscribes this input from the shared
 * document observer once the adapter unmounts.
 */
export function watchForPasswordManagerBadge(
  hiddenInputEl: HTMLInputElement,
  baseWidthPx: number,
  offsetPx = PASSWORD_MANAGER_BADGE_OFFSET_PX,
  selectors: readonly string[] = PASSWORD_MANAGER_SELECTORS,
): () => void {
  const doc = hiddenInputEl.ownerDocument ?? /* istanbul ignore next */ document
  const watch: PasswordManagerWatch = {
    hiddenInputEl,
    baseWidthPx,
    offsetPx,
    selectors,
  }

  if (isPasswordManagerActive(selectors, doc)) {
    applyPasswordManagerOffset(watch)
    return () => {}
  }

  const state = getPasswordManagerObserver(doc)
  if (!state) return () => {}

  state.watches.add(watch)

  return () => {
    releasePasswordManagerWatch(doc, watch)
  }
}
