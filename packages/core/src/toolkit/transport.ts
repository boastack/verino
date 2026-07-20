/**
 * Transport abstraction for receiving one-time codes.
 *
 * The browser Web OTP API is the default transport, while adapters may inject
 * another implementation for native shells, tests, or platform-specific APIs.
 * Transports receive an AbortSignal and should stop pending work when aborted.
 */

export type OTPTransportContext = {
  signal: AbortSignal
}

export type OTPTransport = {
  receive: (context: OTPTransportContext) => Promise<string | null>
}

export type OTPTransportRequestOptions = {
  /** Transport to use. Defaults to `webOTPTransport`. */
  transport?: OTPTransport
  /** Maximum time to wait before cancellation. Default: 5 minutes. */
  timeoutMs?: number
}

export type OTPTransportRequest = {
  /** Resolves with a received code, or `null` when cancelled or unavailable. */
  promise: Promise<string | null>
  /** Signal passed to the active transport. */
  signal: AbortSignal
  /** Idempotently cancel the active request. */
  cancel: () => void
}

interface OTPCredentialLike {
  code?: string
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

/** Whether the current runtime exposes the browser Credential Management API. */
export function isWebOTPAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'credentials' in navigator
}

/** Errors that are normal outcomes of Web OTP cancellation or unavailability. */
export function isExpectedOTPTransportError(error: unknown): boolean {
  const name = (error as { name?: string })?.name
  const message = (error as { message?: string })?.message?.toLowerCase() ?? ''

  return name === 'AbortError'
    || name === 'InvalidStateError'
    || message === 'aborted'
}

/** Default browser transport backed by `navigator.credentials.get()`. */
export const webOTPTransport: OTPTransport = {
  async receive({ signal }): Promise<string | null> {
    if (!isWebOTPAvailable()) return null

    const credential = await (navigator.credentials.get as unknown as (
      options: { otp: { transport: ['sms'] }; signal: AbortSignal },
    ) => Promise<OTPCredentialLike | null>)({
      otp: { transport: ['sms'] },
      signal,
    })

    return typeof credential?.code === 'string' && credential.code
      ? credential.code
      : null
  },
}

/**
 * Start a cancellable OTP transport request.
 *
 * Cancellation and expected Web OTP errors resolve to `null`. Unexpected
 * transport failures reject so adapters can surface diagnostics without
 * confusing normal timeout/disconnect paths with real integration faults.
 */
export function requestOTPCode(
  options: OTPTransportRequestOptions = {},
): OTPTransportRequest {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number')
  }

  const controller = new AbortController()
  const transport = options.transport ?? webOTPTransport
  let settled = false

  let resolveCancellation: (value: null) => void = () => {}
  const cancellation = new Promise<null>((resolve) => {
    resolveCancellation = resolve
  })

  const cancel = (): void => {
    if (controller.signal.aborted) return
    controller.abort()
    resolveCancellation(null)
  }

  const timeoutId = setTimeout(cancel, timeoutMs)
  let received: Promise<string | null>
  try {
    // Invoke immediately so the default browser transport preserves the timing
    // of direct `navigator.credentials.get()` integrations.
    received = Promise.resolve(transport.receive({ signal: controller.signal }))
  } catch (error) {
    received = Promise.reject(error)
  }
  received = received.catch((error: unknown) => {
      if (isExpectedOTPTransportError(error)) return null
      throw error
    })

  const promise = Promise.race([received, cancellation]).finally(() => {
    if (settled) return
    settled = true
    clearTimeout(timeoutId)
  })

  return {
    promise,
    signal: controller.signal,
    cancel,
  }
}
