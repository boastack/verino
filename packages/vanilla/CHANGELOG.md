# Changelog — @verino/vanilla

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-01

### Added

- `initOTP(target, options?)` — mounts a fully accessible OTP field into any CSS selector or DOM element. Returns `VerinoInstance[]` — one instance per matched element.
- `VerinoInstance` API: `reset()`, `resend()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `getCode()`, `focus(slotIndex?)`, `destroy()`.
- Single hidden-input pattern — one transparent `<input>` overlays visual slot `<div>` elements. SMS autofill (`autocomplete="one-time-code"`), password managers, screen readers, and IME all target the real input natively.
- Full `data-*` attribute system on every slot div: `data-active`, `data-focus`, `data-filled`, `data-empty`, `data-complete`, `data-invalid`, `data-success`, `data-disabled`, `data-readonly`, `data-masked`, `data-first`, `data-last`, `data-slot` (zero-based index string).
- Wrapper-level boolean presence attributes (`data-complete`, `data-invalid`, `data-success`, `data-disabled`, `data-readonly`) for container-scoped CSS selectors.
- CSS custom properties on `.verino-wrapper`: `--verino-size`, `--verino-gap`, `--verino-radius`, `--verino-font-size`, `--verino-bg`, `--verino-bg-filled`, `--verino-color`, `--verino-border-color`, `--verino-active-color`, `--verino-error-color`, `--verino-success-color`, `--verino-caret-color`, `--verino-placeholder-color`, `--verino-placeholder-size`, `--verino-separator-color`, `--verino-separator-size`, `--verino-masked-size`.
- `separatorAfter` option — inserts a `.verino-separator` element after the specified slot index or indices.
- `masked` and `maskChar` options — renders a glyph (default `●`) in filled slots; sets `type="password"` on the hidden input for secure mobile keyboards.
- `onChange(code)` callback — fires on every user interaction (INPUT, DELETE, CLEAR, PASTE).
- `resendAfter` option (default `30`) — cooldown in seconds before the resend button re-enables after being clicked.
- Plugin system — `VerinoPlugin` contract (`{ name, install(ctx) → cleanup }`); installed plugins run their cleanup functions inside `instance.destroy()`.
- `timerUIPlugin` — renders a live `.verino-timer-badge` countdown and a `.verino-resend-btn` resend button as siblings of the wrapper; countdown restarts automatically when `reset()` or `resend()` is called.
- `webOTPPlugin` — intercepts incoming SMS OTPs via `navigator.credentials.get` and fills all slots automatically; aborts cleanly on `destroy()`.
- `pmGuardPlugin` — detects and repositions credential badge overlays injected by LastPass, 1Password, Dashlane, Bitwarden, and Keeper; uses a `MutationObserver` that is disconnected on `destroy()`.
- `data-*` attribute initialisation from HTML attributes on the wrapper element: `data-length`, `data-type`, `data-timer`, `data-resend`, `data-separator-after`, `data-separator`, `data-masked`, `data-mask-char`, `data-placeholder`, `data-name`.
- CDN IIFE bundle at `dist/verino.min.js` — exposes `window.Verino` with `init`, `createOTP`, `filterChar`, `filterString`, `formatCountdown`. Call `Verino.init(...)` directly from a `<script>` tag.
- Full TypeScript types: `VanillaOTPOptions`, `VerinoInstance`, `VerinoPlugin`, `VerinoPluginContext`, `VerinoWrapper`.

---

[Unreleased]: https://github.com/boastack/verino/compare/@verino/vanilla@1.0.0...HEAD
[1.0.0]: https://github.com/boastack/verino/releases/tag/%40verino%2Fvanilla%401.0.0
