/**
 * @verino/react-native
 * ─────────────────────────────────────────────────────────────────────────────
 * React Native adapter — useOTP hook.
 *
 * Architecture: a single invisible `TextInput` overlays visual slot Views,
 * mirroring the web single-hidden-input pattern. The real TextInput captures
 * all keyboard input, iOS/Android SMS autofill (`textContentType="oneTimeCode"`
 * / `autoComplete="sms-otp"`), and paste. Slot Views are purely visual mirrors
 * of state — they hold no text input of their own.
 *
 * This package never imports `react-native` at runtime. `useOTP` returns a
 * plain props object (`hiddenInputProps`) shaped to spread directly onto a
 * consumer-rendered `<TextInput>`, so the package stays zero-dependency and
 * works with any React Native runtime (bare RN, Expo, etc.) without version
 * coupling.
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type RefObject,
  type MutableRefObject,
} from 'react'

import {
  type CoreOTPOptions,
  type FeedbackOptions,
  type FieldBehaviorOptions,
  type OTPEvent,
  type OTPStateSnapshot,
  type SlotEntry,
  type TimerUIOptions,
  type TimerController,
  type ResendUIOptions,
} from '@verino/core'
import { filterChar } from '@verino/core/filter'
import { createOTP } from '@verino/core/machine'
import {
  applyTypedInput,
  clampSlotIndex,
  createFrameScheduler,
  handleOTPKeyAction,
  type FrameScheduler,
} from '@verino/core/toolkit/controller'
import {
  migrateProgrammaticValue,
  syncProgrammaticValue,
} from '@verino/core/toolkit/adapter-policy'
import { createTimer } from '@verino/core'
import { subscribeFeedback } from '@verino/core/toolkit/feedback'


// ─────────────────────────────────────────────────────────────────────────────
// RN-LOCAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structural subset of React Native's `TextInput` imperative ref — matched
 * by `TextInput` instances without importing the `react-native` package.
 */
export type TextInputRefLike = {
  focus: () => void
  blur: () => void
  clear?: () => void
  isFocused?: () => boolean
  setSelection?: (start: number, end: number) => void
}

/** Structural subset of `NativeSyntheticEvent<TextInputKeyPressEventData>`. */
export type OTPKeyPressEvent = {
  nativeEvent: { key: string }
}

/**
 * Extended options for useOTP.
 * Builds on the core machine options with React Native-specific controlled-
 * input, separator, masked, and onChange behavior.
 *
 * @example — uncontrolled
 *   const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *
 * @example — controlled
 *   const [code, setCode] = useState('')
 *   const otp = useOTP({ length: 6, value: code, onChange: setCode })
 */
type ReactNativeFieldBehaviorOptions = Pick<
  FieldBehaviorOptions,
  'autoFocus' | 'onFocus' | 'onBlur' | 'placeholder' | 'selectOnFocus' | 'blurOnComplete' | 'defaultValue'
>

export type ReactNativeOTPOptions =
  & CoreOTPOptions
  & FeedbackOptions
  & ReactNativeFieldBehaviorOptions
  & Pick<TimerUIOptions, 'onExpire'>
  & Pick<ResendUIOptions, 'onResend'>
  & {
  /**
   * Live external control for the OTP value.
   * Pass the current string from parent state and update it via `onChange`.
   * Use `defaultValue` for one-time prefill.
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
   * Switches the hidden TextInput to `secureTextEntry` for native keyboards.
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
  /**
   * Tap handler — moves the cursor to this slot and focuses the hidden
   * TextInput. No-ops while the field is disabled. Spread onto a
   * `Pressable`/`TouchableOpacity` wrapping the slot view.
   */
  onPress:      () => void
}

