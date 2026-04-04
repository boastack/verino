/**
 * @verino/core/toolkit/feedback
 * ─────────────────────────────────────────────────────────────────────────────
 * Browser feedback utilities — exported so adapters and consumers can trigger
 * haptic/audio confirmation without reimplementing Web Audio or the Vibration
 * API boilerplate.
 *
 * The OTP state machine itself stays side-effect free. Adapters call these in
 * response to emitted core events.
 */

import type { OTPEvent, OTPStateSnapshot, StateListener } from '../types.js'

/**
 * Trigger a short 10ms haptic pulse via `navigator.vibrate`.
 *
 * Silently no-ops in environments that do not support the Vibration API
 * (e.g. desktop browsers, Safari, SSR/Node.js). The `try/catch` guards against
 * stricter browsers that throw on unsupported calls rather than returning false.
 *
 * @returns `void` — result of `navigator.vibrate` is intentionally discarded.
 */
export function triggerHapticFeedback(): void {
  try { (globalThis as any).navigator?.vibrate?.(10) } catch { /* not supported — fail silently */ }
}

const TONE_FREQUENCY_HZ = 880
const TONE_DURATION_S  = 0.08
const TONE_INITIAL_GAIN = 0.08

/**
 * Play a brief 880 Hz tone via the Web Audio API.
 *
 * The oscillator uses an exponential gain ramp from `TONE_INITIAL_GAIN` to near-
 * zero so the tone fades naturally rather than cutting off with a click artefact.
 *
 * The `AudioContext` is closed immediately after the tone ends (via `onended`)
 * to prevent Chrome's ~6-concurrent-context limit from being reached across rapid
 * completions. A 500 ms safety timeout closes the context even if `onended` never
 * fires (e.g. when the oscillator is GC'd before stopping).
 *
 * Silently no-ops where the Web Audio API is unavailable.
 *
 * @returns `void` — all audio work is fire-and-forget.
 */
export function triggerSoundFeedback(): void {
  try {
    const audioCtx: AudioContext = new AudioContext()
    const oscillator: OscillatorNode = audioCtx.createOscillator()
    const gainNode: GainNode = audioCtx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = TONE_FREQUENCY_HZ
    gainNode.gain.setValueAtTime(TONE_INITIAL_GAIN, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + TONE_DURATION_S)
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + TONE_DURATION_S)

    oscillator.onended = () => { audioCtx.close().catch(() => {}) }
    const closeTimeout = setTimeout(() => { audioCtx.close().catch(() => {}) }, 500)
    closeTimeout.unref?.()
  } catch { /* Web Audio not available — fail silently */ }
}

type OTPSubscribable = {
  subscribe(listener: StateListener): () => void
}

/**
 * Attach the shared completion/error feedback behavior used by adapters.
 *
 * `COMPLETE` triggers optional haptic and sound feedback.
 * `ERROR` triggers optional haptic feedback when the machine is in an error state.
 */
export function subscribeFeedback(
  otp: OTPSubscribable,
  options: { haptic?: boolean; sound?: boolean } = {},
): () => void {
  const { haptic = true, sound = false } = options

  return otp.subscribe((_state: OTPStateSnapshot, event: OTPEvent) => {
    if (event.type === 'COMPLETE') {
      if (haptic) triggerHapticFeedback()
      if (sound) triggerSoundFeedback()
    } else if (event.type === 'ERROR' && event.hasError) {
      if (haptic) triggerHapticFeedback()
    }
  })
}
