<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner2.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/react-native</h1>

<h3 align="center">
  React Native adapter for <a href="https://github.com/boastack/verino">Verino</a>. Reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/react-native"><img src="https://img.shields.io/npm/v/@verino/react-native?color=20C55C&label=%40verino%2Freact-native" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/react-native"><img src="https://img.shields.io/bundlephobia/minzip/@verino/react-native?color=20C55C&label=gzip+size" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/react-native` wraps [`@verino/core`](https://www.npmjs.com/package/@verino/core) in a `useOTP` hook for React Native. It mirrors the same single-hidden-input architecture as `@verino/react`: one invisible `TextInput` overlays a row of visual slot `View`s and captures all keyboard input, long-press paste, and native SMS autofill (`textContentType="oneTimeCode"` on iOS, `autoComplete="sms-otp"` on Android). Slot views are purely visual — they hold no text input of their own.

**This package never imports `react-native` at runtime.** `useOTP` returns a plain props object (`hiddenInputProps`) shaped to spread directly onto your own `<TextInput>`, so the package has zero dependencies, works with bare React Native or Expo, and never pins you to a specific React Native version.

The core instance stays stable across ordinary re-renders. Callback options (`onComplete`, `onExpire`, etc.) are stored in refs so they can be updated without restarting the effect, and the machine is only recreated when structural configuration such as `length` changes.

---

## Why Use This Adapter?

- **Full markup control.** `useOTP` provides render props — you own the JSX, no opaque wrapper.
- **Native SMS autofill.** `textContentType="oneTimeCode"` (iOS) and `autoComplete="sms-otp"` (Android) are wired in automatically.
- **Zero dependency, any RN runtime.** The hook never imports `react-native` — it works with bare RN, Expo, or any fork without version coupling.
- **Tap-to-focus slots.** `getSlotProps(index).onPress` moves the cursor to a tapped slot — a natural mobile affordance the DOM adapters don't need.
- **Stable instance.** The `@verino/core` state machine persists across ordinary re-renders and only rebuilds for structural configuration changes.

---

## Installation

```bash
# npm
npm i @verino/react-native

# pnpm
pnpm add @verino/react-native

# yarn
yarn add @verino/react-native
```

**Peer dependencies:** React ≥ 18, React Native ≥ 0.70 (both optional at the package level — install whichever your app already uses). `@verino/core` installs automatically.

---

## Quick Start

```tsx
import { StyleSheet, View, Text, TextInput, Pressable } from 'react-native'
import { useOTP } from '@verino/react-native'

function OTPField() {
  const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })

  return (
    <View style={styles.row}>
      <TextInput {...otp.hiddenInputProps} style={StyleSheet.absoluteFill} />
      {otp.getSlots().map((slot) => {
        const { char, isActive, isFilled, isError, hasFakeCaret, placeholder, onPress } = otp.getSlotProps(slot.index)
        return (
          <Pressable key={slot.index} onPress={onPress}>
            <View style={[styles.slot, isActive && styles.active, isFilled && styles.filled, isError && styles.error]}>
              {hasFakeCaret && <View style={styles.caret} />}
              <Text style={styles.char}>{isFilled ? char : placeholder}</Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row:    { position: 'relative', flexDirection: 'row', gap: 8 },
  slot:   { width: 48, height: 56, borderRadius: 10, borderWidth: 1, borderColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  active: { borderColor: '#3D3D3D' },
  filled: { backgroundColor: '#FFFFFF' },
  error:  { borderColor: '#FB2C36' },
  caret:  { position: 'absolute', width: 1.5, height: 24, backgroundColor: '#3D3D3D' },
  char:   { fontSize: 24 },
})
```

> **Note:** `verify(code)` is a placeholder — replace it with your own API call or application logic.

