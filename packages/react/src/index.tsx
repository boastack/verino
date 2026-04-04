/**
 * @verino/react
 * ─────────────────────────────────────────────────────────────────────────────
 * React adapter — useOTP hook + HiddenOTPInput component.
 *
 * Architecture: single hidden-input overlays visual slot divs.
 * The core state machine stays stable across ordinary parent re-renders and
 * only recreates when the slot structure itself changes.
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  type RefObject,
  type MutableRefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
} from 'react'

import {
  type CoreOTPOptions,
  type FeedbackOptions,
  type FieldBehaviorOptions,
  type HiddenInputAttrs,
  type OTPEvent,
  type OTPStateSnapshot,
  type InputProps,
  type FocusDataAttrs,
  type SlotEntry,
  type TimerUIOptions,
  type ResendUIOptions,
  type WrapperDataAttrs,
} from '@verino/core'
import { filterChar, filterString } from '@verino/core/filter'
import { createOTP } from '@verino/core/machine'
import {
  applyTypedInput,
  clampSlotIndex,
  clearOTPInput,
  createFrameScheduler,
  focusOTPInput,
  handleOTPKeyAction,
  insertCode,
  scheduleFocusSync,
  scheduleInputBlur,
  scheduleInputSelection,
  syncInputValue as syncHiddenInputValue,
} from '@verino/core/toolkit/controller'
import {
  migrateProgrammaticValue,
  syncProgrammaticValue,
} from '@verino/core/toolkit/adapter-policy'
import { createTimer } from '@verino/core'
import { subscribeFeedback } from '@verino/core/toolkit/feedback'


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended options for useOTP.
 * Builds on the core machine options with React-specific controlled-input,
 * separator, masked, and onChange behavior.
 *
 * @example — uncontrolled
 *   const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *
 * @example — controlled / react-hook-form
 *   <Controller name="otp" control={control} render={({ field }) => (
 *     <OTPInput value={field.value} onChange={field.onChange} length={6} />
 *   )} />
 */
type ReactFieldBehaviorOptions = Pick<
  FieldBehaviorOptions,
  'autoFocus' | 'name' | 'onFocus' | 'onBlur' | 'placeholder' | 'selectOnFocus' | 'blurOnComplete' | 'defaultValue'
>

