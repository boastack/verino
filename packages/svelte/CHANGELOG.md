# Changelog — @verino/svelte

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] - 2026-03-22

### Added

- `useOTP(options)` function — exposes all OTP state as Svelte stores; `$otp` in a template yields the full `OTPState`.
- `$slots` — derived `Readable<SlotEntry[]>` store for reactive slot iteration via `{#each $slots as slot}`.
- `$wrapperAttrs` — derived store of presence `data-*` attributes for spread onto the wrapper element.
- `use:otp.action` — Svelte action that wires all event listeners to the hidden input and manages the timer lifecycle; cleans up automatically when the element is removed from the DOM.
- `$timerSeconds` — live countdown writable store; browser-safe (starts inside the action, not at module load).
- `setValue(v)` — programmatic fill without triggering `onComplete`; no-ops when the value is unchanged.
- `onChange` fires on every user interaction; suppressed during `setValue` and `defaultValue` application.
- Full TypeScript types: `SvelteOTPOptions`, `UseOTPResult`.
