/**
 * verino
 * ─────────────────────────────────────────────────────────────────────────────
 * OTP input library for the modern web.
 * Vanilla JS · React · Vue · Svelte · Alpine · Web Components
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

// Core — pure logic, zero DOM
export {
  createOTP,
  createTimer,
  filterChar,
  filterString,
  formatCountdown,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type InputType,
  type OTPState,
  type OTPOptions,
  type OTPEvent,
  type OTPEventType,
  type InputProps,
  type SlotEntry,
  type SlotProps,
  type TimerOptions,
  type TimerControls,
  type StateListener,
} from './core/index.js'

// Vanilla DOM adapter
export {
  initOTP,
  type VerinoInstance,
  type VanillaOnlyOptions,
} from './adapters/vanilla.js'

// Plugin types — exported so consumers can author custom plugins without
// importing from deep internal paths.
export {
  type VerinoPlugin,
  type VerinoPluginContext,
  type VerinoWrapper,
} from './adapters/plugins/types.js'
