/**
 * @verino/core/toolkit
 * ─────────────────────────────────────────────────────────────────────────────
 * Toolkit helpers for adapters built on top of the Verino core state machine.
 *
 * This subpath intentionally holds DOM / Web API integration helpers separately
 * from the pure OTP machine exported at `@verino/core`.
 */

export {
  subscribeFeedback,
  triggerHapticFeedback,
  triggerSoundFeedback,
} from './feedback.js'
export {
  migrateProgrammaticValue,
  seedProgrammaticValue,
  syncProgrammaticValue,
} from './adapter-policy.js'
export {
  createResendTimer,
} from './timer-policy.js'
export {
  applyExternalValue,
  applyPastedInput,
  applyTypedInput,
  boolAttr,
  clampSlotIndex,
  clearOTPInput,
  createFrameScheduler,
  filterExternalValue,
  filterTypedValue,
  focusOTPInput,
  handleOTPKeyAction,
  insertCode,
  migrateValueForConfigChange,
  scheduleFocusSync,
  scheduleInputBlur,
  scheduleInputFocus,
  scheduleInputSelection,
  syncExternalValue,
  syncFocusSelection,
  syncInputValue,
} from './controller.js'
export {
  PASSWORD_MANAGER_BADGE_OFFSET_PX,
  isPasswordManagerActive,
  watchForPasswordManagerBadge,
} from './password-manager.js'
