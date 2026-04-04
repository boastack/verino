import type { InputType, OTPInstance } from '@verino/core'

export type VerinoWrapper = HTMLElement & {
  __verinoFooterEl?: HTMLDivElement | null
  __verinoResendRowEl?: HTMLDivElement | null
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
  clearField: () => void
  syncSlots: () => void
}

export type VerinoPlugin = {
  name: string
  install: (ctx: VerinoPluginContext) => () => void
}
