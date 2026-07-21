/**
 * @verino/alpine
 * ─────────────────────────────────────────────────────────────────────────────
 * Alpine.js adapter — x-verino directive (single hidden-input architecture)
 *
 * Usage:
 *   import Alpine from 'alpinejs'
 *   import { VerinoAlpine } from '@verino/alpine'
 *   Alpine.plugin(VerinoAlpine)
 *   Alpine.start()
 *
 *   <div x-verino="{ length: 6, type: 'numeric', timer: 60 }"></div>
 *
 *   // With separator:
 *   <div x-verino="{ length: 6, separatorAfter: 2 }"></div>
 *
 *   // Access public API:
 *   el._verino.setDisabled(true)
 *   el._verino.setError(true)
 *   el._verino.reset()
 *   el._verino.getCode()
 */

import {
  type CoreOTPOptions,
  type FeedbackOptions,
  type FieldBehaviorOptions,
  type FocusDataAttrs,
  type SlotEntry,
  type InputProps,
  type ResendUIOptions,
  type TimerController,
  type TimerUIOptions,
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
  focusOTPInput,
  handleOTPKeyAction,
  scheduleFocusSync,
  scheduleInputBlur,
  scheduleInputFocus,
  scheduleInputSelection,
  syncInputValue,
} from '@verino/core/toolkit/controller'
import { seedProgrammaticValue } from '@verino/core/toolkit/adapter-policy'
import { createTimer } from '@verino/core'
import {
  createResendTimer,
} from '@verino/core/toolkit/timer-policy'
import { subscribeFeedback } from '@verino/core/toolkit/feedback'
import {
  getOTPCodeUnit,
  resolveOTPUIStrings,
  type OTPUIStringOverrides,
} from '@verino/core/toolkit/messages'

/** Shape of the data object Alpine passes to every directive handler. */
type AlpineDirectiveData = {
  /** The raw expression string from `x-verino="{ ... }"`. */
  expression: string
  /** Directive value segment, e.g. `x-verino:value`. Unused by Verino. */
  value:      string
  /** Modifier segments, e.g. `x-verino.modifier`. Unused by Verino. */
  modifiers:  string[]
}

/** Utility functions Alpine passes to every directive handler. */
type AlpineDirectiveUtilities = {
  /** Evaluate an Alpine expression in the component scope and return its value. */
  evaluate:      (expr: string) => unknown
  /** Return a function that evaluates `expr` reactively via Alpine's effect system. */
  evaluateLater: (expr: string) => (callback: (value: unknown) => void) => void
  /** Register a teardown function called when the component or directive is destroyed. */
  cleanup:       (fn: () => void) => void
  /** Run `fn` reactively; re-runs whenever its Alpine reactive dependencies change. */
  effect:        (fn: () => void) => void
}

/** Minimal interface for the Alpine.js instance — only the parts Verino needs. */
type AlpinePlugin = {
  directive: (
    name: string,
    handler: (el: HTMLElement, data: AlpineDirectiveData, utilities: AlpineDirectiveUtilities) => { cleanup(): void } | void
  ) => void
}

type AlpineFieldBehaviorOptions = Pick<
  FieldBehaviorOptions,
  'autoFocus' | 'name' | 'onFocus' | 'onBlur' | 'placeholder' | 'selectOnFocus' | 'blurOnComplete' | 'defaultValue'
>

/**
 * Extended options for the Alpine x-verino directive.
 * Adds separator and Alpine-specific callbacks on top of the core options.
 */
type AlpineOTPOptions =
  & CoreOTPOptions
  & FeedbackOptions
  & AlpineFieldBehaviorOptions
  & TimerUIOptions
  & ResendUIOptions
  & {
  /**
   * Insert a purely visual separator after the Nth slot (1-based).
   * Accepts a single position or an array for multiple separators.
   * Default: 0 (no separator).
   * @example separatorAfter: 3      ->  [*][*][*] — [*][*][*]   (splits after 3rd)
   * @example separatorAfter: [2, 4] ->  [*][*] — [*][*] — [*][*]
   */
  separatorAfter?: number | number[]
  separator?:      string
  onChange?:       (code: string) => void
  /**
   * When `true`, each filled slot displays a mask glyph instead of the real
   * character. The hidden input switches to `type="password"`. `getCode()`
   * still returns real characters. Use for PIN entry or any sensitive input flow.
   * Default: `false`.
   */
  masked?:         boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   * @example maskChar: '*'
   */
  maskChar?:       string
  /** Localize every user-facing string rendered by the directive. */
  messages?:       OTPUIStringOverrides
}

type AlpineVerinoAPI = {
  getCode:      () => string
  getSlots:     () => readonly SlotEntry[]
  getInputProps:(slotIndex: number) => InputProps & FocusDataAttrs
  destroy:      () => void
  reset:        () => void
  resend:       () => void
  setError:     (isError: boolean) => void
  setSuccess:   (isSuccess: boolean) => void
  setDisabled:  (value: boolean) => void
  setReadOnly:  (value: boolean) => void
  focus:        (slotIndex: number) => void
  timer:        TimerController
}

