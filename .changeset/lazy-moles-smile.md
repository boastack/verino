---
"@verino/react-native": minor
---

Initial release of the React Native adapter. Mirrors `@verino/react`'s single-hidden-input architecture with a `TextInput` overlaying visual slot views, native SMS autofill (`textContentType="oneTimeCode"` / `autoComplete="sms-otp"`), and tap-to-focus slots via `getSlotProps(index).onPress`. The package never imports `react-native` — `hiddenInputProps` is a plain props object spread onto a consumer-rendered `<TextInput>`, keeping it zero-dependency and version-agnostic across bare RN and Expo.
