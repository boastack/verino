import type { InputType } from '../types.js'

export type OTPCodeUnit = 'digit' | 'character'

/** User-facing strings rendered by adapters with built-in DOM. */
export type OTPUIStrings = {
  groupLabel: (length: number, unit: OTPCodeUnit) => string
  inputLabel: (length: number, unit: OTPCodeUnit) => string
  expiresIn: string
  resendPrompt: string
  resendAction: string
  resendButtonLabel: string
}

export type OTPUIStringOverrides = Partial<OTPUIStrings>

export const defaultOTPUIStrings: Readonly<OTPUIStrings> = Object.freeze({
  groupLabel: (length: number, unit: OTPCodeUnit) => `${length}-${unit} verification code`,
  inputLabel: (length: number, unit: OTPCodeUnit) => `Enter your ${length}-${unit} code`,
  expiresIn: 'Code expires in',
  resendPrompt: 'Didn\u2019t receive the code?',
  resendAction: 'Resend',
  resendButtonLabel: 'Resend verification code',
})

/** Resolve partial localized strings against stable English defaults. */
export function resolveOTPUIStrings(overrides?: OTPUIStringOverrides): OTPUIStrings {
  if (!overrides || typeof overrides !== 'object') return { ...defaultOTPUIStrings }

  return {
    groupLabel: typeof overrides.groupLabel === 'function'
      ? overrides.groupLabel
      : defaultOTPUIStrings.groupLabel,
    inputLabel: typeof overrides.inputLabel === 'function'
      ? overrides.inputLabel
      : defaultOTPUIStrings.inputLabel,
    expiresIn: typeof overrides.expiresIn === 'string'
      ? overrides.expiresIn
      : defaultOTPUIStrings.expiresIn,
    resendPrompt: typeof overrides.resendPrompt === 'string'
      ? overrides.resendPrompt
      : defaultOTPUIStrings.resendPrompt,
    resendAction: typeof overrides.resendAction === 'string'
      ? overrides.resendAction
      : defaultOTPUIStrings.resendAction,
    resendButtonLabel: typeof overrides.resendButtonLabel === 'string'
      ? overrides.resendButtonLabel
      : defaultOTPUIStrings.resendButtonLabel,
  }
}

/** Map an input mode to the noun used in accessible labels. */
export function getOTPCodeUnit(type: InputType): OTPCodeUnit {
  return type === 'numeric' ? 'digit' : 'character'
}
