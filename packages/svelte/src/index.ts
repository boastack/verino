/**
 * @verino/svelte
 * ─────────────────────────────────────────────────────────────────────────────
 * Svelte adapter — useOTP store + action (single hidden-input architecture)
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store'

import {
  createOTP,
  createTimer,
  filterString,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type OTPOptions,
  type OTPState,
  type InputType,
  type SlotEntry,
  type InputProps,
} from 'verino'


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended options for the Svelte useOTP composable.
 * Adds controlled-input, separator, and disabled support on top of OTPOptions.
 */
export type SvelteOTPOptions = OTPOptions & {
  /**
   * Controlled value — drives the slot state from outside the composable.
   * Pass a string of up to length characters to pre-fill or sync the field.
   */
  value?: string
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
  subscribe:      Writable<OTPState>['subscribe']
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
  wrapperAttrs:   Readable<Record<string, string | undefined>>
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
  slots:          Readable<SlotEntry[]>
  /** Returns the current joined code string. */
  getCode:        () => string
  /**
   * Minimal array snapshot of every slot — non-reactive snapshot.
   * Use for one-off reads outside a reactive context. Prefer `$otp.slots` in templates.
   */
  getSlots:       () => SlotEntry[]
  /**
   * Framework-agnostic handlers + data-* attributes for slot `index`.
   * Spread data-* onto visual slot divs for CSS-attribute-driven styling.
   * Always returns current state — use inside `{#each $slots as slot}` for reactivity.
   *
   * Includes `data-focus: 'true' | 'false'` in addition to the core `InputProps`
   * fields — sourced from the closure-level `isFocused` variable that the action's
   * focus/blur handlers update on every focus change.
   */
  getInputProps:  (index: number) => InputProps & { 'data-focus': 'true' | 'false' }
  /** Clear all slots, restart timer, return focus to input. */
  reset:          () => void
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
  let suppressComplete = false

  // ── Focus tracking — updated by the action's focus/blur handlers ─────────
  let isFocused = false

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

  // ── Stores ─────────────────────────────────────────────────────────────────
  const store               = writable(otp.state)
  const timerStore          = writable(timerSecs)
  const isDisabledStore     = writable(initialDisabled)
  const isReadOnlyStore     = writable(readOnlyOpt)
  const separatorAfterStore = writable(separatorAfterOpt)
  const separatorStore      = writable(separatorOpt)
  const maskedStore         = writable(maskedOpt)
  const maskCharStore       = writable(maskCharOpt)

  let inputEl:    HTMLInputElement | null = null
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
    store.set({ ...s })
    if (!suppressOnChange) {
      onChangeProp?.(s.slotValues.join(''))
    }
  }

  // ── Controlled value sync ──────────────────────────────────────────────────
  function setValue(incoming: string | undefined): void {
    if (incoming === undefined) return
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
    if (inputEl) {
      inputEl.value = filtered
      inputEl.setSelectionRange(filtered.length, filtered.length)
    }
    onChangeProp?.(filtered)
  }

  if (controlledValue !== undefined) {
    setValue(controlledValue)
  } else if (defaultValue) {
    // Apply defaultValue once — no onComplete, no onChange
    const filtered = filterString(defaultValue.slice(0, length), type, pattern)
    if (filtered) {
      suppressComplete = true
      try {
        for (let i = 0; i < filtered.length; i++) otp.insert(filtered[i], i)
      } finally {
        suppressComplete = false
      }
      sync(true)
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  let timerControls: ReturnType<typeof createTimer> | null = null

  if (timerSecs > 0) {
    timerControls = createTimer({
      totalSeconds: timerSecs,
      onTick:   (r) => timerStore.set(r),
      onExpire: () => { timerStore.set(0); onExpire?.() },
    })
  }

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

    const unsubDisabled = isDisabledStore.subscribe((v: boolean) => { node.disabled = v })

    function onKeydown(e: KeyboardEvent): void {
      if (get(isDisabledStore)) return
      const pos = node.selectionStart ?? 0
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (isReadOnly) return
        otp.delete(pos)
        sync()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
      } else if (e.key === 'Delete') {
        e.preventDefault()
        if (isReadOnly) return
        otp.clear(pos)
        sync()
        requestAnimationFrame(() => node.setSelectionRange(pos, pos))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        otp.move(pos - 1)
        sync()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        otp.move(pos + 1)
        sync()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
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
        sync()
        const next = otp.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
      }
    }

    function onChange(e: Event): void {
      if (get(isDisabledStore) || isReadOnly) return
      const raw = (e.target as HTMLInputElement).value
      if (!raw) {
        otp.reset()
        node.value = ''
        node.setSelectionRange(0, 0)
        sync()
        return
      }
      const valid = filterString(raw, type, pattern).slice(0, length)
      otp.reset()
      for (let i = 0; i < valid.length; i++) otp.insert(valid[i], i)
      const next = Math.min(valid.length, length - 1)
      node.value = valid
      node.setSelectionRange(next, next)
      otp.move(next)
      sync()
      if (blurOnCompleteOpt && otp.state.isComplete) {
        requestAnimationFrame(() => node.blur())
      }
    }

    function onPaste(e: ClipboardEvent): void {
      if (get(isDisabledStore) || isReadOnly) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      const pos  = node.selectionStart ?? 0
      otp.paste(text, pos)
      const { slotValues, activeSlot } = otp.state
      node.value = slotValues.join('')
      node.setSelectionRange(activeSlot, activeSlot)
      sync()
      if (blurOnCompleteOpt && otp.state.isComplete) {
        requestAnimationFrame(() => node.blur())
      }
    }

    function onFocus(): void {
      isFocused = true
      onFocusProp?.()
      const pos = otp.state.activeSlot
      requestAnimationFrame(() => {
        const char = otp.state.slotValues[pos]
        if (selectOnFocusOpt && char) {
          node.setSelectionRange(pos, pos + 1)
        } else {
          node.setSelectionRange(pos, pos)
        }
      })
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
      requestAnimationFrame(() => node.focus())
    }

    // Start timer now that the component is mounted and the input element is
    // available — matching Vue's onMounted pattern.
    timerControls?.start()

    return {
      destroy() {
        node.removeEventListener('keydown', onKeydown)
        node.removeEventListener('input',   onChange)
        node.removeEventListener('paste',   onPaste)
        node.removeEventListener('focus',   onFocus)
        node.removeEventListener('blur',    onBlur)
        unsubDisabled()
        timerControls?.stop()
        inputEl = null
      },
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset(): void {
    otp.reset()
    if (inputEl) { inputEl.value = ''; inputEl.focus(); inputEl.setSelectionRange(0, 0) }
    timerStore.set(timerSecs)
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

  function setDisabled(value: boolean): void {
    isDisabledStore.set(value)
    otp.setDisabled(value)
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
  }

  function focus(slotIndex: number): void {
    otp.move(slotIndex)
    inputEl?.focus()
    requestAnimationFrame(() => inputEl?.setSelectionRange(slotIndex, slotIndex))
    sync(true)
  }

  function getCode(): string {
    return otp.getCode()
  }

  function getSlots(): SlotEntry[] {
    return otp.getSlots()
  }

  function getInputProps(slotIndex: number): InputProps & { 'data-focus': 'true' | 'false' } {
    const s        = otp.state
    const char     = s.slotValues[slotIndex] ?? ''
    const isFilled = char.length === 1
    const b        = (v: boolean): 'true' | 'false' => v ? 'true' : 'false'
    return {
      value:     char,
      onInput:   (c) => { otp.insert(c, slotIndex); sync() },
      onKeyDown: (key) => {
        if (key === 'Backspace')       { otp.delete(slotIndex); sync() }
        else if (key === 'Delete')     { otp.clear(slotIndex); sync() }
        else if (key === 'ArrowLeft')  { otp.move(slotIndex - 1); sync() }
        else if (key === 'ArrowRight') { otp.move(slotIndex + 1); sync() }
      },
      onFocus: () => { isFocused = true; otp.move(slotIndex); sync(); onFocusProp?.() },
      onBlur:  () => { isFocused = false; onBlurProp?.() },
      'data-index':    slotIndex,
      'data-active':   b(s.activeSlot === slotIndex),
      'data-focus':    b(isFocused),
      'data-filled':   b(isFilled),
      'data-empty':    b(!isFilled),
      'data-complete': b(s.isComplete),
      'data-invalid':  b(s.hasError),
      'data-success':  b(s.hasSuccess),
      'data-disabled': b(s.isDisabled),
      // Use the live `isReadOnly` closure variable (updated by setReadOnly()) rather
      // than the initial `readOnlyOpt` option value so that runtime calls to
      // setReadOnly() are correctly reflected in data-readonly.
      'data-readonly': b(isReadOnly),
      'data-first':    b(slotIndex === 0),
      'data-last':     b(slotIndex === length - 1),
    }
  }

  // Derived stores
  const value      = derived(store, ($s: OTPState) => $s.slotValues.join(''))
  const isComplete = derived(store, ($s: OTPState) => $s.isComplete)
  const hasError   = derived(store, ($s: OTPState) => $s.hasError)
  const hasSuccess = derived(store, ($s: OTPState) => $s.hasSuccess)
  const activeSlot = derived(store, ($s: OTPState) => $s.activeSlot)
  const slots      = derived(store, ($s: OTPState) => $s.slotValues.map((value, index) => ({
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
    ([$complete, $error, $success, $dis, $ro]) => ({
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
    setError,
    setSuccess,
    setDisabled,
    setReadOnly,
    setValue,
    focus,
  }
}