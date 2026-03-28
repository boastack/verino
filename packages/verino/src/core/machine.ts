/**
 * verino/core/machine
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure OTP state machine — zero DOM, zero framework, zero side effects.
 *
 * ARCHITECTURE
 * ────────────
 * A pure state machine: accepts actions, mutates state through a single
 * pipeline, and notifies subscribers. No DOM, no timers, no haptics, no sound.
 * All side effects belong in adapters.
 *
 * MUTATION PIPELINE
 * ─────────────────
 * Every state change flows through one path:
 *
 *   action → applyState(patch, event) → state updated → emit(event) → subscribers
 *
 * No action mutates state directly. No event fires without a state update.
 * No state update happens without an event. The pipeline is the only door.
 *
 * EVENT SYSTEM
 * ────────────
 * Every mutation emits a typed event as the second argument to subscribers:
 *
 *   otp.subscribe((state, event) => {
 *     if (event.type === 'COMPLETE')     triggerHapticFeedback()
 *     if (event.type === 'INVALID_CHAR') shake(event.index)
 *     if (event.type === 'BLUR')         validateSlot(event.index)
 *   })
 *
 * IDENTITY SYSTEM
 * ───────────────
 * Each createOTP call gets a stable instance id. Use these helpers for
 * deterministic, collision-free DOM ids:
 *
 *   otp.getSlotId(2)  → 'verino-1-slot-2'
 *   otp.getGroupId()  → 'verino-1-group'
 *   otp.getErrorId()  → 'verino-1-error'
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import type {
  OTPOptions,
  OTPState,
  OTPEvent,
  StateListener,
  InputType,
  InputProps,
  SlotProps,
  SlotEntry,
} from './types.js'
import { filterChar, filterString } from './filter.js'


// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL COUNTER
// ─────────────────────────────────────────────────────────────────────────────

// Generates unique instance IDs within a single JavaScript execution context
// (browser tab, Node.js process, or Web Worker). IDs are NOT collision-free
// across concurrent SSR requests that share a module cache — use a unique
// wrapper key (e.g. React key, route id) to isolate instances in those cases.
let _instanceCounter = 0


// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS (module-scoped, stateless)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clamp `n` to the inclusive range `[min, max]`.
 *
 * Used to prevent the active slot cursor from escaping the `[0, length − 1]` bounds
 * during arrow-key navigation, paste, and programmatic `move()` calls.
 */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Derive `isComplete` and `isEmpty` from `slotValues` in a single linear pass.
 *
 * Centralises all derived-boolean logic — no scattered per-action derivations.
 * Called once per mutation; the result is spread directly into the state patch
 * passed to `applyState`.
 *
 * @param slotValues - The current slot value array (may be mutated in-place before this call).
 * @param length     - The number of slots (equal to `slotValues.length`).
 */
