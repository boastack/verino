/**
 * verino/vanilla
 * ─────────────────────────────────────────────────────────────────────────────
 * DOM adapter using the single-hidden-input architecture.
 *
 * Architecture:
 *   One real <input> sits invisibly behind the visual slot divs.
 *   It captures ALL keyboard input, paste, and native SMS autofill.
 *   The visual slot <div>s are pure mirrors — they display characters
 *   from the hidden input's value, show a fake caret on the active slot,
 *   and forward click events to focus the real input.
 *
 * Why this is better than multiple inputs:
 *   - autocomplete="one-time-code" works as native single-input autofill
 *   - iOS SMS autofill works without any hacks
 *   - Screen readers see one real input — perfect a11y
 *   - No focus-juggling between inputs on every keystroke
 *   - Password managers can't confuse the slots for separate fields
 *
 * Web OTP API:
 *   Handled by the webOTPPlugin — see adapters/plugins/web-otp.ts.
 *
 * Timer + Resend UI:
 *   Handled by the timerUIPlugin — see adapters/plugins/timer-ui.ts.
 *   Pass `onTick` to drive your own timer UI and suppress the built-in one.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  createOTP,
  filterString,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type OTPOptions,
  type InputType,
} from '../core/index.js'
import { timerUIPlugin } from './plugins/timer-ui.js'
import { webOTPPlugin }  from './plugins/web-otp.js'
import { pmGuardPlugin } from './plugins/pm-guard.js'
import type { VerinoWrapper } from './plugins/types.js'


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The control surface returned by initOTP for each mounted wrapper. */
export type VerinoInstance = {
  /** Clear all slots, restart timer, focus the hidden input. */
  reset:        () => void
  /** Reset + fire onResend callback. */
  resend:       () => void
  /** Apply or clear the error state on all visual slots. */
  setError:     (isError: boolean) => void
  /** Apply or clear the success state on all visual slots. */
  setSuccess:   (isSuccess: boolean) => void
  /**
   * Enable or disable the input. When disabled, all keypresses and pastes are
   * silently ignored and the hidden input is set to disabled. Use during async
   * verification to prevent the user from modifying the code mid-request.
   */
  setDisabled:  (isDisabled: boolean) => void
  /**
   * Toggle readOnly at runtime. When `true`, all slot mutations are blocked
   * but focus, navigation, and copy remain fully functional.
   * Distinct from `disabled` — no opacity/cursor change, `aria-readonly` is set.
   */
  setReadOnly:  (isReadOnly: boolean) => void
  /** Returns the current joined code string. */
  getCode:      () => string
  /** Programmatically move focus to a slot index (focuses the hidden input). */
  focus:        (slotIndex: number) => void
  /** Remove all event listeners and stop the timer. */
  destroy:      () => void
}


// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const INJECTED_STYLE_ID = 'verino-styles'

/**
 * Injects the verino stylesheet into `<head>` exactly once per page.
 * Subsequent calls are no-ops guarded by the element id.
 *
 * CSS custom properties (set on `.verino-wrapper` to override defaults):
 * | Property                  | Default   | Controls                         |
 * |---------------------------|-----------|----------------------------------|
 * | `--verino-size`           | `56px`    | Slot width + height              |
 * | `--verino-gap`            | `12px`    | Gap between slots                |
 * | `--verino-radius`         | `10px`    | Slot border radius               |
 * | `--verino-font-size`      | `24px`    | Digit font size                  |
 * | `--verino-bg`             | `#FAFAFA` | Slot background (empty)          |
 * | `--verino-bg-filled`      | `#FFFFFF` | Slot background (filled)         |
 * | `--verino-color`          | `#0A0A0A` | Digit text colour                |
 * | `--verino-border-color`   | `#E5E5E5` | Default slot border              |
 * | `--verino-active-color`   | `#3D3D3D` | Active slot border + ring        |
 * | `--verino-error-color`    | `#FB2C36` | Error border, ring + badge       |
 * | `--verino-success-color`  | `#00C950` | Success border + ring            |
 * | `--verino-timer-color`    | `#5C5C5C` | Timer label text colour          |
 * | `--verino-caret-color`    | `#3D3D3D` | Fake caret colour                |
 * | `--verino-separator-color`| `#A1A1A1` | Separator text colour            |
 * | `--verino-separator-size` | `18px`    | Separator font size              |
 * | `--verino-masked-size`    | `16px`    | Mask character font size         |
 */
