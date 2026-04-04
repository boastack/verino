/**
 * @verino/react
 * ─────────────────────────────────────────────────────────────────────────────
 * React adapter — useOTP hook + HiddenOTPInput component.
 *
 * Architecture: single hidden-input overlays visual slot divs.
 * Core state machine is created once via useMemo and subscribed to via
 * useEffect — React state stays in sync with core state automatically.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
} from 'react'

import {
  createOTP,
  createTimer,
  filterString,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type OTPOptions,
  type OTPState,
  type OTPEvent,
  type InputProps,
  type SlotEntry,
  type InputType,
} from '@verino/core'


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended options for useOTP.
 * Adds controlled-input, separator, masked, and onChange on top of OTPOptions.
 *
 * @example — uncontrolled
 *   const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *
 * @example — controlled / react-hook-form
 *   <Controller name="otp" control={control} render={({ field }) => (
 *     <OTPInput value={field.value} onChange={field.onChange} length={6} />
 *   )} />
 */
export type ReactOTPOptions = OTPOptions & {
  /**
   * Controlled value — drives slot state from outside.
   * Compatible with react-hook-form via <Controller>.
   */
  value?: string
  /**
   * Fires once per user interaction with the current joined code string.
   * Receives partial values — not just on completion.
   */
  onChange?: (code: string) => void
  /**
   * Visual separator after the Nth slot (1-based). Accepts single or array.
   * @example separatorAfter: 3      →  [*][*][*] — [*][*][*]   (splits after 3rd)
   * @example separatorAfter: [2, 4] →  [*][*] — [*][*] — [*][*]
   */
  separatorAfter?: number | number[]
  /** Separator character. Default: '—' */
  separator?: string
  /**
   * Display a mask glyph instead of the real character in filled slots.
   * Switches the hidden input to type="password" for mobile keyboards.
   * getCode() and onComplete always return real characters.
   */
  masked?: boolean
  /**
   * Glyph shown in filled slots when masked is true.
   * Default: '●' (U+25CF BLACK CIRCLE).
   */
  maskChar?: string
}

/**
 * Per-slot render props from getSlotProps(index).
 * Use for full structural control over slot markup.
 */
export type SlotRenderProps = {
  char:         string
  index:        number
  isActive:     boolean
  isFilled:     boolean
  isError:      boolean
  /** True when success state is active — mutually exclusive with isError. */
  isSuccess:    boolean
  isComplete:   boolean
  isDisabled:   boolean
  isFocused:    boolean
  /** True when this slot is active, empty, and focused — render fake caret here. */
  hasFakeCaret: boolean
  masked:       boolean
  maskChar:     string
  placeholder:  string
}

/** Props to spread onto the single hidden input element. */
export type HiddenInputProps = {
  ref:              RefObject<HTMLInputElement>
  type:             'text' | 'password'
  inputMode:        'numeric' | 'text'
  autoComplete:     'one-time-code'
  maxLength:        number
  disabled:         boolean
  name?:            string
  autoFocus?:       boolean
  'aria-label':     string
  /** Present (value `'true'`) only when the field is in readOnly mode. */
  'aria-readonly'?: 'true'
  spellCheck:       false
  autoCorrect:      'off'
  autoCapitalize:   'off'
  onKeyDown:        (e: KeyboardEvent<HTMLInputElement>) => void
  onChange:         (e: ChangeEvent<HTMLInputElement>) => void
  onPaste:          (e: ClipboardEvent<HTMLInputElement>) => void
  onFocus:          () => void
  onBlur:           () => void
}

