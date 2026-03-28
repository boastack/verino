# Changelog — verino

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] - 2026-03-22

### Added

- `createOTP(options)` — pure, zero-dependency OTP state machine. Safe to instantiate in SSR, Node.js, and Web Workers. Available from `verino/core`.
- `initOTP(target, options)` — vanilla DOM adapter; mounts on any CSS selector or element. Returns a `VerinoInstance` with `reset()`, `resend()`, `setError()`, `setSuccess()`, `setDisabled()`, `setReadOnly()`, `getCode()`, `focus()`, and `destroy()`.
- Single hidden-input architecture — one transparent `<input>` captures all browser events; visual slot elements are display-only. Enables native SMS autofill (`autocomplete="one-time-code"`), password manager support, and screen reader compatibility without custom workarounds.
- `filterChar` and `filterString` — character filtering utilities for `numeric`, `alphabet`, `alphanumeric`, and `any` input types; `pattern: RegExp` overrides type for per-character validation.
- `createTimer(options)` — countdown helper with `start`, `stop`, `reset`, and `restart` controls. `formatCountdown(seconds)` formats as `m:ss`.
- Plugin system (`verino/plugins`) with three built-in plugins:
  - `timerUIPlugin` — countdown footer and resend row; restarts automatically on `reset()`.
  - `webOTPPlugin` — Web OTP API integration; fills slots from an SMS credential, aborted cleanly on `destroy()`.
  - `pmGuardPlugin` — detects and neutralises password manager badge overlays via `MutationObserver`.
- `data-*` attribute system on slot elements for CSS-driven state styling: `data-active`, `data-focus`, `data-filled`, `data-empty`, `data-complete`, `data-invalid`, `data-success`, `data-disabled`, `data-readonly`, `data-first`, `data-last`.
- CSS custom properties on `.verino-wrapper` for theming: sizing (`--verino-size`, `--verino-gap`, `--verino-radius`), typography (`--verino-font-size`, `--verino-color`), backgrounds (`--verino-bg`, `--verino-bg-filled`), borders and state colors (`--verino-border-color`, `--verino-active-color`, `--verino-error-color`, `--verino-success-color`), and component-specific tokens for the caret, timer, separator, placeholder, and masked glyph.
- ARIA — `role="group"` with `aria-labelledby` on the slot container; all visual slot divs are `aria-hidden`; hidden input carries `aria-label` and `aria-readonly`.
- Opt-in haptic feedback (`haptic: true`) and sound feedback (`sound: true`).
- Sub-path exports: `verino`, `verino/core`, `verino/plugins`, `verino/plugins/timer-ui`, `verino/plugins/web-otp`, `verino/plugins/pm-guard`.
- CDN IIFE bundle at `dist/verino.min.js` exposing `window.Verino`.
- Full TypeScript types for all public APIs.
