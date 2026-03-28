/**
 * @verino/vue
 * ─────────────────────────────────────────────────────────────────────────────
 * Vue 3 adapter — useOTP composable (single hidden-input architecture)
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  isRef,
  type Ref,
} from 'vue'

import {
  createOTP,
  createTimer,
  filterString,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type OTPOptions,
  type InputType,
  type SlotEntry,
  type InputProps,
} from 'verino'


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended options for the Vue useOTP composable.
 * Adds controlled-input, separator, and disabled support on top of OTPOptions.
 */
export type VueOTPOptions = OTPOptions & {
  /**
   * Controlled value — pre-fills and drives the slot state from outside the composable.
   *
   * Reactive mode (recommended): pass a Ref<string>. The composable watches it
   * via Vue's reactivity system — changes propagate automatically, making it
   * fully equivalent to React's controlled-input pattern.
   * ```ts
   * const code = ref('')
   * const otp = useOTP({ value: code, length: 6 })
   * // Clearing from parent:
   * code.value = ''
   * ```
   *
   * Static mode: pass a plain string to pre-fill slots once on creation.
   * Subsequent changes to the string will NOT be reactive (composables run
   * once during setup()). Use reset() or the Ref pattern for runtime updates.
   */
  value?: string | Ref<string>
  /**
   * Fires exactly ONCE per user interaction with the current joined code string.
   * Receives partial values too — not just when the code is complete.
   */
  onChange?: (code: string) => void
  /**
   * Insert a purely visual separator after this slot index (0-based).
   * Accepts a single position or an array for multiple separators.
   * aria-hidden, never part of the value, no effect on the state machine.
   * Default: 0 (no separator).
   * @example separatorAfter: 3      ->  [*][*][*] — [*][*][*]
   * @example separatorAfter: [2, 4] ->  [*][*] — [*][*] — [*][*]
   */
  separatorAfter?: number | number[]
  /**
   * The character or string to render as the separator.
   * Default: '—'
   */
  separator?: string
  /**
   * When `true`, slot templates should display a mask glyph instead of the real
   * character. The hidden input switches to `type="password"` via `hiddenInputAttrs`.
   *
   * `getCode()` and `onComplete` always return real characters.
   * Use for PIN entry or any sensitive input flow.
   *
   * Default: `false`.
   */
  masked?: boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Returned as a reactive `Ref<string>` so templates can bind to it directly.
   *
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   * @example maskChar: '*'
   */
  maskChar?: string
}

