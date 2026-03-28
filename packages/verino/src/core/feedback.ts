/**
 * verino/core/feedback
 * ─────────────────────────────────────────────────────────────────────────────
 * Optional sensory feedback utilities — exported so consumers can call them
 * in their own event handlers without reimplementing the Web Audio / vibration
 * boilerplate ("bring your own feedback" pattern).
 *
 * Used internally by the core machine when `haptic` / `sound` options are set.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

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
  try { navigator?.vibrate?.(10) } catch { /* not supported — fail silently */ }
}

const TONE_FREQUENCY_HZ  = 880   // A5 — chosen for clear audible confirmation
const TONE_DURATION_S    = 0.08  // 80ms — short enough to not be intrusive
const TONE_INITIAL_GAIN  = 0.08  // 0–1 amplitude; quiet by design so the tone is noticeable but not jarring

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
    const audioCtx    = new AudioContext()
    const oscillator  = audioCtx.createOscillator()
    const gainNode    = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = TONE_FREQUENCY_HZ
    gainNode.gain.setValueAtTime(TONE_INITIAL_GAIN, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + TONE_DURATION_S)
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + TONE_DURATION_S)

    // Primary close path — fires when the oscillator finishes naturally.
    oscillator.onended = () => { audioCtx.close().catch(() => { /* ignore */ }) }

    // Safety fallback — close the context even if onended never fires (e.g. the
    // oscillator is garbage-collected before it stops, or the browser omits the
    // event). Prevents AudioContext accumulation against Chrome's ~6-context limit.
    setTimeout(() => { audioCtx.close().catch(() => { /* ignore */ }) }, 500)
  } catch { /* Web Audio not available — fail silently */ }
}
