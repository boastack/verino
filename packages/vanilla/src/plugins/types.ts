/**
 * verino/plugins — shared types for the vanilla adapter plugin system.
 *
 * A VerinoPlugin is a named, self-contained unit of functionality that can be
 * installed into the vanilla adapter at mount time. Each plugin receives a
 * context object and returns a cleanup function invoked on destroy().
 *
 * Plugin contract:
 *   install(ctx) → cleanup
 */

import type { InputType, OTPInstance } from '@verino/core'

// ─────────────────────────────────────────────────────────────────────────────
// WRAPPER AUGMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Augmented HTMLElement used as the verino wrapper.
 * The timer-ui plugin stores its footer element references here so that
 * subsequent mounts on the same DOM node can remove stale footers without
 * fragile sibling-DOM walks.
 */
export type VerinoWrapper = HTMLElement & {
  __verinoFooterEl?:    HTMLDivElement | null
  __verinoResendRowEl?: HTMLDivElement | null
  __verinoInstance?:    { destroy(): void } | null
}


// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable context object passed to every plugin's `install` function.
 * Plugins should only use what they need — the full surface is exposed so
 * plugins remain independent of each other and of the adapter internals.
 */
export type VerinoPluginContext = {
  /** The core OTP state machine instance. */
  otp:            OTPInstance
  /** The user-supplied wrapper element, augmented with footer references. */
  wrapperEl:      VerinoWrapper
  /** The hidden real `<input>` element. */
  hiddenInputEl:  HTMLInputElement
  /** The `div.verino-content` row that holds visual slot divs. */
  slotRowEl:      HTMLDivElement
  /** Number of slots. */
  slotCount:      number
  /** Active character-set type for this instance. */
  inputType:      InputType
  /** Optional per-character regex that overrides `inputType`. */
  pattern?:       RegExp
  /** Initial timer duration in seconds. 0 means no timer. */
  timerSeconds:   number
  /** Resend cooldown in seconds. */
  resendCooldown: number
  /** Called when the Resend button is clicked. */
  onResend?:      () => void
  /** Called every second with remaining seconds (suppresses built-in timer UI). */
  onTickCallback?: (remaining: number) => void
  /** Called when the countdown reaches zero. */
  onExpire?:      () => void
  /** Clear the current code and visual field state without managing plugin timers. */
  clearField:     () => void
  /** Force a full DOM sync from OTP core state → slot divs. */
  syncSlots:      () => void
}


// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Verino plugin is a named object with a single `install` method.
 * `install` receives the plugin context and returns a cleanup function.
 * The cleanup function is called by `instance.destroy()`.
 *
 * @example
 * ```ts
 * const myPlugin: VerinoPlugin = {
 *   name: 'my-plugin',
 *   install(ctx) {
 *     const unsub = ctx.otp.subscribe((_state, event) => {
 *       if (event.type === 'COMPLETE') doSomething(event.value)
 *     })
 *     return unsub
 *   },
 * }
 * ```
 */
export type VerinoPlugin = {
  /** Unique name — used in debug messages only. */
  name:    string
  /**
   * Called once at mount time.
   * @returns A cleanup function called on `instance.destroy()`.
   */
  install: (ctx: VerinoPluginContext) => () => void
}
