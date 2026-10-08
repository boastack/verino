/**
 * verino — Expo demo app
 *
 * A fully runnable Expo screen demonstrating @verino/react-native:
 *   - single hidden TextInput overlaying visual slot views
 *   - native SMS autofill (textContentType="oneTimeCode" / autoComplete="sms-otp")
 *   - tap-to-focus slots via getSlotProps(index).onPress
 *   - live countdown timer + resend
 *   - expo-haptics wired into the `feedback` runtime (navigator.vibrate
 *     doesn't exist on native, so verino never assumes it)
 *
 * Run with:
 *   pnpm build                      # from the repo root — builds packages/react-native/dist
 *   cd examples/react-native-expo
 *   npm install
 *   npx expo start                  # then press i / a / w, or scan the QR code
 */

import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native'
import { useOTP } from '@verino/react-native'

const CORRECT_CODE = '123456'

export default function App() {
  const [verifying, setVerifying] = useState(false)

  const otp = useOTP({
    length: 6,
    type: 'numeric',
    timer: 30,

    feedback: {
      haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    },

    onComplete: async (code) => {
      setVerifying(true)
      otp.setDisabled(true)
      // Simulate a network round-trip.
      await new Promise((resolve) => setTimeout(resolve, 600))
      setVerifying(false)
      otp.setDisabled(false)
      if (code === CORRECT_CODE) {
        otp.setSuccess(true)
      } else {
        otp.setError(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    },

    onResend: () => Alert.alert('Code resent', `Try ${CORRECT_CODE}`),
    onExpire: () => Alert.alert('Code expired', 'Tap resend to get a new one.'),
  })

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="auto" />

      <Text style={styles.heading}>Enter verification code</Text>
      <Text style={styles.subheading}>
        We sent a 6-digit code to <Text style={styles.bold}>hello@example.com</Text>.{'\n'}
        (Demo code: {CORRECT_CODE})
      </Text>

      <View style={styles.row}>
        <TextInput {...otp.hiddenInputProps} style={StyleSheet.absoluteFill} />

        {otp.getSlots().map((slot) => {
          const p = otp.getSlotProps(slot.index)
          return (
            <Pressable key={slot.index} onPress={p.onPress} hitSlop={4}>
              <View
                style={[
                  styles.slot,
                  p.isActive && p.isFocused && styles.slotActive,
                  p.isFilled && styles.slotFilled,
                  p.isError && styles.slotError,
                  otp.hasSuccess && styles.slotSuccess,
                  otp.isDisabled && styles.slotDisabled,
                ]}
              >
                {p.hasFakeCaret && <View style={styles.caret} />}
                <Text style={styles.slotText}>{p.char}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      {verifying && <Text style={styles.status}>Verifying…</Text>}
      {otp.hasError && <Text style={[styles.status, styles.error]}>Incorrect code — try again.</Text>}
      {otp.hasSuccess && <Text style={[styles.status, styles.success]}>✓ Verified!</Text>}

      {otp.timerSeconds > 0 ? (
        <Text style={styles.timer}>Resend available in {otp.timerSeconds}s</Text>
      ) : (
        <Pressable onPress={otp.resend}>
          <Text style={styles.resend}>Resend code</Text>
        </Pressable>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', padding: 24, paddingTop: 64 },
  heading: { fontSize: 22, fontWeight: '700', color: '#0C0C0C' },
  subheading: { marginTop: 6, marginBottom: 32, color: '#757575', fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '700', color: '#0C0C0C' },
  row: { position: 'relative', flexDirection: 'row', gap: 8 },
  slot: {
    width: 48, height: 56,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#DBDBDB', borderRadius: 10,
    backgroundColor: '#FAFAFA',
  },
  slotActive:   { borderColor: '#2A2A2A' },
  slotFilled:   { backgroundColor: '#FFFFFF' },
  slotError:    { borderColor: '#FF3846' },
  slotSuccess:  { borderColor: '#00C65B' },
  slotDisabled: { opacity: 0.5 },
  slotText:     { fontSize: 22, fontWeight: '600', color: '#0C0C0C' },
  caret:        { position: 'absolute', width: 2, height: '52%', backgroundColor: '#2A2A2A', borderRadius: 1 },
  status:       { marginTop: 16, fontSize: 14 },
  error:        { color: '#FF3846' },
  success:      { color: '#00C65B' },
  timer:        { marginTop: 16, fontSize: 13, color: '#757575' },
  resend:       { marginTop: 16, fontSize: 13, color: '#2A2A2A', fontWeight: '600' },
})