/** Props to spread onto a consumer-rendered `<TextInput>`. */
export type HiddenInputProps = {
  /**
   * Typed `RefObject<any>` rather than `RefObject<TextInputRefLike>` so it
   * satisfies a real `<TextInput ref={...}>`'s own ref type — TS ref
   * assignability needs our ref's `current` type to be a *supertype* of the
   * real `TextInput` instance (which `TextInputRefLike` deliberately isn't,
   * since it only models the handful of members this package calls). The
   * underlying value is still a `TextInputRefLike`-typed ref internally.
   */
  ref:                  RefObject<any>
  value:                string
  onChangeText:         (text: string) => void
  onKeyPress:           (e: OTPKeyPressEvent) => void
  onFocus:              () => void
  onBlur:               () => void
  maxLength:            number
  editable:             boolean
  keyboardType:         'number-pad' | 'default'
  textContentType:      'oneTimeCode'
  autoComplete:         'sms-otp'
  secureTextEntry:      boolean
  caretHidden:          true
  contextMenuHidden:    false
  importantForAutofill: 'yes'
  spellCheck:           false
  autoCorrect:          false
  autoCapitalize:       'none'
  accessibilityLabel:   string
  autoFocus?:           true
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
  /** True when the field is read-only. */
  isReadOnly:       boolean
  /** Remaining timer seconds (live countdown). 0 when no timer or expired. */
  timerSeconds:     number
  /** Imperative controller for pausing, resuming, inspecting, or subscribing to the timer. */
  timer:            TimerController
  /** True while the hidden TextInput has native focus. */
  isFocused:        boolean
  /** Returns the current joined code string. */
  getCode:          () => string
  /**
   * Minimal array snapshot — index, value, isActive, isFilled — for slot rendering.
   * Pair with getSlotProps(slot.index) for full render props.
   */
  getSlots:         () => readonly SlotEntry[]
  /** Full render props for slot index — includes isFocused, hasFakeCaret, masked, onPress. */
  getSlotProps:     (index: number) => SlotRenderProps
  /** Spread onto the hidden TextInput element. */
  hiddenInputProps: HiddenInputProps
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
   * Mirrors the `disabled` option but can be called imperatively.
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

function transformChangedText(raw: string, transformer?: PasteTransformer): string {
  if (!transformer) return raw

  try {
    return transformer(raw)
  } catch (err) {
    console.warn('[verino/react-native] pasteTransformer threw — using raw text.', err)
    return raw
  }
}

function reportInvalidChars(
  text: string,
  length: number,
  type: ResolvedInputType,
  pattern: RegExp | undefined,
  onInvalidChar?: InvalidCharHandler,
): void {
  if (!onInvalidChar || !text) return

  let cursor = 0
  for (const char of Array.from(text)) {
    if (cursor >= length) break
    if (filterChar(char, type, pattern)) cursor++
    else onInvalidChar(char, cursor)
  }
}

// ── RN-local focus/blur scheduling ──────────────────────────────────────────
// Mirrors @verino/core/toolkit/controller's DOM scheduling helpers, but typed
// against TextInputRefLike instead of HTMLInputElement — RN has no imperative
// `.value` setter or `.setSelectionRange()`, and the controlled `value` prop
// already reflects machine state on every re-render, so no value-sync helper
// is needed here.

function scheduleRNFocus(scheduler: FrameScheduler, getInput: () => TextInputRefLike | null | undefined): void {
  scheduler.schedule(() => { getInput()?.focus() })
}

function scheduleRNBlur(scheduler: FrameScheduler, getInput: () => TextInputRefLike | null | undefined): void {
  scheduler.schedule(() => { getInput()?.blur() })
}


// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React Native hook for OTP input — single hidden-TextInput architecture.
 *
 * The core state machine stays stable across ordinary parent re-renders and is
 * subscribed to via useEffect — every state change automatically triggers a
 * React re-render.
 *
 * @example
 * ```tsx
 * const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *
 * <View style={{ position: 'relative', flexDirection: 'row', gap: 8 }}>
 *   <TextInput {...otp.hiddenInputProps} style={StyleSheet.absoluteFill} />
 *   {otp.getSlots().map((slot) => {
 *     const { char, isActive, isFilled, onPress } = otp.getSlotProps(slot.index)
 *     return (
 *       <Pressable key={slot.index} onPress={onPress}>
 *         <View style={[styles.slot, isActive && styles.active]}>
 *           <Text>{char}</Text>
 *         </View>
 *       </Pressable>
 *     )
 *   })}
 * </View>
 * ```
 */
export function useOTP(options: ReactNativeOTPOptions = {}): UseOTPResult {
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
    feedback,
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
    maskChar         = '●',
    autoFocus        = true,
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
  const typeRef             = useLatestRef(type)
  const patternRef          = useLatestRef(pattern)
  const blurOnCompleteRef   = useLatestRef(blurOnComplete)
  const disabledRef         = useLatestRef(disabled)
  const readOnlyRef         = useLatestRef(readOnlyProp)
  const pasteTransformerRef = useLatestRef(pasteTransformer)
  const onInvalidCharRef    = useLatestRef(onInvalidChar)

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
  const inputRef                        = useRef<TextInputRefLike>(null)
  const frameScheduler                  = useMemo(() => createFrameScheduler(), [])
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
        scheduleRNBlur(frameScheduler, () => inputRef.current)
      }
    })

    return () => {
      frameScheduler.cancelAll()
      unsubState()
      otp.destroy()
    }
  }, [frameScheduler, otp])

  useEffect(() => {
    const unsubFeedback = subscribeFeedback(otp, { haptic, sound, feedback })
    return () => { unsubFeedback() }
  }, [haptic, sound, feedback, otp])

  useEffect(() => {
    setState(otp.getSnapshot())
  }, [otp])

  // ── Sync disabled / readOnly into the stable machine ─────────────────────
  useMirroredMachineFlags(otp, disabled, readOnlyProp)

  // ── Controlled value sync ─────────────────────────────────────────────────
  // Unlike the DOM adapter, no imperative `.value =` sync is needed — the
  // hidden TextInput is a controlled component, so `hiddenInputProps.value`
  // reflects the new machine state automatically on the next render.
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

    setState(result.snapshot)
  }, [controlledValue, length, otp])

  // ── defaultValue — applied once per fresh core in uncontrolled mode ───────
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
  }, [controlledValue, defaultValue, length, otp, pattern, type])

  // ── Dynamic filter migration ───────────────────────────────────────────────
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
    onChangeRef.current?.(result.value)
  }, [length, otp, pattern, type])

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    timerController.start()
    return () => timerController.stop()
  }, [timerController])


  // ── Event handlers ────────────────────────────────────────────────────────

  // The hidden TextInput's `value` always mirrors the full joined code, so
  // onChangeText receives the complete new value on every edit — typing,
  // backspace, long-press paste, and SMS autofill alike. This mirrors the web
  // adapter's hiddenInputProps.onChange handler exactly, with `pasteTransformer`
  // applied unconditionally since RN cannot distinguish a paste/autofill from
  // typing at this handler (transformers are expected to be no-ops on already
  // clean single characters).
  const onChangeText = useCallback((raw: string) => {
    if (disabledRef.current || readOnlyRef.current) return

    if (!raw) {
      otp.reset()
      onChangeRef.current?.('')
      return
    }

    const transformed = transformChangedText(raw, pasteTransformerRef.current)
    reportInvalidChars(transformed, length, typeRef.current, patternRef.current, onInvalidCharRef.current)

    const result = applyTypedInput(otp, transformed, {
      length,
      type: typeRef.current,
      pattern: patternRef.current,
    })
    onChangeRef.current?.(result.value)
  }, [length, otp])

  // onChangeText alone cannot report ArrowLeft/ArrowRight (hardware keyboard
  // navigation, e.g. iPad) — onKeyPress covers that one gap.
  const onKeyPress = useCallback((e: OTPKeyPressEvent) => {
    if (disabledRef.current) return
    const key = e.nativeEvent.key
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return

    handleOTPKeyAction(otp, {
      key,
      position: otp.state.activeSlot,
      length,
      readOnly: readOnlyRef.current,
    })
  }, [length, otp])

  const onFocus = useCallback(() => {
    setIsFocused(true)
    onFocusRef.current?.()
  }, [])

  const onBlur = useCallback(() => {
    setIsFocused(false)
    onBlurRef.current?.()
  }, [])


  // ── Public API ────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    otp.reset()
    if (!state.isDisabled) scheduleRNFocus(frameScheduler, () => inputRef.current)
    timerController.restart()
  }, [otp, state.isDisabled, timerController, frameScheduler])

  const resend = useCallback(() => {
    otp.reset()
    if (!state.isDisabled) scheduleRNFocus(frameScheduler, () => inputRef.current)
    timerController.restart()
    onResendRef.current?.()
  }, [otp, state.isDisabled, timerController, frameScheduler, onResendRef])

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
    otp.move(slotIndex)
    scheduleRNFocus(frameScheduler, () => inputRef.current)
  }, [otp, frameScheduler])

  const getCode = useCallback(() => otp.getCode(), [otp])

  const getSlots = useCallback((): readonly SlotEntry[] => otp.getSlots(), [otp])

  const getSlotProps = useCallback((index: number): SlotRenderProps => {
    const slotIndex = clampSlotIndex(index, length)
    const char       = state.slotValues[slotIndex] ?? ''
    const isActive   = slotIndex === state.activeSlot && isFocused
    return {
      char,
      index:        slotIndex,
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
      onPress: () => { if (!state.isDisabled) focus(slotIndex) },
    }
  }, [state, isFocused, masked, maskChar, placeholder, length, focus])

  // Memoised so consumers wrapped in React.memo don't re-render on unrelated
  // state changes (e.g. timer ticks). Event handlers are already stable via
  // useCallback; the containing object needs useMemo to be stable too.
  const hiddenInputProps = useMemo((): HiddenInputProps => ({
    ref:                   inputRef,
    value:                 state.slotValues.join(''),
    onChangeText,
    onKeyPress,
    onFocus,
    onBlur,
    maxLength:             length,
    editable:              !state.isDisabled,
    keyboardType:          type === 'numeric' ? 'number-pad' : 'default',
    textContentType:       'oneTimeCode',
    autoComplete:          'sms-otp',
    secureTextEntry:       masked,
    caretHidden:           true,
    contextMenuHidden:     false,
    importantForAutofill:  'yes',
    spellCheck:            false,
    autoCorrect:           false,
    autoCapitalize:        'none',
    accessibilityLabel:    `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`,
    ...(autoFocus ? { autoFocus: true as const } : {}),
  }), [state.slotValues, state.isDisabled, onChangeText, onKeyPress, onFocus, onBlur, length, type, masked, autoFocus])

  return {
    slotValues:      state.slotValues,
    activeSlot:      state.activeSlot,
    isComplete:      state.isComplete,
    hasError:        state.hasError,
    hasSuccess:      state.hasSuccess,
    isDisabled:      state.isDisabled,
    isReadOnly:      state.isReadOnly,
    timerSeconds,
    timer:           timerController,
    isFocused,
    getCode,
    getSlots,
    getSlotProps,
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
  }
}

// Re-exported so consumers can build character-level invalid-char feedback
// themselves from hiddenInputProps.onChangeText diffs if desired.
export { filterChar }
