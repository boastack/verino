/**
 * @verino/svelte
 * ─────────────────────────────────────────────────────────────────────────────
 * Svelte adapter — useOTP store + action (single hidden-input architecture)
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store'

import {
  type CoreOTPOptions,
  type FeedbackOptions,
  type FieldBehaviorOptions,
  type FocusDataAttrs,
  type SlotEntry,
  type InputProps,
  type OTPStateSnapshot,
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
  scheduleInputFocus,
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
 * Extended options for the Svelte useOTP composable.
 * Builds on the core machine options with Svelte-specific controlled-input,
 * separator, and masked rendering behavior.
 */
type SvelteFieldBehaviorOptions = Pick<
  FieldBehaviorOptions,
  'autoFocus' | 'name' | 'onFocus' | 'onBlur' | 'placeholder' | 'selectOnFocus' | 'blurOnComplete' | 'defaultValue'
>

export type SvelteOTPOptions =
  & CoreOTPOptions
  & FeedbackOptions
  & SvelteFieldBehaviorOptions
  & Pick<TimerUIOptions, 'onExpire'>
  & Pick<ResendUIOptions, 'onResend'>
  & {
  /**
   * Live external control for the OTP value.
   * In Svelte, live external control is provided through a readable store.
   * Use `defaultValue` for one-time prefill on mount.
   */
  value?: Readable<string>
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
   * character. The hidden input switches to `type="password"` via the action.
   *
   * `getCode()` and `onComplete` always return real characters.
   * Use for PIN entry or any sensitive input flow.
   *
   * Default: `false`.
   */
  masked?: boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Returned as a `writable` store so Svelte templates can subscribe to it.
   *
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   * @example maskChar: '*'
   */
  maskChar?: string
}