type AlpineVerinoElement = HTMLElement & {
  _verino: AlpineVerinoAPI
}

type AlpineCallbackRefs = {
  onChange?:       AlpineOTPOptions['onChange']
  onBlur?:         AlpineOTPOptions['onBlur']
  onComplete?:     AlpineOTPOptions['onComplete']
  onExpire?:       AlpineOTPOptions['onExpire']
  onFocus?:        AlpineOTPOptions['onFocus']
  onInvalidChar?:  AlpineOTPOptions['onInvalidChar']
  onResend?:       AlpineOTPOptions['onResend']
  onTick?:         AlpineOTPOptions['onTick']
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseInteger(value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function asPasteTransformer(value: unknown): ((raw: string) => string) | undefined {
  return typeof value === 'function' ? (value as (raw: string) => string) : undefined
}

function asCompleteHandler(value: unknown): ((code: string) => void) | undefined {
  return typeof value === 'function' ? (value as (code: string) => void) : undefined
}

function asInvalidCharHandler(value: unknown): ((char: string, index: number) => void) | undefined {
  return typeof value === 'function' ? (value as (char: string, index: number) => void) : undefined
}

function asTickHandler(value: unknown): ((remaining: number) => void) | undefined {
  return typeof value === 'function' ? (value as (remaining: number) => void) : undefined
}

function asVoidHandler(value: unknown): (() => void) | undefined {
  return typeof value === 'function' ? (value as () => void) : undefined
}

function asFeedbackRuntime(value: unknown): AlpineOTPOptions['feedback'] | undefined {
  if (!isPlainObject(value)) return undefined
  const haptic = asVoidHandler(value.haptic)
  const sound = asVoidHandler(value.sound)
  return haptic || sound ? { haptic, sound } : undefined
}

function normalizeAlpineOptions(input: unknown): AlpineOTPOptions {
  if (!isPlainObject(input)) return {}

  return {
    length:           parseInteger(input.length, 6, 1),
    type:             parseInputType(input.type),
    timer:            parseInteger(input.timer, 0, 0),
    disabled:         parseBooleanish(input.disabled, false),
    readOnly:         parseBooleanish(input.readOnly, false),
    pattern:          input.pattern instanceof RegExp ? input.pattern : undefined,
    pasteTransformer: asPasteTransformer(input.pasteTransformer),
    onComplete:       asCompleteHandler(input.onComplete),
    onInvalidChar:    asInvalidCharHandler(input.onInvalidChar),
    onTick:           asTickHandler(input.onTick),
    onExpire:         asVoidHandler(input.onExpire),
    onResend:         asVoidHandler(input.onResend),
    onChange:         asCompleteHandler(input.onChange),
    onFocus:          asVoidHandler(input.onFocus),
    onBlur:           asVoidHandler(input.onBlur),
    haptic:           parseBooleanish(input.haptic, true),
    sound:            parseBooleanish(input.sound, false),
    feedback:         asFeedbackRuntime(input.feedback),
    autoFocus:        parseBooleanish(input.autoFocus, true),
    name:             typeof input.name === 'string' ? input.name : undefined,
    placeholder:      typeof input.placeholder === 'string' ? input.placeholder : undefined,
    selectOnFocus:    parseBooleanish(input.selectOnFocus, false),
    blurOnComplete:   parseBooleanish(input.blurOnComplete, false),
    defaultValue:     typeof input.defaultValue === 'string' ? input.defaultValue : undefined,
    separatorAfter:   parseSeparatorAfter(input.separatorAfter),
    separator:        typeof input.separator === 'string' ? input.separator : undefined,
    resendAfter:      parseInteger(input.resendAfter, 30, 0),
    masked:           parseBooleanish(input.masked, false),
    maskChar:         typeof input.maskChar === 'string' ? input.maskChar : undefined,
    messages:         isPlainObject(input.messages) ? input.messages as OTPUIStringOverrides : undefined,
  }
}

type AlpinePreservedState = {
  code:       string
  activeSlot: number
  hasError:   boolean
  hasSuccess: boolean
}

function normalizeEvaluatedOptions(evaluated: unknown): AlpineOTPOptions {
  if (!isPlainObject(evaluated)) {
    console.error('[verino] expression did not return a plain object. Got:', evaluated)
    return {}
  }
  return normalizeAlpineOptions(evaluated)
}

function separatorAfterEqual(
  a: number | number[] | undefined,
  b: number | number[] | undefined,
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index])
  }
  return a === b
}

function applyCallbackRefs(target: AlpineCallbackRefs, options: AlpineOTPOptions): void {
  target.onComplete    = options.onComplete
  target.onInvalidChar = options.onInvalidChar
  target.onTick        = options.onTick
  target.onExpire      = options.onExpire
  target.onResend      = options.onResend
  target.onChange      = options.onChange
  target.onFocus       = options.onFocus
  target.onBlur        = options.onBlur
}