function injectStylesOnce(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(INJECTED_STYLE_ID)) return

  const styleEl = document.createElement('style')
  styleEl.id = INJECTED_STYLE_ID
  styleEl.textContent = [
    '.verino-element{position:relative;display:inline-block;line-height:1}',
    '.verino-hidden-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;border:none;outline:none;background:transparent;color:transparent;caret-color:transparent;z-index:1;cursor:text;font-size:1px}',
    '.verino-content{display:inline-flex;gap:var(--verino-gap,12px);align-items:center;padding:24px 0 0;position:relative}',
    '.verino-slot{position:relative;width:var(--verino-size,56px);height:var(--verino-size,56px);border:1px solid var(--verino-border-color,#E5E5E5);border-radius:var(--verino-radius,10px);font-size:var(--verino-font-size,24px);font-weight:var(--verino-font-weight,600);display:flex;align-items:center;justify-content:center;background:var(--verino-bg,#FAFAFA);color:var(--verino-color,#0A0A0A);transition:border-color 150ms ease,box-shadow 150ms ease,background 150ms ease;user-select:none;-webkit-user-select:none;cursor:text;font-family:inherit}',
    '.verino-slot[data-active="true"][data-focus="true"]{border-color:var(--verino-active-color,#3D3D3D);box-shadow:0 0 0 3px color-mix(in srgb,var(--verino-active-color,#3D3D3D) 10%,transparent);background:var(--verino-bg-filled,#FFFFFF)}',
    '.verino-slot[data-filled="true"]{background:var(--verino-bg-filled,#FFFFFF)}',
    '.verino-slot[data-invalid="true"]{border-color:var(--verino-error-color,#FB2C36);box-shadow:0 0 0 3px color-mix(in srgb,var(--verino-error-color,#FB2C36) 12%,transparent)}',
    '.verino-slot[data-success="true"]{border-color:var(--verino-success-color,#00C950);box-shadow:0 0 0 3px color-mix(in srgb,var(--verino-success-color,#00C950) 12%,transparent)}',
    '.verino-slot[data-disabled="true"]{opacity:0.45;cursor:not-allowed;pointer-events:none}',
    '.verino-caret{position:absolute;width:2px;height:52%;background:var(--verino-caret-color,#3D3D3D);border-radius:1px;animation:verino-blink 1s step-start infinite;pointer-events:none}',
    '@keyframes verino-blink{0%,100%{opacity:1}50%{opacity:0}}',
    '.verino-separator{display:flex;align-items:center;justify-content:center;color:var(--verino-separator-color,#A1A1A1);font-size:var(--verino-separator-size,18px);font-weight:400;user-select:none;flex-shrink:0;}',
    '.verino-slot[data-empty="true"]{font-size:var(--verino-placeholder-size,16px);color:var(--verino-placeholder-color,#D3D3D3)}',
    '.verino-slot[data-masked="true"][data-filled="true"]{font-size:var(--verino-masked-size,16px)}',
    '.verino-timer{display:flex;align-items:center;gap:8px;font-size:14px;padding:20px 0 0}',
    '.verino-timer-label{color:var(--verino-timer-color,#5C5C5C);font-size:14px}',
    '.verino-timer-badge{display:inline-flex;align-items:center;background:color-mix(in srgb,var(--verino-error-color,#FB2C36) 10%,transparent);color:var(--verino-error-color,#FB2C36);font-weight:500;font-size:14px;padding:2px 10px;border-radius:99px;height:24px}',
    '.verino-resend{display:none;align-items:center;gap:8px;font-size:14px;color:var(--verino-timer-color,#5C5C5C);padding:20px 0 0}',
    '.verino-resend.is-visible{display:flex}',
    '.verino-resend-btn{display:inline-flex;align-items:center;background:#E8E8E8;border:none;padding:2px 10px;border-radius:99px;color:#0A0A0A;font-weight:500;font-size:14px;transition:background 150ms ease;cursor:pointer;height:24px}',
    '.verino-resend-btn:hover{background:#E5E5E5}',
    '.verino-resend-btn:disabled{color:#A1A1A1;cursor:not-allowed;background:#F5F5F5}',
    '.verino-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}',
  ].join('')
  document.head.appendChild(styleEl)
}


// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vanilla-only options that extend the core OTPOptions.
 * These are not part of the shared adapter API.
 */
export type VanillaOnlyOptions = OTPOptions & {
  /**
   * Insert a purely visual separator after this slot index (0-based).
   * The separator is aria-hidden, never enters the value, and has no effect on state.
   * Accepts a single position or an array for multiple separators.
   * Default: 0 (no separator).
   * @example separatorAfter: 3      -> [ ][ ][ ] — [ ][ ][ ]       (6-slot field)
   * @example separatorAfter: [2, 4] -> [ ][ ] — [ ][ ] — [ ][ ]
   */
  separatorAfter?: number | number[]
  /**
   * The character or string to render as the separator.
   * Default: '—'
   */
  separator?: string
  /**
   * When `true`, each filled slot displays a mask glyph instead of the real
   * character. The hidden input switches to `type="password"` so the OS keyboard
   * and browser autocomplete treat it as a sensitive field.
   *
   * `getCode()` and `onComplete` always return the real characters — masking is
   * purely visual. Use for PIN entry or any flow where the value should not be
   * visible to shoulder-surfers.
   *
   * Default: `false`.
   */
  masked?: boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Allows substituting the default bullet with any character of your choice
   * (e.g. `'*'`, `'•'`, `'x'`).
   *
   * Readable via the `data-mask-char` HTML attribute:
   * `<div class="verino-wrapper" data-mask-char="*">`.
   *
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   */
  maskChar?: string
}

/**
 * Mount verino on one or more wrapper elements.
 *
 * @param target   CSS selector or HTMLElement. Default: '.verino-wrapper'
 * @param options  Runtime options — supplement or override data attributes.
 * @returns        Array of VerinoInstance objects, one per wrapper found.
 */
export function initOTP(
  target:  string | HTMLElement = '.verino-wrapper',
  options: VanillaOnlyOptions = {},
): VerinoInstance[] {
  injectStylesOnce()

  const wrapperElements: HTMLElement[] = typeof target === 'string'
    ? Array.from(document.querySelectorAll<HTMLElement>(target))
    : [target]

  return wrapperElements.map(wrapperEl => mountOnWrapper(wrapperEl, options))
}


// ─────────────────────────────────────────────────────────────────────────────
// MOUNT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mount the OTP field onto a single wrapper element.
 *
 * Builds the full DOM structure (slot row, hidden input, group label), installs
 * the three built-in plugins (timer-ui, web-otp, pm-guard), registers all event
 * listeners, and returns a `VerinoInstance` control surface.
 *
 * @internal Called by `initOTP` for each matched wrapper element.
 */