export type UseOTPResult = {
  /** Subscribe to the full state store. */
  subscribe:      Writable<OTPStateSnapshot>['subscribe']
  /** Derived — joined code string. */
  value:          Readable<string>
  /** Derived — completion boolean. */
  isComplete:     Readable<boolean>
  /** Derived — error boolean. */
  hasError:       Readable<boolean>
  /** Derived — success boolean. Mutually exclusive with hasError. */
  hasSuccess:     Readable<boolean>
  /** Derived — active slot index. */
  activeSlot:     Readable<number>
  /** Remaining timer seconds store. */
  timerSeconds:   Writable<number>
  /** Whether the field is currently disabled. */
  isDisabled:     Writable<boolean>
  /** Whether the field is currently read-only. Blocks mutations, preserves navigation. */
  isReadOnly:     Writable<boolean>
  /** The separator slot index store. */
  separatorAfter: Writable<number | number[]>
  /** The separator character store. */
  separator:      Writable<string>
  /** Whether masked mode is active. When true, templates should render `maskChar` instead of char. */
  masked:         Writable<boolean>
  /**
   * The configured mask glyph store. Use in templates instead of a hard-coded `●`:
   * `{$otp.masked && char ? $otp.maskChar : char}`
   */
  maskChar:       Writable<string>
  /** The placeholder character for empty slots. Empty string when not set. */
  placeholder:    string
  /** Derived — spread onto the wrapper element as data attributes for CSS/Tailwind targeting. */
  wrapperAttrs:   Readable<WrapperDataAttrs>
  /**
   * Svelte action — bind to the single hidden input via `use:otp.action`.
   * Wires all keydown / input / paste / focus / blur listeners and starts
   * the timer (if configured). Returns `{ destroy }` per the Svelte action contract.
   */
  action:         (node: HTMLInputElement) => { destroy: () => void }
  /**
   * Reactive derived store — minimal snapshot of every slot.
   * Use in templates: `{#each $otp.slots as slot}`.
   */
  slots:          Readable<readonly SlotEntry[]>
  /** Returns the current joined code string. */
  getCode:        () => string
  /**
   * Minimal array snapshot of every slot — non-reactive snapshot.
   * Use for one-off reads outside a reactive context. Prefer `$otp.slots` in templates.
   */
  getSlots:       () => readonly SlotEntry[]
  /**
   * Framework-agnostic handlers + data-* attributes for slot `index`.
   * Spread data-* onto visual slot divs for CSS-attribute-driven styling.
   * Always returns current state — use inside `{#each $slots as slot}` for reactivity.
   *
   * Includes `data-focus: 'true' | 'false'` in addition to the core `InputProps`
   * fields — sourced from the closure-level `isFocused` variable that the action's
   * focus/blur handlers update on every focus change.
   */
  getInputProps:  (index: number) => InputProps & FocusDataAttrs
  /** Clear all slots, restart timer, return focus to input. */
  reset:          () => void
  /** Reset the field and fire `onResend`. */
  resend:         () => void
  /** Apply or clear the error state. Clears success. */
  setError:       (isError: boolean) => void
  /** Apply or clear the success state. Clears error. */
  setSuccess:     (isSuccess: boolean) => void
  /** Enable or disable the field at runtime. */
  setDisabled:    (value: boolean) => void
  /**
   * Toggle readOnly at runtime. When `true`, all slot mutations are blocked
   * but focus, navigation, and copy remain fully functional.
   */
  setReadOnly:    (value: boolean) => void
  /** Programmatically move focus to a slot index. */
  focus:          (slotIndex: number) => void
  /**
   * Programmatically set the field value without triggering `onComplete`.
   * Pass `undefined` to no-op. Filters the incoming string through the current
   * `type`/`pattern` before distribution, identical to controlled-value sync.
   */
  setValue:       (v: string | undefined) => void
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Svelte composable for OTP input — single hidden-input architecture.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useOTP } from '@verino/svelte'
 *   const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *   $: state = $otp
 * </script>
 *
 * <div style="position:relative; display:inline-flex; gap:8px; align-items:center">
 *   <input
 *     use:otp.action
 *     style="position:absolute;inset:0;opacity:0;z-index:1;cursor:text"
 *   />
 *   {#each state.slotValues as char, i}
 *     {#if $otp.separatorAfter > 0 && i === $otp.separatorAfter}
 *       <span aria-hidden="true">{$otp.separator}</span>
 *     {/if}
 *     <div class="slot"
 *       class:is-active={i === state.activeSlot}
 *       class:is-filled={!!char}
 *       class:is-error={state.hasError}
 *       class:is-disabled={$otp.isDisabled}
 *     >{char}</div>
 *   {/each}
 * </div>
 * ```
 */
export function useOTP(options: SvelteOTPOptions = {}): UseOTPResult {
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
  let suppressComplete = false
  const invalidControlledValueMessage = '[verino/svelte] `value` must be a Svelte readable store for live external control. Use `defaultValue` for one-time prefill.'

  // ── Focus tracking — updated by the action's focus/blur handlers ─────────
  let isFocused = false
  let inputEl: HTMLInputElement | null = null
  const frameScheduler = createFrameScheduler(() => !!inputEl?.isConnected)

  // ── Core instance ──────────────────────────────────────────────────────────
  const otp = createOTP({
    length, idBase, type, pattern, pasteTransformer, onInvalidChar,
    onComplete: onComplete ? (code) => { if (!suppressComplete) onComplete(code) } : undefined,
    disabled: initialDisabled,
    readOnly: readOnlyOpt,
  })

  const unsubFeedback = subscribeFeedback(otp, { haptic, sound })

  // ── Stores ─────────────────────────────────────────────────────────────────
  const store               = writable<OTPStateSnapshot>(otp.getSnapshot())
  const timerStore          = writable(timerSecs)
  const isDisabledStore     = writable(initialDisabled)
  const isReadOnlyStore     = writable(readOnlyOpt)
  const separatorAfterStore = writable(separatorAfterOpt)
  const separatorStore      = writable(separatorOpt)
  const maskedStore         = writable(maskedOpt)
  const maskCharStore       = writable(maskCharOpt)

  let isReadOnly: boolean                = readOnlyOpt

  // ── sync() ─────────────────────────────────────────────────────────────────
  /**
   * Push current core state into the Svelte store so all derived stores and
   * subscribed components re-render.
   *
   * @param suppressOnChange - When `true`, `onChange` is NOT fired. Pass `true` for
   *   cursor-only moves (ArrowLeft/Right, Tab) and programmatic fills where the
   *   user has not typed a character.
   */
  function sync(suppressOnChange = false): void {
    const s = otp.state
    store.set({ ...s, slotValues: [...s.slotValues] })
    if (!suppressOnChange) {
      onChangeProp?.(s.slotValues.join(''))
    }
  }

  // ── Controlled value sync ──────────────────────────────────────────────────
  function setValue(incoming: string | undefined): void {
    if (incoming === undefined) return
    let result: ReturnType<typeof syncProgrammaticValue>
    suppressComplete = true
    try {
      result = syncProgrammaticValue(otp, incoming, { length, type, pattern }, 'input-end')
    } finally {
      suppressComplete = false
    }
    if (!result.changed) return
    sync(true)
    syncInputValue(inputEl, result.value, result.nextSelection)
  }

  let unsubscribeControlledValue: (() => void) | null = null
  if (controlledValue !== undefined) {
    if (typeof controlledValue.subscribe === 'function') {
      unsubscribeControlledValue = controlledValue.subscribe((incoming) => {
        setValue(incoming)
      })
    } else {
      console.error(invalidControlledValueMessage)
    }
  } else if (defaultValue) {
    // Apply defaultValue once — no onComplete, no onChange
    let result: ReturnType<typeof syncProgrammaticValue>
    suppressComplete = true
    try {
      result = syncProgrammaticValue(otp, defaultValue, { length, type, pattern }, 'input-end')
    } finally {
      suppressComplete = false
    }
    if (result.changed) {
      sync(true)
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  const timerController = createTimer({
    totalSeconds: timerSecs,
    emitInitialTickOnStart: true,
    emitInitialTickOnRestart: true,
    onTick:   (remaining) => timerStore.set(remaining),
    onExpire: () => { timerStore.set(0); onExpire?.() },
  })

  // ── Svelte Action ──────────────────────────────────────────────────────────
  function action(node: HTMLInputElement): { destroy: () => void } {
    inputEl = node

    node.type           = maskedOpt ? 'password' : 'text'
    node.inputMode      = type === 'numeric' ? 'numeric' : 'text'
    node.autocomplete   = 'one-time-code'
    node.maxLength      = length
    node.disabled       = get(isDisabledStore)
    node.spellcheck     = false
    if (nameOpt) node.name = nameOpt
    node.setAttribute('aria-label',      `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`)
    node.setAttribute('autocorrect',     'off')
    node.setAttribute('autocapitalize',  'off')
    if (readOnlyOpt) node.setAttribute('aria-readonly', 'true')
    syncInputValue(node, otp.state.slotValues.join(''), otp.state.activeSlot)

    const unsubDisabled = isDisabledStore.subscribe((v: boolean) => { node.disabled = v })

    function onKeydown(e: KeyboardEvent): void {
      if (get(isDisabledStore)) return
      const result = handleOTPKeyAction(otp, {
        key: e.key,
        position: node.selectionStart ?? 0,
        length,
        readOnly: isReadOnly,
        shiftKey: e.shiftKey,
      })
      if (!result.handled) return

      e.preventDefault()
      sync(!result.valueChanged)
      if (result.nextSelection !== null) {
        scheduleInputSelection(frameScheduler, node, result.nextSelection)
      }
    }

    function onChange(e: Event): void {
      if (get(isDisabledStore) || isReadOnly) return
      const raw = node.value
      if (!raw) {
        clearOTPInput(otp, node, { focus: false })
        sync()
        return
      }
      const result = applyTypedInput(otp, raw, { length, type, pattern })
      syncInputValue(node, result.value, result.nextSelection)
      sync()
      scheduleInputBlur(frameScheduler, node, blurOnCompleteOpt && result.isComplete)
    }

    function onPaste(e: ClipboardEvent): void {
      if (get(isDisabledStore) || isReadOnly) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      const result = applyPastedInput(otp, text, node.selectionStart ?? 0)
      syncInputValue(node, result.value, result.nextSelection)
      sync()
      scheduleInputBlur(frameScheduler, node, blurOnCompleteOpt && result.isComplete)
    }

    function onFocus(): void {
      isFocused = true
      onFocusProp?.()
      scheduleFocusSync(frameScheduler, otp, node, selectOnFocusOpt)
    }

    function onBlur(): void {
      isFocused = false
      onBlurProp?.()
    }

    node.addEventListener('keydown', onKeydown)
    node.addEventListener('input',   onChange)
    node.addEventListener('paste',   onPaste)
    node.addEventListener('focus',   onFocus)
    node.addEventListener('blur',    onBlur)

    if (autoFocusOpt && !get(isDisabledStore)) {
      scheduleInputFocus(frameScheduler, node)
    }

    // Start timer now that the component is mounted and the input element is
    // available — matching Vue's onMounted pattern.
    timerController.start()

    return {
      destroy() {
        frameScheduler.cancelAll()
        node.removeEventListener('keydown', onKeydown)
        node.removeEventListener('input',   onChange)
        node.removeEventListener('paste',   onPaste)
        node.removeEventListener('focus',   onFocus)
        node.removeEventListener('blur',    onBlur)
        unsubDisabled()
        unsubscribeControlledValue?.()
        unsubscribeControlledValue = null
        timerController.stop()
        unsubFeedback()
        otp.destroy()
        inputEl = null
      },
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset(): void {
    clearOTPInput(otp, inputEl, { focus: true, disabled: get(isDisabledStore) })
    timerController.restart()
    sync()
  }

  function resend(): void {
    clearOTPInput(otp, inputEl, { focus: true, disabled: get(isDisabledStore) })
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

  function setDisabled(value: boolean): void {
    isDisabledStore.set(value)
    otp.setDisabled(value)
    sync(true)
  }

  function setReadOnly(value: boolean): void {
    isReadOnly = value
    isReadOnlyStore.set(value)
    otp.setReadOnly(value)
    if (inputEl) {
      if (value) {
        inputEl.setAttribute('aria-readonly', 'true')
      } else {
        inputEl.removeAttribute('aria-readonly')
      }
    }
    sync(true)
  }

  function focus(slotIndex: number): void {
    focusOTPInput(otp, inputEl, slotIndex)
    sync(true)
  }

  function getCode(): string {
    return otp.getCode()
  }

  function getSlots(): readonly SlotEntry[] {
    return otp.getSlots()
  }

  function getInputProps(slotIndex: number): InputProps & FocusDataAttrs {
    const s        = otp.getSnapshot()
    const char     = s.slotValues[slotIndex] ?? ''
    const isFilled = char.length === 1
    return {
      value:     char,
      onInput:   (c) => { otp.insert(c, slotIndex); sync() },
      onKeyDown: (key) => {
        const result = handleOTPKeyAction(otp, {
          key,
          position: slotIndex,
          length,
          readOnly: isReadOnly,
        })
        if (result.handled) sync(!result.valueChanged)
      },
      onFocus: () => { isFocused = true; otp.move(slotIndex); sync(); onFocusProp?.() },
      onBlur:  () => { isFocused = false; onBlurProp?.() },
      'data-slot':     slotIndex,
      'data-active':   boolAttr(s.activeSlot === slotIndex),
      'data-focus':    boolAttr(isFocused),
      'data-filled':   boolAttr(isFilled),
      'data-empty':    boolAttr(!isFilled),
      'data-complete': boolAttr(s.isComplete),
      'data-invalid':  boolAttr(s.hasError),
      'data-success':  boolAttr(s.hasSuccess),
      'data-disabled': boolAttr(s.isDisabled),
      // Use the live `isReadOnly` closure variable (updated by setReadOnly()) rather
      // than the initial `readOnlyOpt` option value so that runtime calls to
      // setReadOnly() are correctly reflected in data-readonly.
      'data-readonly': boolAttr(isReadOnly),
      'data-first':    boolAttr(slotIndex === 0),
      'data-last':     boolAttr(slotIndex === length - 1),
    }
  }

  // Derived stores
  const value      = derived(store, ($s: OTPStateSnapshot) => $s.slotValues.join(''))
  const isComplete = derived(store, ($s: OTPStateSnapshot) => $s.isComplete)
  const hasError   = derived(store, ($s: OTPStateSnapshot) => $s.hasError)
  const hasSuccess = derived(store, ($s: OTPStateSnapshot) => $s.hasSuccess)
  const activeSlot = derived(store, ($s: OTPStateSnapshot) => $s.activeSlot)
  const slots      = derived(store, ($s: OTPStateSnapshot) => $s.slotValues.map((value, index) => ({
    index,
    value,
    isActive: $s.activeSlot === index,
    isFilled: value.length === 1,
  })))

  // Derived wrapper data attributes for CSS/Tailwind targeting.
  // Uses the already-narrowed isComplete/hasError derived stores rather than
  // the full store, so wrapperAttrs only recalculates when one of these four
  // booleans changes — not on every slot value or cursor move.
  const wrapperAttrs = derived(
    [isComplete, hasError, hasSuccess, isDisabledStore, isReadOnlyStore],
    ([$complete, $error, $success, $dis, $ro]): WrapperDataAttrs => ({
      ...($complete ? { 'data-complete': '' } : {}),
      ...($error    ? { 'data-invalid':  '' } : {}),
      ...($success  ? { 'data-success':  '' } : {}),
      ...($dis      ? { 'data-disabled': '' } : {}),
      ...($ro       ? { 'data-readonly': '' } : {}),
    })
  )

  return {
    subscribe:      store.subscribe,
    value,
    isComplete,
    hasError,
    hasSuccess,
    activeSlot,
    timerSeconds:   timerStore,
    isDisabled:     isDisabledStore,
    isReadOnly:     isReadOnlyStore,
    separatorAfter: separatorAfterStore,
    separator:      separatorStore,
    masked:         maskedStore,
    maskChar:       maskCharStore,
    placeholder:    placeholderOpt,
    wrapperAttrs,
    slots,
    action,
    getCode,
    getSlots,
    getInputProps,
    reset,
    resend,
    setError,
    setSuccess,
    setDisabled,
    setReadOnly,
    setValue,
    focus,
  }
}
