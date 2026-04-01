# Changelog — @verino/react

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-01

### Added

- `useOTP(options)` hook — creates and manages a `createOTP` instance that is stable across re-renders. Returns `UseOTPResult` with all OTP state, pre-composed props, and control methods.
- `HiddenOTPInput` — `forwardRef` component rendering the zero-opacity, absolutely-positioned hidden input that overlays the slot row.
- `hiddenInputProps` — pre-composed prop object for spread onto the hidden `<input>`.
- `wrapperProps` — pre-composed `data-*` presence attributes for spread onto the outer wrapper element.
- `getSlotProps(index)` — per-slot render props for building custom slot components, including `hasFakeCaret` for rendering a blinking cursor on the active, empty slot while focused.
- `getInputProps(index)` — slot `data-*` attributes including `data-focus` injected from the adapter's `isFocused` state.
- Control methods on `UseOTPResult`: `reset()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `focus(slotIndex?)`, `getCode()`.
- Controlled value via `value?: string` — programmatic fills sync to the field without triggering `onComplete`.
- `timerSeconds` — live countdown state value; restarts automatically when `reset()` is called.
- Callback stability — `onComplete`, `onExpire`, `onResend`, `onFocus`, `onBlur`, `onInvalidChar`, `onChange`, `pasteTransformer`, and `pattern` are stored in refs; safe to pass inline functions without causing subscription restarts.
- `onChange` fires once per interaction batch; suppressed during controlled value sync and `defaultValue` application.
- Full TypeScript types: `ReactOTPOptions`, `SlotRenderProps`, `HiddenInputProps`, `UseOTPResult`.

---

[Unreleased]: https://github.com/boastack/verino/compare/@verino/react@1.0.0...HEAD
[1.0.0]: https://github.com/boastack/verino/releases/tag/%40verino%2Freact%401.0.0