function computeDerivedState(
  slotValues: string[],
  length: number,
): { isComplete: boolean; isEmpty: boolean } {
  let filled = 0
  for (const v of slotValues) if (v.length === 1) filled++
  return {
    isComplete: filled === length,
    isEmpty:    filled === 0,
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a pure OTP state machine.
 *
 * All state lives in a single OTPState object. Every mutation goes through
 * `applyState`, which updates state then fires `emit`. Subscribers always
 * receive a cloned snapshot — internal state is never directly exposed.
 *
 * Safe to instantiate in Node.js, SSR, Web Workers, and browsers alike.
 */
export function createOTP(options: OTPOptions = {}) {

  // ── Instance identity ───────────────────────────────────────────────────────
  const instanceId = `verino-${++_instanceCounter}`

  // ── Length guard — parseInt('', 10) from a missing data-attr yields NaN ────
  const rawLength = options.length ?? 6
  const length    = Number.isNaN(rawLength) ? 6 : Math.max(1, Math.floor(rawLength))

  // ── Options extracted once — closures hold stable references ───────────────
  const {
    type             = 'numeric' as InputType,
    pattern,
    onComplete,
    onInvalidChar,
    pasteTransformer,
  } = options

  // ── State — the single source of truth ─────────────────────────────────────
  //
  // isDisabled and isReadOnly live here. There are NO separate `disabled` /
  // `readOnly` closure vars. Action guards read state.isDisabled and
  // state.isReadOnly directly — one source of truth, no split-brain window.
  //
  let state: OTPState = {
    slotValues:   Array(length).fill('') as string[],
    activeSlot:   0,
    hasError:     false,
    hasSuccess:   false,
    isComplete:   false,
    isEmpty:      true,
    timerSeconds: options.timer ?? 0,
    isDisabled:   options.disabled ?? false,
    isReadOnly:   options.readOnly ?? false,
  }

  // ── Subscriber set ──────────────────────────────────────────────────────────
  const listeners = new Set<StateListener>()


  // ── MUTATION PIPELINE ───────────────────────────────────────────────────────

  // Monotonically-incrementing counter bumped by every applyState call.
  // getSlots() compares against this to avoid recomputing on every call
  // within the same render cycle. A version counter (vs. array reference)
  // is required because slotValues is mutated in-place before applyState,
  // so the array reference never changes across insert/delete/clear operations.
  let _mutVersion   = 0
  let _slotsVersion = -1
  let _slotsCache:  SlotEntry[] = []

  /**
   * Notify all subscribers with a snapshot of the current state and the event
   * that triggered the change.
   *
   * The snapshot clones slotValues so subscribers cannot corrupt live state
   * through array mutation. Called exclusively from applyState (and directly
   * for zero-patch events: COMPLETE, INVALID_CHAR, FOCUS, BLUR).
   */
  function emit(event: OTPEvent): void {
    if (listeners.size === 0) return
    const snapshot: OTPState = { ...state, slotValues: [...state.slotValues] }
    listeners.forEach(fn => fn(snapshot, event))
  }

  /**
   * Apply a partial state patch then emit the triggering event.
   *
   * This is the ONLY place the `state` reference itself is replaced.
   * (Note: `slotValues` may be mutated in-place before this call — e.g. in
   * `insert()` — but the state object reference is always replaced here.)
   * Every action calls applyState; nothing assigns to `state` directly.
   */
  function applyState(patch: Partial<OTPState>, event: OTPEvent): OTPState {
    state = { ...state, ...patch }
    _mutVersion++
    emit(event)
    return state
  }


  // ── ACTIONS ─────────────────────────────────────────────────────────────────

  /**
   * Insert a single character into `slotIndex`.
   *
   * - Invalid characters emit INVALID_CHAR and leave slots unchanged.
   * - When the last slot fills, COMPLETE fires synchronously after INPUT.
   * - Out-of-bounds indices are ignored to prevent sparse-array corruption.
   */
  function insert(char: string, slotIndex: number): OTPState {
    if (state.isDisabled || state.isReadOnly) return state
    if (slotIndex < 0 || slotIndex >= length) return state

    const validChar = filterChar(char, type, pattern)

    if (!validChar) {
      if (char.length === 1) onInvalidChar?.(char, slotIndex)

      // INVALID_CHAR fires exactly once per rejection regardless of cursor position.
      // When the cursor needs to move, fold the cursor update into the same event
      // so subscribers receive one coherent notification — not a separate MOVE.
      if (state.activeSlot !== slotIndex) {
        return applyState(
          { activeSlot: slotIndex },
          { type: 'INVALID_CHAR', char: char || '', index: slotIndex },
        )
      }
      emit({ type: 'INVALID_CHAR', char: char || '', index: slotIndex })
      return state
    }

    // Capture completion state BEFORE mutation so the COMPLETE guard below
    // can distinguish a transition (false → true) from an already-complete
    // re-fill. Without this, typing over a filled slot fires COMPLETE again
    // on every keystroke.
    const wasComplete = state.isComplete

    // Mutate the internal array directly — no working-copy clone needed.
    // emit() clones slotValues when building the subscriber snapshot, which
    // is the only clone that matters for external safety.
    state.slotValues[slotIndex] = validChar

    const nextSlot = slotIndex < length - 1 ? slotIndex + 1 : length - 1
    const derived  = computeDerivedState(state.slotValues, length)

    // slotValues is already updated in-place; omit it from the patch so
    // applyState does not allocate a second array reference.
    const newState = applyState(
      { activeSlot: nextSlot, hasError: false, ...derived },
      { type: 'INPUT', index: slotIndex, value: validChar },
    )

    // COMPLETE fires synchronously — no setTimeout. Guard with !wasComplete
    // so it fires only on the false→true transition, never on re-fills of an
    // already-complete field.
    if (derived.isComplete && !wasComplete) {
      const code = state.slotValues.join('')
      emit({ type: 'COMPLETE', value: code })
      onComplete?.(code)
    }

    return newState
  }

  /**
   * Backspace at `slotIndex`.
   *
   * If the current slot is filled, clears it and leaves the cursor there.
   * If the current slot is empty, clears the previous slot and moves back.
   */
  function deleteSlot(slotIndex: number): OTPState {
    if (state.isDisabled || state.isReadOnly) return state
    if (slotIndex < 0 || slotIndex >= length) return state

    if (state.slotValues[slotIndex]) {
      state.slotValues[slotIndex] = ''
      const { isEmpty } = computeDerivedState(state.slotValues, length)
      return applyState(
        { activeSlot: slotIndex, isComplete: false, isEmpty },
        { type: 'DELETE', index: slotIndex },
      )
    }

    const prevSlot = clamp(slotIndex - 1, 0, length - 1)
    state.slotValues[prevSlot] = ''
    const { isEmpty } = computeDerivedState(state.slotValues, length)
    return applyState(
      { activeSlot: prevSlot, isComplete: false, isEmpty },
      { type: 'DELETE', index: slotIndex },
    )
  }

  /**
   * Delete-key at `slotIndex` — clears the slot in-place, cursor does not move.
   *
   * Distinct from backspace: no backward step, no previous-slot fallback.
   */
  function clearSlot(slotIndex: number): OTPState {
    if (state.isDisabled || state.isReadOnly) return state
    if (slotIndex < 0 || slotIndex >= length) return state
    if (!state.slotValues[slotIndex]) return state

    state.slotValues[slotIndex] = ''
    const { isEmpty } = computeDerivedState(state.slotValues, length)
    return applyState(
      { activeSlot: slotIndex, isComplete: false, isEmpty },
      { type: 'CLEAR', index: slotIndex },
    )
  }

  /**
   * Move the cursor to `slotIndex`, clamped to [0, length − 1].
   */
  function move(slotIndex: number): OTPState {
    const index = clamp(slotIndex, 0, length - 1)
    return applyState({ activeSlot: index }, { type: 'MOVE', index })
  }

  /**
   * Distribute a pasted string starting at `cursorSlot`.
   *
   * - Fills forward sequentially; never wraps.
   * - Characters beyond the last slot are silently dropped.
   * - Invalid characters are filtered out; onInvalidChar fires for each.
   * - Cursor lands on the last slot that was actually written.
   * - COMPLETE fires synchronously if all slots are filled.
   *
   * @example (length=6, type='numeric')
   *   paste('123456', 0) → fills slots 0–5, cursor on 5
   *   paste('123',    0) → fills slots 0–2, cursor on 2
   *   paste('123',    4) → fills slots 4–5 with '1','2'; '3' dropped; cursor on 5
   *   paste('84AB91', 0) → filtered='8491', fills slots 0–3, cursor on 3
   */
  function pasteString(cursorSlot: number, rawText: string): OTPState {
    if (state.isDisabled || state.isReadOnly) return state

    const startSlot = clamp(cursorSlot, 0, length - 1)

    let transformed: string
    try {
      transformed = pasteTransformer ? pasteTransformer(rawText) : rawText
    } catch (err) {
      console.warn('[verino] pasteTransformer threw — using raw paste text.', err)
      transformed = rawText
    }

    if (onInvalidChar && transformed) {
      // Walk the transformed string in parallel with a slot cursor to report
      // each rejected character at the slot index it would have been placed in.
      // Valid chars advance `cursor` (consuming a slot); invalid chars fire
      // onInvalidChar at the current cursor position without advancing it —
      // i.e. the next valid char would still land in the same slot.
      let cursor = startSlot
      for (const char of Array.from(transformed)) {
        if (cursor >= length) break
        if (filterChar(char, type, pattern)) cursor++
        else onInvalidChar(char, cursor)
      }
    }

    const validChars = filterString(transformed, type, pattern)
    if (!validChars) return state

    const wasComplete = state.isComplete
    const writeCount  = Math.min(validChars.length, length - startSlot)

    for (let i = 0; i < writeCount; i++) {
      state.slotValues[startSlot + i] = validChars[i]
    }

    const lastWritten = startSlot + writeCount - 1
    const derived     = computeDerivedState(state.slotValues, length)

    const newState = applyState(
      { activeSlot: lastWritten, hasError: false, ...derived },
      { type: 'PASTE', startIndex: startSlot, value: rawText },
    )

    if (derived.isComplete && !wasComplete) {
      const code = state.slotValues.join('')
      emit({ type: 'COMPLETE', value: code })
      onComplete?.(code)
    }

    return newState
  }

  /** Toggle error state. Clears hasSuccess when setting error. Emits ERROR. */
  function setError(isError: boolean): OTPState {
    return applyState(
      { hasError: isError, ...(isError ? { hasSuccess: false } : {}) },
      { type: 'ERROR', hasError: isError },
    )
  }

  /** Toggle success state. Clears hasError when setting success. Emits SUCCESS. */
  function setSuccess(isSuccess: boolean): OTPState {
    return applyState(
      { hasSuccess: isSuccess, ...(isSuccess ? { hasError: false } : {}) },
      { type: 'SUCCESS', hasSuccess: isSuccess },
    )
  }

  /**
   * Clear all slots and return to initial state.
   *
   * Preserves isDisabled and isReadOnly — reset is a content operation,
   * not an access-control operation.
   */
  function reset(): OTPState {
    return applyState(
      {
        slotValues:   Array(length).fill('') as string[],
        activeSlot:   0,
        hasError:     false,
        hasSuccess:   false,
        isComplete:   false,
        isEmpty:      true,
        timerSeconds: options.timer ?? 0,
      },
      { type: 'RESET' },
    )
  }

  /**
   * Release all subscribers and cancel any pending state.
   *
   * Call this when the OTP instance is no longer needed (e.g. component unmount,
   * SPA route tear-down). After destroy(), subscribe() is a no-op.
   */
  function destroy(): void {
    listeners.clear()
  }

  /**
   * Toggle disabled at runtime.
   *
   * State is the single source of truth — there is no separate `disabled`
   * closure variable. All action guards read state.isDisabled directly.
   */
  function setDisabled(value: boolean): void {
    applyState({ isDisabled: value }, { type: 'DISABLED', isDisabled: value })
  }

  /**
   * Toggle readOnly at runtime.
   *
   * When true, slot mutations (insert, delete, clear, paste) are blocked.
   * Focus and navigation remain available.
   */
  function setReadOnly(value: boolean): void {
    applyState({ isReadOnly: value }, { type: 'READONLY', isReadOnly: value })
  }

  /**
   * Emit a FOCUS event. Does not change state.
   * Adapters call this from the hidden input's focus handler.
   */
  function focus(slotIndex: number): void {
    emit({ type: 'FOCUS', index: clamp(slotIndex, 0, length - 1) })
  }

  /**
   * Emit a BLUR event. Does not change state.
   * `index` is the slot that was active at the moment of blur — subscribers
   * can use it for per-slot validation without reading additional state.
   */
  function blur(): void {
    emit({ type: 'BLUR', index: state.activeSlot })
  }


  // ── DATA ACCESS ─────────────────────────────────────────────────────────────

  /**
   * Returns a safe snapshot: shallow copy of state with a cloned slotValues array.
   * Mutations to the returned object do not affect live state.
   *
   * Exposed on the public surface as both `getSnapshot()` and `getState()`.
   * Prefer `otp.state` for a live (non-cloned) read of the current state.
   */
  function getSnapshot(): OTPState {
    return { ...state, slotValues: [...state.slotValues] }
  }

  /**
   * Subscribe to all state changes.
   *
   * The listener receives:
   *   state — cloned snapshot of the post-mutation state
   *   event — discriminated union of the action that triggered the change
   *
   * Returns an unsubscribe function.
   *
   * @example
   * ```ts
   * const unsub = otp.subscribe((state, event) => {
   *   render(state)
   *   if (event.type === 'COMPLETE')     triggerHapticFeedback()
   *   if (event.type === 'INVALID_CHAR') shake(event.index)
   * })
   * unsub()
   * ```
   */
  function subscribe(listener: StateListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }


  // ── DX LAYER ────────────────────────────────────────────────────────────────

  /**
   * Returns fully-derived display data for visual slot `index`.
   *
   * Eliminates per-adapter state-derivation boilerplate. Does not include
   * accessibility attributes — compose those on top via getSlotId / getGroupId.
   *
   * @example
   * ```tsx
   * {Array.from({ length: 6 }, (_, i) => (
   *   <SlotDiv key={i} {...otp.getSlotProps(i)} />
   * ))}
   * ```
   */
  function getSlotProps(index: number): SlotProps {
    const char = state.slotValues[index] ?? ''
    return {
      id:         getSlotId(index),
      index,
      char,
      isFilled:   char.length === 1,
      isActive:   state.activeSlot === index,
      isError:    state.hasError,
      isSuccess:  state.hasSuccess,
      isComplete: state.isComplete,
      isEmpty:    char.length === 0,
      isDisabled: state.isDisabled,
      isReadOnly: state.isReadOnly,
    }
  }

  /**
   * Returns a minimal array snapshot of every slot.
   *
   * Use this to iterate slots for rendering when you don't need the full
   * `getSlotProps` surface. Pair with `getInputProps(slot.index)` to spread
   * `data-*` attributes onto each visual element.
   *
   * @example
   * ```tsx
   * otp.getSlots().map((slot) => (
   *   <div key={slot.index} {...attrs(otp.getInputProps(slot.index))}>
   *     {slot.value}
   *   </div>
   * ))
   * ```
   */
  function getSlots(): SlotEntry[] {
    if (_slotsVersion !== _mutVersion) {
      _slotsCache   = state.slotValues.map((value, index) => ({
        index,
        value,
        isActive: state.activeSlot === index,
        isFilled: value.length === 1,
      }))
      _slotsVersion = _mutVersion
    }
    return _slotsCache
  }

  /**
   * Returns framework-agnostic event handlers bound to `slotIndex`.
   *
   * Encapsulates all key-dispatch logic — adapters wire these directly to
   * DOM or synthetic events without implementing their own key handling.
   *
   * @example — hidden-input pattern
   * ```ts
   * const props = otp.getInputProps(otp.state.activeSlot)
   * input.oninput   = (e) => props.onInput((e.target as HTMLInputElement).value.slice(-1))
   * input.onkeydown = (e) => props.onKeyDown(e.key)
   * input.onfocus   = props.onFocus
   * input.onblur    = props.onBlur
   * ```
   *
   * @example — React
   * ```tsx
   * const { onKeyDown, onFocus, onBlur } = otp.getInputProps(otp.state.activeSlot)
   * <input onKeyDown={(e) => onKeyDown(e.key)} onFocus={onFocus} onBlur={onBlur} />
   * ```
   */
  function getInputProps(slotIndex: number): InputProps {
    const char     = state.slotValues[slotIndex] ?? ''
    const isFilled = char.length === 1
    // Inline boolean→string converter: data-* attribute values must be the
    // string literals "true" / "false" (not JS booleans) for CSS attribute
    // selectors like [data-active="true"] to match correctly.
    const b        = (v: boolean): 'true' | 'false' => v ? 'true' : 'false'

    return {
      value:     char,
      onInput:   (c) => { insert(c, slotIndex) },
      onKeyDown: (key) => {
        switch (key) {
          case 'Backspace':  deleteSlot(slotIndex);  break
          case 'Delete':     clearSlot(slotIndex);   break
          case 'ArrowLeft':  move(slotIndex - 1);    break
          case 'ArrowRight': move(slotIndex + 1);    break
        }
      },
      onFocus: () => focus(slotIndex),
      onBlur:  () => blur(),

      'data-index':    slotIndex,
      'data-active':   b(state.activeSlot === slotIndex),
      'data-filled':   b(isFilled),
      'data-empty':    b(!isFilled),
      'data-complete': b(state.isComplete),
      'data-invalid':  b(state.hasError),
      'data-success':  b(state.hasSuccess),
      'data-disabled': b(state.isDisabled),
      'data-readonly': b(state.isReadOnly),
      'data-first':    b(slotIndex === 0),
      'data-last':     b(slotIndex === length - 1),
    }
  }


  // ── IDENTITY ─────────────────────────────────────────────────────────────────

  /** Stable DOM id for slot `index`. @example 'verino-1-slot-2' */
  function getSlotId(index: number):  string { return `${instanceId}-slot-${index}` }
  /** Stable DOM id for the group container. @example 'verino-1-group' */
  function getGroupId():              string { return `${instanceId}-group` }
  /** Stable DOM id for the error message element. @example 'verino-1-error' */
  function getErrorId():              string { return `${instanceId}-error` }


  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC SURFACE
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    /** Live state reference — always reflects the latest mutation. Read-only at the type level; use actions to mutate. */
    get state(): Readonly<OTPState> { return state },

    // ── Actions ───────────────────────────────────────────────────────────────
    /** Insert `char` into slot `slotIndex`. Emits INPUT (+ COMPLETE if all slots filled). */
    insert,
    /** Backspace at `slotIndex`. Emits DELETE. */
    delete:  deleteSlot,
    /** Delete-key at `slotIndex` — clears in-place, cursor stays. Emits CLEAR. */
    clear:   clearSlot,
    /**
     * Distribute pasted text from `cursorSlot` forward.
     * Emits PASTE (+ COMPLETE if all slots filled).
     * @param text        Raw paste value.
     * @param cursorSlot  Starting slot. Default: 0.
     */
    paste:   (text: string, cursorSlot = 0) => pasteString(cursorSlot, text),
    /** Move cursor to `slotIndex`. Emits MOVE. */
    move,
    /** Emit FOCUS without changing state. Call from adapter focus handlers. */
    focus,
    /** Emit BLUR without changing state. Carries the active slot index. */
    blur,

    // ── State control ─────────────────────────────────────────────────────────
    /** Toggle error state. Clears success. Emits ERROR. */
    setError,
    /** Toggle success state. Clears error. Emits SUCCESS. */
    setSuccess,
    /** Clear all slots and return to initial state. Emits RESET. */
    reset,
    /** Toggle disabled. When true, all mutations are blocked. Emits DISABLED. */
    setDisabled,
    /** Toggle readOnly. When true, slot mutations are blocked. Emits READONLY. */
    setReadOnly,
    /**
     * Release all subscribers.
     * Call on component unmount to prevent memory leaks on bare `createOTP` usage.
     */
    destroy,

    // ── Data access ───────────────────────────────────────────────────────────
    /** Returns the current code as a joined string. */
    getCode:     () => state.slotValues.join(''),
    /** Returns a safe snapshot with cloned slotValues. */
    getSnapshot,
    /** Alias for `getSnapshot()`. Returns a safe snapshot with cloned slotValues. */
    getState:    getSnapshot,

    // ── DX helpers ────────────────────────────────────────────────────────────
    /** Minimal array snapshot of every slot — index, value, isActive, isFilled. */
    getSlots,
    /** Full display data for visual slot `index`. */
    getSlotProps,
    /** Framework-agnostic event handlers + data-* attributes bound to `slotIndex`. */
    getInputProps,

    // ── Identity ──────────────────────────────────────────────────────────────
    getSlotId,
    getGroupId,
    getErrorId,

    // ── Subscription ──────────────────────────────────────────────────────────
    /**
     * Subscribe to state changes and events.
     * Returns an unsubscribe function.
     */
    subscribe,
  }
}
