# Changelog — @verino/core

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-01

### Added

- `createOTP(options)` — pure state machine with zero DOM and zero framework dependencies. All input logic (character filtering, cursor movement, paste normalisation, timer management, event routing) lives here.
- `OTPState` — immutable-at-type-level state object: `slotValues`, `activeSlot`, `hasError`, `hasSuccess`, `isComplete`, `isEmpty`, `timerSeconds`, `isDisabled`, `isReadOnly`. Note: `isEmpty` is NOT the complement of `isComplete` — a partially filled field has both `false`.
- `subscribe(listener)` — registers a listener called on every state change with `(state, event)`; returns an unsubscribe function. All subscriptions are released by `destroy()`.
- Discriminated `OTPEvent` union emitted on every state change: `INPUT`, `DELETE`, `CLEAR`, `PASTE`, `COMPLETE`, `INVALID_CHAR`, `FOCUS`, `BLUR`, `RESET`, `MOVE`, `ERROR`, `SUCCESS`, `DISABLED`, `READONLY`.
- Input actions: `insert(char, index)`, `delete(index)`, `clear(index)`, `paste(text, cursorSlot?)`, `move(index)`.
- Focus actions: `focus(slotIndex)` — emits `FOCUS` without changing state; `blur()` — emits `BLUR` carrying the active slot index for per-slot validation.
- State-control actions: `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `reset()`, `destroy()`.
- `getCode()` — returns the current assembled value string.
- `getSnapshot()` / `getState()` — returns a safe isolated copy of state with cloned `slotValues`.
- `getSlots()` — returns a memoised `SlotEntry[]` snapshot: `{ index, value, isActive, isFilled }` per slot. Result is cached by mutation version and recomputed only when state changes.
- `getSlotProps(index)` — full per-slot display data for framework adapters: `id`, `char`, `index`, `isFilled`, `isActive`, `isError`, `isSuccess`, `isComplete`, `isEmpty`, `isDisabled`, `isReadOnly`.
- `getInputProps(index)` — event handlers (`onInput`, `onKeyDown`, `onFocus`, `onBlur`) plus a full set of `data-*` attributes for CSS-driven slot styling: `data-slot`, `data-active`, `data-filled`, `data-empty`, `data-complete`, `data-invalid`, `data-success`, `data-disabled`, `data-readonly`, `data-first`, `data-last`. Note: `data-focus` is NOT included — adapters inject it themselves since the core is DOM-free.
- Stable per-instance ID helpers (collision-free across multiple mounted fields): `getSlotId(index)`, `getGroupId()`, `getErrorId()`.
- `filterChar(char, type, pattern?)` — returns the character if it passes validation or `''` if rejected.
- `filterString(str, type, pattern?)` — applies `filterChar` to every Unicode code point; safe for emoji and multi-byte input via `Array.from()`.
- `createTimer({ totalSeconds, onTick, onExpire })` — interval-based countdown; returns `TimerControls`: `start()`, `stop()`, `reset()` (stop and restore to `totalSeconds`), `restart()` (reset then start). If `totalSeconds <= 0`, `onExpire` fires synchronously on `start()`.
- `formatCountdown(seconds)` — formats a second count as `m:ss` string (e.g. `65` → `"1:05"`, `9` → `"0:09"`). Used by vanilla, alpine, and web-component adapters for their built-in timer UI.
- `triggerHapticFeedback()` — calls `navigator.vibrate(10)` in supported browsers; no-ops silently elsewhere. Re-exported for custom adapter authors.
- `triggerSoundFeedback()` — plays a short tone via the Web Audio API. Re-exported for custom adapter authors.
- `OTPOptions` — full configuration type: `length`, `type`, `pattern`, `pasteTransformer`, `onComplete`, `onExpire`, `onResend`, `onTick`, `onInvalidChar`, `autoFocus`, `blurOnComplete`, `selectOnFocus`, `placeholder`, `name`, `masked`, `maskChar`, `onFocus`, `onBlur`, `defaultValue`, `disabled`, `readOnly`, `timer`, `resendAfter`, `haptic`, `sound`.
- Mutual-exclusion guarantee: `setError(true)` clears `hasSuccess`; `setSuccess(true)` clears `hasError`.
- `onComplete` fires synchronously after the final `insert` or `paste` action; only on the `false → true` transition so re-typing over a complete field does not re-fire it.
- `haptic` (default `true`) — triggers `navigator.vibrate(10)` on completion and error in supported browsers.
- `sound` (default `false`) — plays a short audio tone on completion via the Web Audio API.
- Full TypeScript types: `OTPOptions`, `OTPState`, `OTPEvent`, `OTPEventType`, `InputProps`, `SlotEntry`, `SlotProps`, `TimerOptions`, `TimerControls`, `StateListener`.

---

[Unreleased]: https://github.com/boastack/verino/compare/@verino/core@1.0.0...HEAD
[1.0.0]: https://github.com/boastack/verino/releases/tag/%40verino%2Fcore%401.0.0
