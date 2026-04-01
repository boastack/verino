# Changelog — @verino/alpine

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-01

### Added

- `VerinoAlpine` — Alpine.js plugin; register with `Alpine.plugin(VerinoAlpine)` before `Alpine.start()`.
- `x-verino` directive — accepts an options object evaluated in the Alpine component scope (reactive `$data` references supported); builds the full OTP field DOM inside the target element on mount.
- `el._verino` imperative API attached to the wrapper element after mount: `getCode()`, `getSlots()`, `getInputProps(index)`, `reset()`, `resend()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `focus(slotIndex)`, `destroy()`.
- Built-in timer footer and resend row when `timer > 0`; omitted when `onTick` is provided (custom-tick mode).
- `onTick(remaining)` callback for implementing a custom countdown UI outside the directive's container.
- All `data-*` slot and wrapper attributes consistent with the other adapters.
- Automatic cleanup via Alpine's `cleanup()` hook on `x-if` / `x-for` teardown — no manual `destroy()` call required.
- CDN IIFE bundle at `dist/verino-alpine.min.js` — sets `window.VerinoAlpine` on load; use with `Alpine.plugin(VerinoAlpine)` in a plain `<script>` tag, no bundler required.
- Full TypeScript types: `VerinoAlpine`.

---

[Unreleased]: https://github.com/boastack/verino/compare/@verino/alpine@1.0.0...HEAD
[1.0.0]: https://github.com/boastack/verino/releases/tag/%40verino%2Falpine%401.0.0