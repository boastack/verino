# Security policy

## Reporting a vulnerability

Please do not disclose security vulnerabilities in a public issue. Use the
repository's **Security → Report a vulnerability** flow. If private vulnerability
reporting is unavailable, contact the package owner through the verified links on
the npm package page and include a minimal reproduction, affected version, and
impact. Avoid including real OTPs, phone numbers, email addresses, or credentials.

## Responsibility boundary

Verino collects and presents a one-time code. It does not generate, deliver, or
verify codes and it does not authenticate users. Applications must perform every
security decision on a trusted server.

- Generate codes with a cryptographically secure random source.
- Store a one-way verifier rather than a plaintext code when possible.
- Enforce a short server-side expiry, one-time use, and invalidation after success.
- Rate-limit issuance, resend, and verification independently.
- Limit attempts and return generic responses that do not reveal account existence.
- Bind recovery sessions to the intended account, purpose, and client context.
- Never log codes through `onComplete`, analytics, error reporting, or session replay.

## Client-side persistence

Do not persist OTP digits in localStorage, sessionStorage, cookies, URLs, or page
history. `createTimerPersistence()` is deliberately limited to a version and an
absolute expiry timestamp; it never serializes the code. Client timers improve UX
only—the server's expiry remains authoritative.

## Automatic-code transports

Browser Web OTP remains Verino's default automatic-code transport. Custom
`OTPTransport` implementations must:

- honor the provided `AbortSignal` and release listeners when it aborts;
- resolve with a code or `null`, without logging or retaining the code;
- use an authenticated, origin-bound platform channel;
- treat the received code as untrusted input and rely on server verification.

Set `otpTransport: false` when automatic retrieval is inappropriate. Web OTP must
run in a secure context and its SMS format must be bound to the requesting origin.

## Supported versions

Security fixes are applied to the latest published major version. Consumers should
stay on the latest patch release and review release notes before upgrading majors.