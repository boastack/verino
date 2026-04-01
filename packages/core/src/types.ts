/**
 * verino/core/types
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared TypeScript interfaces and type aliases used across the core modules.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

/** The set of characters each slot will accept. */
export type InputType = 'numeric' | 'alphabet' | 'alphanumeric' | 'any'

/** Snapshot of the OTP field state at any point in time. */
export type OTPState = {
  /** Current value of each slot. Empty string means unfilled. */
  slotValues:   string[]
  /** Index of the currently focused slot. */
  activeSlot:   number
  /** Whether an error state is active. */
  hasError:     boolean
  /** Whether a success state is active. Mutually exclusive with hasError — setting one clears the other. */
  hasSuccess:   boolean
  /** True when every slot contains a valid character. */
  isComplete:   boolean
  /** True when no slot contains a character. Note: NOT the complement of `isComplete` — a partially filled field has both `isEmpty === false` and `isComplete === false`. */
  isEmpty:      boolean
  /**
   * Mirrors the initial timer value — NOT a live countdown.
   * The live countdown is managed by each adapter layer.
   * Do not use this field to read remaining time; use the `onTick` option to receive live countdown updates.
   */
  timerSeconds: number
  /** Whether the input is currently disabled. Reflects the latest `setDisabled()` call. */
  isDisabled:   boolean
  /** Whether the input is currently read-only. Reflects the latest `setReadOnly()` call. */
  isReadOnly:   boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All event types the OTP state machine can emit.
 *
 * Use as a discriminant in `subscribe` listeners:
 * ```ts
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
  index:    number
  /** Current character. Empty string when unfilled. */
  value:    string
  /** True when this slot is the active (focused) slot. */
  isActive: boolean
  /** True when this slot contains a character. */
  isFilled: boolean
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
  id:         string
  /** Zero-based slot index. */
  index:      number
  /** Current character in this slot. `''` means unfilled. */
  char:       string
  /** True when this slot contains a character. */
  isFilled:   boolean
  /** True when the cursor is positioned at this slot. */
  isActive:   boolean
  /** True when an error is active on the whole field. */
  isError:    boolean
  /** True when a success state is active on the whole field. */
  isSuccess:  boolean
  /** True when every slot is filled. */
  isComplete: boolean
  /** True when this slot is empty (`char === ''`). */
  isEmpty:    boolean
  /** True when the field is disabled. */
  isDisabled: boolean
  /** True when the field is read-only. */
  isReadOnly: boolean
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
  value:     string
  /**
   * Call with a single typed character from an input or keypress event.
   * The core validates, filters, inserts, and advances the cursor automatically.
   * Invalid characters (per `type` / `pattern`) are silently ignored.
   */
  onInput:   (char: string) => void
  /**
   * Call with `e.key` from a keydown event.
   * Handles: `'Backspace'` (clear + step back), `'Delete'` (clear in-place),
   * `'ArrowLeft'` (move cursor left), `'ArrowRight'` (move cursor right).
   * All other keys are silently ignored — no need to filter in the adapter.
   */
  onKeyDown: (key: string) => void
  /**
   * Call when this slot receives focus.
   * Emits a `FOCUS` event to all subscribers without changing state.
   */
  onFocus:   () => void
  /**
   * Call when this slot loses focus.
   * Emits a `BLUR` event to all subscribers without changing state.
   */
  onBlur:    () => void
  /**
   * Zero-based position of this slot.
   * CSS: [data-slot="0"] { border-radius: 8px 0 0 8px }
   */
  'data-slot':     number
  /**
   * `"true"` when this slot is at the logical cursor position
   * (i.e. `state.activeSlot === index`). Always reflects the cursor, even when
   * the field does not have browser focus.
   * CSS: [data-active="true"] { border-color: #3D3D3D }
   * Note: adapters that track browser focus should combine this with their own
   * focus state — e.g. `[data-active="true"][data-focus="true"]` — and inject
   * `data-focus` themselves since the pure core has no DOM access.
   */
  'data-active':   'true' | 'false'
  /**
   * `"true"` when this slot contains a character.
   * Always the inverse of `data-empty` — the two are mutually exclusive and
   * exhaustive: exactly one is `"true"` for any slot at any time.
   * CSS: [data-filled="true"] { background: white }
   */
  'data-filled':   'true' | 'false'
  /**
   * `"true"` when this slot is empty (no character).
   * Always the inverse of `data-filled` — the two are mutually exclusive and
   * exhaustive: exactly one is `"true"` for any slot at any time.
   * CSS: [data-empty="true"] { opacity: 0.4 }
   */
  'data-empty':    'true' | 'false'
  /**
   * `"true"` when every slot in the field is filled.
   * CSS: [data-complete="true"] { border-color: green }
   */
  'data-complete': 'true' | 'false'
  /**
   * `"true"` when the entire field is in an error state.
   * CSS: [data-invalid="true"] { border-color: red }
   */
  'data-invalid':  'true' | 'false'
  /**
   * `"true"` when the entire field is in a success state.
   * CSS: [data-success="true"] { border-color: green }
   */
  'data-success':  'true' | 'false'
  /**
   * `"true"` when the field is disabled — all mutations are blocked.
   * CSS: [data-disabled="true"] { opacity: 0.5; cursor: not-allowed }
   */
  'data-disabled': 'true' | 'false'
  /**
   * `"true"` when the field is read-only — value visible but not editable.
   * CSS: [data-readonly="true"] { background: #f5f5f5 }
   */
  'data-readonly': 'true' | 'false'
  /**
   * `"true"` for slot 0 — the first slot in the field.
   * CSS: [data-first="true"] { border-radius: 8px 0 0 8px }
   */
  'data-first':    'true' | 'false'
  /**
   * `"true"` for the last slot in the field.
   * CSS: [data-last="true"] { border-radius: 0 8px 8px 0 }
   */
  'data-last':     'true' | 'false'
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
export type StateListener = (state: OTPState, event: OTPEvent) => void

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

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Configuration options passed to `createOTP` or `initOTP`. */
export type OTPOptions = {
  /** Number of input slots. Default: `6`. */
  length?:       number
  /** Character set accepted by each slot. Default: `'numeric'`. */
  type?:         InputType
  /** Countdown duration in seconds. `0` disables the timer. Default: `0`. */
  timer?:        number
  /** Resend cooldown in seconds after the user clicks Resend. Default: `30`. */
  resendAfter?:  number
  /** Called with the joined code string when all slots are filled. */
  onComplete?:   (code: string) => void
  /**
   * Called every second with the remaining seconds. Use to drive a custom timer UI.
   *
   * **Adapter note:** Only fires in adapters that include a built-in countdown timer
   * (vanilla, alpine, web component). In React, Vue, and Svelte the timer is managed
   * separately inside each adapter — pass `onTick` as part of those adapters' options.
   * Has no effect when passed directly to `createOTP`.
   */
  onTick?:       (remainingSeconds: number) => void
  /** Called when the countdown reaches zero. */
  onExpire?:     () => void
  /**
   * Called when the resend action is triggered.
   *
   * **Adapter note:** Only fires automatically in adapters with a built-in Resend button
   * (vanilla, alpine, web component). In React, Vue, and Svelte there is no built-in
   * Resend button — call `onResend` manually in your own UI handler.
   * Has no effect when passed directly to `createOTP`.
   */
  onResend?:     () => void
  /**
   * Trigger haptic feedback (via `navigator.vibrate`) on completion and error.
   * Handled by each adapter via the event system — the core emits events and
   * adapters call `triggerHapticFeedback()` in response.
   * Default: `true`.
   */
  haptic?:       boolean
  /**
   * Play a short tone (via Web Audio API) on completion.
   * Handled by each adapter via the event system — the core emits events and
   * adapters call `triggerSoundFeedback()` in response.
   * Default: `false`.
   */
  sound?:        boolean
  /**
   * When `true`, all input actions (typing, backspace, paste) are silently ignored.
   * Use this during async verification to prevent the user modifying the code.
   * Default: `false`.
   */
  disabled?:     boolean
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
  /**
   * When `true`, all slot mutations (typing, backspace, delete, paste) are
   * blocked while focus, selection, arrow navigation, and copy remain allowed.
   * Semantically distinct from `disabled` — the field is readable and focusable.
   * Default: `false`.
   */
  readOnly?: boolean
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
