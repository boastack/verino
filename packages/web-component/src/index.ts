/**
 * @verino/web-component
 * ─────────────────────────────────────────────────────────────────────────────
 * Framework-agnostic Web Component — <verino-input>
 * Uses single hidden-input architecture for correct SMS autofill + a11y.
 *
 * Attributes:
 *   length           Number of slots (default: 6)
 *   type             Character set: numeric | alphabet | alphanumeric | any (default: numeric)
 *   timer            Countdown seconds (default: 0 = no timer)
 *   resend-after     Cooldown seconds before the built-in Resend re-enables (default: 30)
 *   disabled         Boolean attribute — disables all input when present
 *   readonly         Boolean attribute — blocks mutations, preserves focus and navigation
 *   separator-after  Slot index (1-based) or comma-separated list, e.g. "3" or "2,4" (default: none)
 *   separator        Separator character to render (default: —)
 *   masked           Boolean attribute — shows mask glyph in filled slots; switches hidden input to type="password"
 *   mask-char        Glyph shown in filled slots when masked (default: ●)
 *   name             Sets the hidden input's name attr for native form submission
 *   placeholder      Character shown in empty slots (e.g. "○" or "_")
 *   default-value    Uncontrolled initial value applied once on mount; does not trigger complete event
 *   id-base          Stable prefix for request-scoped ids
 *   auto-focus       Boolean attribute — focus input on mount (default: true when absent)
 *   select-on-focus  Boolean attribute — selects the current slot char on focus
 *   blur-on-complete Boolean attribute — blurs the input when all slots are filled
 *   haptic           Boolean attribute — triggers navigator.vibrate on completion and error (default: true)
 *   sound            Boolean attribute — plays a short tone via Web Audio API on completion (default: false)
 *
 * Events:
 *   complete         CustomEvent<{ code: string }> — fired when all slots filled
 *   expire           CustomEvent — fired when timer reaches zero
 *   change           CustomEvent<{ code: string }> — fired on every input change
 *   success          CustomEvent — fired when setSuccess(true) is called
 *
 * DOM API:
 *   el.reset()
 *   el.setError(boolean)
 *   el.setSuccess(boolean)
 *   el.setDisabled(boolean)
 *   el.setReadOnly(boolean)
 *   el.getCode() -> string
 *   el.getSlots() -> SlotEntry[]
 *   el.getInputProps(index) -> InputProps
 *   el.pattern = /^[0-9A-F]$/         (JS property, not attribute)
 *   el.pasteTransformer = fn           (JS property)
 *   el.onComplete = code => {}         (JS property)
 *   el.onResend   = () => {}           (JS property)
 *   el.onFocus    = () => {}           (JS property)
 *   el.onBlur     = () => {}           (JS property)
 *   el.onInvalidChar = (char, i) => {} (JS property)
 *   el.idBase     = 'checkout-otp'     (JS property)
 */

import {
  type OTPInstance,
  type SlotEntry,
  type InputProps,
} from '@verino/core'
import { parseBooleanish, parseInputType, parseSeparatorAfter } from '@verino/core/filter'
import { createOTP } from '@verino/core/machine'
import { formatCountdown } from '@verino/core/timer'
import {
  applyPastedInput,
  applyTypedInput,
  boolAttr,
  clearOTPInput,
  createFrameScheduler,
  handleOTPKeyAction,
  scheduleFocusSync,
  scheduleInputBlur,
  scheduleInputFocus,
  scheduleInputSelection,
  syncInputValue,
} from '@verino/core/toolkit/controller'
import { seedProgrammaticValue } from '@verino/core/toolkit/adapter-policy'
import { createResendTimer } from '@verino/core/toolkit/timer-policy'
import { subscribeFeedback } from '@verino/core/toolkit/feedback'
import { watchForPasswordManagerBadge } from '@verino/core/toolkit/password-manager'