See [`examples/react-native.tsx`](https://github.com/boastack/verino/blob/main/examples/react-native.tsx) for a complete working example, including the fake caret and SMS autofill, or [`examples/react-native-expo`](https://github.com/boastack/verino/tree/main/examples/react-native-expo) for a full runnable Expo app (works the same in Expo Go, a development build, or bare React Native — no config plugin or native module required).

---

## Common Patterns

| Use case | Key options |
|---|---|
| SMS / email OTP | `type: 'numeric'`, `timer: 60`, `onResend` |
| TOTP / 2FA with separator | `separatorAfter: 3` |
| PIN entry | `masked: true`, `blurOnComplete: true` |
| Alphanumeric code | `type: 'alphanumeric'`, `pasteTransformer` |
| Invite / referral code | `separatorAfter: [3, 6]`, `pattern: /^[A-Z0-9]$/` |
| Async verification lock | `setDisabled(true / false)` around the API call |
| Pre-fill on mount | `defaultValue: '123456'` |
| Display-only / read-only | `readOnly: true` |

---

## Usage

### Live external control

Use `value` for live external control and `defaultValue` for one-time mount prefill. Programmatic updates do not trigger `onComplete`:

```tsx
const [code, setCode] = useState('')
const otp = useOTP({ length: 6, value: code, onChange: setCode })
```

### Async verification

```tsx
const otp = useOTP({
  length: 6,
  onComplete: async (code) => {
    otp.setDisabled(true)
    const ok = await api.verify(code)
    otp.setDisabled(false)
    ok ? otp.setSuccess(true) : otp.setError(true)
  },
})
```

### Timer

`timerSeconds` is a live reactive countdown, it updates every second:

```tsx
const otp = useOTP({ length: 6, timer: 60, onExpire: () => showExpired() })

{otp.timerSeconds > 0 && (
  <Text>
    Expires in {Math.floor(otp.timerSeconds / 60)}:
    {String(otp.timerSeconds % 60).padStart(2, '0')}
  </Text>
)}
```

### Separator

```tsx
const otp    = useOTP({ length: 6, separatorAfter: 3, separator: '—' })
const sepSet = new Set(
  Array.isArray(otp.separatorAfter) ? otp.separatorAfter : [otp.separatorAfter]
)

{otp.getSlots().map((slot) => (
  <React.Fragment key={slot.index}>
    {sepSet.has(slot.index) && <Text accessibilityElementsHidden>{otp.separator}</Text>}
    <View style={styles.slot}><Text>{otp.getSlotProps(slot.index).char}</Text></View>
  </React.Fragment>
))}
```

### Masked input

```tsx
const otp = useOTP({ length: 6, masked: true, maskChar: '●' })

{otp.getSlots().map((slot) => {
  const { char, isFilled, masked, maskChar, placeholder } = otp.getSlotProps(slot.index)
  return (
    <View key={slot.index} style={styles.slot}>
      <Text>{isFilled ? (masked ? maskChar : char) : placeholder}</Text>
    </View>
  )
})}
```

`masked` also sets `hiddenInputProps.secureTextEntry`, so the native keyboard matches (password-style entry).

### Haptics and sound

Browser `navigator.vibrate` / Web Audio aren't available on native, so wire the `feedback` runtime to your platform's haptics/audio APIs:

```tsx
import * as Haptics from 'expo-haptics'

const otp = useOTP({
  length: 6,
  feedback: {
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  },
})
```

Without a `feedback` override, `haptic`/`sound` options are accepted but no-op on native (there is no `navigator.vibrate` or `AudioContext` in the RN JS runtime).

---

## Accessibility

- **Single accessibility-labelled input** — the hidden `TextInput` carries `accessibilityLabel="Enter your N-digit code"` (or `N-character code` for non-numeric types). Screen readers announce one field, not multiple slots.
- **`keyboardType`** — set to `"number-pad"` or `"default"` based on `type`, triggering the correct native keyboard.
- **`textContentType="oneTimeCode"` / `autoComplete="sms-otp"`** — enables native SMS autofill on iOS and Android.
- **Anti-interference** — `spellCheck={false}`, `autoCorrect={false}`, and `autoCapitalize="none"` prevent unwanted keyboard behavior.
- **`maxLength`** — constrains the hidden input to `length`.
- **`secureTextEntry` in masked mode** — triggers the native secure-entry keyboard.
- **Tap-to-focus slots** — `getSlotProps(index).onPress` lets users reposition the cursor by tapping a filled slot, the native-feeling equivalent of clicking mid-field on the web.

---

## API Reference

### `useOTP(options?)`

```ts
function useOTP(options?: ReactNativeOTPOptions): UseOTPResult
```

### `ReactNativeOTPOptions`

Builds on `CoreOTPOptions` from `@verino/core` with React Native-specific state and rendering options:

```ts
type ReactNativeOTPOptions = CoreOTPOptions & {
  value?:          string                   // live external control; does not trigger onComplete
  onChange?:       (code: string) => void   // fires on INPUT, DELETE, CLEAR, PASTE
  separatorAfter?: number | number[]
  separator?:      string                   // default: '—'
  masked?:         boolean
  maskChar?:       string                   // default: '●'
}
```

### `UseOTPResult`

```ts
type UseOTPResult = {
  // Reactive state (plain values — update triggers re-render)
  slotValues:     string[]
  activeSlot:     number
  isComplete:     boolean
  hasError:       boolean
  hasSuccess:     boolean
  isDisabled:     boolean
  isReadOnly:     boolean
  isFocused:      boolean
  timerSeconds:   number           // live countdown; 0 when expired or no timer
  timer:          TimerController  // imperative timer controls and snapshots
  separatorAfter: number | number[]
  separator:      string

  // Bindings
  hiddenInputProps: HiddenInputProps  // spread onto your own <TextInput>

  // Slot helpers
  getCode():                   string
  getSlots():                  SlotEntry[]
  getSlotProps(index: number): SlotRenderProps  // includes onPress for tap-to-focus

  // Programmatic control
  reset():                  void
  resend():                 void
  setError(v: boolean):     void
  setSuccess(v: boolean):   void
  setDisabled(v: boolean):  void
  setReadOnly(v: boolean):  void
  focus(slotIndex: number): void
}
```

### `HiddenInputProps`

The exact prop bag spread onto `<TextInput>`:

```ts
type HiddenInputProps = {
  ref:                  RefObject<any>
  value:                string
  onChangeText:         (text: string) => void
  onKeyPress:            (e: { nativeEvent: { key: string } }) => void
  onFocus:               () => void
  onBlur:                () => void
  maxLength:             number
  editable:              boolean
  keyboardType:          'number-pad' | 'default'
  textContentType:       'oneTimeCode'
  autoComplete:          'sms-otp'
  secureTextEntry:       boolean
  caretHidden:           true
  contextMenuHidden:     false
  importantForAutofill:  'yes'
  spellCheck:            false
  autoCorrect:           false
  autoCapitalize:        'none'
  accessibilityLabel:    string
  autoFocus?:            true
}
```

`TextInputRefLike` is a structural subset of React Native's real `TextInput` ref (`focus`, `blur`, and optionally `clear` / `isFocused` / `setSelection`) — any real `TextInput` instance satisfies it without this package importing `react-native`.

`hiddenInputProps.ref` is typed `RefObject<any>` rather than `RefObject<TextInputRefLike>`, specifically so `<TextInput {...otp.hiddenInputProps} />` type-checks against the real `TextInput`'s own ref type. TypeScript's ref assignability needs our ref's `current` type to be a *supertype* of the real `TextInput` instance (which includes `measure`, `measureInWindow`, `setNativeProps`, and more) — `TextInputRefLike` deliberately isn't that, since it only models the handful of members this package calls internally. The ref still holds a real `TextInput` instance at runtime; only its public TypeScript type is widened.

---

## Differences from `@verino/react`

Mobile has no DOM, no `data-*` CSS attribute styling, and no mouse-driven cursor placement. The architecture is otherwise identical (single hidden input, stable core instance, same options surface), with these adapter-specific exceptions:

- No `getInputProps` / `data-*` attribute system — style slots from plain booleans on `getSlotProps(index)` instead.
- No `wrapperProps` — read `isComplete` / `hasError` / `hasSuccess` / `isDisabled` / `isReadOnly` directly off the hook result.
- No shipped `HiddenOTPInput` wrapper component — spread `hiddenInputProps` directly onto your own `<TextInput>` so this package never needs to import `react-native`.
- `getSlotProps(index)` adds `onPress` — tapping a slot moves the cursor there, since there's no visible text caret to click into on a transparent overlay input.
- `onChangeText` is the single source of truth for typed input, backspace, long-press paste, and SMS autofill alike (RN always reports the field's full current value on every edit). `onKeyPress` only covers hardware-keyboard `ArrowLeft`/`ArrowRight` navigation, which `onChangeText` cannot represent.
- `haptic` / `sound` are accepted for API parity with the other adapters but no-op on native unless you supply a `feedback` runtime (`navigator.vibrate` / Web Audio don't exist in the RN JS engine).
- `selectOnFocus`, native caret placement on focus, and caret sync on `ArrowLeft`/`ArrowRight` all work the same as the DOM adapters, but are **best-effort**: they rely on the real `TextInput` ref exposing an optional `setSelection(start, end)` method, whose presence and exact behavior can vary by React Native version and platform. When unavailable, these calls silently no-op — typing, backspace, paste, and autofill are unaffected either way.

---

## License

MIT © [Olawale Balo](https://github.com/boastack)