function alpineOptionsEqual(a: AlpineOTPOptions | null, b: AlpineOTPOptions): boolean {
  if (!a) return false

  return (
    a.length === b.length &&
    a.type === b.type &&
    a.timer === b.timer &&
    a.pattern?.source === b.pattern?.source &&
    a.pattern?.flags === b.pattern?.flags &&
    a.pasteTransformer === b.pasteTransformer &&
    Boolean(a.onTick) === Boolean(b.onTick) &&
    a.autoFocus === b.autoFocus &&
    a.name === b.name &&
    a.placeholder === b.placeholder &&
    a.selectOnFocus === b.selectOnFocus &&
    a.blurOnComplete === b.blurOnComplete &&
    a.defaultValue === b.defaultValue &&
    a.separator === b.separator &&
    a.resendAfter === b.resendAfter &&
    a.masked === b.masked &&
    a.maskChar === b.maskChar &&
    a.messages?.groupLabel === b.messages?.groupLabel &&
    a.messages?.inputLabel === b.messages?.inputLabel &&
    a.messages?.expiresIn === b.messages?.expiresIn &&
    a.messages?.resendPrompt === b.messages?.resendPrompt &&
    a.messages?.resendAction === b.messages?.resendAction &&
    a.messages?.resendButtonLabel === b.messages?.resendButtonLabel &&
    separatorAfterEqual(a.separatorAfter, b.separatorAfter)
  )
}