export type UseOTPResult = {
  /** Current value of each slot. Empty string = unfilled. */
  slotValues:       string[]
  /** Index of the currently active slot. */
  activeSlot:       number
  /** True when every slot is filled. */
  isComplete:       boolean
  /** True when error state is active. */
  hasError:         boolean
  /** True when success state is active — mutually exclusive with hasError. */
  hasSuccess:       boolean
  /** True when the field is disabled. */
  isDisabled:       boolean
  /** Remaining timer seconds (live countdown). 0 when no timer or expired. */
  timerSeconds:     number
  /** True while the hidden input has browser focus. */
  isFocused:        boolean
  /** Returns the current joined code string. */
  getCode:          () => string
  /**
   * Minimal array snapshot — index, value, isActive, isFilled — for slot rendering.
   * Pair with getInputProps(slot.index) to spread data-* attributes.
   */
  getSlots:         () => SlotEntry[]
  /**
   * Framework-agnostic handlers + data-* attributes for slot index.
   * Event handlers are wired via the hidden input; spread data-* onto visual divs.
   *
   * Includes `data-focus: 'true' | 'false'` in addition to the core `InputProps`
   * fields — sourced from the adapter's `isFocused` React state so the returned
   * object always reflects real browser focus without touching the DOM directly.
   */
  getInputProps:    (index: number) => InputProps & { 'data-focus': 'true' | 'false' }
  /** Full render props for slot index — includes isFocused, hasFakeCaret, masked. */
  getSlotProps:     (index: number) => SlotRenderProps
  /** Spread onto the hidden input element. */
  hiddenInputProps: HiddenInputProps
  /** Spread onto the wrapper for CSS data-attribute targeting. */
  wrapperProps:     Record<string, string | undefined>
  /** Separator slot index/indices. */
  separatorAfter:   number | number[]
  /** Separator character/string. */
  separator:        string
  /** Clear all slots, restart timer, return focus. */
  reset:            () => void
  /** Apply or clear the error state. Clears success. */
  setError:         (isError: boolean) => void
  /** Apply or clear the success state. Clears error. */
  setSuccess:       (isSuccess: boolean) => void
  /** Toggle read-only at runtime. When true, slot mutations are blocked. */
  setReadOnly:      (isReadOnly: boolean) => void
  /**
   * Enable or disable the input at runtime.
   * When disabled, all keypresses and pastes are silently ignored.
   * Mirrors the `disabled` prop but can be called imperatively.
   */
  setDisabled:      (isDisabled: boolean) => void
  /** Programmatically move focus to a specific slot index. */
  focus:            (slotIndex: number) => void
}


// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook for OTP input — single hidden-input architecture.
 *
 * The core state machine is created once (useMemo) and subscribed to via
 * useEffect — every state change automatically triggers a React re-render.
 *
 * @example
 * ```tsx
 * const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *
 * <div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
 *   <HiddenOTPInput {...otp.hiddenInputProps} />
 *   {otp.getSlots().map((slot) => (
 *     <MySlot key={slot.index} {...otp.getSlotProps(slot.index)} />
 *   ))}
 * </div>
 * ```
 */
