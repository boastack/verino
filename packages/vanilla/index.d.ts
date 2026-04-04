/** Public type facade for the `@verino/vanilla` package. */
import type {
  CoreOTPOptions,
  FeedbackOptions,
  FieldBehaviorOptions,
  ResendUIOptions,
  TimerUIOptions,
} from '@verino/core'
import type {
  VerinoPlugin,
  VerinoPluginContext,
  VerinoWrapper,
} from './plugins/types'

export type VerinoInstance = {
  reset: () => void
  resend: () => void
  setError: (isError: boolean) => void
  setSuccess: (isSuccess: boolean) => void
  setDisabled: (isDisabled: boolean) => void
  setReadOnly: (isReadOnly: boolean) => void
  getCode: () => string
  focus: (slotIndex: number) => void
  destroy: () => void
}

export type VanillaOnlyOptions =
  & CoreOTPOptions
  & TimerUIOptions
  & ResendUIOptions
  & FeedbackOptions
  & FieldBehaviorOptions
  & {
    separatorAfter?: number | number[]
    separator?: string
    masked?: boolean
    maskChar?: string
  }

export declare function initOTP(target: HTMLElement, options?: VanillaOnlyOptions): [VerinoInstance]
export declare function initOTP(target: string, options?: VanillaOnlyOptions): VerinoInstance[]
export declare function initOTP(): VerinoInstance[]
export declare function initOTP(target: string | HTMLElement, options?: VanillaOnlyOptions): VerinoInstance[]

declare global {
  interface Window {
    Verino: {
      init: typeof initOTP
    }
  }
}

export type {
  VerinoPlugin,
  VerinoPluginContext,
  VerinoWrapper,
}
