# verino — Expo demo

A runnable Expo app demonstrating [`@verino/react-native`](../../packages/react-native): a single hidden `TextInput` overlaying visual slot views, native SMS autofill, tap-to-focus slots, a live countdown/resend, and `expo-haptics` wired into verino's `feedback` runtime.

This app depends on `@verino/react-native` via a local `file:` path into the monorepo (it isn't published to npm from this checkout), so the package must be built first.

## Run it

```bash
# From the repo root — builds packages/react-native/dist
pnpm build

cd examples/react-native-expo
npm install
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), `w` (web), or scan the QR code with Expo Go on a physical device.

The demo code is `123456` — type it in, or try an incorrect code to see the error state, or wait for the 30s timer to expire and tap **Resend code**.

## What to look at

- **`App.tsx`** — the whole screen, including `useOTP`'s `hiddenInputProps` spread directly onto a real `<TextInput>`, `getSlotProps(index).onPress` for tap-to-focus, and `expo-haptics` passed in via the `feedback` option.
- No Expo config plugin or native module is required by `@verino/react-native` itself — it's pure JS/TS and never imports `react-native`, so it works the same in Expo Go, a development build, or bare React Native.
