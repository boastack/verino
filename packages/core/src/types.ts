/**
 * verino/core/types
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared TypeScript interfaces and type aliases used across the core modules.
 */

/** The set of characters each slot will accept. */
export type InputType = 'numeric' | 'alphabet' | 'alphanumeric' | 'any'

/** String literal booleans used by CSS-targetable `data-*` attributes. */
export type BooleanDataAttr = 'true' | 'false'

/** Public snapshot of the OTP field state at any point in time. */
export type OTPStateSnapshot = {
  /** Current value of each slot. Empty string means unfilled. */
  readonly slotValues:   readonly string[]
  /** Index of the currently focused slot. */
  readonly activeSlot:   number
  /** Whether an error state is active. */
  readonly hasError:     boolean
  /** Whether a success state is active. Mutually exclusive with hasError — setting one clears the other. */
  readonly hasSuccess:   boolean
  /** True when every slot contains a valid character. */
  readonly isComplete:   boolean
  /** True when no slot contains a character. Note: NOT the complement of `isComplete` — a partially filled field has both `isEmpty === false` and `isComplete === false`. */
  readonly isEmpty:      boolean
  /**
   * Mirrors the initial timer value — NOT a live countdown.
   * The live countdown is managed by each adapter layer.
   * Do not use this field to read remaining time; use the `onTick` option to receive live countdown updates.
   */
  readonly timerSeconds: number
  /** Whether the input is currently disabled. Reflects the latest `setDisabled()` call. */
  readonly isDisabled:   boolean
  /** Whether the input is currently read-only. Reflects the latest `setReadOnly()` call. */
  readonly isReadOnly:   boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All event types the OTP state machine can emit.
 *
 * Use as a discriminant in `subscribe` listeners:
 * ```ts
 * import { triggerHapticFeedback } from '@verino/core/toolkit'
 *
 * otp.subscribe((state, event) => {
 *   if (event.type === 'COMPLETE') doSomething(event.value)
 * })
 * ```
 */
export type OTPEventType =
  | 'INPUT'
  | 'DELETE'
  | 'CLEAR'
  | 'PASTE'
  | 'COMPLETE'
  | 'INVALID_CHAR'
  | 'FOCUS'
  | 'BLUR'
  | 'RESET'
  | 'MOVE'
  | 'ERROR'
  | 'SUCCESS'
  | 'DISABLED'
  | 'READONLY'

/**
 * Discriminated union of every event the state machine can emit.
 * Received as the second argument in `subscribe` listeners.
 *
 * Each variant carries only the data relevant to that action, so you can
 * narrowly handle exactly what you care about without a default catch-all.
 *
 * All slot-position fields are named `index` for consistency across variants.
 *
 * @example
 * ```ts
 * otp.subscribe((state, event) => {
 *   switch (event.type) {
 *     case 'COMPLETE':     return handleComplete(event.value)
 *     case 'INVALID_CHAR': return shake(event.index)
 *     case 'INPUT':        return highlightSlot(event.index)
 *   }
 * })
 * ```
 */
export type OTPEvent =
  /** A valid character was accepted and inserted into a slot. */
  | { type: 'INPUT';        index: number; value: string }
  /** Backspace was pressed — slot cleared and cursor moved back. */
  | { type: 'DELETE';       index: number }
  /** Delete key was pressed — slot cleared in-place, cursor stays. */
  | { type: 'CLEAR';        index: number }
  /** A string was pasted; `startIndex` is the first slot written, `value` is the raw text. */
  | { type: 'PASTE';        startIndex: number; value: string }
  /**
   * All slots are now filled.
   * Emitted synchronously after INPUT/PASTE fills the last slot.
   * Use this to trigger haptic/sound feedback, start verification, etc.
   */
  | { type: 'COMPLETE';     value: string }
  /** A character was rejected by the active type/pattern filter. */
  | { type: 'INVALID_CHAR'; char: string; index: number }
  /** Logical focus moved to `index` (emitted by `focus(index)` on the instance). */
  | { type: 'FOCUS';        index: number }
  /**
   * Logical blur. `index` is the slot that was active at the time of blur
   * — useful for per-slot validation or analytics.
   */
  | { type: 'BLUR';         index: number }
  /** All slots were cleared and state was reset to initial. */
  | { type: 'RESET' }
  /** The active slot moved (arrow keys, programmatic `move(index)`). */
  | { type: 'MOVE';         index: number }
  /** Error state was toggled. */
  | { type: 'ERROR';        hasError: boolean }
  /** Success state was toggled. */
  | { type: 'SUCCESS';      hasSuccess: boolean }
  /** Disabled state was toggled. */
  | { type: 'DISABLED';     isDisabled: boolean }
  /** Read-only state was toggled. */
  | { type: 'READONLY';     isReadOnly: boolean }

// ─────────────────────────────────────────────────────────────────────────────
// SLOT ENTRY  (minimal snapshot — returned by getSlots())
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal per-slot snapshot returned by `getSlots()`.
 *
 * Prefer this over `getSlotProps` when you only need to iterate slots for
 * rendering and rely on `data-*` attributes (from `getInputProps`) for styling.
 *
 * @example
 * ```tsx
 * otp.getSlots().map((slot) => (
 *   <div key={slot.index} {...getDataAttrs(otp.getInputProps(slot.index))}>
 *     {slot.value}
 *   </div>
 * ))
 * ```
 */
export type SlotEntry = {
  /** Zero-based position of this slot. */
  readonly index:    number
  /** Current character. Empty string when unfilled. */
  readonly value:    string
  /** True when this slot is the active (focused) slot. */
  readonly isActive: boolean
  /** True when this slot contains a character. */
  readonly isFilled: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT DISPLAY DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Display data for a single visual slot.
 * Returned by `getSlotProps(index)` — use to render slot divs without
 * duplicating state derivation logic in every adapter.
 *
 * Does NOT include accessibility attributes — adapters compose those
 * on top using `getSlotId()` / `getGroupId()` / `getErrorId()`.
 */
export type SlotProps = {
  /** Stable DOM-safe id for this slot. Useful for aria-activedescendant. */
  readonly id:         string
  /** Zero-based slot index. */
  readonly index:      number
  /** Current character in this slot. `''` means unfilled. */
  readonly char:       string
  /** True when this slot contains a character. */
  readonly isFilled:   boolean
  /** True when the cursor is positioned at this slot. */
  readonly isActive:   boolean
  /** True when an error is active on the whole field. */
  readonly isError:    boolean
  /** True when a success state is active on the whole field. */
  readonly isSuccess:  boolean
  /** True when every slot is filled. */
  readonly isComplete: boolean
  /** True when this slot is empty (`char === ''`). */
  readonly isEmpty:    boolean
  /** True when the field is disabled. */
  readonly isDisabled: boolean
  /** True when the field is read-only. */
  readonly isReadOnly: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT PROPS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Framework-agnostic event handlers returned by `getInputProps(slotIndex)`.
 *
 * Wire these to a real DOM element (or a framework's synthetic event system)
 * without writing any adapter-specific event handling logic yourself:
 *
 * @example — framework-agnostic wiring
 * ```ts
 * const props = otp.getInputProps(otp.state.activeSlot)
 *
 * inputElement.oninput   = (e) => props.onInput((e.target as HTMLInputElement).value.slice(-1))
 * inputElement.onkeydown = (e) => props.onKeyDown(e.key)
 * inputElement.onfocus   = props.onFocus
 * inputElement.onblur    = props.onBlur
 * ```
 *
 * @example — React
 * ```tsx
 * const props = otp.getInputProps(otp.state.activeSlot)
 * <input
 *   value={props.value}
 *   onKeyDown={(e) => props.onKeyDown(e.key)}
 *   onFocus={props.onFocus}
 *   onBlur={props.onBlur}
 * />
 * ```
 */
export type InputProps = {
  /** Current character in this slot. Empty string when unfilled. */
  readonly value:     string
  /**
   * Call with a single typed character from an input or keypress event.
   * The core validates, filters, inserts, and advances the cursor automatically.
   * Invalid characters (per `type` / `pattern`) are silently ignored.
   */
  readonly onInput:   (char: string) => void
  /**
   * Call with `e.key` from a keydown event.
   * Handles: `'Backspace'` (clear + step back), `'Delete'` (clear in-place),
   * `'ArrowLeft'` (move cursor left), `'ArrowRight'` (move cursor right).
   * All other keys are silently ignored — no need to filter in the adapter.
   */
  readonly onKeyDown: (key: string) => void
  /**
   * Call when this slot receives focus.
   * Emits a `FOCUS` event to all subscribers without changing state.
   */
  readonly onFocus:   () => void
  /**
   * Call when this slot loses focus.
   * Emits a `BLUR` event to all subscribers without changing state.
   */
  readonly onBlur:    () => void
  /**
   * Zero-based position of this slot.
   * CSS: [data-slot="0"] { border-radius: 8px 0 0 8px }
   */
  readonly 'data-slot':     number
  /**
   * `"true"` when this slot is at the logical cursor position
   * (i.e. `state.activeSlot === index`). Always reflects the cursor, even when
   * the field does not have browser focus.
   * CSS: [data-active="true"] { border-color: #3D3D3D }
   * Note: adapters that track browser focus should combine this with their own
   * focus state — e.g. `[data-active="true"][data-focus="true"]` — and inject
   * `data-focus` themselves since the pure core has no DOM access.
   */
  readonly 'data-active':   BooleanDataAttr
  /**
   * `"true"` when this slot contains a character.
   * Always the inverse of `data-empty` — the two are mutually exclusive and
   * exhaustive: exactly one is `"true"` for any slot at any time.
   * CSS: [data-filled="true"] { background: white }
   */
  readonly 'data-filled':   BooleanDataAttr
  /**
   * `"true"` when this slot is empty (no character).
   * Always the inverse of `data-filled` — the two are mutually exclusive and
   * exhaustive: exactly one is `"true"` for any slot at any time.
   * CSS: [data-empty="true"] { opacity: 0.4 }
   */
  readonly 'data-empty':    BooleanDataAttr
  /**
   * `"true"` when every slot in the field is filled.
   * CSS: [data-complete="true"] { border-color: green }
   */
  readonly 'data-complete': BooleanDataAttr
  /**
   * `"true"` when the entire field is in an error state.
   * CSS: [data-invalid="true"] { border-color: red }
   */
  readonly 'data-invalid':  BooleanDataAttr
  /**
   * `"true"` when the entire field is in a success state.
   * CSS: [data-success="true"] { border-color: green }
   */
  readonly 'data-success':  BooleanDataAttr
  /**
   * `"true"` when the field is disabled — all mutations are blocked.
   * CSS: [data-disabled="true"] { opacity: 0.5; cursor: not-allowed }
   */
  readonly 'data-disabled': BooleanDataAttr
  /**
   * `"true"` when the field is read-only — value visible but not editable.
   * CSS: [data-readonly="true"] { background: #f5f5f5 }
   */
  readonly 'data-readonly': BooleanDataAttr
  /**
   * `"true"` for slot 0 — the first slot in the field.
   * CSS: [data-first="true"] { border-radius: 8px 0 0 8px }
   */
  readonly 'data-first':    BooleanDataAttr
  /**
   * `"true"` for the last slot in the field.
   * CSS: [data-last="true"] { border-radius: 0 8px 8px 0 }
   */
  readonly 'data-last':     BooleanDataAttr
}

/** Extra `data-*` state injected by adapters that track browser focus. */
export type FocusDataAttrs = {
  readonly 'data-focus': BooleanDataAttr
}

/** Reusable slot-level `data-*` attributes returned by `getInputProps()`. */
export type OTPDataAttrs = Pick<
  InputProps,
  | 'data-slot'
  | 'data-active'
  | 'data-filled'
  | 'data-empty'
  | 'data-complete'
  | 'data-invalid'
  | 'data-success'
  | 'data-disabled'
  | 'data-readonly'
  | 'data-first'
  | 'data-last'
>

export type WrapperDataAttrName =
  | 'data-complete'
  | 'data-invalid'
  | 'data-success'
  | 'data-disabled'
  | 'data-readonly'

/** Wrapper-level state attributes used by adapters for CSS/Tailwind targeting. */
export type WrapperDataAttrs = Partial<Record<WrapperDataAttrName, ''>>

/** Shared hidden-input attribute bag used by JS-property based adapters. */
export type HiddenInputAttrs = {
  readonly type:             'text' | 'password'
  readonly inputMode:        'numeric' | 'text'
  readonly autoComplete:     'one-time-code'
  readonly maxLength:        number
  readonly disabled:         boolean
  readonly name?:            string
  readonly autoFocus?:       true
  readonly 'aria-label':     string
  readonly 'aria-readonly'?: 'true'
  readonly spellCheck:       false
  readonly autoCorrect:      'off'
  readonly autoCapitalize:   'off'
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listener function invoked after every state mutation in `createOTP`.
 *
 * Receives a shallow-copy snapshot of the new state plus the event that
 * triggered the update. The `event` parameter is fully typed as a
 * discriminated union — narrowing on `event.type` gives you precise access
 * to event-specific data without any casting.
 *
 * The extra `event` parameter is backwards-compatible: listeners that only
 * accept `state` continue to work without modification.
 *
 * @example
 * ```ts
 * // State only (still works)
 * otp.subscribe(state => render(state))
 *
 * // State + event (new pattern — full event data)
 * otp.subscribe((state, event) => {
 *   render(state)
 *   if (event.type === 'COMPLETE') triggerHapticFeedback()
 * })
 * ```
 */
export type StateListener = (state: OTPStateSnapshot, event: OTPEvent) => void

// ─────────────────────────────────────────────────────────────────────────────
// TIMER
// ─────────────────────────────────────────────────────────────────────────────

/** Options for the standalone `createTimer` utility. */
export type TimerOptions = {
  /** Total countdown duration in seconds. */
  totalSeconds:   number
  /** Called every second with the remaining seconds. */
  onTick?:        (remainingSeconds: number) => void
  /** Called when the countdown reaches zero. */
  onExpire?:      () => void
  /**
   * When `true`, `onTick` fires immediately with `totalSeconds` on `start()` —
   * before the first interval tick — so callers can display the initial value
   * without polling state separately.
   */
  emitInitialTickOnStart?:   boolean
  /**
   * When `true`, `onTick` fires immediately with `totalSeconds` on `restart()`.
   * Defaults to the value of `emitInitialTickOnStart` when omitted.
   */
  emitInitialTickOnRestart?: boolean
}

/** Controls returned by `createTimer`. */
export type TimerControls = {
  /** Start the countdown. */
  start:   () => void
  /** Stop and pause the countdown. */
  stop:    () => void
  /** Reset remaining time back to `totalSeconds` without starting. */
  reset:   () => void
  /** Reset and immediately start again. */
  restart: () => void
}

/** Adapter-side feedback controls powered by the toolkit layer. */
export type FeedbackOptions = {
  /** Trigger haptic feedback (via `navigator.vibrate`) on completion and error. */
  haptic?: boolean
  /** Play a short tone (via Web Audio API) on completion. */
  sound?:  boolean
}

/** Adapter-side countdown callbacks. The pure core does not run timers. */
export type TimerUIOptions = {
  /** Called every second with the remaining seconds. */
  onTick?:   (remainingSeconds: number) => void
  /** Called when the countdown reaches zero. */
  onExpire?: () => void
}

/** Adapter-side resend UI options. The pure core does not render resend controls. */
export type ResendUIOptions = {
  /** Resend cooldown in seconds after the user clicks Resend. Default: `30`. */
  resendAfter?: number
  /** Called when the resend action is triggered. */
  onResend?:   () => void
}

/** Shared adapter-only field behavior that sits above the pure machine. */
export type FieldBehaviorOptions = {
  /**
   * Auto-focus the hidden input when the component mounts.
   * Set to `false` to prevent the field from stealing focus on load.
   * Default: `true`.
   */
  autoFocus?: boolean
  /**
   * The `name` attribute to set on the hidden input for native HTML form
   * submission and `FormData` compatibility.
   * @example name: 'otp'  →  FormData includes otp=123456
   */
  name?: string
  /**
   * Called when the hidden input gains browser focus.
   * Use to show contextual help or update surrounding UI.
   */
  onFocus?: () => void
  /**
   * Called when the hidden input loses browser focus.
   * Use to trigger validation or hide contextual help.
   */
  onBlur?: () => void
  /**
   * Character to display in empty (unfilled) slots as a visual hint.
   * Common choices: `'○'`, `'_'`, `'·'`, `'•'`.
   * Default: `''` (blank — no placeholder).
   * @example placeholder: '○'
   */
  placeholder?: string
  /**
   * When `true`, focusing a slot that already contains a character selects that
   * character so the next keystroke replaces it in-place.
   * When `false` (default), the cursor is placed at the slot position and the
   * existing character must be deleted before a new one can be entered.
   * Default: `false`.
   */
  selectOnFocus?: boolean
  /**
   * When `true`, the hidden input is automatically blurred when all slots are
   * filled. Removes focus styling and hides the fake caret once the code is
   * complete. Useful for flows that immediately submit or verify on completion.
   * Default: `false`.
   */
  blurOnComplete?: boolean
  /**
   * Uncontrolled initial value applied once on mount.
   * Distributed across slots exactly like user input but does NOT trigger
   * `onComplete` or fire change events. Ignored when a `value` prop is present.
   * Default: `undefined` (no pre-fill).
   */
  defaultValue?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Runtime behavior accepted by the pure `createOTP()` state machine. */
export type CoreBehaviorOptions = {
  /** Number of input slots. Default: `6`. */
  length?:       number
  /**
   * Optional stable prefix used by `getSlotId()`, `getGroupId()`, and
   * `getErrorId()`.
   *
   * Provide this in SSR or multi-request environments when you need IDs to be
   * deterministic beyond the process-local fallback counter.
   *
   * @example idBase: 'checkout-otp'
   */
  idBase?:       string
  /** Character set accepted by each slot. Default: `'numeric'`. */
  type?:         InputType
  /** Countdown duration in seconds. `0` disables the timer. Default: `0`. */
  timer?:        number
  /**
   * When `true`, all input actions (typing, backspace, paste) are silently ignored.
   * Use this during async verification to prevent the user modifying the code.
   * Default: `false`.
   */
  disabled?:     boolean
  /**
   * When `true`, all slot mutations (typing, backspace, delete, paste) are
   * blocked while focus, selection, arrow navigation, and copy remain allowed.
   * Semantically distinct from `disabled` — the field is readable and focusable.
   * Default: `false`.
   */
  readOnly?:     boolean
  /**
   * Arbitrary per-character regex. When provided, each typed/pasted character must
   * match this pattern to be accepted into a slot.
   *
   * Takes precedence over the named `type` for character validation only —
   * `type` still controls `inputMode` and ARIA labels on the hidden input.
   *
   * The regex should match a **single character**:
   * @example pattern: /^[0-9A-F]$/   — uppercase hex only
   * @example pattern: /^[2-9A-HJ-NP-Z]$/  — ambiguity-free alphanumeric (no 0/O, 1/I/L)
   */
  pattern?:      RegExp
  /**
   * Optional transform applied to the raw clipboard text before it is filtered
   * and distributed into slots. Runs before `filterString` inside `pasteString()`.
   *
   * Use to strip formatting from pasted codes that real users copy from emails or
   * SMS messages (e.g. `"G-123456"` → `"123456"`, `"123 456"` → `"123456"`).
   *
   * The return value is then passed through the normal `filterString` + `pattern`
   * validation, so you only need to handle the structural formatting — character
   * validity is still enforced automatically.
   *
   * @example pasteTransformer: (raw) => raw.replace(/\s+|-/g, '')
   * @example pasteTransformer: (raw) => raw.toUpperCase()
   */
  pasteTransformer?: (raw: string) => string
}

/** Pure machine callbacks accepted by `createOTP()`. */
export type CoreCallbackOptions = {
  /** Called with the joined code string when all slots are filled. */
  onComplete?:   (code: string) => void
  /**
   * Called when the user types or pastes a character that is rejected by the
   * current `type` or `pattern` filter.
   *
   * Receives the raw rejected character and the zero-based slot index where
   * entry was attempted. Use to display inline feedback such as
   * "Only digits are allowed" or highlight the offending slot.
   *
   * @example
   * onInvalidChar: (char, index) => console.warn(`Rejected "${char}" at slot ${index}`)
   */
  onInvalidChar?: (char: string, index: number) => void
}

/** Configuration options accepted by the pure `createOTP()` state machine. */
export type CoreOTPOptions = CoreBehaviorOptions & CoreCallbackOptions

/** Adapter-facing configuration options passed to `initOTP()` and framework wrappers. */
export type OTPOptions =
  & CoreOTPOptions
  & TimerUIOptions
  & ResendUIOptions
  & FeedbackOptions
  & FieldBehaviorOptions

/** Public control surface returned by `createOTP()`. */
export type OTPInstance = {
  readonly state: OTPStateSnapshot
  insert:      (char: string, slotIndex: number) => OTPStateSnapshot
  delete:      (slotIndex: number) => OTPStateSnapshot
  clear:       (slotIndex: number) => OTPStateSnapshot
  paste:       (text: string, cursorSlot?: number) => OTPStateSnapshot
  move:        (slotIndex: number) => OTPStateSnapshot
  focus:       (slotIndex: number) => void
  blur:        () => void
  setError:    (isError: boolean) => OTPStateSnapshot
  setSuccess:  (isSuccess: boolean) => OTPStateSnapshot
  reset:       () => OTPStateSnapshot
  setDisabled: (value: boolean) => void
  setReadOnly: (value: boolean) => void
  destroy:     () => void
  getCode:     () => string
  getSnapshot: () => OTPStateSnapshot
  getSlots:    () => readonly SlotEntry[]
  getSlotProps:(index: number) => SlotProps
  getInputProps:(slotIndex: number) => InputProps
  getSlotId:   (index: number) => string
  getGroupId:  () => string
  getErrorId:  () => string
  subscribe:   (listener: StateListener) => () => void
}
