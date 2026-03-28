# Changelog — @verino/vue

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] - 2026-03-22

### Added

- `useOTP(options)` composable — exposes all OTP state as Vue `Ref<T>` values; templates react automatically without manual subscriptions.
- `hiddenInputAttrs` — computed ref for `v-bind` on the hidden `<input>`.
- `wrapperAttrs` — computed ref for `v-bind` on the wrapper element; carries presence `data-*` attributes.
- `inputRef` — `Ref<HTMLInputElement | null>` for binding to the hidden input via `:ref`.
- Named event handlers for template binding: `onKeydown`, `onChange`, `onPaste`, `onFocus`, `onBlur`.
- `getInputProps(index)` — returns slot data attributes including `data-focus`, accurate within Vue's change-detection cycle.
- Controlled value via `value?: string | Ref<string>` — a `Ref<string>` is watched reactively; a plain `string` is applied once at creation.
- `timerSeconds: Ref<number>` — live countdown; started on mount, stopped on unmount.
- `onChange` fires on every user interaction; suppressed during controlled value sync and `defaultValue` application.
- Full TypeScript types: `VueOTPOptions`, `UseOTPResult`.
