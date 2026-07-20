# Upgrade guide for the next minor release

This release is additive. Existing Verino 2.x integrations do not need code
changes. Browser Web OTP, timer defaults, callbacks, and adapter return values keep
their existing behavior.

## Optional secure timer restoration

Persist only the deadline—not the OTP value:

```ts
import { createTimer } from '@verino/core'
import { createTimerPersistence } from '@verino/core/toolkit/storage'

const saved = createTimerPersistence({ storage: sessionStorage, key: 'verify-expiry' })
const timer = createTimer({ totalSeconds: 60, expiresAt: saved.loadExpiresAt() ?? undefined })
const stopPersistence = saved.bind(timer)
```

Keep the server authoritative. Clear the recovery session after success or when
the server invalidates it.

## Optional custom automatic-code transport

Vanilla and Web Component continue using browser Web OTP by default. Inject a
transport only when another platform owns code retrieval:

```ts
const transport = {
  async receive({ signal }) {
    return nativeBridge.waitForVerificationCode({ signal })
  },
}

initOTP(element, { otpTransport: transport })
// or: verinoElement.otpTransport = transport
```

Use `otpTransport: false` to disable automatic retrieval. Custom transports should
honor cancellation and must not persist or log codes.

## Localized built-in UI

Vanilla, Alpine, and Web Component accept `messages` overrides for accessible
labels, timer copy, and resend copy. Function-valued labels receive the active
length and `digit`/`character` unit.

## Styling

Existing color tokens still work. New ring, motion, caret, timer, and resend tokens
remove remaining hard-coded built-in styles. See [Design tokens](./DESIGN_TOKENS.md).