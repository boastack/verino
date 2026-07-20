import type { InputType, OTPInstance, TimerController } from '@verino/core'
import type { OTPTransport } from '@verino/core/toolkit/transport'
import type { OTPUIStrings } from '@verino/core/toolkit/messages'

export type VerinoWrapper = HTMLElement & {
  __verinoFooterEl?: HTMLDivElement | null
  __verinoResendRowEl?: HTMLDivElement | null
  __verinoTimerController?: TimerController | null
  __verinoInstance?: { destroy(): void } | null
}

export type VerinoPluginContext = {
  otp: OTPInstance
  wrapperEl: VerinoWrapper
  hiddenInputEl: HTMLInputElement
  slotRowEl: HTMLDivElement
  slotCount: number
  inputType: InputType
  pattern?: RegExp
  timerSeconds: number
  resendCooldown: number
  onResend?: () => void
  onTickCallback?: (remaining: number) => void
  onExpire?: () => void
  otpTransport?: OTPTransport | false
  otpTransportTimeout: number
  messages: OTPUIStrings
  clearField: () => void
  syncSlots: () => void
}

export type VerinoPlugin = {
  name: string
  install: (ctx: VerinoPluginContext) => () => void
}
