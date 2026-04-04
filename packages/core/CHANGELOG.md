# Changelog — @verino/core

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

- `createOTP(options)` — pure OTP state machine with zero DOM and zero dependencies. Handles character filtering, cursor movement, paste normalization, and a typed event system.
- Discriminated `OTPEvent` union covering all mutations: `INPUT`, `DELETE`, `CLEAR`, `PASTE`, `COMPLETE`, `INVALID_CHAR`, `FOCUS`, `BLUR`, `RESET`, `MOVE`, `ERROR`, `SUCCESS`, `DISABLED`, `READONLY`.
- `onComplete` fires synchronously on the `false → true` completion transition only — re-filling an already-complete field does not re-fire it.
- `hasError` and `hasSuccess` are mutually exclusive — setting one clears the other.
- `getInputProps(index)` — event handlers and `data-*` attributes for CSS-driven slot styling, ready to spread onto any DOM element or framework component.
- `getSlotId`, `getGroupId`, `getErrorId` — stable per-instance DOM ID helpers; pass `idBase` for deterministic SSR IDs.
- `filterChar` / `filterString` — Unicode-safe character filtering; `filterString` iterates code points via `Array.from` for correct emoji handling.
- `createTimer` — interval-based countdown with `start`, `stop`, `reset`, `restart`; supports immediate tick on start and restart.
- `formatCountdown(seconds)` — formats seconds as `m:ss`.
- `@verino/core/toolkit` — shared adapter primitives: frame scheduling, input controller, programmatic value sync, resend timer, haptic/sound feedback, and password-manager badge guard.
