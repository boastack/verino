# Changelog — @verino/alpine

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

- `VerinoAlpine` — Alpine.js plugin; register with `Alpine.plugin(VerinoAlpine)` before `Alpine.start()`.
- `x-verino` directive — evaluates an options object in the Alpine component scope (reactive `$data` references supported); builds the full OTP field DOM on mount.
- `el._verino` imperative API attached to the wrapper element after mount — `getCode()`, `getSlots()`, `getInputProps(index)`, `reset()`, `resend()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `focus(i)`, `destroy()`.
- Built-in timer footer and resend row when `timer > 0`; omitted entirely when `onTick` is provided (custom-tick mode).
- `onTick(remaining)` callback for implementing a fully custom countdown UI outside the directive's container.
- `onChange(code)` callback fires on every user interaction; suppressed during programmatic value fills.
- Haptic feedback on completion (where supported); opt-in sound feedback via `sound: true`.
- Automatic cleanup via Alpine's `cleanup()` hook — no manual `destroy()` call required on `x-if` / `x-for` teardown.
- CDN IIFE bundle at `dist/verino-alpine.min.js` — sets `window.VerinoAlpine`; use with `Alpine.plugin(VerinoAlpine)`, no bundler required.