function capturePreservedState(wrapperEl: HTMLElement): AlpinePreservedState | null {
  const alpineWrapper = wrapperEl as Partial<AlpineVerinoElement>
  const api = alpineWrapper._verino
  if (!api) return null

  return {
    code:       api.getCode(),
    activeSlot: api.getSlots().find((slot) => slot.isActive)?.index ?? 0,
    hasError:   wrapperEl.hasAttribute('data-invalid'),
    hasSuccess: wrapperEl.hasAttribute('data-success'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alpine.js plugin that registers the `x-verino` directive.
 *
 * Install once before `Alpine.start()`:
 * ```js
 * import Alpine from 'alpinejs'
 * import { VerinoAlpine } from '@verino/alpine'
 * Alpine.plugin(VerinoAlpine)
 * Alpine.start()
 * ```
 *
 * The directive accepts core machine options plus `separatorAfter`,
 * `separator`, `masked`, and `maskChar`. Options are evaluated in Alpine scope
 * and re-applied through Alpine's reactive effect system, so `$data`
 * references stay live after the directive is created.
 *
 * @param Alpine - The Alpine.js global passed automatically by `Alpine.plugin()`.
 */
export const VerinoAlpine = (Alpine: AlpinePlugin): void => {
  Alpine.directive('verino', (wrapperEl, { expression }, { evaluateLater, effect, cleanup }): { cleanup(): void } => {
    type MountedDirective = {
      cleanup(): void
      update(nextOptions: AlpineOTPOptions): void
    }

    function mountDirective(
      options: AlpineOTPOptions,
      preservedState: AlpinePreservedState | null = null,
    ): MountedDirective {
      const {
        length             = 6,
        idBase,
        type               = 'numeric',
        timer:             timerSecs = 0,
        disabled:          initialDisabled = false,
        onTick:            onTickProp,
        haptic             = true,
        sound              = false,
        pattern,
        pasteTransformer,
        separatorAfter:    rawSepAfter = 0,
        separator          = '—',
        resendAfter:       resendCooldown = 30,
        masked             = false,
        maskChar           = '\u25CF',
        autoFocus          = true,
        name:              inputName,
        placeholder        = '',
        selectOnFocus      = false,
        blurOnComplete     = false,
        defaultValue       = '',
        readOnly:          readOnlyOpt = false,
      } = options
      const messages = resolveOTPUIStrings(options.messages)
      const codeUnit = getOTPCodeUnit(type)

      const separatorAfterPositions: number[] = Array.isArray(rawSepAfter) ? rawSepAfter : [rawSepAfter]
      const callbackRefs: AlpineCallbackRefs = {}
      applyCallbackRefs(callbackRefs, options)
      let destroyed = false
      const frameScheduler = createFrameScheduler(() => !destroyed && hiddenInputEl.isConnected)

      let suppressComplete = false
      const otp = createOTP({
        idBase,
        length,
        type,
        pattern,
        pasteTransformer,
        onInvalidChar: (char, index) => { callbackRefs.onInvalidChar?.(char, index) },
        onComplete: (code) => { if (!suppressComplete) callbackRefs.onComplete?.(code) },
        disabled: initialDisabled,
        readOnly: readOnlyOpt,
      })
      let liveHaptic = haptic
      let liveSound = sound
      let unsubFeedback = subscribeFeedback(otp, { haptic: liveHaptic, sound: liveSound, feedback: options.feedback })

      let isDisabled   = initialDisabled
      let isReadOnly   = readOnlyOpt
      let successState = false

      function refreshFeedbackSubscription(nextHaptic: boolean, nextSound: boolean): void {
        unsubFeedback()
        liveHaptic = nextHaptic
        liveSound = nextSound
        unsubFeedback = subscribeFeedback(otp, { haptic: liveHaptic, sound: liveSound, feedback: options.feedback })
      }

      function setDisabledState(value: boolean): void {
        isDisabled = value
        otp.setDisabled(value)
        hiddenInputEl.disabled = value
        syncSlotsToDOM()
        if (!value) {
          scheduleInputFocus(frameScheduler, hiddenInputEl, otp.state.activeSlot)
        }
      }

      function setReadOnlyState(value: boolean): void {
        isReadOnly = value
        otp.setReadOnly(value)
        if (value) hiddenInputEl.setAttribute('aria-readonly', 'true')
        else hiddenInputEl.removeAttribute('aria-readonly')
        syncSlotsToDOM()
      }

      while (wrapperEl.firstChild) wrapperEl.removeChild(wrapperEl.firstChild)
      wrapperEl.style.cssText = 'position:relative;display:inline-flex;gap:var(--verino-gap,12px);align-items:center;flex-wrap:wrap;padding-top:var(--verino-content-padding-top,0px)'
      wrapperEl.setAttribute('role', 'group')
      wrapperEl.setAttribute('aria-label', messages.groupLabel(length, codeUnit))

      const slotEls:  HTMLDivElement[] = []
      const caretEls: HTMLDivElement[] = []

      for (let i = 0; i < length; i++) {
        const slotEl = document.createElement('div')
        slotEl.style.cssText = [
          `width:var(--verino-size,56px)`,
          `height:var(--verino-size,56px)`,
          `border:var(--verino-border-width,1px) solid var(--verino-border-color,#DBDBDB)`,
          `border-radius:var(--verino-radius,10px)`,
          `font-size:var(--verino-font-size,24px)`,
          `font-weight:var(--verino-font-weight,600)`,
          `display:flex`,
          `align-items:center`,
          `justify-content:center`,
          `background:var(--verino-bg,#FAFAFA)`,
          `color:var(--verino-color,#0C0C0C)`,
          `position:relative`,
          `cursor:text`,
          `transition:border-color var(--verino-motion-duration,150ms) ease,box-shadow var(--verino-motion-duration,150ms) ease`,
          `font-family:var(--verino-slot-font,inherit)`,
          `user-select:none`,
        ].join(';')
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
        caretEl.style.cssText = 'position:absolute;width:var(--verino-caret-width,2px);height:var(--verino-caret-height,52%);background:var(--verino-caret-color,#2A2A2A);border-radius:var(--verino-caret-radius,1px);animation:verino-alpine-blink var(--verino-caret-duration,1s) step-start infinite;pointer-events:none;display:none'
        slotEl.appendChild(caretEl)
        caretEls.push(caretEl)

        slotEls.push(slotEl)
        wrapperEl.appendChild(slotEl)

        if (separatorAfterPositions.some(pos => pos > 0 && i === pos - 1)) {
          const sepEl = document.createElement('div')
          sepEl.setAttribute('aria-hidden', 'true')
          sepEl.style.cssText = [
            `display:flex`,
            `align-items:center`,
            `justify-content:center`,
            `color:var(--verino-separator-color,#B2B2B2)`,
            `font-size:var(--verino-separator-size,18px)`,
            `font-weight:400`,
            `user-select:none`,
            `flex-shrink:0`,
          ].join(';')
          sepEl.textContent = separator
          wrapperEl.appendChild(sepEl)
        }
      }

      if (!document.getElementById('verino-alpine-styles')) {
        const s = document.createElement('style')
        s.id = 'verino-alpine-styles'
        s.textContent = [
          '@keyframes verino-alpine-blink{0%,100%{opacity:1}50%{opacity:0}}',
          '.verino-timer{display:flex;align-items:center;gap:var(--verino-timer-gap,8px);font-size:var(--verino-timer-font-size,14px);padding:var(--verino-timer-spacing,20px) 0 0}',
          '.verino-timer-label{color:var(--verino-timer-color,#484848);font-size:inherit}',
          '.verino-timer-badge{display:inline-flex;align-items:center;background:var(--verino-timer-badge-bg,rgba(255,56,70,.12));color:var(--verino-timer-badge-color,var(--verino-error-color,#FF3846));font-weight:var(--verino-timer-badge-font-weight,500);font-size:inherit;padding:var(--verino-pill-padding,2px 10px);border-radius:var(--verino-pill-radius,99px);height:var(--verino-timer-badge-height,24px)}',
          '.verino-resend{display:none;align-items:center;gap:var(--verino-resend-gap,8px);font-size:var(--verino-timer-font-size,14px);color:var(--verino-timer-color,#484848);padding:var(--verino-resend-spacing,20px) 0 0}',
          '.verino-resend.is-visible{display:flex}',
          '.verino-resend-btn{display:inline-flex;align-items:center;background:var(--verino-resend-bg,#F4F4F4);border:none;padding:var(--verino-pill-padding,2px 10px);border-radius:var(--verino-pill-radius,99px);color:var(--verino-resend-color,#0C0C0C);font-weight:var(--verino-resend-font-weight,500);font-size:inherit;transition:background var(--verino-motion-duration,150ms) ease;cursor:pointer;height:var(--verino-resend-height,24px);font-family:inherit}',
          '.verino-resend-btn:hover{background:var(--verino-resend-hover-bg,#E6E6E6)}',
          '.verino-resend-btn:disabled{color:var(--verino-resend-disabled-color,#B2B2B2);cursor:not-allowed;background:var(--verino-resend-disabled-bg,#F4F4F4)}',
        ].join('')
        document.head.appendChild(s)
      }

      const hiddenInputEl = document.createElement('input')
      hiddenInputEl.type           = masked ? 'password' : 'text'
      hiddenInputEl.inputMode      = type === 'numeric' ? 'numeric' : 'text'
      hiddenInputEl.autocomplete   = 'one-time-code'
      hiddenInputEl.maxLength      = length
      hiddenInputEl.disabled       = isDisabled
      hiddenInputEl.setAttribute('aria-label',     messages.inputLabel(length, codeUnit))
      hiddenInputEl.setAttribute('spellcheck',     'false')
      hiddenInputEl.setAttribute('autocorrect',    'off')
      hiddenInputEl.setAttribute('autocapitalize', 'off')
      hiddenInputEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;border:none;outline:none;background:transparent;color:transparent;caret-color:transparent;z-index:1;cursor:text;font-size:1px'
      if (inputName) hiddenInputEl.name = inputName
      if (readOnlyOpt) hiddenInputEl.setAttribute('aria-readonly', 'true')
      wrapperEl.appendChild(hiddenInputEl)

      const seedValue = preservedState?.code || defaultValue
      if (seedValue) {
        let result: ReturnType<typeof seedProgrammaticValue>
        suppressComplete = true
        try {
          result = seedProgrammaticValue(
            otp,
            seedValue,
            { length, type, pattern },
            preservedState
              ? { preserveActiveSlot: preservedState.activeSlot }
              : 'slot-end',
          )
        } finally {
          suppressComplete = false
        }
        if (result.changed) syncInputValue(hiddenInputEl, result.value, result.nextSelection)
      }

      if (preservedState?.hasSuccess) {
        successState = true
        otp.setSuccess(true)
      } else if (preservedState?.hasError) {
        otp.setError(true)
      }

      let timerBadgeEl:       HTMLSpanElement   | null = null
      let resendActionBtn:    HTMLButtonElement | null = null
      let mainTimer:    ReturnType<typeof createTimer> | null = null
      let builtInTimer: ReturnType<typeof createResendTimer> | null = null
      let timerController: TimerController = createTimer({ totalSeconds: 0 })
      let builtInFooterEl:    HTMLDivElement    | null = null
      let builtInResendRowEl: HTMLDivElement    | null = null

      function syncSlotsToDOM(): void {
        const { slotValues, activeSlot, hasError, isComplete } = otp.state
        const focused = document.activeElement === hiddenInputEl

        slotEls.forEach((slotEl, i) => {
          const char     = slotValues[i] ?? ''
          const isActive = i === activeSlot && focused
          const isFilled = char.length === 1

          const existingTextNode = slotEl.childNodes[1]
          let textNode = existingTextNode instanceof Text ? existingTextNode : null
          if (!textNode) {
            textNode = document.createTextNode('')
            slotEl.appendChild(textNode)
          }
          textNode.nodeValue = masked && char ? maskChar : char || placeholder
          slotEl.style.fontSize = isFilled
            ? (masked ? 'var(--verino-masked-size,16px)' : 'var(--verino-font-size,24px)')
            : 'var(--verino-placeholder-size,16px)'
          slotEl.style.color = isFilled
            ? 'var(--verino-color,#0C0C0C)'
            : 'var(--verino-placeholder-color,#888888)'

          const activeColor  = 'var(--verino-active-color,#2A2A2A)'
          const errorColor   = 'var(--verino-error-color,#FF3846)'
          const successColor = 'var(--verino-success-color,#00C65B)'

          if (isDisabled) {
            slotEl.style.opacity       = 'var(--verino-disabled-opacity,.45)'
            slotEl.style.cursor        = 'not-allowed'
            slotEl.style.pointerEvents = 'none'
            slotEl.style.borderColor   = 'var(--verino-border-color,#DBDBDB)'
            slotEl.style.boxShadow     = 'none'
          } else if (hasError) {
            slotEl.style.opacity       = ''
            slotEl.style.cursor        = 'text'
            slotEl.style.pointerEvents = ''
            slotEl.style.borderColor   = errorColor
            slotEl.style.boxShadow     = 'var(--verino-error-ring,0 0 0 3px rgba(255,56,70,.12))'
          } else if (successState) {
            slotEl.style.opacity       = ''
            slotEl.style.cursor        = 'text'
            slotEl.style.pointerEvents = ''
            slotEl.style.borderColor   = successColor
            slotEl.style.boxShadow     = 'var(--verino-success-ring,0 0 0 3px rgba(0,198,91,.12))'
          } else if (isActive) {
            slotEl.style.opacity       = ''
            slotEl.style.cursor        = 'text'
            slotEl.style.pointerEvents = ''
            slotEl.style.borderColor   = activeColor
            slotEl.style.boxShadow     = 'var(--verino-active-ring,0 0 0 3px rgba(42,42,42,.12))'
            slotEl.style.background    = 'var(--verino-bg-filled,#FFFFFF)'
          } else {
            slotEl.style.opacity       = ''
            slotEl.style.cursor        = 'text'
            slotEl.style.pointerEvents = ''
            slotEl.style.borderColor   = 'var(--verino-border-color,#DBDBDB)'
            slotEl.style.boxShadow     = 'none'
            slotEl.style.background    = isFilled ? 'var(--verino-bg-filled,#FFFFFF)' : 'var(--verino-bg,#FAFAFA)'
          }

          slotEl.setAttribute('data-active',   boolAttr(i === activeSlot))
          slotEl.setAttribute('data-focus',    boolAttr(focused))
          slotEl.setAttribute('data-filled',   boolAttr(isFilled))
          slotEl.setAttribute('data-empty',    boolAttr(!isFilled))
          slotEl.setAttribute('data-masked',   boolAttr(masked))
          slotEl.setAttribute('data-invalid',  boolAttr(hasError))
          slotEl.setAttribute('data-success',  boolAttr(successState))
          slotEl.setAttribute('data-disabled', boolAttr(isDisabled))
          slotEl.setAttribute('data-complete', boolAttr(isComplete))
          slotEl.setAttribute('data-readonly', boolAttr(isReadOnly))

          caretEls[i].style.display = isActive && !isFilled && !isDisabled ? 'block' : 'none'
        })

        const newValue = otp.state.slotValues.join('')
        if (hiddenInputEl.value !== newValue) hiddenInputEl.value = newValue
        hiddenInputEl.setAttribute('aria-invalid', boolAttr(hasError))

        wrapperEl.toggleAttribute('data-complete', otp.state.isComplete)
        wrapperEl.toggleAttribute('data-invalid',  otp.state.hasError)
        wrapperEl.toggleAttribute('data-success',  successState)
        wrapperEl.toggleAttribute('data-disabled', isDisabled)
        wrapperEl.toggleAttribute('data-readonly', isReadOnly)
      }

      function clearField(): void {
        successState = false
        clearOTPInput(otp, hiddenInputEl, { focus: !isDisabled, disabled: isDisabled })
        syncSlotsToDOM()
      }

      if (timerSecs > 0) {
        const shouldUseBuiltInFooter = !onTickProp

        if (shouldUseBuiltInFooter) {
          builtInFooterEl = document.createElement('div')
          builtInFooterEl.className = 'verino-timer'
          builtInFooterEl.id = `${otp.getGroupId()}-timer`
          builtInFooterEl.setAttribute('role', 'timer')
          builtInFooterEl.setAttribute('aria-live', 'off')

          const expiresLabel = document.createElement('span')
          expiresLabel.className   = 'verino-timer-label'
          expiresLabel.textContent = messages.expiresIn

          timerBadgeEl = document.createElement('span')
          timerBadgeEl.className   = 'verino-timer-badge'
          timerBadgeEl.textContent = formatCountdown(timerSecs)
          builtInFooterEl.setAttribute('aria-label', `${messages.expiresIn} ${formatCountdown(timerSecs)}`)

          builtInFooterEl.appendChild(expiresLabel)
          builtInFooterEl.appendChild(timerBadgeEl)
          wrapperEl.insertAdjacentElement('afterend', builtInFooterEl)

          builtInResendRowEl = document.createElement('div')
          builtInResendRowEl.className = 'verino-resend'
          builtInResendRowEl.id = `${otp.getGroupId()}-resend`
          builtInResendRowEl.setAttribute('role', 'status')
          builtInResendRowEl.setAttribute('aria-live', 'polite')
          builtInResendRowEl.setAttribute('aria-atomic', 'true')

          const didntReceiveLabel = document.createElement('span')
          didntReceiveLabel.textContent = messages.resendPrompt

          resendActionBtn = document.createElement('button')
          resendActionBtn.className   = 'verino-resend-btn'
          resendActionBtn.textContent = messages.resendAction
          resendActionBtn.type        = 'button'
          resendActionBtn.setAttribute('aria-label', messages.resendButtonLabel)

          builtInResendRowEl.appendChild(didntReceiveLabel)
          builtInResendRowEl.appendChild(resendActionBtn)
          builtInFooterEl.insertAdjacentElement('afterend', builtInResendRowEl)
          hiddenInputEl.setAttribute('aria-describedby', builtInFooterEl.id)
        }

        if (shouldUseBuiltInFooter && resendActionBtn) {
          builtInTimer = createResendTimer({
            timerSeconds: timerSecs,
            resendCooldown,
            clearField,
            showTimer: (remaining) => {
              if (builtInResendRowEl) builtInResendRowEl.classList.remove('is-visible')
              if (builtInFooterEl) builtInFooterEl.style.display = 'flex'
              if (timerBadgeEl) timerBadgeEl.textContent = formatCountdown(remaining)
              if (builtInFooterEl) {
                builtInFooterEl.setAttribute('aria-label', `${messages.expiresIn} ${formatCountdown(remaining)}`)
                hiddenInputEl.setAttribute('aria-describedby', builtInFooterEl.id)
              }
            },
            showResend: () => {
              if (builtInFooterEl) builtInFooterEl.style.display = 'none'
              if (builtInResendRowEl) builtInResendRowEl.classList.add('is-visible')
              if (builtInResendRowEl) hiddenInputEl.setAttribute('aria-describedby', builtInResendRowEl.id)
            },
            onExpire: () => { callbackRefs.onExpire?.() },
            onResend: () => { callbackRefs.onResend?.() },
          })
          timerController = builtInTimer
          builtInTimer.start()
          resendActionBtn.addEventListener('click', () => {
            builtInTimer?.resend()
          })
        } else {
          mainTimer = createTimer({
            totalSeconds: timerSecs,
            emitInitialTickOnStart: true,
            emitInitialTickOnRestart: true,
            onTick: (remaining) => {
              callbackRefs.onTick?.(remaining)
            },
            onExpire: () => {
              callbackRefs.onExpire?.()
            },
          })
          timerController = mainTimer
          mainTimer.start()
        }
      }

      function onKeydown(e: KeyboardEvent): void {
        if (isDisabled) return
        const result = handleOTPKeyAction(otp, {
          key: e.key,
          position: hiddenInputEl.selectionStart ?? 0,
          length,
          readOnly: isReadOnly,
          shiftKey: e.shiftKey,
        })
        if (!result.handled) return

        e.preventDefault()
        syncSlotsToDOM()
        if (result.valueChanged) callbackRefs.onChange?.(otp.getCode())
        if (result.nextSelection !== null) {
          scheduleInputSelection(frameScheduler, hiddenInputEl, result.nextSelection)
        }
      }

      function onInput(): void {
        if (isDisabled || isReadOnly) return
        const raw = hiddenInputEl.value
        if (!raw) {
          clearOTPInput(otp, hiddenInputEl, { focus: false })
          syncSlotsToDOM()
          callbackRefs.onChange?.('')
          return
        }
        const result = applyTypedInput(otp, raw, { length, type, pattern })
        syncInputValue(hiddenInputEl, result.value, result.nextSelection)
        syncSlotsToDOM()
        callbackRefs.onChange?.(otp.getCode())
        scheduleInputBlur(frameScheduler, hiddenInputEl, blurOnComplete && result.isComplete)
      }

      function onPaste(e: ClipboardEvent): void {
        if (isDisabled || isReadOnly) return
        e.preventDefault()
        const text = e.clipboardData?.getData('text') ?? ''
        const result = applyPastedInput(otp, text, hiddenInputEl.selectionStart ?? 0)
        syncInputValue(hiddenInputEl, result.value, result.nextSelection)
        syncSlotsToDOM()
        callbackRefs.onChange?.(otp.getCode())
        scheduleInputBlur(frameScheduler, hiddenInputEl, blurOnComplete && result.isComplete)
      }

      function onFocus(): void {
        callbackRefs.onFocus?.()
        scheduleFocusSync(frameScheduler, otp, hiddenInputEl, selectOnFocus, syncSlotsToDOM)
      }

      function onBlur(): void {
        callbackRefs.onBlur?.()
        syncSlotsToDOM()
      }

      function onClickHandler(e: MouseEvent): void {
        if (isDisabled) return
        let rawSlot = slotEls.length - 1
        for (let i = 0; i < slotEls.length; i++) {
          if (e.clientX <= slotEls[i].getBoundingClientRect().right) { rawSlot = i; break }
        }
        const clickedSlot = Math.min(rawSlot, hiddenInputEl.value.length)
        otp.move(clickedSlot)
        const char = otp.state.slotValues[clickedSlot]
        if (selectOnFocus && char) {
          hiddenInputEl.setSelectionRange(clickedSlot, clickedSlot + 1)
        } else {
          hiddenInputEl.setSelectionRange(clickedSlot, clickedSlot)
        }
        syncSlotsToDOM()
      }

      hiddenInputEl.addEventListener('keydown', onKeydown)
      hiddenInputEl.addEventListener('input',   onInput)
      hiddenInputEl.addEventListener('paste',   onPaste)
      hiddenInputEl.addEventListener('focus',   onFocus)
      hiddenInputEl.addEventListener('blur',    onBlur)
      hiddenInputEl.addEventListener('click',   onClickHandler)

      frameScheduler.schedule(() => {
        if (!isDisabled && autoFocus) hiddenInputEl.focus()
        const next = otp.state.activeSlot
        hiddenInputEl.setSelectionRange(next, next)
        syncSlotsToDOM()
      })

      function teardown(): void {
        destroyed = true
        frameScheduler.cancelAll()
        hiddenInputEl.removeEventListener('keydown', onKeydown)
        hiddenInputEl.removeEventListener('input',   onInput)
        hiddenInputEl.removeEventListener('paste',   onPaste)
        hiddenInputEl.removeEventListener('focus',   onFocus)
        hiddenInputEl.removeEventListener('blur',    onBlur)
        hiddenInputEl.removeEventListener('click',   onClickHandler)
        timerController.stop()
        builtInFooterEl?.remove()
        builtInResendRowEl?.remove()
        unsubFeedback()
        otp.destroy()
        delete (alpineWrapper as Partial<AlpineVerinoElement>)._verino
      }

      function doReset(): void {
        clearField()
        if (builtInTimer) builtInTimer.restartMain()
        else mainTimer?.restart()
      }

      const alpineWrapper = wrapperEl as AlpineVerinoElement
      alpineWrapper._verino = {
        getCode:  () => otp.getCode(),
        getSlots: (): readonly SlotEntry[] => otp.getSlots(),
        getInputProps: (slotIndex: number): InputProps & FocusDataAttrs => {
          const s        = otp.state
          const char     = s.slotValues[slotIndex] ?? ''
          const isFilled = char.length === 1
          return {
            value:     char,
            onInput:   (c) => { otp.insert(c, slotIndex); syncSlotsToDOM() },
            onKeyDown: (key) => {
              const result = handleOTPKeyAction(otp, {
                key,
                position: slotIndex,
                length,
                readOnly: isReadOnly,
              })
              if (result.handled) syncSlotsToDOM()
            },
            onFocus: () => callbackRefs.onFocus?.(),
            onBlur:  () => callbackRefs.onBlur?.(),
            'data-slot':     slotIndex,
            'data-active':   boolAttr(s.activeSlot === slotIndex),
            'data-focus':    boolAttr(document.activeElement === hiddenInputEl),
            'data-filled':   boolAttr(isFilled),
            'data-empty':    boolAttr(!isFilled),
            'data-complete': boolAttr(s.isComplete),
            'data-invalid':  boolAttr(s.hasError),
            'data-success':  boolAttr(successState),
            'data-disabled': boolAttr(isDisabled),
            'data-readonly': boolAttr(isReadOnly),
            'data-first':    boolAttr(slotIndex === 0),
            'data-last':     boolAttr(slotIndex === length - 1),
          }
        },
        destroy: () => teardown(),
        reset: () => doReset(),
        resend: () => { doReset(); callbackRefs.onResend?.() },
        setError: (isError: boolean) => {
          if (isError) successState = false
          otp.setError(isError)
          syncSlotsToDOM()
        },
        setSuccess: (isSuccess: boolean) => {
          successState = isSuccess
          otp.setSuccess(isSuccess)
          if (isSuccess) {
            timerController.stop()
            if (builtInFooterEl)    builtInFooterEl.style.display = 'none'
            if (builtInResendRowEl) builtInResendRowEl.style.display = 'none'
            wrapperEl.dispatchEvent(new CustomEvent('verino:success', { bubbles: true }))
          }
          syncSlotsToDOM()
        },
        setDisabled: (value: boolean) => { setDisabledState(value) },
        setReadOnly: (value: boolean) => { setReadOnlyState(value) },
        timer: timerController,
        focus: (slotIndex: number) => {
          if (isDisabled) return
          focusOTPInput(otp, hiddenInputEl, slotIndex)
          syncSlotsToDOM()
        },
      }

      return {
        cleanup() {
          teardown()
        },
        update(nextOptions) {
          applyCallbackRefs(callbackRefs, nextOptions)

          const nextDisabled = nextOptions.disabled ?? false
          if (nextDisabled !== isDisabled) setDisabledState(nextDisabled)

          const nextReadOnly = nextOptions.readOnly ?? false
          if (nextReadOnly !== isReadOnly) setReadOnlyState(nextReadOnly)

          const nextHaptic = nextOptions.haptic ?? true
          const nextSound  = nextOptions.sound ?? false
          if (nextHaptic !== liveHaptic || nextSound !== liveSound) {
            refreshFeedbackSubscription(nextHaptic, nextSound)
          }
        },
      }
    }

    let currentMount: MountedDirective | null = null
    let currentOptions: AlpineOTPOptions | null = null

    function remountFromValue(evaluated: unknown): void {
      const nextOptions = normalizeEvaluatedOptions(evaluated)
      if (currentMount && alpineOptionsEqual(currentOptions, nextOptions)) {
        currentMount.update(nextOptions)
        currentOptions = nextOptions
        return
      }

      const preservedState = currentMount ? capturePreservedState(wrapperEl) : null
      currentMount?.cleanup()
      currentMount = mountDirective(nextOptions, preservedState)
      currentOptions = nextOptions
    }

    if (expression) {
      const getReactiveValue = evaluateLater(expression)
      effect(() => {
        getReactiveValue((evaluated) => {
          try {
            remountFromValue(evaluated)
          } catch (err) {
            console.error('[verino] failed to evaluate expression:', err)
            remountFromValue({})
          }
        })
      })
    } else {
      remountFromValue({})
    }

    const dispose = (): void => {
      currentMount?.cleanup()
      currentMount = null
      currentOptions = null
    }

    cleanup(dispose)
    return { cleanup: dispose }
  })
}