// ─────────────────────────────────────────────────────────────────────────────
// SHADOW DOM STYLES
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
  :host {
    display:      inline-block;
    position:     relative;
    line-height:  1;
  }

  .verino-wc-outer {
    display:        inline-flex;
    flex-direction: column;
    align-items:    center;
  }

  .verino-wc-root {
    position: relative;
    display:  inline-block;
  }

  .verino-wc-slots {
    display:     inline-flex;
    gap:         var(--verino-gap, 12px);
    align-items: center;
    position:    relative;
    padding-top: 24px;
  }

  .verino-wc-hidden {
    position:    absolute;
    inset:       0;
    width:       100%;
    height:      100%;
    opacity:     0;
    border:      none;
    outline:     none;
    background:  transparent;
    color:       transparent;
    caret-color: transparent;
    z-index:     1;
    cursor:      text;
    font-size:   1px;
  }

  .verino-wc-slot {
    box-sizing:      border-box;
    position:        relative;
    width:           var(--verino-size, 56px);
    height:          var(--verino-size, 56px);
    border:          1px solid var(--verino-border-color, #E5E5E5);
    border-radius:   var(--verino-radius, 10px);
    font-size:       var(--verino-font-size, 24px);
    font-weight:     var(--verino-font-weight, 600);
    display:         flex;
    align-items:     center;
    justify-content: center;
    background:      var(--verino-bg, #FAFAFA);
    color:           var(--verino-color, #0A0A0A);
    font-family:     var(--verino-slot-font, inherit);
    cursor:          text;
    user-select:     none;
    transition:      border-color 150ms ease, box-shadow 150ms ease, background 150ms ease, opacity 150ms ease;
  }
  .verino-wc-slot[data-active="true"][data-focus="true"] {
    border-color: var(--verino-active-color, #3D3D3D);
    box-shadow:   0 0 0 3px color-mix(in srgb, var(--verino-active-color, #3D3D3D) 10%, transparent);
    background:   var(--verino-bg-filled, #FFFFFF);
  }
  .verino-wc-slot[data-filled="true"]  { background: var(--verino-bg-filled, #FFFFFF); }
  .verino-wc-slot[data-invalid="true"] {
    border-color: var(--verino-error-color, #FB2C36);
    box-shadow:   0 0 0 3px color-mix(in srgb, var(--verino-error-color, #FB2C36) 12%, transparent);
  }
  .verino-wc-slot[data-success="true"] {
    border-color: var(--verino-success-color, #00C950);
    box-shadow:   0 0 0 3px color-mix(in srgb, var(--verino-success-color, #00C950) 12%, transparent);
  }
  .verino-wc-slot[data-disabled="true"] {
    opacity:        0.45;
    cursor:         not-allowed;
    pointer-events: none;
  }
  .verino-wc-slot[data-empty="true"] {
    font-size: var(--verino-placeholder-size, 16px);
    color:     var(--verino-placeholder-color, #D3D3D3);
  }
  .verino-wc-slot[data-masked="true"][data-filled="true"] {
    font-size: var(--verino-masked-size, 16px);
  }

  .verino-wc-separator {
    display:         flex;
    align-items:     center;
    justify-content: center;
    color:           var(--verino-separator-color, #A1A1A1);
    font-size:       var(--verino-separator-size, 18px);
    font-weight:     400;
    user-select:     none;
    flex-shrink:     0;
    padding:         0 2px;
  }

  .verino-wc-caret {
    position:      absolute;
    width:         2px;
    height:        52%;
    background:    var(--verino-caret-color, #3D3D3D);
    border-radius: 1px;
    animation:     wc-blink 1s step-start infinite;
    pointer-events: none;
    display:       none;
  }
  @keyframes wc-blink { 0%,100%{opacity:1} 50%{opacity:0} }

  .verino-wc-timer {
    display:     flex;
    align-items: center;
    gap:         8px;
    font-size:   14px;
    padding:     20px 0 0;
  }
  .verino-wc-timer.is-hidden { display: none; }
  .verino-wc-timer-label {
    color:     var(--verino-timer-color, #5C5C5C);
    font-size: 14px;
  }
  .verino-wc-timer-badge {
    box-sizing:      border-box;
    display:         inline-flex;
    align-items:     center;
    background:      color-mix(in srgb, var(--verino-error-color, #FB2C36) 10%, transparent);
    color:           var(--verino-error-color, #FB2C36);
    font-weight:     500;
    font-size:       14px;
    padding:         2px 10px;
    border-radius:   99px;
    height:          24px;
  }

  .verino-wc-resend {
    display:     none;
    align-items: center;
    gap:         8px;
    font-size:   14px;
    color:       var(--verino-timer-color, #5C5C5C);
    padding:     12px 0 0;
  }
  .verino-wc-resend.is-visible { display: flex; }
  .verino-wc-resend-btn {
    box-sizing:    border-box;
    display:       inline-flex;
    align-items:   center;
    background:    #E8E8E8;
    border:        none;
    padding:       2px 10px;
    border-radius: 99px;
    color:         #0A0A0A;
    font-weight:   500;
    font-size:     14px;
    transition:    background 150ms ease;
    cursor:        pointer;
    height:        28px;
    font-family:   inherit;
  }
  .verino-wc-resend-btn:hover    { background: #E5E5E5; }
  .verino-wc-resend-btn:disabled { color: #A1A1A1; cursor: not-allowed; background: #F5F5F5; }
`

// ─────────────────────────────────────────────────────────────────────────────
// WEB OTP API TYPE
// ─────────────────────────────────────────────────────────────────────────────

// The spec adds OTPCredential to the Credential type but it is not yet in
// TypeScript's standard DOM lib. Declare it locally to keep the build clean.
interface OTPCredential extends Credential { code: string }

export type VerinoCompleteEvent = CustomEvent<{ code: string }>
export type VerinoChangeEvent = CustomEvent<{ code: string }>
export type VerinoExpireEvent = CustomEvent<void>
export type VerinoSuccessEvent = CustomEvent<void>

export type VerinoInputEventMap = {
  complete: VerinoCompleteEvent
  change:   VerinoChangeEvent
  expire:   VerinoExpireEvent
  success:  VerinoSuccessEvent
}


// ─────────────────────────────────────────────────────────────────────────────
// WEB COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

class VerinoInput extends HTMLElement {
  /**
   * HTML attribute names whose changes trigger `attributeChangedCallback`.
   * Structural attributes rebuild the component; runtime attributes are patched
   * in place by `attributeChangedCallback`.
   */
  static observedAttributes = ['length', 'type', 'timer', 'resend-after', 'disabled', 'readonly', 'separator-after', 'separator', 'masked', 'mask-char', 'name', 'placeholder', 'auto-focus', 'select-on-focus', 'blur-on-complete', 'default-value', 'id-base', 'sound', 'haptic']

  // Shadow DOM references — rebuilt in full on every attributeChangedCallback.
  private slotEls:        HTMLDivElement[]              = []
  private caretEls:       HTMLDivElement[]              = []
  private hiddenInput:    HTMLInputElement        | null = null
  private timerEl:        HTMLDivElement          | null = null
  private timerBadgeEl:   HTMLSpanElement         | null = null
  private resendEl:       HTMLDivElement          | null = null
  private timer:    ReturnType<typeof createResendTimer> | null = null
  private otp:            OTPInstance | null = null
  private shadow:         ShadowRoot

  // Runtime mutable state — toggled by setDisabled() without a full rebuild.
  private _isDisabled  = false
  private _isSuccess   = false
  private _isReadOnly  = false

  // Cleanup handles — cancelled/disconnected on rebuild and on disconnect.
  private webOTPController:  AbortController | null = null
  private disconnectPMWatch: () => void             = () => {}
  private unsubscribeFeedback: () => void           = () => {}
  private webOTPRequestId = 0
  private readonly frameScheduler = createFrameScheduler(
    () => this.isConnected && !!this.hiddenInput?.isConnected,
  )

  // JS-property-only options. These cannot be expressed as HTML attributes
  // (RegExp and functions are not serialisable to strings), so they are stored
  // here and applied on every build().
  private _idBase:           string | undefined = undefined
  private _pattern:          RegExp | undefined = undefined
  private _pasteTransformer: ((raw: string) => string) | undefined = undefined
  private _onComplete:       ((code: string) => void) | undefined = undefined
  private _onResend:         (() => void) | undefined = undefined
  private _onFocus:          (() => void) | undefined = undefined
  private _onBlur:           (() => void) | undefined = undefined
  private _onInvalidChar:    ((char: string, index: number) => void) | undefined = undefined

  private static readonly REBUILD_ATTRIBUTES = new Set([
    'length',
    'type',
    'timer',
    'resend-after',
    'separator-after',
    'separator',
    'masked',
    'mask-char',
    'id-base',
    'default-value',
  ])

  /** Called when all slots are filled. Also dispatches the `complete` CustomEvent. */
  set onComplete(fn: ((code: string) => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[verino] onComplete must be a function, got:', typeof fn); return
    }
    this._onComplete = fn
  }
  /** Called when the built-in Resend button is clicked. */
  set onResend(fn: (() => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[verino] onResend must be a function, got:', typeof fn); return
    }
    this._onResend = fn
  }
  /** Fires when the hidden input receives focus. Set as JS property. */
  set onFocus(fn: (() => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[verino] onFocus must be a function, got:', typeof fn); return
    }
    this._onFocus = fn
  }
  /** Fires when the hidden input loses focus. Set as JS property. */
  set onBlur(fn: (() => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[verino] onBlur must be a function, got:', typeof fn); return
    }
    this._onBlur = fn
  }
  /**
   * Fires when a typed character is rejected by type/pattern validation.
   * Receives the character and the slot index it was attempted on.
   * Set as JS property.
   */
  set onInvalidChar(fn: ((char: string, index: number) => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[verino] onInvalidChar must be a function, got:', typeof fn); return
    }
    this._onInvalidChar = fn
  }

  /** Optional stable prefix for request-scoped ids. Set as JS property or `id-base` attribute. */
  set idBase(value: string | undefined) {
    if (value !== undefined && typeof value !== 'string') {
      console.warn('[verino] idBase must be a string, got:', typeof value); return
    }
    this._idBase = value?.trim() || undefined
    if (this.shadow.children.length > 0) {
      try {
        this.build()
      } catch (err) {
        console.error('[verino] Failed to rebuild after property change:', err)
      }
    }
  }

  get idBase(): string | undefined {
    return this._idBase ?? (this.getAttribute('id-base') ?? undefined)
  }

  /**
   * Arbitrary per-character regex. When set, each typed/pasted character must
   * match to be accepted. Takes precedence over the type attribute for
   * character validation. Cannot be expressed as an HTML attribute — set as a
   * JS property instead.
   * @example el.pattern = /^[0-9A-F]$/
   */
  set pattern(re: RegExp | undefined) {
    if (re !== undefined && !(re instanceof RegExp)) {
      console.warn('[verino] pattern must be a RegExp, got:', typeof re); return
    }
    this._pattern = re
    if (this.shadow.children.length > 0) {
      try {
        this.build()
      } catch (err) {
        console.error('[verino] Failed to rebuild after property change:', err)
      }
    }
  }

  /**
   * Optional paste transformer function. Applied to raw clipboard text before
   * filtering. Use to strip formatting (e.g. `"G-123456"` → `"123456"`).
   * Cannot be expressed as an HTML attribute — set as a JS property.
   * @example el.pasteTransformer = (raw) => raw.replace(/\s+|-/g, '')
   */
  set pasteTransformer(fn: ((raw: string) => string) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[verino] pasteTransformer must be a function, got:', typeof fn); return
    }
    this._pasteTransformer = fn
    if (this.shadow.children.length > 0) {
      try {
        this.build()
      } catch (err) {
        console.error('[verino] Failed to rebuild after property change:', err)
      }
    }
  }

  constructor() {
    super()
    // Open shadow root so external CSS custom properties (--verino-*) cascade in.
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  /** Called when the element is inserted into the DOM. Triggers the initial build. */
  connectedCallback():    void { this.build() }

  /**
   * Called when the element is removed from the DOM.
   * Stops both timers. Slot values are preserved — the element may be
   * re-inserted into the DOM and should not lose user-entered content.
   */
  disconnectedCallback(): void {
    this.frameScheduler.cancelAll()
    this.timer?.stop()
    this.cancelPendingWebOTP()
    this.disconnectPMWatch()
    this.unsubscribeFeedback()
    this.unsubscribeFeedback = () => {}
  }

  /**
   * Called when any observed attribute changes after the initial connection.
   * Guards on `shadow.children.length > 0` so it does not fire before
   * `connectedCallback` has completed the first build.
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (this.shadow.children.length === 0 || oldValue === newValue) return

    if (VerinoInput.REBUILD_ATTRIBUTES.has(name)) {
      this.build()
      return
    }

    switch (name) {
      case 'disabled':
        this.setDisabled(this._disabledAttr)
        return
      case 'readonly':
        this.setReadOnly(this._readOnlyAttr)
        return
      case 'name':
        if (!this.hiddenInput) return
        if (this._name) this.hiddenInput.name = this._name
        else this.hiddenInput.removeAttribute('name')
        return
      case 'placeholder':
      case 'auto-focus':
      case 'select-on-focus':
      case 'blur-on-complete':
        this.syncSlotsToDOM()
        return
      case 'sound':
      case 'haptic':
        this.refreshFeedbackSubscription()
        return
      default:
        this.build()
    }
  }

  // ── Attribute accessors ─────────────────────────────────────────────────────
  // Each getter reads directly from the live attribute to stay in sync with
  // external attribute mutations. All values are snapshotted at the top of
  // build() so a single rebuild is always internally consistent.

  private get _length(): number {
    const v = parseInt(this.getAttribute('length') ?? '6', 10)
    return isNaN(v) || v < 1 ? 6 : Math.floor(v)
  }
  private get _type() { return parseInputType(this.getAttribute('type')) }
  private get _timer(): number {
    const v = parseInt(this.getAttribute('timer') ?? '0', 10)
    return isNaN(v) || v < 0 ? 0 : Math.floor(v)
  }
  private get _resendAfter(): number {
    const v = parseInt(this.getAttribute('resend-after') ?? '30', 10)
    return isNaN(v) || v < 1 ? 30 : Math.floor(v)
  }
  private get _disabledAttr():    boolean   { return this.hasAttribute('disabled') }
  private get _readOnlyAttr():    boolean   { return this.hasAttribute('readonly') }
  private get _defaultValue():    string    { return this.getAttribute('default-value') ?? '' }
  private get _idBaseAttr():      string | undefined {
    return this.getAttribute('id-base') ?? this._idBase
  }
  /** Parses `separator-after="2,4"` into `[2, 4]`. Filters NaN and zero values. */
  private get _separatorAfter():  number[]  {
    const parsed = parseSeparatorAfter(this.getAttribute('separator-after'), [])
    return Array.isArray(parsed) ? parsed : parsed > 0 ? [parsed] : []
  }
  private get _separator():       string    { return this.getAttribute('separator') ?? '—' }
  /** `masked` is a boolean attribute — present means true, absent means false. */
  private get _masked():          boolean   { return this.hasAttribute('masked') }
  private get _maskChar():        string    { return this.getAttribute('mask-char') ?? '\u25CF' }
  private get _name():            string    { return this.getAttribute('name') ?? '' }
  private get _placeholder():     string    { return this.getAttribute('placeholder') ?? '' }
  /**
   * `auto-focus` defaults to `true` when the attribute is absent.
   * Setting `auto-focus="false"` explicitly suppresses focus on mount.
   */
  private get _autoFocus():       boolean   { return parseBooleanish(this.getAttribute('auto-focus'), true) }
  private get _selectOnFocus():   boolean   { return this.hasAttribute('select-on-focus') }
  private get _blurOnComplete():  boolean   { return this.hasAttribute('blur-on-complete') }
  /** `sound` defaults to `false` — present as boolean attribute to enable. */
  private get _sound():           boolean   { return this.hasAttribute('sound') }
  /** `haptic` defaults to `true` — set `haptic="false"` to disable. */
  private get _haptic():          boolean   { return parseBooleanish(this.getAttribute('haptic'), true) }

  // ── Build ───────────────────────────────────────────────────────────────────
  /**
   * Constructs the entire shadow DOM from scratch.
   *
   * Called on first connect, on every observed attribute change, and when
   * certain JS-property setters (`pattern`, `pasteTransformer`)
   * are assigned after mount. Tears down any running timer and resets the
   * state machine before rebuilding to prevent duplicate intervals or stale
   * closure references from the previous build.
   */
  private build(): void {
    const previousCode       = this.otp?.getCode() ?? ''
    const previousActiveSlot = this.otp?.state.activeSlot ?? 0
    const previousHasError   = this.otp?.state.hasError ?? false
    const previousHasSuccess = this._isSuccess
    const previousDisabled   = this.otp ? this._isDisabled : this._disabledAttr
    const previousReadOnly   = this.otp ? this._isReadOnly : this._readOnlyAttr

    const length             = this._length
    const type               = this._type
    const timerSecs          = this._timer
    const resendCooldown     = this._resendAfter
    const separatorPositions = this._separatorAfter
    const separator          = this._separator
    const masked             = this._masked
    const inputName          = this._name
    const autoFocus          = this._autoFocus
    this._isDisabled         = previousDisabled
    this._isReadOnly         = previousReadOnly
    this._isSuccess          = previousHasSuccess

    this.timer?.stop()
    this.frameScheduler.cancelAll()
    this.cancelPendingWebOTP()
    this.disconnectPMWatch()
    this.unsubscribeFeedback()
    this.unsubscribeFeedback = () => {}
    this.otp?.destroy()

    // Clear shadow DOM using safe child removal
    while (this.shadow.firstChild) this.shadow.removeChild(this.shadow.firstChild)
    this.slotEls  = []
    this.caretEls = []
    this.timerEl        = null
    this.timerBadgeEl   = null
    this.resendEl       = null
    this.timer    = null

    // Styles
    const styleEl = document.createElement('style')
    styleEl.textContent = STYLES
    this.shadow.appendChild(styleEl)

    // Outer centering wrapper — timer/resend live here as siblings of rootEl
    // so the hidden input (position:absolute inset:0 inside rootEl) cannot block them
    const outerEl = document.createElement('div')
    outerEl.className = 'verino-wc-outer'

    // Root
    const rootEl = document.createElement('div')
    rootEl.className = 'verino-wc-root'

    // Slot row
    const slotRowEl = document.createElement('div')
    slotRowEl.className = 'verino-wc-slots'

    // Visual slots + optional separator
    for (let i = 0; i < length; i++) {
      const slotEl  = document.createElement('div')
      slotEl.className = 'verino-wc-slot'
      slotEl.setAttribute('aria-hidden',   'true')
      slotEl.setAttribute('data-slot',     String(i))
      slotEl.setAttribute('data-first',    String(i === 0))
      slotEl.setAttribute('data-last',     String(i === length - 1))
      slotEl.setAttribute('data-active',   'false')
      slotEl.setAttribute('data-focus',    'false')
      slotEl.setAttribute('data-filled',   'false')
      slotEl.setAttribute('data-empty',    'true')
      slotEl.setAttribute('data-masked',   String(masked))
      slotEl.setAttribute('data-invalid',  'false')
      slotEl.setAttribute('data-success',  'false')
      slotEl.setAttribute('data-disabled', 'false')
      slotEl.setAttribute('data-complete', 'false')
      slotEl.setAttribute('data-readonly', 'false')

      const caretEl = document.createElement('div')
      caretEl.className = 'verino-wc-caret'
      slotEl.appendChild(caretEl)

      this.caretEls.push(caretEl)
      this.slotEls.push(slotEl)
      slotRowEl.appendChild(slotEl)

      if (separatorPositions.some(pos => i === pos - 1)) {
        const sepEl = document.createElement('div')
        sepEl.className   = 'verino-wc-separator'
        sepEl.textContent = separator
        sepEl.setAttribute('aria-hidden', 'true')
        slotRowEl.appendChild(sepEl)
      }
    }

    // Hidden input
    const hiddenInput = document.createElement('input')
    hiddenInput.type           = masked ? 'password' : 'text'
    hiddenInput.inputMode      = type === 'numeric' ? 'numeric' : 'text'
    hiddenInput.autocomplete   = 'one-time-code'
    hiddenInput.maxLength      = length
    hiddenInput.disabled       = this._isDisabled
    hiddenInput.className      = 'verino-wc-hidden'
    hiddenInput.setAttribute('aria-label',     `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`)
    hiddenInput.setAttribute('spellcheck',     'false')
    hiddenInput.setAttribute('autocorrect',    'off')
    hiddenInput.setAttribute('autocapitalize', 'off')
    if (inputName) hiddenInput.name = inputName
    this.hiddenInput = hiddenInput

    rootEl.appendChild(slotRowEl)
    rootEl.appendChild(hiddenInput)
    outerEl.appendChild(rootEl)
    this.shadow.appendChild(outerEl)

    // Core
    let suppressComplete = false
    this.otp = createOTP({
      length,
      idBase: this._idBaseAttr,
      type,
      pattern:          this._pattern,
      pasteTransformer: this._pasteTransformer,
      onInvalidChar:    (char, index) => { this._onInvalidChar?.(char, index) },
      disabled:         this._isDisabled,
      readOnly:         this._isReadOnly,
      onComplete: (code) => {
        if (suppressComplete) return
        this._onComplete?.(code)
        this.dispatchEvent(
          new CustomEvent<{ code: string }>('complete', { detail: { code }, bubbles: true, composed: true })
        )
      },
    })

    this.refreshFeedbackSubscription()

    // ── Built-in timer + resend (mirrors vanilla/alpine adapters) ──────────────
    if (timerSecs > 0) {
      // Timer footer — "Code expires in [0:45]"
      const timerFooterEl = document.createElement('div')
      timerFooterEl.className = 'verino-wc-timer'
      this.timerEl = timerFooterEl

      const timerLabel = document.createElement('span')
      timerLabel.className   = 'verino-wc-timer-label'
      timerLabel.textContent = 'Code expires in'

      const timerBadge = document.createElement('span')
      timerBadge.className   = 'verino-wc-timer-badge'
      timerBadge.textContent = formatCountdown(timerSecs)
      this.timerBadgeEl = timerBadge

      timerFooterEl.appendChild(timerLabel)
      timerFooterEl.appendChild(timerBadge)
      outerEl.appendChild(timerFooterEl)

      // Resend row — "Didn't receive the code? [Resend]"
      const resendRowEl = document.createElement('div')
      resendRowEl.className = 'verino-wc-resend'
      this.resendEl = resendRowEl

      const resendLabel = document.createElement('span')
      resendLabel.textContent = 'Didn\u2019t receive the code?'

      const resendBtn = document.createElement('button')
      resendBtn.className   = 'verino-wc-resend-btn'
      resendBtn.textContent = 'Resend'
      resendBtn.type        = 'button'

      resendRowEl.appendChild(resendLabel)
      resendRowEl.appendChild(resendBtn)
      outerEl.appendChild(resendRowEl)

      this.timer = createResendTimer({
        timerSeconds: timerSecs,
        resendCooldown,
        clearField: () => { this.clearField() },
        showTimer: (remaining) => {
          if (this.resendEl) this.resendEl.classList.remove('is-visible')
          if (this.timerEl) this.timerEl.classList.remove('is-hidden')
          if (this.timerBadgeEl) this.timerBadgeEl.textContent = formatCountdown(remaining)
        },
        showResend: () => {
          if (this.timerEl) this.timerEl.classList.add('is-hidden')
          if (this.resendEl) this.resendEl.classList.add('is-visible')
        },
        onExpire: () => {
          this.dispatchEvent(new CustomEvent<void>('expire', { bubbles: true, composed: true }))
        },
        onResend: () => { this._onResend?.() },
      })
      this.timer.start()

      // Resend button click — restart with resend cooldown
      resendBtn.addEventListener('click', () => {
        this.timer?.resend()
      })
    }

    if (this._isReadOnly) hiddenInput.setAttribute('aria-readonly', 'true')

    // Re-apply the current code across rebuilds. If there is no live code yet,
    // fall back to the declarative defaultValue attribute.
    const seedValue = previousCode || this._defaultValue
    if (seedValue) {
      let result: ReturnType<typeof seedProgrammaticValue>
      suppressComplete = true
      try {
        result = seedProgrammaticValue(
          this.otp!,
          seedValue,
          {
            length,
            type,
            pattern: this._pattern,
          },
          previousCode
            ? { preserveActiveSlot: previousActiveSlot }
            : 'slot-end',
        )
      } finally {
        suppressComplete = false
      }
      if (result.changed) syncInputValue(hiddenInput, result.value, result.nextSelection)
    }

    if (previousHasSuccess) {
      this.otp.setSuccess(true)
    } else if (previousHasError) {
      this.otp.setError(true)
    }

    this.attachEvents()

    if (this._isDisabled) this.applyDisabledDOM(true)

    // ── Web OTP API (SMS autofill) ──────────────────────────────────────────
    // navigator.credentials.get() intercepts incoming OTP SMSes on Android
    // Chrome without any user gesture. AbortController is stored so
    // disconnectedCallback and rebuild can cancel the pending request.
    if (typeof navigator !== 'undefined' && 'credentials' in navigator) {
      const requestId = ++this.webOTPRequestId
      const controller = new AbortController()
      this.webOTPController = controller
      const webOTPTimeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)
      ;(navigator.credentials.get as (opts: object) => Promise<OTPCredential | null>)({
        otp:    { transport: ['sms'] },
        signal: controller.signal,
      }).then((credential) => {
        clearTimeout(webOTPTimeoutId)
        if (requestId === this.webOTPRequestId) this.webOTPController = null
        if (
          controller.signal.aborted ||
          !this.isConnected ||
          requestId !== this.webOTPRequestId ||
          !credential?.code ||
          !this.otp ||
          !this.hiddenInput
        ) return
        const result = applyTypedInput(this.otp, credential.code, {
          length,
          type,
          pattern: this._pattern,
        })
        if (!result.value) return
        syncInputValue(this.hiddenInput, result.value, result.nextSelection)
        this.syncSlotsToDOM()
      }).catch(() => {
        clearTimeout(webOTPTimeoutId)
        if (requestId === this.webOTPRequestId) this.webOTPController = null
        /* aborted on rebuild/disconnect or not supported */
      })
    }

    // ── Password manager badge guard ────────────────────────────────────────
    // Detect badge icons from LastPass, 1Password, Dashlane, Bitwarden, Keeper
    // and widen the hidden input to prevent overlap with the last visual slot.
    const slotRowWidth = slotRowEl.getBoundingClientRect().width
    this.disconnectPMWatch = watchForPasswordManagerBadge(hiddenInput, slotRowWidth)

    hiddenInput.addEventListener('click', (e: MouseEvent) => {
      if (this._isDisabled) return
      // click fires after the browser places cursor (always 0 due to font-size:1px).
      // Coordinate hit-test determines which slot was visually clicked, then
      // setSelectionRange overrides the browser's placement.
      let rawSlot = this.slotEls.length - 1
      for (let i = 0; i < this.slotEls.length; i++) {
        if (e.clientX <= this.slotEls[i].getBoundingClientRect().right) { rawSlot = i; break }
      }
      // Clamp to filled count so the visual active slot matches the actual cursor position.
      const clickedSlot = Math.min(rawSlot, hiddenInput.value.length)
      this.otp?.move(clickedSlot)
      const char = this.otp?.state.slotValues[clickedSlot] ?? ''
      if (this._selectOnFocus && char) {
        hiddenInput.setSelectionRange(clickedSlot, clickedSlot + 1)
      } else {
        hiddenInput.setSelectionRange(clickedSlot, clickedSlot)
      }
      this.syncSlotsToDOM()
    })

    this.frameScheduler.schedule(() => {
      if (!this._isDisabled && autoFocus) hiddenInput.focus()
      const next = this.otp?.state.activeSlot ?? 0
      hiddenInput.setSelectionRange(next, next)
      this.syncSlotsToDOM()
    })
  }

  // ── DOM sync ────────────────────────────────────────────────────────────────
  /**
   * Reconcile the shadow slot divs with the current core state using CSS class
   * toggles. Called after every user action (input, keydown, paste, focus, click).
   *
   * Uses `this.shadow.activeElement` instead of `document.activeElement` to
   * correctly detect focus within the shadow root across all browsers — the
   * document active element is the host `<verino-input>` element, not the
   * internal hidden input.
   */
  private syncSlotsToDOM(): void {
    if (!this.otp || !this.hiddenInput) return
    const { slotValues, activeSlot, hasError, isComplete } = this.otp.state
    // Use shadow.activeElement — document.activeElement is the host element in shadow DOM
    const focused = this.shadow.activeElement === this.hiddenInput

    this.slotEls.forEach((slotEl, i) => {
      const char     = slotValues[i] ?? ''
      const isFilled = char.length === 1

      const existingTextNode = slotEl.childNodes[1]
      let textNode = existingTextNode instanceof Text ? existingTextNode : null
      if (!textNode) {
        textNode = document.createTextNode('')
        slotEl.appendChild(textNode)
      }
      textNode.nodeValue = this._masked && char ? this._maskChar : char || this._placeholder

      slotEl.setAttribute('data-active',   boolAttr(i === activeSlot))
      slotEl.setAttribute('data-focus',    boolAttr(focused))
      slotEl.setAttribute('data-filled',   boolAttr(isFilled))
      slotEl.setAttribute('data-empty',    boolAttr(!isFilled))
      slotEl.setAttribute('data-masked',   boolAttr(this._masked))
      slotEl.setAttribute('data-invalid',  boolAttr(hasError))
      // hasError and _isSuccess are mutually exclusive: setError(true) sets _isSuccess = false,
      // and setSuccess(true) calls otp.setError(false). No explicit guard needed.
      slotEl.setAttribute('data-success',  boolAttr(this._isSuccess))
      slotEl.setAttribute('data-disabled', boolAttr(this._isDisabled))
      slotEl.setAttribute('data-complete', boolAttr(isComplete))
      slotEl.setAttribute('data-readonly', boolAttr(this._isReadOnly))

      this.caretEls[i].style.display = i === activeSlot && focused && !isFilled && !this._isDisabled ? 'block' : 'none'
    })

    // Only update value when it actually differs — assigning the same string
    // resets selectionStart/End in some browsers, clobbering the cursor.
    const newValue = slotValues.join('')
    if (this.hiddenInput.value !== newValue) this.hiddenInput.value = newValue

    this.toggleAttribute('data-complete', isComplete)
    this.toggleAttribute('data-invalid',  hasError)
    this.toggleAttribute('data-success',  this._isSuccess)
    this.toggleAttribute('data-disabled', this._isDisabled)
    this.toggleAttribute('data-readonly', this._isReadOnly)
  }

  /**
   * Apply or remove the disabled state directly on existing DOM nodes without
   * triggering a full rebuild. Used by both `build()` (initial disabled attr)
   * and `setDisabled()` (runtime toggle).
   */
  private applyDisabledDOM(value: boolean): void {
    if (this.hiddenInput) this.hiddenInput.disabled = value
    this.slotEls.forEach(s => s.setAttribute('data-disabled', value ? 'true' : 'false'))
  }

  private refreshFeedbackSubscription(): void {
    this.unsubscribeFeedback()
    this.unsubscribeFeedback = () => {}
    if (!this.otp) return
    this.unsubscribeFeedback = subscribeFeedback(this.otp, {
      haptic: this._haptic,
      sound:  this._sound,
    })
  }

  private cancelPendingWebOTP(): void {
    this.webOTPRequestId += 1
    this.webOTPController?.abort()
    this.webOTPController = null
  }

  private clearField(): void {
    this._isSuccess = false
    if (this.otp) {
      clearOTPInput(this.otp, this.hiddenInput, {
        focus: !this._isDisabled,
        disabled: this._isDisabled,
      })
    }
    this.syncSlotsToDOM()
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  /**
   * Wire all event listeners to the hidden input element.
   * Called once at the end of each `build()`. Because `build()` creates a fresh
   * `hiddenInput` element, there is no need to `removeEventListener` — the old
   * element is discarded and its listeners are garbage-collected with it.
   */
  private attachEvents(): void {
    const input   = this.hiddenInput!
    const otp     = this.otp!
    const length  = this._length
    const type    = this._type
    const pattern = this._pattern

    input.addEventListener('keydown', (e) => {
      if (this._isDisabled) return
      const result = handleOTPKeyAction(otp, {
        key: e.key,
        position: input.selectionStart ?? 0,
        length,
        readOnly: this._isReadOnly,
        shiftKey: e.shiftKey,
      })
      if (!result.handled) return

      e.preventDefault()
      this.syncSlotsToDOM()
      if (result.valueChanged) this.dispatchChange()
      if (result.nextSelection !== null) {
        scheduleInputSelection(this.frameScheduler, input, result.nextSelection)
      }
    })

    input.addEventListener('input', () => {
      if (this._isDisabled || this._isReadOnly) return
      const raw = input.value
      if (!raw) {
        clearOTPInput(otp, input, { focus: false })
        this.syncSlotsToDOM()
        this.dispatchChange()
        return
      }
      const result = applyTypedInput(otp, raw, { length, type, pattern })
      syncInputValue(input, result.value, result.nextSelection)
      this.syncSlotsToDOM()
      this.dispatchChange()
      scheduleInputBlur(this.frameScheduler, input, this._blurOnComplete && result.isComplete)
    })

    input.addEventListener('paste', (e) => {
      if (this._isDisabled || this._isReadOnly) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      const result = applyPastedInput(otp, text, input.selectionStart ?? 0)
      syncInputValue(input, result.value, result.nextSelection)
      this.syncSlotsToDOM()
      this.dispatchChange()
      scheduleInputBlur(this.frameScheduler, input, this._blurOnComplete && result.isComplete)
    })

    input.addEventListener('focus', () => {
      this._onFocus?.()
      scheduleFocusSync(this.frameScheduler, otp, input, this._selectOnFocus, () => this.syncSlotsToDOM())
    })

    input.addEventListener('blur', () => {
      this._onBlur?.()
      this.slotEls.forEach(s => { s.setAttribute('data-focus', 'false') })
      this.caretEls.forEach(c => { c.style.display = 'none' })
    })

  }

  /**
   * Dispatch a `change` CustomEvent carrying the current code string.
   * Fired after every input, paste, and backspace action.
   * `composed: true` lets the event cross the shadow root boundary so host-page
   * listeners registered with `el.addEventListener('change', ...)` receive it.
   */
  private dispatchChange(): void {
    this.dispatchEvent(new CustomEvent<{ code: string }>('change', {
      detail:   { code: this.otp?.getCode() ?? '' },
      bubbles:  true,
      composed: true,
    }))
  }

  // ── Public DOM API ──────────────────────────────────────────────────────────

  /** Clear all slots, reset the timer display, and re-focus the hidden input. */
  reset(): void {
    this.clearField()
    this.timer?.restartMain()
  }

  /** Reset the field and fire `onResend`. Restarts the timer with resend cooldown when a timer is active. */
  resend(): void {
    if (this.timer) {
      this.timer.resend()
    } else {
      this.clearField()
      this._onResend?.()
    }
  }

  /** Apply or clear the error state on all visual slots. */
  setError(isError: boolean): void {
    if (isError) this._isSuccess = false
    this.otp?.setError(isError)
    this.syncSlotsToDOM()
  }

  /**
   * Apply or clear the success state on all visual slots. Stops the timer on success.
   * Uses CSS class toggling (not inline styles) so `reset()` can fully restore UI state.
   */
  setSuccess(isSuccess: boolean): void {
    this._isSuccess = isSuccess
    if (isSuccess) {
      this.otp?.setError(false)
      this.timer?.stop()
      // Hide timer and resend via class-based approach so reset() can restore them.
      // Inline styles would persist across reset() calls and permanently suppress the UI.
      if (this.timerEl)  this.timerEl.classList.add('is-hidden')
      if (this.resendEl) this.resendEl.classList.remove('is-visible')
      this.dispatchEvent(new CustomEvent<void>('success', { bubbles: true, composed: true }))
    } else {
      if (this.timerEl)  this.timerEl.classList.remove('is-hidden')
    }
    this.syncSlotsToDOM()
  }

  /** Read-only. `true` when success state is active. */
  get hasSuccess(): boolean { return this._isSuccess }

  /**
   * Enable or disable the input at runtime.
   * Equivalent to toggling the `disabled` HTML attribute but without triggering
   * a full rebuild. Re-enabling automatically restores focus to the active slot.
   */
  setDisabled(value: boolean): void {
    this._isDisabled = value
    this.otp?.setDisabled(value)
    this.applyDisabledDOM(value)
    this.syncSlotsToDOM()
    if (!value && this.hiddenInput) {
      scheduleInputFocus(this.frameScheduler, this.hiddenInput, this.otp?.state.activeSlot ?? 0)
    }
  }

  /**
   * Toggle readOnly at runtime. When `true`, all slot mutations are blocked
   * but focus, navigation, and copy remain fully functional.
   * Distinct from `disabled` — no opacity/cursor change, `aria-readonly` is set.
   */
  setReadOnly(value: boolean): void {
    this._isReadOnly = value
    this.otp?.setReadOnly(value)
    if (this.hiddenInput) {
      if (value) {
        this.hiddenInput.setAttribute('aria-readonly', 'true')
      } else {
        this.hiddenInput.removeAttribute('aria-readonly')
      }
    }
    this.syncSlotsToDOM()
  }

  /** Returns the current code as a joined string (e.g. `"123456"`). */
  getCode(): string {
    return this.otp?.getCode() ?? ''
  }

  /** Minimal snapshot of every slot — index, value, isActive, isFilled. */
  getSlots(): readonly SlotEntry[] {
    return this.otp?.getSlots() ?? []
  }

  /**
   * Framework-agnostic handlers + data-* attributes for slot `index`.
   *
   * Unlike other adapters, `data-focus` is NOT included here — the web component
   * manages all slot attribute updates internally through `syncSlotsToDOM()`, which
   * reads `this.shadow.activeElement` to derive the correct focus state at sync time.
   * This method is intended for external consumers who compose custom slot markup
   * outside the shadow root.
   */
  getInputProps(slotIndex: number): InputProps {
    const otp = this.otp
    const s   = otp?.state
    const char     = s?.slotValues[slotIndex] ?? ''
    const isFilled = char.length === 1
    return {
      value:     char,
      onInput:   (c) => { otp?.insert(c, slotIndex); this.syncSlotsToDOM() },
      onKeyDown: (key) => {
        if (!otp) return
        const result = handleOTPKeyAction(otp, {
          key,
          position: slotIndex,
          length: this._length,
          readOnly: this._isReadOnly,
        })
        if (result.handled) this.syncSlotsToDOM()
      },
      onFocus: () => this._onFocus?.(),
      onBlur:  () => this._onBlur?.(),
      'data-slot':     slotIndex,
      'data-active':   boolAttr(s?.activeSlot === slotIndex),
      'data-filled':   boolAttr(isFilled),
      'data-empty':    boolAttr(!isFilled),
      'data-complete': boolAttr(s?.isComplete ?? false),
      'data-invalid':  boolAttr(s?.hasError ?? false),
      // Use _isSuccess (the local runtime flag) rather than s.hasSuccess (core state)
      // so this matches the value used in syncSlotsToDOM — setSuccess() updates _isSuccess
      // and otp.setSuccess() together, keeping them in sync.
      'data-success':  boolAttr(this._isSuccess),
      'data-disabled': boolAttr(this._isDisabled),
      'data-readonly': boolAttr(this._isReadOnly),
      'data-first':    boolAttr(slotIndex === 0),
      'data-last':     boolAttr(slotIndex === this._length - 1),
    }
  }
}

interface VerinoInput {
  addEventListener<K extends keyof VerinoInputEventMap>(
    type: K,
    listener: (this: VerinoInput, ev: VerinoInputEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener<K extends keyof VerinoInputEventMap>(
    type: K,
    listener: (this: VerinoInput, ev: VerinoInputEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void
}

declare global {
  interface HTMLElementTagNameMap {
    'verino-input': VerinoInput
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('verino-input')) {
  customElements.define('verino-input', VerinoInput)
}

export { VerinoInput }
