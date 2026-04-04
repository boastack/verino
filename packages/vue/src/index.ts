/**
 * @verino/vue
 * ─────────────────────────────────────────────────────────────────────────────
 * Vue 3 adapter — useOTP composable (single hidden-input architecture)
 */

import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  isRef,
  type Ref,
  type WatchSource,
} from 'vue'

import {
  type CoreOTPOptions,
  type FeedbackOptions,
  type FieldBehaviorOptions,
  type FocusDataAttrs,
  type HiddenInputAttrs,
  type SlotEntry,
  type InputProps,
  type TimerUIOptions,
  type ResendUIOptions,
  type WrapperDataAttrs,
} from '@verino/core'
import { createOTP } from '@verino/core/machine'
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
  scheduleInputSelection,
  syncInputValue,
} from '@verino/core/toolkit/controller'
import { syncProgrammaticValue } from '@verino/core/toolkit/adapter-policy'
import { createTimer } from '@verino/core'
import { subscribeFeedback } from '@verino/core/toolkit/feedback'


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended options for the Vue useOTP composable.
 * Builds on the core machine options with Vue-specific controlled-input,
 * separator, and masked rendering behavior.
 */
type VueFieldBehaviorOptions = Pick<
  FieldBehaviorOptions,
  'autoFocus' | 'name' | 'onFocus' | 'onBlur' | 'placeholder' | 'selectOnFocus' | 'blurOnComplete' | 'defaultValue'
>

type VueHiddenInputAttrs = {
  type:             HiddenInputAttrs['type']
  inputmode:        HiddenInputAttrs['inputMode']
  autocomplete:     HiddenInputAttrs['autoComplete']
  maxlength:        HiddenInputAttrs['maxLength']
  disabled:         HiddenInputAttrs['disabled']
  name?:            HiddenInputAttrs['name']
  autofocus?:       true
  'aria-label':     HiddenInputAttrs['aria-label']
  spellcheck:       'false'
  autocorrect:      HiddenInputAttrs['autoCorrect']
  autocapitalize:   HiddenInputAttrs['autoCapitalize']
  'aria-readonly'?: HiddenInputAttrs['aria-readonly']
}

