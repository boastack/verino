# Changelog — @verino/vanilla

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

- `initOTP(target, options?)` — mounts a fully accessible OTP field into any CSS selector or DOM element. Returns `VerinoInstance[]`, one per matched element.
- Single hidden-input pattern — one transparent `<input>` overlays visual slot `<div>` elements so SMS autofill, password managers, screen readers, and IME all work natively.
- Full `data-*` attribute system on slot divs and the wrapper element for CSS-driven state styling (active, filled, error, success, masked, and more).
- Extensible plugin system — `VerinoPlugin` contract (`{ name, install(ctx) → cleanup }`); cleanup runs inside `instance.destroy()`.
- `timerUIPlugin` (built-in) — renders countdown and resend row as siblings of the wrapper; restarts automatically on `reset()` or `resend()`.
- `webOTPPlugin` (built-in) — fills slots from an incoming SMS OTP via `navigator.credentials.get`; aborts cleanly on `destroy()`.
- `pmGuardPlugin` (built-in) — repositions credential badge overlays injected by password managers via `MutationObserver`; disconnects on `destroy()`.
- Data-attribute initialization from HTML attributes on the wrapper (`data-length`, `data-type`, `data-timer`, etc.) — no JS required for basic configuration.
- CSS custom properties on `.verino-wrapper` for zero-class theming (`--verino-size`, `--verino-gap`, `--verino-radius`, `--verino-error-color`, and more).
- CDN IIFE bundle at `dist/verino.min.js` exposing `window.Verino`; use `Verino.init(...)` directly from a `<script>` tag.