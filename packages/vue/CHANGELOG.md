# Changelog — @verino/vue

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-04-04

### Breaking Changes

- `@verino/core` — `OTPState` type has been removed. Replace all references with `OTPStateSnapshot`.
- `@verino/core` — `otp.state` now returns a new isolated snapshot on every read instead of a shared mutable reference. Code that cached `const s = otp.state` and expected it to reflect subsequent mutations will break — read `otp.state` fresh on each access, or use `otp.subscribe` to react to changes.
- All adapters — `onTick` now fires immediately on mount and after every `reset()` with the full remaining seconds, not only on each decrement. Remove any code that manually sets the initial timer display — the first `onTick` call handles it.

### Added

- `@verino/core` — `@verino/core/toolkit` subpath export; provides `triggerHapticFeedback`, `triggerSoundFeedback`, `createResendTimer`, password-manager badge helpers, and shared input controller primitives for building custom adapters.
- `@verino/core` — `createTimer` accepts `emitInitialTickOnStart` and `emitInitialTickOnRestart` boolean options. When enabled, `onTick` fires synchronously on `start()` and `restart()` with the full `totalSeconds` — eliminating the one-second blank delay at timer start.
- `@verino/react` — `resend()` method on `UseOTPResult`; clears the field, restarts the timer, and fires `onResend`. Accepts `onResend` callback in `ReactOTPOptions`.
- `@verino/vue` — `resend()` method on `UseOTPResult`; accepts `onResend` in `VueOTPOptions`.
- `@verino/svelte` — `resend()` method on `UseOTPResult`; accepts `onResend` in `SvelteOTPOptions`.
- `@verino/web-component` — `resend()` DOM method; `id-base` HTML attribute for setting a deterministic ID prefix on SSR-rendered pages.

### Fixed

- `@verino/core` — `parseSeparatorAfter` accepted `0` as a valid separator index on the single-value path, producing a separator before the first slot. Now consistently rejects any value less than `1`, matching the array path behaviour.
- `@verino/core` — Duplicate `idBase` values across simultaneously mounted instances now log a warning in development, preventing silent ARIA ID collisions.
- `@verino/vanilla` — Calling `initOTP` on an element that already has a live instance now destroys the stale instance before mounting the new one, instead of silently leaving the old listeners and plugins active.

---

## [1.0.0] - 2026-04-01

Initial release.

### Added

- `useOTP(options)` composable — exposes all OTP state as Vue `Ref<T>` values; templates react automatically without manual subscriptions.
- `hiddenInputAttrs` — `ComputedRef` for `v-bind` on the hidden `<input>`; includes `type`, `inputmode`, `autocomplete`, `maxlength`, `disabled`, and ARIA attributes.
- `wrapperAttrs` — `ComputedRef` of presence `data-*` attributes for `v-bind` on the wrapper element.
- `inputRef: Ref<HTMLInputElement | null>` — bind to the hidden input via `:ref="(el) => (otp.inputRef.value = el)"`.
- Named event handlers (`onKeydown`, `onPaste`, `onFocus`, `onBlur`) for direct template binding without wrapper functions.
- `getSlots()` — reactive slot iteration helper; reads from Vue refs so results are reactive in templates.
- `getInputProps(index)` — slot `data-*` attributes including `data-focus`, accurate within Vue's change-detection cycle.
- Controlled value via `value?: string | Ref<string>` — pass a `ref`, `computed`, or getter for live external control; `defaultValue` for one-time prefill on mount.
- `timerSeconds: Ref<number>` — live countdown; timer starts on `onMounted`, stops on `onUnmounted`.