/**
 * verino/core
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure OTP state machine — zero DOM, zero framework, zero side effects.
 * All adapters (vanilla, React, Vue, Svelte, Alpine, Web Components) import
 * from here. Nothing else is shared between them.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

export type {
  InputType,
  OTPState,
  OTPOptions,
  OTPEvent,
  OTPEventType,
  InputProps,
  SlotEntry,
  SlotProps,
  TimerOptions,
  TimerControls,
  StateListener,
} from './types.js'
export { filterChar, filterString }                    from './filter.js'
export { createTimer, formatCountdown }                from './timer.js'
export { triggerHapticFeedback, triggerSoundFeedback } from './feedback.js'
export { createOTP }                                   from './machine.js'
