# Changelog — @verino/react-native

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-07

Initial release.

### Added

- `useOTP(options)` hook — React Native adapter built on `@verino/core`, mirroring `@verino/react`'s single-hidden-input architecture with a `TextInput` overlaying visual slot views.
- `hiddenInputProps` — plain props object spread directly onto a consumer-rendered `<TextInput>`. The package never imports `react-native` at runtime, keeping it dependency-free and version-agnostic.
- `getSlotProps(index)` — per-slot render props including `hasFakeCaret` and a new `onPress` handler for tap-to-focus, since mobile slots have no clickable text caret to position a cursor the way the web does.
- Native SMS autofill wiring — `textContentType: 'oneTimeCode'` (iOS) and `autoComplete: 'sms-otp'` (Android) set automatically on `hiddenInputProps`.
- `onChangeText` as the single source of truth for typing, backspace, long-press paste, and SMS autofill — all reported as the field's full current value, matching RN's `TextInput` semantics. `onKeyPress` additionally covers hardware-keyboard `ArrowLeft`/`ArrowRight` navigation.
- `pasteTransformer` and `onInvalidChar` support, applied on every `onChangeText` call since RN cannot distinguish a paste/autofill from typing at that handler.
- Controlled value via `value?: string` and one-time `defaultValue` prefill — same semantics as `@verino/react`.
- `timer` / `timerSeconds` live countdown, `resend()`, `setError`/`setSuccess`/`setDisabled`/`setReadOnly`, and `focus(slotIndex)` — full parity with the other framework adapters.
- `feedback` runtime option for injecting platform haptics/audio (e.g. `expo-haptics`), since `navigator.vibrate` and Web Audio don't exist in the RN JS engine.
- `selectOnFocus` support and native caret-position sync on focus, `ArrowLeft`/`ArrowRight`, and `focus(slotIndex)` — matches the DOM adapters' behavior via the real `TextInput` ref's optional `setSelection(start, end)`, best-effort since support varies by RN version/platform.
- A runnable Expo demo app at `examples/react-native-expo`.

### Fixed

- `hiddenInputProps.ref` was typed `RefObject<TextInputRefLike>`, which failed to type-check against a real `<TextInput ref={...}>` — TS ref assignability needs the ref's `current` type to be a supertype of the real `TextInput` instance. Widened to `RefObject<any>` at the public-type boundary; verified against the real `react-native` package's types.
- A rejected edit while `readOnly` (where `editable` stays `true` so focus/selection keep working) could leave the native `TextInput` visually showing a character the OS just accepted, because React Native has no DOM-style automatic "restore the controlled value" safety net on rejection — it only reconciles native text back to `value` during a commit. `onChangeText`'s guard now forces a re-render (a fresh, content-identical snapshot) instead of a bare early return, so the native display always gets corrected back.