export type VueOTPOptions =
  & CoreOTPOptions
  & FeedbackOptions
  & VueFieldBehaviorOptions
  & Pick<TimerUIOptions, 'onExpire'>
  & Pick<ResendUIOptions, 'onResend'>
  & {
  /**
   * Live external control for the OTP value.
   *
   * In Vue, live external control is provided through a watch source such as a
   * `ref`, `computed`, or getter function. Use `defaultValue` for one-time
   * prefill on mount.
   *
   * Reactive mode:
   * ```ts
   * const code = ref('')
   * const otp = useOTP({ value: code, length: 6 })
   * // Clearing from parent:
   * code.value = ''
   * ```
   */
  value?: WatchSource<string>
  /**
   * Fires exactly ONCE per user interaction with the current joined code string.
   * Receives partial values too — not just when the code is complete.
   */
  onChange?: (code: string) => void
  /**
   * Insert a purely visual separator after the Nth slot (1-based).
   * Accepts a single position or an array for multiple separators.
   * aria-hidden, never part of the value, no effect on the state machine.
   * Default: 0 (no separator).
   * @example separatorAfter: 3      ->  [*][*][*] — [*][*][*]   (splits after 3rd)
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
  slotValues:       Ref<readonly string[]>
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
  hiddenInputAttrs: Ref<VueHiddenInputAttrs>
  /** Spread onto the wrapper element to expose state as data attributes for CSS/Tailwind targeting. */
  wrapperAttrs:     Ref<WrapperDataAttrs>
  /** Returns the current joined code string. */
  getCode:          () => string
  /**
   * Minimal array snapshot of every slot — reactive, reads from Vue refs.
   * Use in templates: `v-for="slot in otp.getSlots()"`.
   */
  getSlots:         () => readonly SlotEntry[]
  /**
   * Framework-agnostic handlers + data-* attributes for slot `index`.
   * Reactive in Vue templates — reads from Vue refs, not core state.
   * Spread data-* onto visual slot divs for CSS-attribute-driven styling.
   *
   * Includes `data-focus: 'true' | 'false'` in addition to the core `InputProps`
   * fields — sourced from the reactive `isFocused` ref so templates re-render
   * correctly when the hidden input gains or loses browser focus.
   */
  getInputProps:    (index: number) => InputProps & FocusDataAttrs
  /** Clear all slots, restart timer, return focus to input. */
  reset:            () => void
  /** Reset the field and fire `onResend`. */
  resend:           () => void
  /** Apply or clear the error state. Clears success. */
  setError:         (isError: boolean) => void
  /** Apply or clear the success state. Clears error. */
  setSuccess:       (isSuccess: boolean) => void
  /** Enable or disable the field at runtime. */
  setDisabled:      (isDisabled: boolean) => void
  /** Toggle read-only mode at runtime. */
  setReadOnly:      (isReadOnly: boolean) => void
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
    idBase,
    type               = 'numeric',
    timer:             timerSecs = 0,
    disabled:          initialDisabled = false,
    onComplete,
    onExpire,
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
    onResend,
  } = options

  // ── Suppress flag — prevents programmatic fills from firing onComplete ──────
  // onComplete fires synchronously on the last insert(); wrap it so that
  // controlled-value sync and defaultValue application can bypass the callback.
  let suppressComplete = false
  const invalidControlledValueMessage = '[verino/vue] `value` must be a Vue ref, computed, or getter for live external control. Use `defaultValue` for one-time prefill.'

  // ── Core instance ──────────────────────────────────────────────────────────
  const otp = createOTP({
    length, idBase, type, pattern, pasteTransformer, onInvalidChar,
    onComplete: onComplete ? (code) => { if (!suppressComplete) onComplete(code) } : undefined,
    disabled: initialDisabled,
    readOnly: readOnlyOpt,
  })

  const unsubFeedback = subscribeFeedback(otp, { haptic, sound })

  // ── Reactive state ─────────────────────────────────────────────────────────
  const slotValues   = ref<readonly string[]>(Array(length).fill(''))
  const activeSlot   = ref(0)
  const isComplete   = ref(false)
  const hasError     = ref(false)
  const hasSuccess   = ref(false)
  const isDisabled   = ref(initialDisabled)
  const isReadOnly   = ref(readOnlyOpt)
  const timerSeconds = ref(timerSecs)
  const isFocused    = ref(false)
  const inputRef     = ref<HTMLInputElement | null>(null)
  const frameScheduler = createFrameScheduler(() => !!inputRef.value?.isConnected)
  const separatorAfter = ref<number | number[]>(separatorAfterOpt)
  const separator      = ref(separatorOpt)
  const masked         = ref(maskedOpt)
  const maskChar       = ref(maskCharOpt)

  const value = computed(() => slotValues.value.join(''))

  const hiddenInputAttrs = computed<VueHiddenInputAttrs>(() => ({
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
    ...(isReadOnly.value ? { 'aria-readonly': 'true' } : {}),
  }))

  const wrapperAttrs = computed<WrapperDataAttrs>(() => ({
    ...(isComplete.value ? { 'data-complete': '' } : {}),
    ...(hasError.value   ? { 'data-invalid':  '' } : {}),
    ...(hasSuccess.value ? { 'data-success':  '' } : {}),
    ...(isDisabled.value ? { 'data-disabled': '' } : {}),
    ...(isReadOnly.value ? { 'data-readonly': '' } : {}),
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
  // `value` is live external control only when the caller passes a Vue watch
  // source. Invalid value shapes are rejected; one-off prefills should use
  // `defaultValue`.
  let stopControlledValueWatch: (() => void) | null = null
  if (controlledValue !== undefined) {
    const applyControlledValue = (incoming: string): void => {
        let result: ReturnType<typeof syncProgrammaticValue>
        suppressComplete = true
        try {
          result = syncProgrammaticValue(otp, incoming, { length, type, pattern }, 'input-end')
        } finally {
          suppressComplete = false
        }
        if (!result.changed) return
        sync(true)
        syncInputValue(inputRef.value, result.value, result.nextSelection)
    }

    if (isRef(controlledValue) || typeof controlledValue === 'function') {
      stopControlledValueWatch = watch(controlledValue, (incoming) => applyControlledValue(incoming), { immediate: true })
    } else {
      console.error(invalidControlledValueMessage)
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  const timerController = createTimer({
    totalSeconds: timerSecs,
    emitInitialTickOnStart: true,
    emitInitialTickOnRestart: true,
    onTick:   (remaining) => { timerSeconds.value = remaining },
    onExpire: () => { timerSeconds.value = 0; onExpire?.() },
  })

  onMounted(() => {
    if (controlledValue === undefined && defaultValue) {
      let result: ReturnType<typeof syncProgrammaticValue>
      suppressComplete = true
      try {
        result = syncProgrammaticValue(otp, defaultValue, { length, type, pattern }, 'input-end')
      } finally {
        suppressComplete = false
      }
      if (result.changed) {
        sync(true)
        syncInputValue(inputRef.value, result.value, result.nextSelection)
      }
    }
    syncInputValue(inputRef.value, otp.state.slotValues.join(''), otp.state.activeSlot)
    if (autoFocusOpt && !initialDisabled && inputRef.value) {
      inputRef.value.focus()
      inputRef.value.setSelectionRange(0, 0)
    }
    timerController.start()
  })

  onUnmounted(() => {
    frameScheduler.cancelAll()
    stopControlledValueWatch?.()
    stopControlledValueWatch = null
    timerController.stop()
    unsubFeedback()
    otp.destroy()
  })

  // ── Event handlers ─────────────────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent): void {
    if (isDisabled.value) return
    const result = handleOTPKeyAction(otp, {
      key: e.key,
      position: inputRef.value?.selectionStart ?? 0,
      length,
      readOnly: isReadOnly.value,
      shiftKey: e.shiftKey,
    })
    if (!result.handled) return

    e.preventDefault()
    sync(!result.valueChanged)
    if (result.nextSelection !== null) {
      scheduleInputSelection(frameScheduler, () => inputRef.value, result.nextSelection)
    }
  }

  function onChange(e: Event): void {
    if (isDisabled.value || isReadOnly.value) return
    if (!(e.target instanceof HTMLInputElement)) return
    const raw = e.target.value
    if (!raw) {
      clearOTPInput(otp, inputRef.value, { focus: false })
      sync()
      return
    }
    const result = applyTypedInput(otp, raw, { length, type, pattern })
    syncInputValue(inputRef.value, result.value, result.nextSelection)
    sync()
    scheduleInputBlur(frameScheduler, () => inputRef.value, blurOnCompleteOpt && result.isComplete)
  }

  function onPaste(e: ClipboardEvent): void {
    if (isDisabled.value || isReadOnly.value) return
    e.preventDefault()
    const text = e.clipboardData?.getData('text') ?? ''
    const result = applyPastedInput(otp, text, inputRef.value?.selectionStart ?? 0)
    syncInputValue(inputRef.value, result.value, result.nextSelection)
    sync()
    scheduleInputBlur(frameScheduler, () => inputRef.value, blurOnCompleteOpt && result.isComplete)
  }

  function onFocus(): void {
    isFocused.value = true
    onFocusProp?.()
    scheduleFocusSync(frameScheduler, otp, () => inputRef.value, selectOnFocusOpt)
  }

  function onBlur(): void {
    isFocused.value = false
    onBlurProp?.()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset(): void {
    clearOTPInput(otp, inputRef.value, { focus: true, disabled: isDisabled.value })
    timerController.restart()
    sync()
  }

  function resend(): void {
    clearOTPInput(otp, inputRef.value, { focus: true, disabled: isDisabled.value })
    timerController.restart()
    onResend?.()
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

  function setDisabled(disabled: boolean): void {
    otp.setDisabled(disabled)
    isDisabled.value = disabled
    sync(true)
  }

  function setReadOnly(readOnly: boolean): void {
    otp.setReadOnly(readOnly)
    isReadOnly.value = readOnly
    sync(true)
  }

  function focus(slotIndex: number): void {
    focusOTPInput(otp, inputRef.value, slotIndex)
    sync(true)
  }

  function getCode(): string {
    return otp.getCode()
  }

  function getSlots(): readonly SlotEntry[] {
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
  function getInputProps(slotIndex: number): InputProps & FocusDataAttrs {
    const char     = slotValues.value[slotIndex] ?? ''
    const isFilled = char.length === 1
    return {
      value:     char,
      onInput:   (c) => { otp.insert(c, slotIndex); sync() },
      onKeyDown: (key) => {
        const result = handleOTPKeyAction(otp, {
          key,
          position: slotIndex,
          length,
          readOnly: isReadOnly.value,
        })
        if (result.handled) sync(!result.valueChanged)
      },
      onFocus: () => { activeSlot.value = slotIndex; isFocused.value = true; onFocusProp?.() },
      onBlur:  () => { isFocused.value = false; onBlurProp?.() },
      'data-slot':     slotIndex,
      'data-active':   boolAttr(activeSlot.value === slotIndex),
      'data-focus':    boolAttr(isFocused.value),
      'data-filled':   boolAttr(isFilled),
      'data-empty':    boolAttr(!isFilled),
      'data-complete': boolAttr(isComplete.value),
      'data-invalid':  boolAttr(hasError.value),
      'data-success':  boolAttr(hasSuccess.value),
      'data-disabled': boolAttr(isDisabled.value),
      'data-readonly': boolAttr(isReadOnly.value),
      'data-first':    boolAttr(slotIndex === 0),
      'data-last':     boolAttr(slotIndex === length - 1),
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
    resend,
    setError,
    setSuccess,
    setDisabled,
    setReadOnly,
    focus,
    onKeydown,
    onChange,
    onPaste,
    onFocus,
    onBlur,
  }
}