export function useOTP(options: ReactOTPOptions = {}): UseOTPResult {
  const {
    length           = 6,
    type             = 'numeric' as InputType,
    timer:           timerSecs = 0,
    disabled         = false,
    onComplete,
    onExpire,
    onResend,
    haptic           = true,
    sound            = false,
    pattern,
    pasteTransformer,
    onInvalidChar,
    value:           controlledValue,
    defaultValue,
    readOnly:        readOnlyProp = false,
    onChange:        onChangeProp,
    onFocus:         onFocusProp,
    onBlur:          onBlurProp,
    separatorAfter   = 0,
    separator        = '—',
    masked           = false,
    maskChar         = '\u25CF',
    autoFocus        = true,
    name:            inputName,
    placeholder      = '',
    selectOnFocus    = false,
    blurOnComplete   = false,
  } = options

  // ── Stable callback refs ──────────────────────────────────────────────────
  // Stored in refs so the core subscription (stable [] deps) always reads the
  // latest callbacks without needing to be recreated on every render.
  const onCompleteRef       = useRef(onComplete)
  const onExpireRef         = useRef(onExpire)
  const onResendRef         = useRef(onResend)
  const onChangeRef         = useRef(onChangeProp)
  const onFocusRef          = useRef(onFocusProp)
  const onBlurRef           = useRef(onBlurProp)
  const onInvalidCharRef    = useRef(onInvalidChar)
  const patternRef          = useRef(pattern)
  const pasteTransformerRef = useRef(pasteTransformer)
  const blurOnCompleteRef   = useRef(blurOnComplete)
  const disabledRef         = useRef(disabled)
  const readOnlyRef         = useRef(readOnlyProp)

  useEffect(() => { onCompleteRef.current       = onComplete       }, [onComplete])
  useEffect(() => { onExpireRef.current         = onExpire         }, [onExpire])
  useEffect(() => { onResendRef.current         = onResend         }, [onResend])
  useEffect(() => { onChangeRef.current         = onChangeProp     }, [onChangeProp])
  useEffect(() => { onFocusRef.current          = onFocusProp      }, [onFocusProp])
  useEffect(() => { onBlurRef.current           = onBlurProp       }, [onBlurProp])
  useEffect(() => { onInvalidCharRef.current    = onInvalidChar    }, [onInvalidChar])
  useEffect(() => { patternRef.current          = pattern          }, [pattern])
  useEffect(() => { pasteTransformerRef.current = pasteTransformer }, [pasteTransformer])
  useEffect(() => { blurOnCompleteRef.current   = blurOnComplete   }, [blurOnComplete])
  useEffect(() => { disabledRef.current         = disabled         }, [disabled])
  useEffect(() => { readOnlyRef.current         = readOnlyProp     }, [readOnlyProp])

  // ── Suppress flags ────────────────────────────────────────────────────────
  // suppressCompleteRef: prevents programmatic fills from firing onComplete.
  // suppressOnChangeRef: prevents per-insert onChange during bulk fill loops.
  const suppressCompleteRef  = useRef(false)
  const suppressOnChangeRef  = useRef(false)

  // ── Core instance — created once, never recreated ─────────────────────────
  const otp = useMemo(() => createOTP({
    length, type, pattern, pasteTransformer,
    readOnly:      readOnlyProp,
    disabled,
    onComplete:    (code) => { if (!suppressCompleteRef.current) onCompleteRef.current?.(code) },
    onExpire:      ()     => onExpireRef.current?.(),
    onResend:      ()     => onResendRef.current?.(),
    onInvalidChar: (char, index) => onInvalidCharRef.current?.(char, index),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  // ── React state ───────────────────────────────────────────────────────────
  const [state, setState]               = useState<OTPState>(() => otp.state)
  const [timerSeconds, setTimer]        = useState(timerSecs)
  // Incrementing an integer is the idiomatic React pattern for re-triggering a
  // useEffect that has no meaningful dependency. reset() bumps this to restart
  // the timer effect without recreating the core or losing other hook state.
  const [timerTrigger, setTimerTrigger] = useState(0)
  const [isFocused, setIsFocused]       = useState(false)
  const inputRef                        = useRef<HTMLInputElement>(null)

  // ── Core subscription — every state change → React re-render ─────────────
  //
  // This is the ONLY place setState is called from the core.
  // Manual setState calls elsewhere are limited to:
  //   - Controlled value sync (after programmatic fill loops)
  //   - defaultValue application (once on mount)
  useEffect(() => {
    return otp.subscribe((snapshot: OTPState, event: OTPEvent) => {
      setState(snapshot)

      // onChange fires on user-driven slot mutations only — not on structural
      // events (FOCUS, BLUR, MOVE, RESET, ERROR, DISABLED, READONLY, COMPLETE).
      if (
        !suppressOnChangeRef.current &&
        (event.type === 'INPUT' || event.type === 'DELETE' ||
         event.type === 'CLEAR' || event.type === 'PASTE')
      ) {
        onChangeRef.current?.(snapshot.slotValues.join(''))
      }

      if (event.type === 'COMPLETE') {
        if (haptic) triggerHapticFeedback()
        if (sound)  triggerSoundFeedback()
        if (blurOnCompleteRef.current) requestAnimationFrame(() => inputRef.current?.blur())
      } else if (event.type === 'ERROR' && event.hasError) {
        if (haptic) triggerHapticFeedback()
      }
    })
  // otp is stable (useMemo with [] deps) — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync disabled / readOnly into core when props change ─────────────────
  // `otp` is intentionally omitted from each dependency array: it is created
  // once via useMemo([]) and never replaced, making it structurally stable.
  // Adding it would be a no-op but would trigger the exhaustive-deps lint rule.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { otp.setDisabled(disabled)     }, [disabled])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { otp.setReadOnly(readOnlyProp) }, [readOnlyProp])

  // ── Controlled value sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (controlledValue === undefined) return

    const incoming = filterString(controlledValue.slice(0, length), type, pattern)
    const current  = otp.state.slotValues.join('')
    if (incoming === current) return

    suppressCompleteRef.current = true
    suppressOnChangeRef.current = true
    try {
      otp.reset()
      for (let i = 0; i < incoming.length; i++) otp.insert(incoming[i], i)
    } finally {
      suppressCompleteRef.current = false
      suppressOnChangeRef.current = false
    }

    // Subscriber fires during the loop above but is suppressed.
    // Apply final state in one shot so React sees a single consistent update.
    // getSnapshot() deep-clones slotValues so React holds an isolated copy.
    setState(otp.getSnapshot())

    if (inputRef.current) {
      inputRef.current.value = incoming
      inputRef.current.setSelectionRange(incoming.length, incoming.length)
    }

    onChangeRef.current?.(incoming)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue, length])

  // ── defaultValue — applied once on mount ─────────────────────────────────
  useEffect(() => {
    if (controlledValue !== undefined || !defaultValue) return
    const filtered = filterString(defaultValue.slice(0, length), type, pattern)
    if (!filtered) return

    suppressCompleteRef.current = true
    suppressOnChangeRef.current = true
    try {
      for (let i = 0; i < filtered.length; i++) otp.insert(filtered[i], i)
    } finally {
      suppressCompleteRef.current = false
      suppressOnChangeRef.current = false
    }

    setState(otp.getSnapshot())
    if (inputRef.current) {
      inputRef.current.value = filtered
      inputRef.current.setSelectionRange(filtered.length, filtered.length)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerSecs) return
    setTimer(timerSecs)
    const t = createTimer({
      totalSeconds: timerSecs,
      onTick:   (r) => setTimer(r),
      onExpire: ()  => { setTimer(0); onExpireRef.current?.() },
    })
    t.start()
    return () => t.stop()
  }, [timerSecs, timerTrigger])


  // ── Event handlers ────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (disabledRef.current) return
    const pos = inputRef.current?.selectionStart ?? 0

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (readOnlyRef.current) return
      otp.delete(pos)
      // Subscriber handles setState; just reposition the hidden cursor.
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))

    } else if (e.key === 'Delete') {
      e.preventDefault()
      if (readOnlyRef.current) return
      otp.clear(pos)
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos))

    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      otp.move(pos - 1)
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))

    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      otp.move(pos + 1)
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))

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
      const next = otp.state.activeSlot
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))
    }
  }, [])

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (disabledRef.current || readOnlyRef.current) return
    const raw = e.target.value

    if (!raw) {
      otp.reset()   // subscriber handles setState; RESET → no onChange in subscribe
      if (inputRef.current) { inputRef.current.value = ''; inputRef.current.setSelectionRange(0, 0) }
      onChangeRef.current?.('')
      return
    }

    const valid = filterString(raw, type, patternRef.current).slice(0, length)

    // Suppress per-insert onChange; fire once at the end.
    suppressOnChangeRef.current = true
    try {
      otp.reset()
      for (let i = 0; i < valid.length; i++) otp.insert(valid[i], i)
    } finally {
      suppressOnChangeRef.current = false
    }

    const next = Math.min(valid.length, length - 1)
    if (inputRef.current) { inputRef.current.value = valid; inputRef.current.setSelectionRange(next, next) }
    otp.move(next)

    onChangeRef.current?.(valid)
  }, [type, length])

  const onPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    if (disabledRef.current || readOnlyRef.current) return
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const pos  = inputRef.current?.selectionStart ?? 0
    otp.paste(text, pos)
    // Subscriber handles setState + onChange (PASTE event passes the filter).
    const { slotValues, activeSlot } = otp.state
    if (inputRef.current) {
      inputRef.current.value = slotValues.join('')
      inputRef.current.setSelectionRange(activeSlot, activeSlot)
    }
  }, [])

  const onFocus = useCallback(() => {
    setIsFocused(true)
    onFocusRef.current?.()
    const pos = otp.state.activeSlot
    requestAnimationFrame(() => {
      const char = otp.state.slotValues[pos]
      if (selectOnFocus && char) {
        inputRef.current?.setSelectionRange(pos, pos + 1)
      } else {
        inputRef.current?.setSelectionRange(pos, pos)
      }
    })
  }, [selectOnFocus])

  const onBlur = useCallback(() => {
    setIsFocused(false)
    onBlurRef.current?.()
  }, [])


  // ── Public API ────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    otp.reset()   // subscriber handles setState
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
      inputRef.current.setSelectionRange(0, 0)
    }
    setTimer(timerSecs)
    setTimerTrigger((n: number) => n + 1)
  }, [timerSecs])

  const setError    = useCallback((isError: boolean)    => { otp.setError(isError) }, [])
  const setSuccess  = useCallback((isSuccess: boolean)  => { otp.setSuccess(isSuccess) }, [])
  const setReadOnly = useCallback((isReadOnly: boolean) => { otp.setReadOnly(isReadOnly) }, [])
  const setDisabled = useCallback((isDisabled: boolean) => { otp.setDisabled(isDisabled) }, [])

  const focus = useCallback((slotIndex: number) => {
    otp.move(slotIndex)
    inputRef.current?.focus()
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(slotIndex, slotIndex))
  }, [])

  const getCode = useCallback(() => otp.getCode(), [])

  const getSlots = useCallback((): SlotEntry[] => otp.getSlots(), [])

  // Build getInputProps in the adapter so data-focus can include real focus state.
  const getInputProps = useCallback((index: number): InputProps & { 'data-focus': 'true' | 'false' } => {
    const coreProps = otp.getInputProps(index)
    return { ...coreProps, 'data-focus': isFocused ? 'true' : 'false' }
  }, [isFocused])

  const getSlotProps = useCallback((index: number): SlotRenderProps => {
    const char     = state.slotValues[index] ?? ''
    const isActive = index === state.activeSlot && isFocused
    return {
      char,
      index,
      isActive,
      isFilled:     char.length === 1,
      isError:      state.hasError,
      isSuccess:    state.hasSuccess,
      isComplete:   state.isComplete,
      isDisabled:   disabled,
      isFocused,
      hasFakeCaret: isActive && char.length === 0,
      masked,
      maskChar,
      placeholder,
    }
  }, [state, isFocused, disabled, masked, maskChar, placeholder])

  // Memoised so consumers wrapped in React.memo don't re-render on unrelated
  // state changes (e.g. timer ticks). Event handlers are already stable via
  // useCallback; the containing object needs useMemo to be stable too.
  const hiddenInputProps = useMemo((): HiddenInputProps => ({
    ref:            inputRef,
    type:           masked ? 'password' : 'text',
    inputMode:      type === 'numeric' ? 'numeric' : 'text',
    autoComplete:   'one-time-code',
    maxLength:      length,
    disabled,
    ...(inputName ? { name: inputName }  : {}),
    ...(autoFocus ? { autoFocus: true }  : {}),
    'aria-label':   `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`,
    spellCheck:     false,
    autoCorrect:    'off',
    autoCapitalize: 'off',
    ...(readOnlyProp ? { 'aria-readonly': 'true' as const } : {}),
    onKeyDown,
    onChange,
    onPaste,
    onFocus,
    onBlur,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [masked, type, length, disabled, inputName, autoFocus, readOnlyProp, onKeyDown, onChange, onPaste, onFocus, onBlur])

  const wrapperProps = useMemo((): Record<string, string | undefined> => ({
    ...(state.isComplete  ? { 'data-complete': '' } : {}),
    ...(state.hasError    ? { 'data-invalid':  '' } : {}),
    ...(state.hasSuccess  ? { 'data-success':  '' } : {}),
    ...(disabled          ? { 'data-disabled': '' } : {}),
    ...(readOnlyProp      ? { 'data-readonly': '' } : {}),
  }), [state.isComplete, state.hasError, state.hasSuccess, disabled, readOnlyProp])

  return {
    slotValues:      state.slotValues,
    activeSlot:      state.activeSlot,
    isComplete:      state.isComplete,
    hasError:        state.hasError,
    hasSuccess:      state.hasSuccess,
    isDisabled:      disabled,
    timerSeconds,
    isFocused,
    getCode,
    getSlots,
    getInputProps,
    reset,
    setError,
    setSuccess,
    setReadOnly,
    setDisabled,
    focus,
    separatorAfter,
    separator,
    hiddenInputProps,
    getSlotProps,
    wrapperProps,
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// HIDDEN OTP INPUT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience wrapper around the single hidden <input> element.
 * Positions itself absolutely over the slot row to capture all keyboard
 * input, native SMS autofill, and browser paste.
 *
 * @example
 * ```tsx
 * <div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
 *   <HiddenOTPInput {...otp.hiddenInputProps} />
 *   {otp.getSlots().map((slot) => <MySlot key={slot.index} {...otp.getSlotProps(slot.index)} />)}
 * </div>
 * ```
 */
const HIDDEN_INPUT_STYLE: CSSProperties = {
  position:   'absolute',
  inset:      0,
  width:      '100%',
  height:     '100%',
  opacity:    0,
  border:     'none',
  outline:    'none',
  background: 'transparent',
  color:      'transparent',
  caretColor: 'transparent',
  zIndex:     1,
  cursor:     'text',
  fontSize:   1,
}

export const HiddenOTPInput = forwardRef<
  HTMLInputElement,
  Omit<HiddenInputProps, 'ref'>
>((props, ref) => (
  <input ref={ref} style={HIDDEN_INPUT_STYLE} {...props} />
))

HiddenOTPInput.displayName = 'HiddenOTPInput'
