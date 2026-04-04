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
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  createOTP,
  createTimer,
  filterString,
  formatCountdown,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type InputType,
  type SlotEntry,
  type InputProps,
} from '@verino/core'

/** Convert a boolean to the string literal `'true'` or `'false'` required by CSS attribute selectors. */
const b = (v: boolean): 'true' | 'false' => v ? 'true' : 'false'

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


// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD MANAGER BADGE GUARD
// ─────────────────────────────────────────────────────────────────────────────
//
// This logic mirrors the equivalent guard in packages/vanilla/src/plugins/pm-guard.ts.
// It is intentionally duplicated here because the web component is a standalone
// bundle that cannot import from @verino/vanilla at runtime. Keep both copies
// in sync when modifying.
//
// Password managers (LastPass, 1Password, Dashlane, Bitwarden, Keeper) inject
// a small icon badge into or beside <input> elements they detect as credential
// fields. On OTP inputs this badge physically overlaps the last visual slot.
//
// Fix: detect when any of these extensions are active, then push the hidden
// input's width ~40px wider so the badge renders outside the slot boundary.

const WC_PM_SELECTORS = [
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

const WC_PM_BADGE_OFFSET_PX = 40

/**
 * Returns `true` if any known password manager badge element is present in the document.
 * Each query is wrapped in try/catch because extension-injected selectors can be malformed.
 */
function wcIsPasswordManagerActive(): boolean {
  return WC_PM_SELECTORS.some(sel => {
    try { return document.querySelector(sel) !== null }
    catch { return false }
  })
}

/**
 * Detect password manager badge icons and widen the hidden input to prevent overlap
 * with the last visual slot.
 *
 * Runs inside a RAF (in the caller) so `baseWidthPx` reflects post-layout measurements.
 * Returns a disconnect function — call it from `disconnectedCallback` or on rebuild.
 *
 * @param hiddenInputEl - The hidden `<input>` whose width will be expanded.
 * @param baseWidthPx   - The natural slot row width measured after layout.
 */
function wcWatchForPasswordManagerBadge(
  hiddenInputEl: HTMLInputElement,
  baseWidthPx:   number,
): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}

  function applyOffset(): void {
    hiddenInputEl.style.width = `${baseWidthPx + WC_PM_BADGE_OFFSET_PX}px`
  }

  if (wcIsPasswordManagerActive()) {
    applyOffset()
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (wcIsPasswordManagerActive()) {
      applyOffset()
      observer.disconnect()
    }
  })

  observer.observe(document.documentElement, {
    childList:  true,
    subtree:    true,
    attributes: true,
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

  return () => observer.disconnect()
}


// ─────────────────────────────────────────────────────────────────────────────
// WEB COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

class VerinoInput extends HTMLElement {
  /**
   * HTML attribute names whose changes trigger `attributeChangedCallback`.
   * Any change to these attributes causes a full shadow DOM rebuild so the
   * component always reflects its attribute state without manual reconciliation.
   */
  static observedAttributes = ['length', 'type', 'timer', 'resend-after', 'disabled', 'readonly', 'separator-after', 'separator', 'masked', 'mask-char', 'name', 'placeholder', 'auto-focus', 'select-on-focus', 'blur-on-complete', 'default-value', 'sound', 'haptic']

  // Shadow DOM references — rebuilt in full on every attributeChangedCallback.
  private slotEls:        HTMLDivElement[]              = []
  private caretEls:       HTMLDivElement[]              = []
  private hiddenInput:    HTMLInputElement        | null = null
  private timerEl:        HTMLDivElement          | null = null
  private timerBadgeEl:   HTMLSpanElement         | null = null
  private resendEl:       HTMLDivElement          | null = null
  private timerCtrl:      ReturnType<typeof createTimer> | null = null
  private resendCountdown: ReturnType<typeof createTimer> | null = null
  private otp:            ReturnType<typeof createOTP> | null = null
  private shadow:         ShadowRoot

  // Runtime mutable state — toggled by setDisabled() without a full rebuild.
  private _isDisabled  = false
  private _isSuccess   = false
  private _isReadOnly  = false

  // Cleanup handles — cancelled/disconnected on rebuild and on disconnect.
  private webOTPController:  AbortController | null = null
  private disconnectPMWatch: () => void             = () => {}

  // JS-property-only options. These cannot be expressed as HTML attributes
  // (RegExp and functions are not serialisable to strings), so they are stored
  // here and applied on every build().
  private _pattern:          RegExp | undefined = undefined
  private _pasteTransformer: ((raw: string) => string) | undefined = undefined
  private _onComplete:       ((code: string) => void) | undefined = undefined
  private _onResend:         (() => void) | undefined = undefined
  private _onFocus:          (() => void) | undefined = undefined
  private _onBlur:           (() => void) | undefined = undefined
  private _onInvalidChar:    ((char: string, index: number) => void) | undefined = undefined

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
    if (this.shadow.children.length > 0) {
      try {
        this.build()
      } catch (err) {
        console.error('[verino] Failed to rebuild after property change:', err)
      }
    }
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
    this.timerCtrl?.stop()
    this.resendCountdown?.stop()
    this.webOTPController?.abort()
    this.webOTPController = null
    this.disconnectPMWatch()
  }

  /**
   * Called when any observed attribute changes after the initial connection.
   * Guards on `shadow.children.length > 0` so it does not fire before
   * `connectedCallback` has completed the first build.
   */
  attributeChangedCallback(): void {
    if (this.shadow.children.length > 0) this.build()
  }

  // ── Attribute accessors ─────────────────────────────────────────────────────
  // Each getter reads directly from the live attribute to stay in sync with
  // external attribute mutations. All values are snapshotted at the top of
  // build() so a single rebuild is always internally consistent.

  private get _length(): number {
    const v = parseInt(this.getAttribute('length') ?? '6', 10)
    return isNaN(v) || v < 1 ? 6 : Math.floor(v)
  }
  private get _type():            InputType { return (this.getAttribute('type') ?? 'numeric') as InputType }
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
  /** Parses `separator-after="2,4"` into `[2, 4]`. Filters NaN and zero values. */
  private get _separatorAfter():  number[]  {
    const v = this.getAttribute('separator-after')
    if (!v) return []
    return v.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
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
  private get _autoFocus():       boolean   { return !this.hasAttribute('auto-focus') || this.getAttribute('auto-focus') !== 'false' }
  private get _selectOnFocus():   boolean   { return this.hasAttribute('select-on-focus') }
  private get _blurOnComplete():  boolean   { return this.hasAttribute('blur-on-complete') }
  /** `sound` defaults to `false` — present as boolean attribute to enable. */
  private get _sound():           boolean   { return this.hasAttribute('sound') }
  /** `haptic` defaults to `true` — set `haptic="false"` to disable. */
  private get _haptic():          boolean   { return !this.hasAttribute('haptic') || this.getAttribute('haptic') !== 'false' }

  // ── Build ───────────────────────────────────────────────────────────────────
  /**
   * Constructs the entire shadow DOM from scratch.
   *
   * Called on first connect, on every observed attribute change, and when
   * certain JS-property setters (`pattern`, `pasteTransformer`, `onInvalidChar`)
   * are assigned after mount. Tears down any running timer and resets the
   * state machine before rebuilding to prevent duplicate intervals or stale
   * closure references from the previous build.
   */
  private build(): void {
    const length             = this._length
    const type               = this._type
    const timerSecs          = this._timer
    const resendCooldown     = this._resendAfter
    const separatorPositions = this._separatorAfter
    const separator          = this._separator
    const masked             = this._masked
    const inputName          = this._name
    const autoFocus          = this._autoFocus
    const selectOnFocus      = this._selectOnFocus
    const blurOnComplete     = this._blurOnComplete
    this._isDisabled         = this._disabledAttr
    this._isReadOnly         = this._readOnlyAttr

    this.timerCtrl?.stop()
    this.resendCountdown?.stop()
    this.webOTPController?.abort()
    this.webOTPController = null
    this.disconnectPMWatch()
    this.otp?.reset()

    // Clear shadow DOM using safe child removal
    while (this.shadow.firstChild) this.shadow.removeChild(this.shadow.firstChild)
    this.slotEls  = []
    this.caretEls = []
    this.timerEl        = null
    this.timerBadgeEl   = null
    this.resendEl       = null
    this.timerCtrl      = null
    this.resendCountdown = null

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
    const soundEnabled  = this._sound
    const hapticEnabled = this._haptic

    let suppressComplete = false
    this.otp = createOTP({
      length,
      type,
      pattern:          this._pattern,
      pasteTransformer: this._pasteTransformer,
      onInvalidChar:    this._onInvalidChar,
      readOnly:         this._isReadOnly,
      onComplete: (code) => {
        if (suppressComplete) return
        this._onComplete?.(code)
        this.dispatchEvent(
          new CustomEvent('complete', { detail: { code }, bubbles: true, composed: true })
        )
      },
    })

    // Feedback via events — mirrors vanilla/alpine adapter pattern.
    this.otp.subscribe((_state, event) => {
      if (event.type === 'COMPLETE') {
        if (hapticEnabled) triggerHapticFeedback()
        if (soundEnabled)  triggerSoundFeedback()
      } else if (event.type === 'ERROR' && event.hasError) {
        if (hapticEnabled) triggerHapticFeedback()
      }
    })

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

      // Main countdown
      this.timerCtrl = createTimer({
        totalSeconds: timerSecs,
        onTick: (r) => { if (this.timerBadgeEl) this.timerBadgeEl.textContent = formatCountdown(r) },
        onExpire: () => {
          if (this.timerEl) this.timerEl.classList.add('is-hidden')
          if (this.resendEl) this.resendEl.classList.add('is-visible')
          this.dispatchEvent(new CustomEvent('expire', { bubbles: true, composed: true }))
        },
      })
      this.timerCtrl.start()

      // Resend button click — restart with resend cooldown
      resendBtn.addEventListener('click', () => {
        this.resendEl!.classList.remove('is-visible')
        this.timerEl!.classList.remove('is-hidden')
        this.timerBadgeEl!.textContent = formatCountdown(resendCooldown)
        this.resendCountdown?.stop()
        this.resendCountdown = createTimer({
          totalSeconds: resendCooldown,
          onTick:   (r) => { if (this.timerBadgeEl) this.timerBadgeEl.textContent = formatCountdown(r) },
          onExpire: () => {
            if (this.timerEl) this.timerEl.classList.add('is-hidden')
            if (this.resendEl) this.resendEl.classList.add('is-visible')
          },
        })
        this.resendCountdown.start()
        this._onResend?.()
      })
    }

    if (this._isReadOnly) hiddenInput.setAttribute('aria-readonly', 'true')

    // Apply defaultValue once on build — no onComplete, no change event
    const dv = this._defaultValue
    if (dv) {
      const filtered = filterString(dv.slice(0, length), type, this._pattern)
      if (filtered) {
        suppressComplete = true
        try {
          for (let i = 0; i < filtered.length; i++) this.otp!.insert(filtered[i], i)
        } finally {
          suppressComplete = false
        }
        hiddenInput.value = filtered
      }
    }

    this.attachEvents(selectOnFocus, blurOnComplete)

    if (this._isDisabled) this.applyDisabledDOM(true)

    // ── Web OTP API (SMS autofill) ──────────────────────────────────────────
    // navigator.credentials.get() intercepts incoming OTP SMSes on Android
    // Chrome without any user gesture. AbortController is stored so
    // disconnectedCallback and rebuild can cancel the pending request.
    if (typeof navigator !== 'undefined' && 'credentials' in navigator) {
      this.webOTPController = new AbortController()
      const webOTPTimeoutId = setTimeout(() => this.webOTPController?.abort(), 5 * 60 * 1000)
      ;(navigator.credentials.get as (opts: object) => Promise<OTPCredential | null>)({
        otp:    { transport: ['sms'] },
        signal: this.webOTPController.signal,
      }).then((credential) => {
        clearTimeout(webOTPTimeoutId)
        if (!credential?.code || !this.otp || !this.hiddenInput) return
        const valid = filterString(credential.code, type, this._pattern).slice(0, length)
        if (!valid) return
        this.otp.reset()
        for (let i = 0; i < valid.length; i++) this.otp.insert(valid[i], i)
        const nextCursor = Math.min(valid.length, length - 1)
        this.hiddenInput.value = valid
        this.hiddenInput.setSelectionRange(nextCursor, nextCursor)
        this.otp.move(nextCursor)
        this.syncSlotsToDOM()
      }).catch(() => {
        clearTimeout(webOTPTimeoutId)
        /* aborted on rebuild/disconnect or not supported */
      })
    }

    // ── Password manager badge guard ────────────────────────────────────────
    // Detect badge icons from LastPass, 1Password, Dashlane, Bitwarden, Keeper
    // and widen the hidden input to prevent overlap with the last visual slot.
    const slotRowWidth = slotRowEl.getBoundingClientRect().width
    this.disconnectPMWatch = wcWatchForPasswordManagerBadge(hiddenInput, slotRowWidth)

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
      if (selectOnFocus && char) {
        hiddenInput.setSelectionRange(clickedSlot, clickedSlot + 1)
      } else {
        hiddenInput.setSelectionRange(clickedSlot, clickedSlot)
      }
      this.syncSlotsToDOM()
    })

    requestAnimationFrame(() => {
      if (!this._isDisabled && autoFocus) hiddenInput.focus()
      hiddenInput.setSelectionRange(0, 0)
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

      let textNode = slotEl.childNodes[1] as Text | undefined
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        textNode = document.createTextNode('')
        slotEl.appendChild(textNode)
      }
      textNode.nodeValue = this._masked && char ? this._maskChar : char || this._placeholder

      slotEl.setAttribute('data-active',   b(i === activeSlot))
      slotEl.setAttribute('data-focus',    b(focused))
      slotEl.setAttribute('data-filled',   b(isFilled))
      slotEl.setAttribute('data-empty',    b(!isFilled))
      slotEl.setAttribute('data-masked',   b(this._masked))
      slotEl.setAttribute('data-invalid',  b(hasError))
      // hasError and _isSuccess are mutually exclusive: setError(true) sets _isSuccess = false,
      // and setSuccess(true) calls otp.setError(false). No explicit guard needed.
      slotEl.setAttribute('data-success',  b(this._isSuccess))
      slotEl.setAttribute('data-disabled', b(this._isDisabled))
      slotEl.setAttribute('data-complete', b(isComplete))
      slotEl.setAttribute('data-readonly', b(this._isReadOnly))

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

  // ── Events ──────────────────────────────────────────────────────────────────
  /**
   * Wire all event listeners to the hidden input element.
   * Called once at the end of each `build()`. Because `build()` creates a fresh
   * `hiddenInput` element, there is no need to `removeEventListener` — the old
   * element is discarded and its listeners are garbage-collected with it.
   *
   * @param selectOnFocus  When `true`, focusing a filled slot selects its character.
   * @param blurOnComplete When `true`, blurs the input after the last slot is filled.
   */
  private attachEvents(selectOnFocus: boolean, blurOnComplete: boolean): void {
    const input   = this.hiddenInput!
    const otp     = this.otp!
    const length  = this._length
    const type    = this._type
    const pattern = this._pattern

    input.addEventListener('keydown', (e) => {
      if (this._isDisabled) return
      const pos = input.selectionStart ?? 0
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (this._isReadOnly) return
        otp.delete(pos)
        this.syncSlotsToDOM()
        this.dispatchChange()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => input.setSelectionRange(next, next))
      } else if (e.key === 'Delete') {
        e.preventDefault()
        if (this._isReadOnly) return
        otp.clear(pos)
        this.syncSlotsToDOM()
        this.dispatchChange()
        requestAnimationFrame(() => input.setSelectionRange(pos, pos))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        otp.move(pos - 1)
        this.syncSlotsToDOM()
        requestAnimationFrame(() => input.setSelectionRange(otp.state.activeSlot, otp.state.activeSlot))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        otp.move(pos + 1)
        this.syncSlotsToDOM()
        requestAnimationFrame(() => input.setSelectionRange(otp.state.activeSlot, otp.state.activeSlot))
      } else if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (pos === 0) return
          e.preventDefault()
          otp.move(pos - 1)
        } else {
          if (!otp.state.slotValues[pos]) return
          if (pos >= length - 1) return
          e.preventDefault()
          otp.move(pos + 1)
        }
        this.syncSlotsToDOM()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => input.setSelectionRange(next, next))
      }
    })

    input.addEventListener('input', () => {
      if (this._isDisabled || this._isReadOnly) return
      const raw = input.value
      if (!raw) {
        otp.reset()
        input.value = ''
        input.setSelectionRange(0, 0)
        this.syncSlotsToDOM()
        this.dispatchChange()
        return
      }
      const valid = filterString(raw, type, pattern).slice(0, length)
      otp.reset()
      for (let i = 0; i < valid.length; i++) otp.insert(valid[i], i)
      const next = Math.min(valid.length, length - 1)
      input.value = valid
      input.setSelectionRange(next, next)
      otp.move(next)
      this.syncSlotsToDOM()
      this.dispatchChange()
      if (blurOnComplete && otp.state.isComplete) {
        requestAnimationFrame(() => input.blur())
      }
    })

    input.addEventListener('paste', (e) => {
      if (this._isDisabled || this._isReadOnly) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      const pos  = input.selectionStart ?? 0
      otp.paste(text, pos)
      const { slotValues, activeSlot } = otp.state
      input.value = slotValues.join('')
      input.setSelectionRange(activeSlot, activeSlot)
      this.syncSlotsToDOM()
      this.dispatchChange()
      if (blurOnComplete && otp.state.isComplete) {
        requestAnimationFrame(() => input.blur())
      }
    })

    input.addEventListener('focus', () => {
      this._onFocus?.()
      requestAnimationFrame(() => {
        const pos  = otp.state.activeSlot
        const char = otp.state.slotValues[pos]
        if (selectOnFocus && char) {
          input.setSelectionRange(pos, pos + 1)
        } else {
          input.setSelectionRange(pos, pos)
        }
        this.syncSlotsToDOM()
      })
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
    this.dispatchEvent(new CustomEvent('change', {
      detail:   { code: this.otp?.getCode() ?? '' },
      bubbles:  true,
      composed: true,
    }))
  }

  // ── Public DOM API ──────────────────────────────────────────────────────────

  /** Clear all slots, reset the timer display, and re-focus the hidden input. */
  reset(): void {
    this._isSuccess = false
    this.otp?.reset()
    if (this.hiddenInput) {
      this.hiddenInput.value = ''
      if (!this._isDisabled) this.hiddenInput.focus()
      this.hiddenInput.setSelectionRange(0, 0)
    }
    if (this.timerBadgeEl) this.timerBadgeEl.textContent = formatCountdown(this._timer)
    if (this.timerEl)      this.timerEl.classList.remove('is-hidden')
    if (this.resendEl)     this.resendEl.classList.remove('is-visible')
    this.resendCountdown?.stop()
    this.timerCtrl?.restart()
    this.syncSlotsToDOM()
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
      this.timerCtrl?.stop()
      this.resendCountdown?.stop()
      // Hide timer and resend via class-based approach so reset() can restore them.
      // Inline styles would persist across reset() calls and permanently suppress the UI.
      if (this.timerEl)  this.timerEl.classList.add('is-hidden')
      if (this.resendEl) this.resendEl.classList.remove('is-visible')
      this.dispatchEvent(new CustomEvent('success', { bubbles: true, composed: true }))
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
      requestAnimationFrame(() => {
        this.hiddenInput?.focus()
        this.hiddenInput?.setSelectionRange(this.otp?.state.activeSlot ?? 0, this.otp?.state.activeSlot ?? 0)
      })
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
  getSlots(): SlotEntry[] {
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
        if (key === 'Backspace')       { otp?.delete(slotIndex); this.syncSlotsToDOM() }
        else if (key === 'Delete')     { otp?.clear(slotIndex); this.syncSlotsToDOM() }
        else if (key === 'ArrowLeft')  { otp?.move(slotIndex - 1); this.syncSlotsToDOM() }
        else if (key === 'ArrowRight') { otp?.move(slotIndex + 1); this.syncSlotsToDOM() }
      },
      onFocus: () => this._onFocus?.(),
      onBlur:  () => this._onBlur?.(),
      'data-slot':     slotIndex,
      'data-active':   b(s?.activeSlot === slotIndex),
      'data-filled':   b(isFilled),
      'data-empty':    b(!isFilled),
      'data-complete': b(s?.isComplete ?? false),
      'data-invalid':  b(s?.hasError ?? false),
      // Use _isSuccess (the local runtime flag) rather than s.hasSuccess (core state)
      // so this matches the value used in syncSlotsToDOM — setSuccess() updates _isSuccess
      // and otp.setSuccess() together, keeping them in sync.
      'data-success':  b(this._isSuccess),
      'data-disabled': b(this._isDisabled),
      'data-readonly': b(this._isReadOnly),
      'data-first':    b(slotIndex === 0),
      'data-last':     b(slotIndex === this._length - 1),
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('verino-input')) {
  customElements.define('verino-input', VerinoInput)
}

export { VerinoInput }