export type ReactOTPOptions =
  & CoreOTPOptions
  & FeedbackOptions
  & ReactFieldBehaviorOptions
  & Pick<TimerUIOptions, 'onExpire'>
  & Pick<ResendUIOptions, 'onResend'>
  & {
  /**
   * Live external control for the OTP value.
   * In React, pass the current string from parent state and update it via
   * `onChange`. Use `defaultValue` for one-time prefill.
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
export type HiddenInputProps = HiddenInputAttrs & {
  ref:              RefObject<HTMLInputElement>
  onKeyDown:        (e: KeyboardEvent<HTMLInputElement>) => void
  onChange:         (e: ChangeEvent<HTMLInputElement>) => void
  onPaste:          (e: ClipboardEvent<HTMLInputElement>) => void
  onFocus:          () => void
  onBlur:           () => void
}

export type UseOTPResult = {
  /** Current value of each slot. Empty string = unfilled. */
  slotValues:       readonly string[]
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
  getSlots:         () => readonly SlotEntry[]
  /**
   * Framework-agnostic handlers + data-* attributes for slot index.
   * Event handlers are wired via the hidden input; spread data-* onto visual divs.
   *
   * Includes `data-focus: 'true' | 'false'` in addition to the core `InputProps`
   * fields — sourced from the adapter's `isFocused` React state so the returned
   * object always reflects real browser focus without touching the DOM directly.
   */
  getInputProps:    (index: number) => InputProps & FocusDataAttrs
  /** Full render props for slot index — includes isFocused, hasFakeCaret, masked. */
  getSlotProps:     (index: number) => SlotRenderProps
  /** Spread onto the hidden input element. */
  hiddenInputProps: HiddenInputProps
  /** Spread onto the wrapper for CSS data-attribute targeting. */
  wrapperProps:     WrapperDataAttrs
  /** Separator slot index/indices. */
  separatorAfter:   number | number[]
  /** Separator character/string. */
  separator:        string
  /** Clear all slots, restart timer, return focus. */
  reset:            () => void
  /** Reset the field and fire `onResend`. */
  resend:           () => void
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

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function useMirroredMachineFlags(
  otp: ReturnType<typeof createOTP>,
  disabled: boolean,
  readOnly: boolean,
): void {
  useEffect(() => {
    otp.setDisabled(disabled)
    otp.setReadOnly(readOnly)
  }, [otp, disabled, readOnly])
}

type ResolvedInputType = NonNullable<CoreOTPOptions['type']>
type PasteTransformer = CoreOTPOptions['pasteTransformer']
type InvalidCharHandler = CoreOTPOptions['onInvalidChar']

function transformPastedText(raw: string, transformer?: PasteTransformer): string {
  if (!transformer) return raw

  try {
    return transformer(raw)
  } catch (err) {
    console.warn('[verino/react] pasteTransformer threw — using raw paste text.', err)
    return raw
  }
}

function reportInvalidPastedChars(
  text: string,
  startSlot: number,
  length: number,
  type: ResolvedInputType,
  pattern: RegExp | undefined,
  onInvalidChar?: InvalidCharHandler,
): void {
  if (!onInvalidChar || !text) return

  let cursor = startSlot
  for (const char of Array.from(text)) {
    if (cursor >= length) break
    if (filterChar(char, type, pattern)) cursor++
    else onInvalidChar(char, cursor)
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook for OTP input — single hidden-input architecture.
 *
 * The core state machine stays stable across ordinary parent re-renders and is
 * subscribed to via useEffect — every state change automatically triggers a
 * React re-render.
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
    idBase,
    type             = 'numeric',
    timer:           timerSecs = 0,
    disabled         = false,
    onComplete,
    onExpire,
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
    onResend,
  } = options

  // ── Stable callback refs ──────────────────────────────────────────────────
  // Stored in refs so the stable machine/subscriptions always read the latest
  // callbacks and dynamic adapter behavior without recreating the machine.
  const onResendRef         = useLatestRef(onResend)
  const onCompleteRef       = useLatestRef(onComplete)
  const onExpireRef         = useLatestRef(onExpire)
  const onChangeRef         = useLatestRef(onChangeProp)
  const onFocusRef          = useLatestRef(onFocusProp)
  const onBlurRef           = useLatestRef(onBlurProp)
  const onInvalidCharRef    = useLatestRef(onInvalidChar)
  const typeRef             = useLatestRef(type)
  const patternRef          = useLatestRef(pattern)
  const pasteTransformerRef = useLatestRef(pasteTransformer)
  const blurOnCompleteRef   = useLatestRef(blurOnComplete)
  const disabledRef         = useLatestRef(disabled)
  const readOnlyRef         = useLatestRef(readOnlyProp)

  // ── Suppress flags ────────────────────────────────────────────────────────
  // suppressCompleteRef: prevents programmatic fills from firing onComplete.
  // suppressOnChangeRef: prevents per-insert onChange during bulk fill loops.
  const suppressCompleteRef  = useRef(false)
  const suppressOnChangeRef  = useRef(false)

  // ── Core instance — recreated only when slot structure changes ────────────
  const otp = useMemo(() => createOTP({
    length,
    idBase,
    type: 'any',
    readOnly:      readOnlyProp,
    disabled,
    onComplete:    (code) => { if (!suppressCompleteRef.current) onCompleteRef.current?.(code) },
  }), [idBase, length])

  // ── React state ───────────────────────────────────────────────────────────
  const [state, setState]               = useState<OTPStateSnapshot>(() => otp.getSnapshot())
  const [timerSeconds, setTimer]        = useState(timerSecs)
  const [isFocused, setIsFocused]       = useState(false)
  const inputRef                        = useRef<HTMLInputElement>(null)
  const frameScheduler                  = useMemo(
    () => createFrameScheduler(() => !!inputRef.current?.isConnected),
    [],
  )
  const timerController = useMemo(
    () => createTimer({
      totalSeconds: timerSecs,
      emitInitialTickOnStart: true,
      emitInitialTickOnRestart: true,
      onTick:   (remaining) => setTimer(remaining),
      onExpire: () => { setTimer(0); onExpireRef.current?.() },
    }),
    [timerSecs, onExpireRef],
  )

  // ── Core subscription — every state change → React re-render ─────────────
  //
  // This is the ONLY place setState is called from the core.
  // Manual setState calls elsewhere are limited to:
  //   - Controlled value sync (after programmatic fill loops)
  //   - defaultValue application (once on mount)
  useEffect(() => {
    const unsubState = otp.subscribe((snapshot: OTPStateSnapshot, event: OTPEvent) => {
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

      if (event.type === 'COMPLETE' && blurOnCompleteRef.current) {
        scheduleInputBlur(frameScheduler, () => inputRef.current)
      }
    })

    return () => {
      frameScheduler.cancelAll()
      unsubState()
      otp.destroy()
    }
  }, [frameScheduler, otp])

  useEffect(() => {
    const unsubFeedback = subscribeFeedback(otp, { haptic, sound })
    return () => { unsubFeedback() }
  }, [haptic, sound, otp])

  useEffect(() => {
    setState(otp.getSnapshot())
  }, [otp])

  // ── Sync disabled / readOnly into the stable machine ─────────────────────
  useMirroredMachineFlags(otp, disabled, readOnlyProp)

  // ── Controlled value sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (controlledValue === undefined) return

    let result: ReturnType<typeof syncProgrammaticValue>
    suppressCompleteRef.current = true
    suppressOnChangeRef.current = true
    try {
      result = syncProgrammaticValue(otp, controlledValue, {
        length,
        type: typeRef.current,
        pattern: patternRef.current,
      }, 'input-end')
    } finally {
      suppressCompleteRef.current = false
      suppressOnChangeRef.current = false
    }
    if (!result.changed) return

    // Subscriber fires during the loop above but is suppressed.
    // Apply final state in one shot so React sees a single consistent update.
    // getSnapshot() deep-clones slotValues so React holds an isolated copy.
    setState(result.snapshot)

    syncHiddenInputValue(inputRef.current, result.value, result.nextSelection)
  }, [controlledValue, length, otp])

  // ── defaultValue — applied once per fresh core in uncontrolled mode ───────
  //
  // defaultValue is intentionally "initial only". Reapplying it on every
  // parent re-render would clobber live user input.
  const seededDefaultValueOtpRef = useRef<ReturnType<typeof createOTP> | null>(null)
  useEffect(() => {
    if (seededDefaultValueOtpRef.current === otp) return
    seededDefaultValueOtpRef.current = otp
    if (controlledValue !== undefined || !defaultValue) return

    let result: ReturnType<typeof syncProgrammaticValue>
    suppressCompleteRef.current = true
    suppressOnChangeRef.current = true
    try {
      result = syncProgrammaticValue(otp, defaultValue, {
        length,
        type,
        pattern,
      }, 'input-end')
    } finally {
      suppressCompleteRef.current = false
      suppressOnChangeRef.current = false
    }
    if (!result.changed) return

    setState(result.snapshot)
    syncHiddenInputValue(inputRef.current, result.value, result.nextSelection)
  }, [controlledValue, defaultValue, length, otp, pattern, type])

  // ── Dynamic filter migration ───────────────────────────────────────────────
  // The React adapter keeps a stable machine instance across ordinary rerenders.
  // When type/pattern changes, re-filter the current code and re-apply it so
  // existing state cannot survive under rules that no longer accept it.
  useEffect(() => {
    suppressCompleteRef.current = true
    suppressOnChangeRef.current = true
    let result: ReturnType<typeof migrateProgrammaticValue>
    try {
      result = migrateProgrammaticValue(otp, { length, type, pattern })
    } finally {
      suppressCompleteRef.current = false
      suppressOnChangeRef.current = false
    }
    if (!result.changed) return

    setState(result.snapshot)
    syncHiddenInputValue(inputRef.current, result.value, result.snapshot.activeSlot)

    if (onChangeRef.current) {
      onChangeRef.current(result.value)
    }
  }, [length, otp, pattern, type])

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    timerController.start()
    return () => timerController.stop()
  }, [timerController])


  // ── Event handlers ────────────────────────────────────────────────────────

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (disabledRef.current) return
    const result = handleOTPKeyAction(otp, {
      key: e.key,
      position: inputRef.current?.selectionStart ?? 0,
      length,
      readOnly: readOnlyRef.current,
      shiftKey: e.shiftKey,
    })
    if (!result.handled) return

    e.preventDefault()
    if (result.nextSelection !== null) {
      scheduleInputSelection(frameScheduler, () => inputRef.current, result.nextSelection)
    }
  }, [frameScheduler, length, otp])

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (disabledRef.current || readOnlyRef.current) return
    const raw = e.target.value

    if (!raw) {
      clearOTPInput(otp, inputRef.current, { focus: false })
      onChangeRef.current?.('')
      return
    }

    // Suppress per-insert onChange; fire once at the end.
    suppressOnChangeRef.current = true
    let nextValue = ''
    let nextSelection = 0
    try {
      const result = applyTypedInput(otp, raw, {
        length,
        type: typeRef.current,
        pattern: patternRef.current,
      })
      nextValue = result.value
      nextSelection = result.nextSelection
    } finally {
      suppressOnChangeRef.current = false
    }

    syncHiddenInputValue(inputRef.current, nextValue, nextSelection)
    onChangeRef.current?.(nextValue)
  }, [length, otp])

  const onPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    if (disabledRef.current || readOnlyRef.current) return
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const rawPos = inputRef.current?.selectionStart ?? 0
    const pos    = clampSlotIndex(rawPos, length)

    const transformed = transformPastedText(text, pasteTransformerRef.current)

    const currentType    = typeRef.current
    const currentPattern = patternRef.current

    reportInvalidPastedChars(
      transformed,
      pos,
      length,
      currentType,
      currentPattern,
      onInvalidCharRef.current,
    )

    const validChars = filterString(transformed, currentType, currentPattern)
    if (!validChars) return

    const writeCount = Math.min(validChars.length, length - pos)

    suppressOnChangeRef.current = true
    try {
      insertCode(otp, validChars.slice(0, writeCount), pos)
    } finally {
      suppressOnChangeRef.current = false
    }

    const post = otp.getSnapshot()
    const nextValue = post.slotValues.join('')
    syncHiddenInputValue(inputRef.current, nextValue, post.activeSlot)
    onChangeRef.current?.(nextValue)
  }, [length, otp])

  const onFocus = useCallback(() => {
    setIsFocused(true)
    onFocusRef.current?.()
    scheduleFocusSync(frameScheduler, otp, () => inputRef.current, selectOnFocus)
  }, [frameScheduler, otp, selectOnFocus])

  const onBlur = useCallback(() => {
    setIsFocused(false)
    onBlurRef.current?.()
  }, [])


  // ── Public API ────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    clearOTPInput(otp, inputRef.current, { focus: true, disabled: state.isDisabled })
    timerController.restart()
  }, [otp, state.isDisabled, timerController])

  const resend = useCallback(() => {
    clearOTPInput(otp, inputRef.current, { focus: true, disabled: state.isDisabled })
    timerController.restart()
    onResendRef.current?.()
  }, [otp, state.isDisabled, timerController, onResendRef])

  const setError    = useCallback((isError: boolean)    => { otp.setError(isError) }, [otp])
  const setSuccess  = useCallback((isSuccess: boolean)  => { otp.setSuccess(isSuccess) }, [otp])
  const setReadOnly = useCallback((isReadOnly: boolean) => {
    readOnlyRef.current = isReadOnly
    otp.setReadOnly(isReadOnly)
  }, [otp])
  const setDisabled = useCallback((isDisabled: boolean) => {
    disabledRef.current = isDisabled
    otp.setDisabled(isDisabled)
  }, [otp])

  const focus = useCallback((slotIndex: number) => {
    focusOTPInput(otp, inputRef.current, slotIndex)
  }, [otp])

  const getCode = useCallback(() => otp.getCode(), [otp])

  const getSlots = useCallback((): readonly SlotEntry[] => otp.getSlots(), [otp])

  // Build getInputProps in the adapter so it reflects live React-side behavior
  // (focus state + dynamic type/pattern refs) without recreating the machine.
  const getInputProps = useCallback((index: number): InputProps & FocusDataAttrs => {
    const slotIndex = clampSlotIndex(index, length)
    const char      = state.slotValues[slotIndex] ?? ''
    const isFilled  = char.length === 1

    return {
      value: char,
      onInput: (nextChar) => {
        if (disabledRef.current || readOnlyRef.current) return

        const validChar = filterChar(nextChar, typeRef.current, patternRef.current)
        if (!validChar) {
          if (nextChar.length === 1) {
            if (otp.state.activeSlot !== slotIndex) otp.move(slotIndex)
            onInvalidCharRef.current?.(nextChar, slotIndex)
          }
          return
        }

        otp.insert(validChar, slotIndex)
      },
      onKeyDown: (key) => {
        if (disabledRef.current) return

        switch (key) {
          case 'Backspace':
          case 'Delete':
          case 'ArrowLeft':
          case 'ArrowRight': {
            const result = handleOTPKeyAction(otp, {
              key,
              position: slotIndex,
              length,
              readOnly: readOnlyRef.current,
            })
            if (!result.handled) return
            break
          }
        }
      },
      onFocus: () => otp.focus(slotIndex),
      onBlur:  () => otp.blur(),
      'data-slot':     slotIndex,
      'data-active':   state.activeSlot === slotIndex ? 'true' : 'false',
      'data-filled':   isFilled ? 'true' : 'false',
      'data-empty':    isFilled ? 'false' : 'true',
      'data-complete': state.isComplete ? 'true' : 'false',
      'data-invalid':  state.hasError ? 'true' : 'false',
      'data-success':  state.hasSuccess ? 'true' : 'false',
      'data-disabled': state.isDisabled ? 'true' : 'false',
      'data-readonly': state.isReadOnly ? 'true' : 'false',
      'data-first':    slotIndex === 0 ? 'true' : 'false',
      'data-last':     slotIndex === length - 1 ? 'true' : 'false',
      'data-focus':    isFocused ? 'true' : 'false',
    }
  }, [isFocused, length, otp, state])

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
      isDisabled:   state.isDisabled,
      isFocused,
      hasFakeCaret: isActive && char.length === 0,
      masked,
      maskChar,
      placeholder,
    }
  }, [state, isFocused, masked, maskChar, placeholder])

  // Memoised so consumers wrapped in React.memo don't re-render on unrelated
  // state changes (e.g. timer ticks). Event handlers are already stable via
  // useCallback; the containing object needs useMemo to be stable too.
  const hiddenInputProps = useMemo((): HiddenInputProps => ({
    ref:            inputRef,
    type:           masked ? 'password' : 'text',
    inputMode:      type === 'numeric' ? 'numeric' : 'text',
    autoComplete:   'one-time-code',
    maxLength:      length,
    disabled:       state.isDisabled,
    ...(inputName ? { name: inputName }  : {}),
    ...(autoFocus ? { autoFocus: true }  : {}),
    'aria-label':   `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`,
    spellCheck:     false,
    autoCorrect:    'off',
    autoCapitalize: 'off',
    ...(state.isReadOnly ? { 'aria-readonly': 'true' as const } : {}),
    onKeyDown,
    onChange,
    onPaste,
    onFocus,
    onBlur,
  }), [masked, type, length, state.isDisabled, inputName, autoFocus, state.isReadOnly, onKeyDown, onChange, onPaste, onFocus, onBlur])

  const wrapperProps = useMemo((): WrapperDataAttrs => ({
    ...(state.isComplete  ? { 'data-complete': '' } : {}),
    ...(state.hasError    ? { 'data-invalid':  '' } : {}),
    ...(state.hasSuccess  ? { 'data-success':  '' } : {}),
    ...(state.isDisabled  ? { 'data-disabled': '' } : {}),
    ...(state.isReadOnly  ? { 'data-readonly': '' } : {}),
  }), [state.isComplete, state.hasError, state.hasSuccess, state.isDisabled, state.isReadOnly])

  return {
    slotValues:      state.slotValues,
    activeSlot:      state.activeSlot,
    isComplete:      state.isComplete,
    hasError:        state.hasError,
    hasSuccess:      state.hasSuccess,
    isDisabled:      state.isDisabled,
    timerSeconds,
    isFocused,
    getCode,
    getSlots,
    getInputProps,
    reset,
    resend,
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
