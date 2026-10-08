/**
 * verino — React Native example
 *
 * Demonstrates:
 *   - useOTP hook (single hidden-TextInput architecture)
 *   - getSlots() for slot iteration
 *   - getSlotProps() for full slot render props (hasFakeCaret, masked, onPress, …)
 *   - hiddenInputProps spread directly onto a real <TextInput> — this package
 *     never imports 'react-native' itself
 *   - Typing, SMS autofill, deletion, tap-to-focus, completion
 */

import { Fragment, useMemo } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useOTP } from '@verino/react-native'

/** Returns true when a separator should be rendered before slot `i`. */
function isSeparatorBefore(separatorAfter: number | number[], i: number): boolean {
  if (Array.isArray(separatorAfter)) return separatorAfter.includes(i)
  return separatorAfter > 0 && i === separatorAfter
}

/** Format remaining seconds as M:SS. */
function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function OTPScreen() {
  const otp = useOTP({
    length: 6,
    type:   'numeric',
    timer:  60,

    // Strip common paste formatting: "G-123456" or "123 456" → "123456"
    pasteTransformer: (raw: string) => raw.replace(/[\s-]/g, ''),

    masked:      true,
    maskChar:    '*',
    placeholder: '○',

    separatorAfter: 3,
    separator:      '—',

    onComplete: (code: string) => {
      console.log('Complete:', code)
      otp.setError(code !== '123456')
    },
    onExpire: () => console.log('Expired'),
  })

  const timerLabel = useMemo(() => formatTimer(otp.timerSeconds), [otp.timerSeconds])

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Enter verification code</Text>
      <Text style={styles.subheading}>
        Enter the 6-digit code sent to <Text style={styles.bold}>hello@example.com</Text>.
      </Text>

      {/*
        One transparent TextInput sits over the slot row and captures all
        input, autofill, and paste. Slot Views are purely visual — no event
        handling of their own. hiddenInputProps is a plain props object this
        package builds without ever importing 'react-native'.
      */}
      <View style={styles.row}>
        <TextInput {...otp.hiddenInputProps} style={StyleSheet.absoluteFill} />

        {otp.getSlots().map((slot) => {
          const p = otp.getSlotProps(slot.index)
          const display = p.isFilled ? (p.masked ? p.maskChar : p.char) : p.placeholder

          return (
            <Fragment key={slot.index}>
              {otp.separatorAfter != null && isSeparatorBefore(otp.separatorAfter, slot.index) && (
                <Text style={styles.separator} accessibilityElementsHidden>{otp.separator}</Text>
              )}

              <Pressable onPress={p.onPress}>
                <View
                  style={[
                    styles.slot,
                    p.isActive && p.isFocused && styles.slotActive,
                    p.isFilled && styles.slotFilled,
                    otp.isComplete && styles.slotComplete,
                    p.isError && styles.slotError,
                    p.isDisabled && styles.slotDisabled,
                  ]}
                >
                  {p.hasFakeCaret && <View style={styles.caret} />}
                  <Text style={styles.slotText}>{display}</Text>
                </View>
              </Pressable>
            </Fragment>
          )
        })}
      </View>

      {otp.timerSeconds > 0 && (
        <Text style={[styles.timer, otp.timerSeconds < 10 && styles.timerExpiring]}>
          Expires in {timerLabel}
        </Text>
      )}

      {otp.hasError && (
        <Text style={[styles.msg, styles.error]}>Incorrect code. Try 123456.</Text>
      )}
      {otp.isComplete && !otp.hasError && (
        <Text style={[styles.msg, styles.success]}>✓ Verified!</Text>
      )}

      <View style={styles.controls}>
        <Pressable style={styles.button} onPress={otp.reset}><Text>Reset</Text></Pressable>
        <Pressable style={styles.button} onPress={() => otp.setError(false)}><Text>Clear error</Text></Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:       { flex: 1, padding: 32, backgroundColor: '#FFFFFF' },
  heading:      { fontSize: 20, fontWeight: '700', color: '#0C0C0C' },
  subheading:   { marginTop: 4, marginBottom: 24, color: '#757575', fontSize: 14 },
  bold:         { fontWeight: '700' },
  row:          { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 8 },
  separator:    { color: '#B2B2B2', fontSize: 18, paddingHorizontal: 2 },
  slot: {
    width: 48, height: 56,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#DBDBDB', borderRadius: 10,
    backgroundColor: '#FAFAFA',
  },
  slotActive:   { borderColor: '#2A2A2A' },
  slotFilled:   { backgroundColor: '#FFFFFF' },
  slotComplete: { borderColor: '#00C65B' },
  slotError:    { borderColor: '#FF3846' },
  slotDisabled: { opacity: 0.45 },
  slotText:     { fontSize: 24, fontWeight: '600', color: '#0C0C0C' },
  caret:        { position: 'absolute', width: 2, height: '52%', backgroundColor: '#2A2A2A', borderRadius: 1 },
  timer:        { marginTop: 8, fontSize: 13, color: '#757575' },
  timerExpiring:{ color: '#FF3846' },
  msg:          { marginTop: 8, fontSize: 13 },
  error:        { color: '#FF3846' },
  success:      { color: '#00C65B' },
  controls:     { flexDirection: 'row', gap: 8, marginTop: 20 },
  button:       { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#DBDBDB' },
})
