# Changelog — @verino/alpine

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- CDN IIFE bundle at `dist/verino-alpine.min.js` — sets `window.VerinoAlpine` on load; no module import required. Use with `Alpine.plugin(VerinoAlpine)` in a plain `<script>` tag.

---

## [1.0.0] - 2026-03-22

### Added

- `VerinoAlpine` — Alpine.js plugin; register with `Alpine.plugin(VerinoAlpine)` before `Alpine.start()`.
- `x-verino` directive — accepts an options object in the Alpine component scope (reactive `$data` references supported); builds the full OTP field DOM inside the target element on mount.
- `el._verino` imperative API attached to the wrapper element after mount: `getCode()`, `getSlots()`, `getInputProps(index)`, `reset()`, `resend()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `focus(slotIndex)`, `destroy()`.
- Built-in timer footer and resend row when `timer > 0`; omitted when `onTick` is provided (custom-tick mode).
- `onTick(remaining)` callback for implementing a custom countdown UI.
- All `data-*` slot and wrapper attributes consistent with the other adapters.
- Automatic cleanup on `x-if` / `x-for` teardown.
- Full TypeScript types: `VerinoAlpine`.
