# Changelog — @verino/vue

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-01

### Added

- `useOTP(options)` composable — exposes all OTP state as Vue `Ref<T>` values; templates react automatically without manual subscriptions.
- Reactive state refs returned by the composable: `slotValues: Ref<string[]>`, `activeSlot: Ref<number>`, `value: Ref<string>` (computed joined code), `isComplete: Ref<boolean>`, `hasError: Ref<boolean>`, `hasSuccess: Ref<boolean>`, `isDisabled: Ref<boolean>`, `isReadOnly: Ref<boolean>`, `isFocused: Ref<boolean>`, `timerSeconds: Ref<number>`.
- Visual configuration refs: `separatorAfter: Ref<number | number[]>`, `separator: Ref<string>`, `masked: Ref<boolean>`, `maskChar: Ref<string>`, `placeholder: string`.
- `hiddenInputAttrs` — `ComputedRef` for `v-bind` on the hidden `<input>`; includes `type`, `inputmode`, `autocomplete`, `maxlength`, `disabled`, `aria-label`, `aria-readonly`, `spellcheck`, `autocorrect`, `autocapitalize`.
- `wrapperAttrs` — `ComputedRef` for `v-bind` on the wrapper element; carries presence `data-*` attributes (`data-complete`, `data-invalid`, `data-success`, `data-disabled`, `data-readonly`).
- `inputRef` — `Ref<HTMLInputElement | null>` for binding to the hidden input via `:ref`.
- Named event handlers for template binding: `onKeydown`, `onChange`, `onPaste`, `onFocus`, `onBlur`.
- `getInputProps(index)` — returns slot `data-*` attributes including `data-focus`, accurate within Vue's change-detection cycle; reads from Vue refs rather than core state to respect reactivity.
- `getSlots()` — reactive slot iteration helper; reads from Vue refs so it is reactive in templates. Use in `v-for`.
- Control methods: `reset()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `focus(slotIndex?)`, `getCode()`.
- Controlled value via `value?: string | Ref<string>` — a `Ref<string>` is watched reactively; a plain `string` is applied once at creation (static pre-fill).
- `timerSeconds: Ref<number>` — live countdown; started inside `onMounted`, stopped inside `onUnmounted`.
- `onChange` fires on every user interaction; suppressed during controlled value sync and `defaultValue` application.
- Full TypeScript types: `VueOTPOptions`, `UseOTPResult`.

---

[Unreleased]: https://github.com/boastack/verino/compare/@verino/vue@1.0.0...HEAD
[1.0.0]: https://github.com/boastack/verino/releases/tag/%40verino%2Fvue%401.0.0
