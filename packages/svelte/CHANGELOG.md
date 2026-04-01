# Changelog — @verino/svelte

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-01

### Added

- `useOTP(options)` function — exposes all OTP state as Svelte stores; `$otp` in a template yields the full `OTPState` via the top-level `subscribe` method.
- Derived readable stores: `value` (joined code string), `isComplete`, `hasError`, `hasSuccess`, `activeSlot`.
- Writable stores for runtime control: `isDisabled`, `isReadOnly`, `separatorAfter`, `separator`, `masked`, `maskChar`.
- `timerSeconds: Writable<number>` — live countdown store; browser-safe (timer starts inside the action on element mount, not at module load).
- `slots: Readable<SlotEntry[]>` — derived store for reactive slot iteration. Use `{#each $otp.slots as slot}` in templates (or destructure: `const { slots } = otp` then `{#each $slots as slot}`).
- `wrapperAttrs: Readable<Record<string, string | undefined>>` — derived store of presence `data-*` attributes for spread onto the wrapper element. Recalculates only when completion, error, success, disabled, or readOnly state changes.
- `use:otp.action` — Svelte action that wires all event listeners (keydown, input, paste, focus, blur) to the hidden input and manages the timer lifecycle; returns `{ destroy }` per the Svelte action contract.
- `getInputProps(index)` — returns slot `data-*` attributes including `data-focus`; sourced from the closure-level `isFocused` variable updated by the action's focus/blur handlers, accurate at render time since `{#each $slots}` re-renders on every store update.
- `getSlots()` — non-reactive snapshot for one-off reads outside a reactive context.
- Control methods: `reset()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `focus(slotIndex?)`, `getCode()`, `setValue(v)`.
- `setValue(v)` — programmatic fill without triggering `onComplete`; no-ops when the value is unchanged or `undefined`.
- `onChange` fires on every user interaction; suppressed during `setValue` and `defaultValue` application.
- Full TypeScript types: `SvelteOTPOptions`, `UseOTPResult`.

---

[Unreleased]: https://github.com/boastack/verino/compare/@verino/svelte@1.0.0...HEAD
[1.0.0]: https://github.com/boastack/verino/releases/tag/%40verino%2Fsvelte%401.0.0