function mountOnWrapper(
  wrapperEl: VerinoWrapper,
  options:   VanillaOnlyOptions,
): VerinoInstance {
  // Guard against double-initialisation on the same element. Calling initOTP
  // twice without destroy() would orphan the first instance's event listeners
  // and timers. Warn and clean up the stale DOM before proceeding.
  if (wrapperEl.querySelector('.verino-element')) {
    console.warn('[verino] initOTP() called on an already-initialised wrapper — call instance.destroy() first to avoid leaks.')
  }

  // ── Config ───────────────────────────────────────────────────────────────
  const slotCount       = Math.min(
    Math.max(1, options.length ?? (parseInt(wrapperEl.dataset.length ?? '6', 10) || 6)),
    20
  )
  const inputType       = (options.type       ?? wrapperEl.dataset.type            ?? 'numeric') as InputType
  const timerSeconds    = Math.min(Math.max(0, options.timer       ?? (parseInt(wrapperEl.dataset.timer  ?? '0',  10) || 0)), 3600)
  const resendCooldown  = Math.min(Math.max(0, options.resendAfter ?? (parseInt(wrapperEl.dataset.resend ?? '30', 10) || 30)), 3600)
  const onResend        = options.onResend
  const onComplete      = options.onComplete
  let   suppressComplete = false
  const onTickCallback  = options.onTick
  const onExpire        = options.onExpire
  const pattern         = options.pattern
  const defaultValue    = options.defaultValue ?? ''

  const autoFocus      = options.autoFocus !== false         // default true
  const inputName      = options.name
  const onFocusProp    = options.onFocus
  const onBlurProp     = options.onBlur
  const placeholder    = options.placeholder ?? ''
  const selectOnFocus  = options.selectOnFocus  ?? false
  const blurOnComplete = options.blurOnComplete ?? false

  const rawSepAfter = options.separatorAfter
    ?? (wrapperEl.dataset.separatorAfter !== undefined
          ? wrapperEl.dataset.separatorAfter.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
          : [])
  // Normalise to array so all rendering logic is consistent
  const separatorAfterPositions: number[] = Array.isArray(rawSepAfter) ? rawSepAfter : [rawSepAfter]

  const separatorChar  = options.separator
    ?? wrapperEl.dataset.separator
    ?? '—'
  // Support both `data-masked` (boolean presence) and `data-masked="true"` (explicit string)
  const masked    = options.masked   ?? ('masked' in wrapperEl.dataset)
  const maskChar  = options.maskChar ?? wrapperEl.dataset.maskChar ?? '\u25CF'

  // Feedback flags — read once; used in the event subscriber below.
  const hapticEnabled = options.haptic ?? true
  const soundEnabled  = options.sound  ?? false

  // ── Core state machine ───────────────────────────────────────────────────
  const otpCore = createOTP({
    length:           slotCount,
    type:             inputType,
    timer:            timerSeconds,
    resendAfter:      resendCooldown,
    onComplete: onComplete ? (code) => { if (!suppressComplete) onComplete(code) } : undefined,
    onTick:           onTickCallback,
    onExpire,
    pattern,
    pasteTransformer: options.pasteTransformer,
    onInvalidChar:    options.onInvalidChar,
    disabled:         options.disabled ?? false,
    readOnly:         options.readOnly ?? false,
  })

  // ── Feedback via events (side effects are handled here, not in the core) ─
  // The core is now pure — it emits COMPLETE / ERROR events. This subscriber
  // translates those events into haptic vibration and audio feedback so each
  // adapter controls its own side effects rather than delegating to the core.
  const unsubFeedback = otpCore.subscribe((_state, event) => {
    if (event.type === 'COMPLETE') {
      if (hapticEnabled) triggerHapticFeedback()
      if (soundEnabled)  triggerSoundFeedback()
    } else if (event.type === 'ERROR' && event.hasError) {
      if (hapticEnabled) triggerHapticFeedback()
    }
  })

  // ── Build DOM ────────────────────────────────────────────────────────────
  // Clear wrapper using safe DOM removal (avoids innerHTML)
  while (wrapperEl.firstChild) wrapperEl.removeChild(wrapperEl.firstChild)

  const rootEl = document.createElement('div')
  rootEl.className = 'verino-element'

  // ARIA: group the slots under a single labelled landmark so screen readers
  // announce "N-digit code input group" rather than a bare invisible input.
  const groupLabelId = otpCore.getGroupId()
  rootEl.setAttribute('role', 'group')
  rootEl.setAttribute('aria-labelledby', groupLabelId)

  const groupLabelEl = document.createElement('span')
  groupLabelEl.id        = groupLabelId
  groupLabelEl.className = 'verino-sr-only'
  groupLabelEl.textContent = `${slotCount}-${inputType === 'numeric' ? 'digit' : 'character'} verification code`
  rootEl.appendChild(groupLabelEl)

  const slotRowEl = document.createElement('div')
  slotRowEl.className = 'verino-content'

  const slotEls: HTMLDivElement[] = []
  const caretEls: HTMLDivElement[] = []

  for (let i = 0; i < slotCount; i++) {
    const slotEl = document.createElement('div')
    slotEl.className = 'verino-slot'
    slotEl.setAttribute('aria-hidden',   'true')
    slotEl.setAttribute('data-slot',     String(i))
    slotEl.setAttribute('data-first',    String(i === 0))
    slotEl.setAttribute('data-last',     String(i === slotCount - 1))
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
    caretEl.className = 'verino-caret'
    caretEl.style.display = 'none'

    slotEl.appendChild(caretEl)
    caretEls.push(caretEl)
    slotEls.push(slotEl)
    slotRowEl.appendChild(slotEl)

    if (separatorAfterPositions.some(pos => pos > 0 && i === pos - 1)) {
      const sepEl = document.createElement('div')
      sepEl.className   = 'verino-separator'
      sepEl.textContent = separatorChar
      // Intentionally hidden — separators are visual only; screen readers announce the grouped code, not the punctuation between slots
      sepEl.setAttribute('aria-hidden', 'true')
      slotRowEl.appendChild(sepEl)
    }
  }

  const hiddenInputEl = document.createElement('input')
  hiddenInputEl.type         = masked ? 'password' : 'text'
  hiddenInputEl.inputMode    = inputType === 'numeric' ? 'numeric' : 'text'
  hiddenInputEl.autocomplete = 'one-time-code'
  hiddenInputEl.maxLength    = slotCount
  hiddenInputEl.className    = 'verino-hidden-input'
  if (inputName) hiddenInputEl.name = inputName
  hiddenInputEl.setAttribute('aria-label', `Enter your ${slotCount}-${inputType === 'numeric' ? 'digit' : 'character'} code`)
  hiddenInputEl.setAttribute('spellcheck', 'false')
  hiddenInputEl.setAttribute('autocorrect', 'off')
  hiddenInputEl.setAttribute('autocapitalize', 'off')

  rootEl.appendChild(slotRowEl)
  rootEl.appendChild(hiddenInputEl)
  wrapperEl.appendChild(rootEl)

  if (otpCore.state.isReadOnly) hiddenInputEl.setAttribute('aria-readonly', 'true')

  // Apply defaultValue once on mount — no onComplete, no onChange
  if (defaultValue) {
    const filtered = filterString(defaultValue.slice(0, slotCount), inputType, pattern)
    if (filtered) {
      suppressComplete = true
      try {
        for (let i = 0; i < filtered.length; i++) otpCore.insert(filtered[i], i)
      } finally {
        suppressComplete = false
      }
      hiddenInputEl.value = filtered
    }
  }

  // ── DOM sync ──────────────────────────────────────────────────────────────

  /**
   * Reconcile every visual slot div and the hidden input with the current core state.
   *
   * Called after every user action (keydown, input, paste, focus, click) and after
   * any public API method that changes state (setError, setSuccess, setDisabled, etc.).
   *
   * Reads `document.activeElement` to inject the real browser focus state (`data-focus`)
   * onto each slot — the core is DOM-free and cannot know this itself.
   */
  function syncSlotsToDOM(): void {
    const { slotValues, activeSlot, hasError, hasSuccess, isComplete, isDisabled, isReadOnly } = otpCore.state
    const inputIsFocused = document.activeElement === hiddenInputEl

    slotEls.forEach((slotEl, i) => {
      const char     = slotValues[i]
      const isActive = i === activeSlot
      const isFilled = char.length === 1

      let textNode = slotEl.childNodes[1] as Text | undefined
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        textNode = document.createTextNode('')
        slotEl.appendChild(textNode)
      }
      textNode.nodeValue = masked && char ? maskChar : char || placeholder

      slotEl.setAttribute('data-active',   String(isActive))
      slotEl.setAttribute('data-focus',    String(inputIsFocused))
      slotEl.setAttribute('data-filled',   String(isFilled))
      slotEl.setAttribute('data-empty',    String(!isFilled))
      slotEl.setAttribute('data-masked',   String(masked))
      slotEl.setAttribute('data-invalid',  String(hasError))
      slotEl.setAttribute('data-success',  String(hasSuccess))
      slotEl.setAttribute('data-complete', String(isComplete))
      slotEl.setAttribute('data-disabled', String(isDisabled))
      slotEl.setAttribute('data-readonly', String(isReadOnly))

      caretEls[i].style.display = isActive && inputIsFocused && !isFilled ? 'block' : 'none'
    })

    // Only update value when it actually differs — assigning the same string
    // resets selectionStart/End in some browsers, clobbering the cursor.
    const newValue = slotValues.join('')
    if (hiddenInputEl.value !== newValue) hiddenInputEl.value = newValue

    // Expose component state as data attributes on wrapper for CSS/Tailwind targeting
    wrapperEl.toggleAttribute('data-complete', isComplete)
    wrapperEl.toggleAttribute('data-invalid',  hasError)
    wrapperEl.toggleAttribute('data-success',  hasSuccess)
    wrapperEl.toggleAttribute('data-disabled', isDisabled)
    wrapperEl.toggleAttribute('data-readonly', isReadOnly)
  }

  // ── Install plugins ───────────────────────────────────────────────────────

  const pluginCtx = {
    otp:            otpCore,
    wrapperEl,
    hiddenInputEl,
    slotRowEl,
    slotCount,
    inputType,
    pattern,
    timerSeconds,
    resendCooldown,
    onResend,
    onTickCallback,
    onExpire,
    syncSlots: syncSlotsToDOM,
  }

  const pluginCleanups = [
    timerUIPlugin.install(pluginCtx),
    webOTPPlugin.install(pluginCtx),
    pmGuardPlugin.install(pluginCtx),
  ]

  // ── Event handlers ────────────────────────────────────────────────────────

  function onHiddenInputKeydown(event: KeyboardEvent): void {
    const cursorPos = hiddenInputEl.selectionStart ?? 0

    if (event.key === 'Backspace') {
      event.preventDefault()
      if (otpCore.state.isReadOnly) return
      otpCore.delete(cursorPos)
      syncSlotsToDOM()
      hiddenInputEl.setSelectionRange(otpCore.state.activeSlot, otpCore.state.activeSlot)
    } else if (event.key === 'Delete') {
      event.preventDefault()
      if (otpCore.state.isReadOnly) return
      otpCore.clear(cursorPos)
      syncSlotsToDOM()
      hiddenInputEl.setSelectionRange(cursorPos, cursorPos)
    } else if (event.key === 'Tab') {
      if (event.shiftKey) {
        // Shift+Tab: move to previous slot, or exit to previous DOM element from first slot
        if (cursorPos === 0) return
        event.preventDefault()
        otpCore.move(cursorPos - 1)
      } else {
        // Tab: advance to next slot only if current slot is filled
        // On last slot (filled), fall through to let browser move to next DOM element
        if (!otpCore.state.slotValues[cursorPos]) return
        if (cursorPos >= slotCount - 1) return
        event.preventDefault()
        otpCore.move(cursorPos + 1)
      }
      const nextSlot = otpCore.state.activeSlot
      hiddenInputEl.setSelectionRange(nextSlot, nextSlot)
      syncSlotsToDOM()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      otpCore.move(cursorPos - 1)
      const nextSlot = otpCore.state.activeSlot
      hiddenInputEl.setSelectionRange(nextSlot, nextSlot)
      syncSlotsToDOM()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      otpCore.move(cursorPos + 1)
      const nextSlot = otpCore.state.activeSlot
      hiddenInputEl.setSelectionRange(nextSlot, nextSlot)
      syncSlotsToDOM()
    }
  }

  // Handles the `input` DOM event (not `change`). Named "Change" because the handler
  // reconciles value changes caused by IME composition, autocomplete, and SMS autofill —
  // all of which fire `input`, not `change`. The `_event` parameter is unused because
  // we read directly from `hiddenInputEl.value` to avoid the `e.target as HTMLInputElement` cast.
  function onHiddenInputChange(_event: Event): void {
    if (otpCore.state.isReadOnly) return
    const rawValue = hiddenInputEl.value

    if (!rawValue) {
      otpCore.reset()
      hiddenInputEl.value = ''
      hiddenInputEl.setSelectionRange(0, 0)
      syncSlotsToDOM()
      return
    }

    const validValue = filterString(rawValue, inputType, pattern)

    otpCore.reset()
    for (let i = 0; i < Math.min(validValue.length, slotCount); i++) {
      otpCore.insert(validValue[i], i)
    }

    const filledCount = Math.min(validValue.length, slotCount)
    const nextCursor  = Math.min(filledCount, slotCount - 1)
    hiddenInputEl.value = validValue.slice(0, slotCount)
    hiddenInputEl.setSelectionRange(nextCursor, nextCursor)
    otpCore.move(nextCursor)
    syncSlotsToDOM()
    if (blurOnComplete && otpCore.state.isComplete) {
      requestAnimationFrame(() => hiddenInputEl.blur())
    }
  }

  function onHiddenInputPaste(event: ClipboardEvent): void {
    event.preventDefault()
    if (otpCore.state.isReadOnly) return
    const pastedText = event.clipboardData?.getData('text') ?? ''
    const cursorPos  = hiddenInputEl.selectionStart ?? 0
    otpCore.paste(pastedText, cursorPos)

    const { slotValues, activeSlot } = otpCore.state
    hiddenInputEl.value = slotValues.join('')
    hiddenInputEl.setSelectionRange(activeSlot, activeSlot)
    syncSlotsToDOM()
    if (blurOnComplete && otpCore.state.isComplete) {
      requestAnimationFrame(() => hiddenInputEl.blur())
    }
  }

  function onHiddenInputFocus(): void {
    onFocusProp?.()
    // Read activeSlot inside the RAF — not before it.
    // Browser event order on a fresh click: focus fires → click fires → RAF fires.
    // Capturing pos outside the RAF would snapshot activeSlot=0 before the click
    // handler has a chance to call moveFocusTo(clickedSlot), causing the RAF to
    // overwrite the correct slot back to 0.
    requestAnimationFrame(() => {
      const pos  = otpCore.state.activeSlot
      const char = otpCore.state.slotValues[pos]
      if (selectOnFocus && char) {
        hiddenInputEl.setSelectionRange(pos, pos + 1)
      } else {
        hiddenInputEl.setSelectionRange(pos, pos)
      }
      syncSlotsToDOM()
    })
  }

  function onHiddenInputBlur(): void {
    onBlurProp?.()
    // Set data-focus and hide carets directly rather than calling syncSlotsToDOM.
    // syncSlotsToDOM reads document.activeElement to derive focus state, but the
    // blur event fires before the browser has updated activeElement to the next
    // focused element. A direct write avoids the transient intermediate state
    // where the previously-active slot would briefly appear focused.
    slotEls.forEach(slotEl => slotEl.setAttribute('data-focus', 'false'))
    caretEls.forEach(caretEl => { caretEl.style.display = 'none' })
  }

  function onHiddenInputClick(e: MouseEvent): void {
    if (otpCore.state.isDisabled) return
    // Click fires after the browser has already placed the cursor (at 0 due to
    // font-size:1px). Coordinate hit-test to find the intended slot, then
    // override the browser's placement with an explicit setSelectionRange.
    let rawSlot = slotEls.length - 1
    for (let i = 0; i < slotEls.length; i++) {
      if (e.clientX <= slotEls[i].getBoundingClientRect().right) { rawSlot = i; break }
    }
    // Clamp to filled count: setSelectionRange(N, N) on a string of length L
    // silently clamps to L, so cursor ends up at 0 on an empty field. Clamping
    // keeps the visual active slot and the actual cursor position in sync.
    const clickedSlot = Math.min(rawSlot, hiddenInputEl.value.length)
    otpCore.move(clickedSlot)
    const char = otpCore.state.slotValues[clickedSlot]
    if (selectOnFocus && char) {
      hiddenInputEl.setSelectionRange(clickedSlot, clickedSlot + 1)
    } else {
      hiddenInputEl.setSelectionRange(clickedSlot, clickedSlot)
    }
    syncSlotsToDOM()
  }

  hiddenInputEl.addEventListener('keydown', onHiddenInputKeydown)
  hiddenInputEl.addEventListener('input',   onHiddenInputChange)
  hiddenInputEl.addEventListener('paste',   onHiddenInputPaste)
  hiddenInputEl.addEventListener('focus',   onHiddenInputFocus)
  hiddenInputEl.addEventListener('blur',    onHiddenInputBlur)
  hiddenInputEl.addEventListener('click',   onHiddenInputClick)

  requestAnimationFrame(() => {
    if (!otpCore.state.isDisabled && autoFocus) hiddenInputEl.focus()
    hiddenInputEl.setSelectionRange(0, 0)
    syncSlotsToDOM()
  })


  // ── Public API ────────────────────────────────────────────────────────────

  function reset(): void {
    otpCore.reset()
    hiddenInputEl.value = ''
    requestAnimationFrame(() => {
      hiddenInputEl.focus()
      hiddenInputEl.setSelectionRange(0, 0)
      syncSlotsToDOM()
    })
  }

  function resend(): void {
    reset()
    onResend?.()
  }

  function setError(isError: boolean): void {
    otpCore.setError(isError)
    syncSlotsToDOM()
  }

  function setSuccess(isSuccess: boolean): void {
    otpCore.setSuccess(isSuccess)
    syncSlotsToDOM()
  }

  function setDisabled(value: boolean): void {
    otpCore.setDisabled(value)
    hiddenInputEl.disabled = value
    slotEls.forEach(slotEl => {
      ;(slotEl as HTMLElement).style.pointerEvents = value ? 'none' : ''
    })
    syncSlotsToDOM()
  }

  function setReadOnly(value: boolean): void {
    otpCore.setReadOnly(value)
    if (value) {
      hiddenInputEl.setAttribute('aria-readonly', 'true')
    } else {
      hiddenInputEl.removeAttribute('aria-readonly')
    }
    syncSlotsToDOM()
  }

  function getCode(): string {
    return otpCore.getCode()
  }

  function focus(slotIndex: number): void {
    otpCore.move(slotIndex)
    hiddenInputEl.focus()
    hiddenInputEl.setSelectionRange(slotIndex, slotIndex)
    syncSlotsToDOM()
  }

  function destroy(): void {
    hiddenInputEl.removeEventListener('keydown',   onHiddenInputKeydown)
    hiddenInputEl.removeEventListener('input',     onHiddenInputChange)
    hiddenInputEl.removeEventListener('paste',     onHiddenInputPaste)
    hiddenInputEl.removeEventListener('focus',     onHiddenInputFocus)
    hiddenInputEl.removeEventListener('blur',      onHiddenInputBlur)
    hiddenInputEl.removeEventListener('click',     onHiddenInputClick)
    unsubFeedback()
    pluginCleanups.forEach(cleanup => cleanup())
    pluginCleanups.length = 0

    // Clear wrapper state attributes so a reused element doesn't carry stale
    // state from a previous mount (e.g. data-complete or data-invalid stuck on).
    wrapperEl.removeAttribute('data-complete')
    wrapperEl.removeAttribute('data-invalid')
    wrapperEl.removeAttribute('data-success')
    wrapperEl.removeAttribute('data-disabled')
    wrapperEl.removeAttribute('data-readonly')

    otpCore.destroy()
  }

  return { reset, resend, setError, setSuccess, setDisabled, setReadOnly, getCode, focus, destroy }
}


// ─────────────────────────────────────────────────────────────────────────────
// CDN GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    Verino: { init: typeof initOTP }
  }
}

if (typeof window !== 'undefined') {
  window.Verino = { init: initOTP }
}
