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
  type OTPOptions,
  type InputType,
  type SlotEntry,
  type InputProps,
} from 'verino'

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

/**
 * Extended options for the Alpine x-verino directive.
 * Adds separator and disabled support on top of OTPOptions.
 */
type AlpineOTPOptions = OTPOptions & {
  /**
   * Insert a purely visual separator after this slot index (0-based).
   * Accepts a single position or an array for multiple separators.
   * Default: 0 (no separator).
   */
  separatorAfter?: number | number[]
  separator?:      string
  onChange?:       (code: string) => void
  onTick?:         (remaining: number) => void
  /**
   * Cooldown seconds before the built-in Resend button re-enables after being clicked.
   * Default: 30.
   */
  resendAfter?:    number
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
 * The directive accepts the same options as `OTPOptions` plus `separatorAfter`,
 * `separator`, `masked`, and `maskChar`. Options are evaluated via Alpine's
 * `evaluate()` so reactive expressions and Alpine `$data` references work.
 *
 * @param Alpine - The Alpine.js global passed automatically by `Alpine.plugin()`.
 */
export const VerinoAlpine = (Alpine: AlpinePlugin): void => {
  Alpine.directive('verino', (wrapperEl, { expression }, { evaluate }): { cleanup(): void } => {
    let options: AlpineOTPOptions
    try {
      options = (expression ? evaluate(expression) : {}) as AlpineOTPOptions
      if (!options || typeof options !== 'object') {
        console.error('[verino] expression did not return a plain object. Got:', options)
        options = {} as AlpineOTPOptions
      }
    } catch (err) {
      console.error('[verino] failed to evaluate expression:', err)
      options = {} as AlpineOTPOptions
    }

    const {
      length             = 6,
      type               = 'numeric' as InputType,
      timer:             timerSecs = 0,
      disabled:          initialDisabled = false,
      onComplete,
      onExpire,
      onResend,
      onTick:            onTickProp,
      haptic             = true,
      sound              = false,
      pattern,
      pasteTransformer,
      onInvalidChar,
      onChange:          onChangeProp,
      onFocus:           onFocusProp,
      onBlur:            onBlurProp,
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

    // Normalise separatorAfter to an array for consistent rendering
    const separatorAfterPositions: number[] = Array.isArray(rawSepAfter) ? rawSepAfter : [rawSepAfter]

    let suppressComplete = false
    const otp = createOTP({
      length, type, pattern, pasteTransformer, onInvalidChar,
      onComplete: onComplete ? (code) => { if (!suppressComplete) onComplete(code) } : undefined,
      onExpire, onResend, readOnly: readOnlyOpt,
    })

    // Feedback via events — mirrors vanilla adapter pattern.
    otp.subscribe((_state, event) => {
      if (event.type === 'COMPLETE') {
        if (haptic) triggerHapticFeedback()
        if (sound)  triggerSoundFeedback()
      } else if (event.type === 'ERROR' && event.hasError) {
        if (haptic) triggerHapticFeedback()
      }
    })

    let isDisabled   = initialDisabled
    let isReadOnly   = readOnlyOpt
    let successState = false

    // ── Build DOM ─────────────────────────────────────────────────────────────
    while (wrapperEl.firstChild) wrapperEl.removeChild(wrapperEl.firstChild)
    wrapperEl.style.cssText = 'position:relative;display:inline-flex;gap:var(--verino-gap,12px);align-items:center;flex-wrap:wrap'

    const slotEls:  HTMLDivElement[] = []
    const caretEls: HTMLDivElement[] = []

    for (let i = 0; i < length; i++) {
      const slotEl = document.createElement('div')
      slotEl.style.cssText = [
        `width:var(--verino-size,56px)`,
        `height:var(--verino-size,56px)`,
        `border:1px solid var(--verino-border-color,#E5E5E5)`,
        `border-radius:var(--verino-radius,10px)`,
        `font-size:var(--verino-font-size,24px)`,
        `font-weight:var(--verino-font-weight,600)`,
        `display:flex`,
        `align-items:center`,
        `justify-content:center`,
        `background:var(--verino-bg,#FAFAFA)`,
        `color:var(--verino-color,#0A0A0A)`,
        `position:relative`,
        `cursor:text`,
        `transition:border-color 150ms ease,box-shadow 150ms ease`,
        `font-family:inherit`,
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
      caretEl.style.cssText = 'position:absolute;width:2px;height:52%;background:var(--verino-caret-color,#3D3D3D);border-radius:1px;animation:verino-alpine-blink 1s step-start infinite;pointer-events:none;display:none'
      slotEl.appendChild(caretEl)
      caretEls.push(caretEl)

      slotEls.push(slotEl)
      wrapperEl.appendChild(slotEl)

      // Separator — purely decorative, aria-hidden, no effect on value
      if (separatorAfterPositions.some(pos => pos > 0 && i === pos - 1)) {
        const sepEl = document.createElement('div')
        sepEl.setAttribute('aria-hidden', 'true')
        sepEl.style.cssText = [
          `display:flex`,
          `align-items:center`,
          `justify-content:center`,
          `color:var(--verino-separator-color,#A1A1A1)`,
          `font-size:var(--verino-separator-size,18px)`,
          `font-weight:400`,
          `user-select:none`,
          `flex-shrink:0`,
        ].join(';')
        sepEl.textContent = separator
        wrapperEl.appendChild(sepEl)
      }
    }

    // Inject styles once — caret keyframes + timer/resend classes matching vanilla
    if (!document.getElementById('verino-alpine-styles')) {
      const s = document.createElement('style')
      s.id = 'verino-alpine-styles'
      s.textContent = [
        '@keyframes verino-alpine-blink{0%,100%{opacity:1}50%{opacity:0}}',
        '.verino-timer{display:flex;align-items:center;gap:8px;font-size:14px;padding:20px 0 0}',
        '.verino-timer-label{color:var(--verino-timer-color,#5C5C5C);font-size:14px}',
        '.verino-timer-badge{display:inline-flex;align-items:center;background:color-mix(in srgb,var(--verino-error-color,#FB2C36) 10%,transparent);color:var(--verino-error-color,#FB2C36);font-weight:500;font-size:14px;padding:2px 10px;border-radius:99px;height:24px}',
        '.verino-resend{display:none;align-items:center;gap:8px;font-size:14px;color:var(--verino-timer-color,#5C5C5C);padding:20px 0 0}',
        '.verino-resend.is-visible{display:flex}',
        '.verino-resend-btn{display:inline-flex;align-items:center;background:#E8E8E8;border:none;padding:2px 10px;border-radius:99px;color:#0A0A0A;font-weight:500;font-size:14px;transition:background 150ms ease;cursor:pointer;height:24px}',
        '.verino-resend-btn:hover{background:#E5E5E5}',
        '.verino-resend-btn:disabled{color:#A1A1A1;cursor:not-allowed;background:#F5F5F5}',
      ].join('')
      document.head.appendChild(s)
    }

    // Hidden real input
    const hiddenInputEl = document.createElement('input')
    hiddenInputEl.type           = masked ? 'password' : 'text'
    hiddenInputEl.inputMode      = type === 'numeric' ? 'numeric' : 'text'
    hiddenInputEl.autocomplete   = 'one-time-code'
    hiddenInputEl.maxLength      = length
    hiddenInputEl.disabled       = isDisabled
    hiddenInputEl.setAttribute('aria-label',     `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`)
    hiddenInputEl.setAttribute('spellcheck',     'false')
    hiddenInputEl.setAttribute('autocorrect',    'off')
    hiddenInputEl.setAttribute('autocapitalize', 'off')
    hiddenInputEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;border:none;outline:none;background:transparent;color:transparent;caret-color:transparent;z-index:1;cursor:text;font-size:1px'
    if (inputName) hiddenInputEl.name = inputName
    if (readOnlyOpt) hiddenInputEl.setAttribute('aria-readonly', 'true')
    wrapperEl.appendChild(hiddenInputEl)

    // Apply defaultValue once on mount — no onComplete, no onChange
    if (defaultValue) {
      const filtered = filterString(defaultValue.slice(0, length), type, pattern)
      if (filtered) {
        suppressComplete = true
        try {
          for (let i = 0; i < filtered.length; i++) otp.insert(filtered[i], i)
        } finally {
          suppressComplete = false
        }
        hiddenInputEl.value = filtered
      }
    }

    // ── Built-in timer + resend (mirrors vanilla adapter) ──────────────────────
    let timerBadgeEl:       HTMLSpanElement   | null = null
    let resendActionBtn:    HTMLButtonElement | null = null
    let mainCountdown:      ReturnType<typeof createTimer> | null = null
    let resendCountdown:    ReturnType<typeof createTimer> | null = null
    let builtInFooterEl:    HTMLDivElement    | null = null
    let builtInResendRowEl: HTMLDivElement    | null = null

    if (timerSecs > 0) {
      const shouldUseBuiltInFooter = !onTickProp

      if (shouldUseBuiltInFooter) {
        builtInFooterEl = document.createElement('div')
        builtInFooterEl.className = 'verino-timer'

        const expiresLabel = document.createElement('span')
        expiresLabel.className   = 'verino-timer-label'
        expiresLabel.textContent = 'Code expires in'

        timerBadgeEl = document.createElement('span')
        timerBadgeEl.className   = 'verino-timer-badge'
        timerBadgeEl.textContent = formatCountdown(timerSecs)

        builtInFooterEl.appendChild(expiresLabel)
        builtInFooterEl.appendChild(timerBadgeEl)
        wrapperEl.insertAdjacentElement('afterend', builtInFooterEl)

        builtInResendRowEl = document.createElement('div')
        builtInResendRowEl.className = 'verino-resend'

        const didntReceiveLabel = document.createElement('span')
        didntReceiveLabel.textContent = 'Didn\u2019t receive the code?'

        resendActionBtn = document.createElement('button')
        resendActionBtn.className   = 'verino-resend-btn'
        resendActionBtn.textContent = 'Resend'
        resendActionBtn.type        = 'button'

        builtInResendRowEl.appendChild(didntReceiveLabel)
        builtInResendRowEl.appendChild(resendActionBtn)
        builtInFooterEl.insertAdjacentElement('afterend', builtInResendRowEl)
      }

      mainCountdown = createTimer({
        totalSeconds: timerSecs,
        onTick: (remaining) => {
          if (timerBadgeEl) timerBadgeEl.textContent = formatCountdown(remaining)
          onTickProp?.(remaining)
        },
        onExpire: () => {
          if (builtInFooterEl)    builtInFooterEl.style.display = 'none'
          if (builtInResendRowEl) builtInResendRowEl.classList.add('is-visible')
          onExpire?.()
        },
      })
      mainCountdown.start()

      if (shouldUseBuiltInFooter && resendActionBtn) {
        resendActionBtn.addEventListener('click', () => {
          if (!resendActionBtn || !timerBadgeEl || !builtInFooterEl || !builtInResendRowEl) return
          builtInResendRowEl.classList.remove('is-visible')
          builtInFooterEl.style.display = 'flex'
          timerBadgeEl.textContent = formatCountdown(resendCooldown)
          resendCountdown?.stop()
          resendCountdown = createTimer({
            totalSeconds: resendCooldown,
            onTick:   (r) => { if (timerBadgeEl) timerBadgeEl.textContent = formatCountdown(r) },
            onExpire: () => {
              if (builtInFooterEl)    builtInFooterEl.style.display = 'none'
              if (builtInResendRowEl) builtInResendRowEl.classList.add('is-visible')
            },
          })
          resendCountdown.start()
          onResend?.()
        })
      }
    }

    // ── DOM sync ───────────────────────────────────────────────────────────────
    /**
     * Reconcile every visual slot div with the current core state.
     * Called after every user action (input, keydown, paste, focus, click).
     *
     * The Alpine adapter uses inline styles exclusively — no shared stylesheet
     * is injected, so each mounted element is fully self-contained. State
     * priority order for slot appearance: disabled > error > complete > active > default.
     *
     * Font size and color are also set inline here to support placeholder
     * character styling (`--verino-placeholder-size` / `--verino-placeholder-color`),
     * since CSS `:not(.is-filled)` selectors are unavailable without a stylesheet.
     */
    function syncSlotsToDOM(): void {
      const { slotValues, activeSlot, hasError, isComplete } = otp.state
      const focused = document.activeElement === hiddenInputEl
      const b = (v: boolean): 'true' | 'false' => v ? 'true' : 'false'

      slotEls.forEach((slotEl, i) => {
        const char     = slotValues[i] ?? ''
        const isActive = i === activeSlot && focused
        const isFilled = char.length === 1

        let textNode = slotEl.childNodes[1] as Text | undefined
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
          textNode = document.createTextNode('')
          slotEl.appendChild(textNode)
        }
        textNode.nodeValue    = masked && char ? maskChar : char || placeholder
        slotEl.style.fontSize = isFilled
          ? (masked ? 'var(--verino-masked-size,16px)' : 'var(--verino-font-size,24px)')
          : 'var(--verino-placeholder-size,16px)'
        slotEl.style.color    = isFilled
          ? 'var(--verino-color,#0A0A0A)'
          : 'var(--verino-placeholder-color,#D3D3D3)'

        const activeColor  = 'var(--verino-active-color,#3D3D3D)'
        const errorColor   = 'var(--verino-error-color,#FB2C36)'
        const successColor = 'var(--verino-success-color,#00C950)'

        if (isDisabled) {
          slotEl.style.opacity       = '0.45'
          slotEl.style.cursor        = 'not-allowed'
          slotEl.style.pointerEvents = 'none'
          slotEl.style.borderColor   = 'var(--verino-border-color,#E5E5E5)'
          slotEl.style.boxShadow     = 'none'
        } else if (hasError) {
          slotEl.style.opacity       = ''
          slotEl.style.cursor        = 'text'
          slotEl.style.pointerEvents = ''
          slotEl.style.borderColor   = errorColor
          slotEl.style.boxShadow     = `0 0 0 3px color-mix(in srgb,${errorColor} 12%,transparent)`
        } else if (successState) {
          slotEl.style.opacity       = ''
          slotEl.style.cursor        = 'text'
          slotEl.style.pointerEvents = ''
          slotEl.style.borderColor   = successColor
          slotEl.style.boxShadow     = `0 0 0 3px color-mix(in srgb,${successColor} 12%,transparent)`
        } else if (isActive) {
          slotEl.style.opacity       = ''
          slotEl.style.cursor        = 'text'
          slotEl.style.pointerEvents = ''
          slotEl.style.borderColor   = activeColor
          slotEl.style.boxShadow     = `0 0 0 3px color-mix(in srgb,${activeColor} 10%,transparent)`
          slotEl.style.background    = 'var(--verino-bg-filled,#FFFFFF)'
        } else {
          slotEl.style.opacity       = ''
          slotEl.style.cursor        = 'text'
          slotEl.style.pointerEvents = ''
          slotEl.style.borderColor   = 'var(--verino-border-color,#E5E5E5)'
          slotEl.style.boxShadow     = 'none'
          slotEl.style.background    = isFilled ? 'var(--verino-bg-filled,#FFFFFF)' : 'var(--verino-bg,#FAFAFA)'
        }

        slotEl.setAttribute('data-active',   b(i === activeSlot))
        slotEl.setAttribute('data-focus',    b(focused))
        slotEl.setAttribute('data-filled',   b(isFilled))
        slotEl.setAttribute('data-empty',    b(!isFilled))
        slotEl.setAttribute('data-masked',   b(masked))
        slotEl.setAttribute('data-invalid',  b(hasError))
        // hasError and successState are mutually exclusive: setError(true) clears successState,
        // and setSuccess(true) clears the error via otp.setError(false). No explicit guard needed.
        slotEl.setAttribute('data-success',  b(successState))
        slotEl.setAttribute('data-disabled', b(isDisabled))
        slotEl.setAttribute('data-complete', b(isComplete))
        slotEl.setAttribute('data-readonly', b(isReadOnly))

        caretEls[i].style.display = isActive && !isFilled && !isDisabled ? 'block' : 'none'
      })

      // Only update value when it actually differs — assigning the same string
      // resets selectionStart/End in some browsers, clobbering the cursor.
      const newValue = slotValues.join('')
      if (hiddenInputEl.value !== newValue) hiddenInputEl.value = newValue

      wrapperEl.toggleAttribute('data-complete', otp.state.isComplete)
      wrapperEl.toggleAttribute('data-invalid',  otp.state.hasError)
      wrapperEl.toggleAttribute('data-success',  successState)
      wrapperEl.toggleAttribute('data-disabled', isDisabled)
      wrapperEl.toggleAttribute('data-readonly', isReadOnly)
    }

    // ── Event handlers ─────────────────────────────────────────────────────────
    // Named functions are stored so teardown() can call removeEventListener.

    function onKeydown(e: KeyboardEvent): void {
      if (isDisabled) return
      const pos = hiddenInputEl.selectionStart ?? 0
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (isReadOnly) return
        otp.delete(pos)
        syncSlotsToDOM()
        onChangeProp?.(otp.getCode())
        const next = otp.state.activeSlot
        requestAnimationFrame(() => hiddenInputEl.setSelectionRange(next, next))
      } else if (e.key === 'Delete') {
        e.preventDefault()
        if (isReadOnly) return
        otp.clear(pos)
        syncSlotsToDOM()
        onChangeProp?.(otp.getCode())
        requestAnimationFrame(() => hiddenInputEl.setSelectionRange(pos, pos))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        otp.move(pos - 1)
        syncSlotsToDOM()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => hiddenInputEl.setSelectionRange(next, next))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        otp.move(pos + 1)
        syncSlotsToDOM()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => hiddenInputEl.setSelectionRange(next, next))
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
        syncSlotsToDOM()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => hiddenInputEl.setSelectionRange(next, next))
      }
    }

    function onInput(): void {
      if (isDisabled || isReadOnly) return
      const raw = hiddenInputEl.value
      if (!raw) {
        otp.reset()
        hiddenInputEl.value = ''
        hiddenInputEl.setSelectionRange(0, 0)
        syncSlotsToDOM()
        onChangeProp?.('')
        return
      }
      const valid = filterString(raw, type, pattern).slice(0, length)
      otp.reset()
      for (let i = 0; i < valid.length; i++) otp.insert(valid[i], i)
      const next = Math.min(valid.length, length - 1)
      hiddenInputEl.value = valid
      hiddenInputEl.setSelectionRange(next, next)
      otp.move(next)
      syncSlotsToDOM()
      onChangeProp?.(otp.getCode())
      if (blurOnComplete && otp.state.isComplete) {
        requestAnimationFrame(() => hiddenInputEl.blur())
      }
    }

    function onPaste(e: ClipboardEvent): void {
      if (isDisabled || isReadOnly) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      const pos  = hiddenInputEl.selectionStart ?? 0
      otp.paste(text, pos)
      const { slotValues, activeSlot } = otp.state
      hiddenInputEl.value = slotValues.join('')
      hiddenInputEl.setSelectionRange(activeSlot, activeSlot)
      syncSlotsToDOM()
      onChangeProp?.(otp.getCode())
      if (blurOnComplete && otp.state.isComplete) {
        requestAnimationFrame(() => hiddenInputEl.blur())
      }
    }

    function onFocus(): void {
      onFocusProp?.()
      requestAnimationFrame(() => {
        const pos  = otp.state.activeSlot
        const char = otp.state.slotValues[pos]
        if (selectOnFocus && char) {
          hiddenInputEl.setSelectionRange(pos, pos + 1)
        } else {
          hiddenInputEl.setSelectionRange(pos, pos)
        }
        syncSlotsToDOM()
      })
    }

    function onBlur(): void {
      onBlurProp?.()
      // Let syncSlotsToDOM compute correct state — after blur,
      // document.activeElement !== hiddenInputEl, so all slots get isActive=false.
      syncSlotsToDOM()
    }

    function onClickHandler(e: MouseEvent): void {
      if (isDisabled) return
      // click fires after the browser places cursor (always 0 due to font-size:1px).
      // Coordinate hit-test determines which slot was visually clicked, then
      // setSelectionRange overrides the browser's placement.
      let rawSlot = slotEls.length - 1
      for (let i = 0; i < slotEls.length; i++) {
        if (e.clientX <= slotEls[i].getBoundingClientRect().right) { rawSlot = i; break }
      }
      // Clamp to filled count so the visual active slot matches the actual cursor position.
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

    requestAnimationFrame(() => {
      if (!isDisabled && autoFocus) hiddenInputEl.focus()
      hiddenInputEl.setSelectionRange(0, 0)
      syncSlotsToDOM()
    })

    // ── Internal helpers (shared by public API methods below) ─────────────────

    /** Tears down running timers, removes event listeners, and removes built-in footer elements. */
    function teardown(): void {
      hiddenInputEl.removeEventListener('keydown', onKeydown)
      hiddenInputEl.removeEventListener('input',   onInput)
      hiddenInputEl.removeEventListener('paste',   onPaste)
      hiddenInputEl.removeEventListener('focus',   onFocus)
      hiddenInputEl.removeEventListener('blur',    onBlur)
      hiddenInputEl.removeEventListener('click',   onClickHandler)
      mainCountdown?.stop()
      resendCountdown?.stop()
      builtInFooterEl?.remove()
      builtInResendRowEl?.remove()
    }

    /** Resets slot state, restarts timers, and restores focus — shared by reset() and resend(). */
    function doReset(): void {
      successState = false
      otp.reset()
      hiddenInputEl.value = ''
      if (timerBadgeEl)       timerBadgeEl.textContent = formatCountdown(timerSecs)
      if (builtInFooterEl)    builtInFooterEl.style.display    = 'flex'
      if (builtInResendRowEl) builtInResendRowEl.classList.remove('is-visible')
      resendCountdown?.stop()
      mainCountdown?.restart()
      if (!isDisabled) hiddenInputEl.focus()
      hiddenInputEl.setSelectionRange(0, 0)
      syncSlotsToDOM()
    }

    // ── Public API on element ──────────────────────────────────────────────────
    // Exposed on `el._verino` for programmatic control from Alpine components or
    // external JavaScript. Mirrors the VerinoInstance interface from the vanilla adapter.
    ;(wrapperEl as HTMLElement & { _verino: unknown })._verino = {
      /** Returns the current joined code string (e.g. `"123456"`). */
      getCode:  () => otp.getCode(),

      /** Minimal snapshot of every slot — index, value, isActive, isFilled. */
      getSlots: (): SlotEntry[] => otp.getSlots(),

      /** Framework-agnostic handlers + data-* attributes for slot `index`. */
      getInputProps: (slotIndex: number): InputProps & { 'data-focus': 'true' | 'false' } => {
        const s        = otp.state
        const char     = s.slotValues[slotIndex] ?? ''
        const isFilled = char.length === 1
        const b        = (v: boolean): 'true' | 'false' => v ? 'true' : 'false'
        return {
          value:     char,
          onInput:   (c) => { otp.insert(c, slotIndex); syncSlotsToDOM() },
          onKeyDown: (key) => {
            if (key === 'Backspace')       { otp.delete(slotIndex); syncSlotsToDOM() }
            else if (key === 'Delete')     { otp.clear(slotIndex); syncSlotsToDOM() }
            else if (key === 'ArrowLeft')  { otp.move(slotIndex - 1); syncSlotsToDOM() }
            else if (key === 'ArrowRight') { otp.move(slotIndex + 1); syncSlotsToDOM() }
          },
          onFocus: () => onFocusProp?.(),
          onBlur:  () => onBlurProp?.(),
          'data-index':    slotIndex,
          'data-active':   b(s.activeSlot === slotIndex),
          'data-focus':    b(document.activeElement === hiddenInputEl),
          'data-filled':   b(isFilled),
          'data-empty':    b(!isFilled),
          'data-complete': b(s.isComplete),
          'data-invalid':  b(s.hasError),
          'data-success':  b(successState),
          'data-disabled': b(isDisabled),
          'data-readonly': b(isReadOnly),
          'data-first':    b(slotIndex === 0),
          'data-last':     b(slotIndex === length - 1),
        }
      },

      /** Stop timers and remove built-in footer elements. Call before removing the element. */
      destroy: () => teardown(),

      /** Clear all slots, re-focus, reset to idle state, and restart the built-in timer. */
      reset: () => doReset(),

      /** Reset and fire the `onResend` callback. */
      resend: () => { doReset(); onResend?.() },

      /** Apply or clear the error state on all visual slots. */
      setError: (isError: boolean) => {
        if (isError) successState = false
        otp.setError(isError)
        syncSlotsToDOM()
      },

      /** Apply or clear the success state. On success, stops the timer and hides the footer. */
      setSuccess: (isSuccess: boolean) => {
        successState = isSuccess
        otp.setSuccess(isSuccess)
        if (isSuccess) {
          mainCountdown?.stop()
          resendCountdown?.stop()
          if (builtInFooterEl)    builtInFooterEl.style.display = 'none'
          if (builtInResendRowEl) builtInResendRowEl.style.display = 'none'
          wrapperEl.dispatchEvent(new CustomEvent('verino:success', { bubbles: true }))
        }
        syncSlotsToDOM()
      },

      /**
       * Enable or disable the input at runtime.
       * When disabled, all keyboard input, paste events, and click-to-focus
       * are silently ignored. Re-enabling automatically restores focus.
       */
      setDisabled: (value: boolean) => {
        isDisabled = value
        otp.setDisabled(value)
        hiddenInputEl.disabled = value
        syncSlotsToDOM()
        if (!value) {
          requestAnimationFrame(() => {
            hiddenInputEl.focus()
            hiddenInputEl.setSelectionRange(otp.state.activeSlot, otp.state.activeSlot)
          })
        }
      },

      /**
       * Toggle readOnly at runtime. When `true`, all slot mutations are blocked
       * but focus, navigation, and copy remain fully functional.
       * Distinct from `disabled` — no opacity/cursor change, `aria-readonly` is set.
       */
      setReadOnly: (value: boolean) => {
        isReadOnly = value
        otp.setReadOnly(value)
        if (value) {
          hiddenInputEl.setAttribute('aria-readonly', 'true')
        } else {
          hiddenInputEl.removeAttribute('aria-readonly')
        }
        syncSlotsToDOM()
      },

      /**
       * Programmatically move focus to a specific slot index.
       * Focuses the hidden input and positions the cursor at `slotIndex`.
       */
      focus: (slotIndex: number) => {
        if (isDisabled) return
        otp.move(slotIndex)
        hiddenInputEl.focus()
        hiddenInputEl.setSelectionRange(slotIndex, slotIndex)
        syncSlotsToDOM()
      },
    }

    return {
      /** Alpine calls this when the component is destroyed. Stops timers and removes footer elements. */
      cleanup() {
        teardown()
        otp.reset()
      },
    }
  })
}