export type UseOTPResult = {
  /** Current value of each slot. Empty string = unfilled. */
  slotValues:       Ref<string[]>
  /** Index of the currently active slot. */
  activeSlot:       Ref<number>
  /** Computed joined code string. */
  value:            Ref<string>
  /** True when every slot is filled. */
  isComplete:       Ref<boolean>
  /** True when error state is active. */
  hasError:         Ref<boolean>
  /** True when success state is active. Mutually exclusive with hasError. */
  hasSuccess:       Ref<boolean>
  /** True when the field is disabled. Mirrors the disabled option. */
  isDisabled:       Ref<boolean>
  /** Remaining timer seconds. */
  timerSeconds:     Ref<number>
  /** True while the hidden input has browser focus. */
  isFocused:        Ref<boolean>
  /** The separator slot index/indices for template rendering. */
  separatorAfter:   Ref<number | number[]>
  /** The separator character/string to render. */
  separator:        Ref<string>
  /**
   * Whether masked mode is enabled. When true, templates should display
   * `maskChar.value` instead of the real character. `getCode()` still returns real chars.
   */
  masked:           Ref<boolean>
  /**
   * The configured mask glyph. Use in templates instead of a hard-coded `●`:
   * `{{ masked.value && char ? maskChar.value : char }}`
   */
  maskChar:         Ref<string>
  /** The placeholder character for empty slots. Empty string when not set. */
  placeholder:      string
  /** Ref to bind to the hidden input element via :ref. */
  inputRef:         Ref<HTMLInputElement | null>
  /** Attribute object to spread onto the hidden input via v-bind. */
  hiddenInputAttrs: Ref<Record<string, unknown>>
  /** Spread onto the wrapper element to expose state as data attributes for CSS/Tailwind targeting. */
  wrapperAttrs:     Ref<Record<string, string | undefined>>
  /** Returns the current joined code string. */
  getCode:          () => string
  /**
   * Minimal array snapshot of every slot — reactive, reads from Vue refs.
   * Use in templates: `v-for="slot in otp.getSlots()"`.
   */
  getSlots:         () => SlotEntry[]
  /**
   * Framework-agnostic handlers + data-* attributes for slot `index`.
   * Reactive in Vue templates — reads from Vue refs, not core state.
   * Spread data-* onto visual slot divs for CSS-attribute-driven styling.
   *
   * Includes `data-focus: 'true' | 'false'` in addition to the core `InputProps`
   * fields — sourced from the reactive `isFocused` ref so templates re-render
   * correctly when the hidden input gains or loses browser focus.
   */
  getInputProps:    (index: number) => InputProps & { 'data-focus': 'true' | 'false' }
  /** Clear all slots, restart timer, return focus to input. */
  reset:            () => void
  /** Apply or clear the error state. Clears success. */
  setError:         (isError: boolean) => void
  /** Apply or clear the success state. Clears error. */
  setSuccess:       (isSuccess: boolean) => void
  /** Programmatically move focus to a slot index. */
  focus:            (slotIndex: number) => void
  /** Event handlers to bind on the hidden input. */
  onKeydown:        (e: KeyboardEvent) => void
  onChange:         (e: Event) => void
  onPaste:          (e: ClipboardEvent) => void
  onFocus:          () => void
  onBlur:           () => void
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vue 3 composable for OTP input — single hidden-input architecture.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useOTP } from '@verino/vue'
 * const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 * </script>
 *
 * <template>
 *   <div style="position:relative; display:inline-flex; gap:8px; align-items:center">
 *     <input
 *       :ref="(el) => otp.inputRef.value = el"
 *       v-bind="otp.hiddenInputAttrs.value"
 *       style="position:absolute;inset:0;opacity:0;z-index:1;cursor:text"
 *       @keydown="otp.onKeydown"
 *       @input="otp.onChange"
 *       @paste="otp.onPaste"
 *       @focus="otp.onFocus"
 *       @blur="otp.onBlur"
 *     />
 *     <template v-for="slot in otp.getSlots()" :key="slot.index">
 *       <span
 *         v-if="isSeparatorBefore(otp.separatorAfter.value, slot.index)"
 *         aria-hidden="true"
 *       >{{ otp.separator.value }}</span>
 *       <!-- Spread data-* from getInputProps onto the visual div for CSS-attribute styling -->
 *       <div class="slot" v-bind="slotDataAttrs(slot.index)">
 *         {{ otp.masked.value && slot.value ? otp.maskChar.value : slot.value || otp.placeholder }}
 *       </div>
 *     </template>
 *   </div>
 * </template>
 * ```
 */
export function useOTP(options: VueOTPOptions = {}): UseOTPResult {
  const {
    length             = 6,
    type               = 'numeric' as InputType,
    timer:             timerSecs = 0,
    disabled:          initialDisabled = false,
    onComplete,
    onExpire,
    onResend,
    haptic             = true,
    sound              = false,
    pattern,
    pasteTransformer,
    onInvalidChar,
    value:             controlledValue,
    defaultValue,
    readOnly:          readOnlyOpt = false,
    onChange:          onChangeProp,
    onFocus:           onFocusProp,
    onBlur:            onBlurProp,
    separatorAfter:    separatorAfterOpt = 0,
    separator:         separatorOpt = '—',
    masked:            maskedOpt = false,
    maskChar:          maskCharOpt = '\u25CF',
    autoFocus:         autoFocusOpt = true,
    name:              nameOpt,
    placeholder:       placeholderOpt = '',
    selectOnFocus:     selectOnFocusOpt = false,
    blurOnComplete:    blurOnCompleteOpt = false,
  } = options

  // ── Suppress flag — prevents programmatic fills from firing onComplete ──────
  // onComplete fires synchronously on the last insert(); wrap it so that
  // controlled-value sync and defaultValue application can bypass the callback.
  let suppressComplete = false

  // ── Core instance ──────────────────────────────────────────────────────────
  const otp = createOTP({
    length, type, pattern, pasteTransformer, onInvalidChar,
    onComplete: onComplete ? (code) => { if (!suppressComplete) onComplete(code) } : undefined,
    onExpire, onResend, readOnly: readOnlyOpt,
  })

  otp.subscribe((_state, event) => {
    if (event.type === 'COMPLETE') {
      if (haptic) triggerHapticFeedback()
      if (sound)  triggerSoundFeedback()
    } else if (event.type === 'ERROR' && event.hasError) {
      if (haptic) triggerHapticFeedback()
    }
  })

  // ── Reactive state ─────────────────────────────────────────────────────────
  const slotValues   = ref<string[]>(Array(length).fill(''))
  const activeSlot   = ref(0)
  const isComplete   = ref(false)
  const hasError     = ref(false)
  const hasSuccess   = ref(false)
  const isDisabled   = ref(initialDisabled)
  const timerSeconds = ref(timerSecs)
  const isFocused    = ref(false)
  const inputRef     = ref<HTMLInputElement | null>(null)
  const separatorAfter = ref<number | number[]>(separatorAfterOpt)
  const separator      = ref(separatorOpt)
  const masked         = ref(maskedOpt)
  const maskChar       = ref(maskCharOpt)

  const value = computed(() => slotValues.value.join(''))

  const hiddenInputAttrs = computed<Record<string, unknown>>(() => ({
    type:           masked.value ? 'password' : 'text',
    inputmode:      type === 'numeric' ? 'numeric' : 'text',
    autocomplete:   'one-time-code',
    maxlength:      length,
    disabled:       isDisabled.value,
    ...(nameOpt      ? { name: nameOpt }          : {}),
    ...(autoFocusOpt ? { autofocus: true }         : {}),
    'aria-label':   `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`,
    spellcheck:     'false',
    autocorrect:    'off',
    autocapitalize: 'off',
    ...(readOnlyOpt ? { 'aria-readonly': 'true' } : {}),
  }))

  const wrapperAttrs = computed<Record<string, string | undefined>>(() => ({
    ...(isComplete.value ? { 'data-complete': '' } : {}),
    ...(hasError.value   ? { 'data-invalid':  '' } : {}),
    ...(hasSuccess.value ? { 'data-success':  '' } : {}),
    ...(isDisabled.value ? { 'data-disabled': '' } : {}),
    ...(readOnlyOpt      ? { 'data-readonly': '' } : {}),
  }))

  // ── sync() ─────────────────────────────────────────────────────────────────
  /**
   * Copy core state into Vue refs so templates re-render.
   *
   * @param suppressOnChange - When `true`, `onChange` is NOT fired. Pass `true` for
   *   cursor-only moves (ArrowLeft/Right, Tab) and programmatic fills where the
   *   user has not typed a character.
   */
  function sync(suppressOnChange = false): void {
    const s          = otp.state
    slotValues.value = [...s.slotValues]
    activeSlot.value = s.activeSlot
    isComplete.value = s.isComplete
    hasError.value   = s.hasError
    hasSuccess.value = s.hasSuccess
    if (!suppressOnChange) {
      onChangeProp?.(s.slotValues.join(''))
    }
  }

  // ── Controlled value sync ──────────────────────────────────────────────────
  // When value is a Ref<string>, watch it reactively so parent changes
  // propagate automatically. When it's a plain string, the arrow-function
  // source returns a constant — watch fires once via { immediate: true }
  // and never again (documented static-pre-fill behaviour).
  if (controlledValue !== undefined) {
    const watchSource = isRef(controlledValue)
      ? controlledValue
      : () => controlledValue as string

    watch(
      watchSource,
      (incoming: string) => {
        const filtered = filterString(incoming.slice(0, length), type, pattern)
        const current  = otp.state.slotValues.join('')
        if (filtered === current) return

        suppressComplete = true
        try {
          otp.reset()
          for (let i = 0; i < filtered.length; i++) {
            otp.insert(filtered[i], i)
          }
        } finally {
          suppressComplete = false
        }
        sync(true)
        if (inputRef.value) {
          inputRef.value.value = filtered
          inputRef.value.setSelectionRange(filtered.length, filtered.length)
        }
        onChangeProp?.(filtered)
      },
      { immediate: true }
    )
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  let timerControls: ReturnType<typeof createTimer> | null = null

  onMounted(() => {
    if (controlledValue === undefined && defaultValue) {
      const filtered = filterString(defaultValue.slice(0, length), type, pattern)
      if (filtered) {
        suppressComplete = true
        try {
          for (let i = 0; i < filtered.length; i++) otp.insert(filtered[i], i)
        } finally {
          suppressComplete = false
        }
        sync(true)
        if (inputRef.value) { inputRef.value.value = filtered; inputRef.value.setSelectionRange(filtered.length, filtered.length) }
      }
    }
    if (autoFocusOpt && !initialDisabled && inputRef.value) {
      inputRef.value.focus()
      inputRef.value.setSelectionRange(0, 0)
    }
    if (!timerSecs) return
    timerControls = createTimer({
      totalSeconds: timerSecs,
      onTick:   (r) => { timerSeconds.value = r },
      onExpire: () => { timerSeconds.value = 0; onExpire?.() },
    })
    timerControls.start()
  })

  onUnmounted(() => timerControls?.stop())

  // ── Event handlers ─────────────────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent): void {
    if (isDisabled.value) return
    const pos = inputRef.value?.selectionStart ?? 0
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (readOnlyOpt) return
      otp.delete(pos)
      sync()
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
    } else if (e.key === 'Delete') {
      e.preventDefault()
      if (readOnlyOpt) return
      otp.clear(pos)
      sync()
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(pos, pos))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      otp.move(pos - 1)
      sync(true)   // cursor-only move — no value change, suppress onChange
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      otp.move(pos + 1)
      sync(true)   // cursor-only move — no value change, suppress onChange
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
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
      sync(true)   // cursor-only move — no value change, suppress onChange
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
    }
  }

  function onChange(e: Event): void {
    if (isDisabled.value || readOnlyOpt) return
    const raw = (e.target as HTMLInputElement).value
    if (!raw) {
      otp.reset()
      if (inputRef.value) { inputRef.value.value = ''; inputRef.value.setSelectionRange(0, 0) }
      sync()
      return
    }
    const valid = filterString(raw, type, pattern).slice(0, length)
    otp.reset()
    for (let i = 0; i < valid.length; i++) otp.insert(valid[i], i)
    const next = Math.min(valid.length, length - 1)
    if (inputRef.value) { inputRef.value.value = valid; inputRef.value.setSelectionRange(next, next) }
    otp.move(next)
    sync()
    if (blurOnCompleteOpt && otp.state.isComplete) {
      requestAnimationFrame(() => inputRef.value?.blur())
    }
  }

  function onPaste(e: ClipboardEvent): void {
    if (isDisabled.value || readOnlyOpt) return
    e.preventDefault()
    const text = e.clipboardData?.getData('text') ?? ''
    const pos  = inputRef.value?.selectionStart ?? 0
    otp.paste(text, pos)
    const { slotValues: sv, activeSlot: nextSlot } = otp.state
    if (inputRef.value) { inputRef.value.value = sv.join(''); inputRef.value.setSelectionRange(nextSlot, nextSlot) }
    sync()
    if (blurOnCompleteOpt && otp.state.isComplete) {
      requestAnimationFrame(() => inputRef.value?.blur())
    }
  }

  function onFocus(): void {
    isFocused.value = true
    onFocusProp?.()
    const pos = otp.state.activeSlot
    requestAnimationFrame(() => {
      const char = otp.state.slotValues[pos]
      if (selectOnFocusOpt && char) {
        inputRef.value?.setSelectionRange(pos, pos + 1)
      } else {
        inputRef.value?.setSelectionRange(pos, pos)
      }
    })
  }

  function onBlur(): void {
    isFocused.value = false
    onBlurProp?.()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset(): void {
    otp.reset()
    if (inputRef.value) { inputRef.value.value = ''; inputRef.value.focus(); inputRef.value.setSelectionRange(0, 0) }
    timerSeconds.value = timerSecs
    timerControls?.restart()
    sync()
  }

  function setError(isError: boolean): void {
    otp.setError(isError)
    sync(true)
  }

  function setSuccess(isSuccess: boolean): void {
    otp.setSuccess(isSuccess)
    sync(true)
  }

  function focus(slotIndex: number): void {
    otp.move(slotIndex)
    inputRef.value?.focus()
    requestAnimationFrame(() => inputRef.value?.setSelectionRange(slotIndex, slotIndex))
    sync(true)
  }

  function getCode(): string {
    return otp.getCode()
  }

  function getSlots(): SlotEntry[] {
    return slotValues.value.map((value, index) => ({
      index,
      value,
      isActive: activeSlot.value === index,
      isFilled: value.length === 1,
    }))
  }

  // getInputProps reads from Vue refs rather than delegating to otp.getInputProps().
  // This is intentional: data-* attributes must reflect reactive Vue state (e.g.
  // isFocused.value, isComplete.value) so that Vue's template change-detection
  // picks up updates correctly. Delegating to the core would read stale closure
  // state and bypass Vue's reactivity system.
  function getInputProps(slotIndex: number): InputProps & { 'data-focus': 'true' | 'false' } {
    const char     = slotValues.value[slotIndex] ?? ''
    const isFilled = char.length === 1
    const b        = (v: boolean): 'true' | 'false' => v ? 'true' : 'false'
    return {
      value:     char,
      onInput:   (c) => { otp.insert(c, slotIndex); sync() },
      onKeyDown: (key) => {
        if (key === 'Backspace')   { otp.delete(slotIndex); sync() }
        else if (key === 'Delete') { otp.clear(slotIndex); sync() }
        else if (key === 'ArrowLeft')  { otp.move(slotIndex - 1); sync() }
        else if (key === 'ArrowRight') { otp.move(slotIndex + 1); sync() }
      },
      onFocus: () => { activeSlot.value = slotIndex; isFocused.value = true; onFocusProp?.() },
      onBlur:  () => { isFocused.value = false; onBlurProp?.() },
      'data-index':    slotIndex,
      'data-active':   b(activeSlot.value === slotIndex),
      'data-focus':    b(isFocused.value),
      'data-filled':   b(isFilled),
      'data-empty':    b(!isFilled),
      'data-complete': b(isComplete.value),
      'data-invalid':  b(hasError.value),
      'data-success':  b(hasSuccess.value),
      'data-disabled': b(isDisabled.value),
      'data-readonly': b(readOnlyOpt),
      'data-first':    b(slotIndex === 0),
      'data-last':     b(slotIndex === length - 1),
    }
  }

  return {
    slotValues,
    activeSlot,
    value,
    isComplete,
    hasError,
    hasSuccess,
    isDisabled,
    timerSeconds,
    isFocused,
    separatorAfter,
    separator,
    masked,
    maskChar,
    placeholder:    placeholderOpt,
    inputRef,
    hiddenInputAttrs,
    wrapperAttrs,
    getCode,
    getSlots,
    getInputProps,
    reset,
    setError,
    setSuccess,
    focus,
    onKeydown,
    onChange,
    onPaste,
    onFocus,
    onBlur,
  }
}