/**
 * verino/core
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared Verino core package.
 * This root entry is intentionally pure: state machine, filtering, timer, and
 * types only. Toolkit helpers live at `@verino/core/toolkit`.
 */

export type {
  BooleanDataAttr,
  InputType,
  OTPStateSnapshot,
  CoreBehaviorOptions,
  CoreCallbackOptions,
  CoreOTPOptions,
  OTPOptions,
  FeedbackOptions,
  TimerUIOptions,
  ResendUIOptions,
  FieldBehaviorOptions,
  OTPEvent,
  OTPEventType,
  InputProps,
  OTPDataAttrs,
  FocusDataAttrs,
  WrapperDataAttrs,
  HiddenInputAttrs,
  SlotEntry,
  SlotProps,
  TimerOptions,
  TimerControls,
  StateListener,
  OTPInstance,
} from './types.js'
export { filterChar, filterString, isInputType, parseBooleanish, parseInputType, parseSeparatorAfter } from './filter.js'
export { createTimer, formatCountdown }                from './timer.js'
export { createOTP }                                   from './machine.js'
