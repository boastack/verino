# Changelog — @verino/web-component

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-01

### Added

- `<verino-input>` custom element — self-registers on import; open shadow root so `--verino-*` CSS custom properties cascade in from the host element.
- HTML attributes for declarative configuration: `length`, `type`, `timer`, `resend-after`, `disabled`, `readonly`, `separator-after`, `separator`, `masked`, `mask-char`, `name`, `placeholder`, `auto-focus`, `select-on-focus`, `blur-on-complete`, `default-value`, `sound`, `haptic`. All attributes are observed via `observedAttributes`; changes take effect without re-mounting.
- JS-only property setters for values that cannot be expressed as HTML attributes: `pattern`, `pasteTransformer`, `onComplete`, `onResend`, `onFocus`, `onBlur`, `onInvalidChar`.
- DOM methods: `reset()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `getCode()`, `getSlots()`, `getInputProps(index)`.
- Custom events (all `bubbles: true`, `composed: true`): `complete` (`detail: { code }`), `expire`, `change` (`detail: { code }`), `success`.
- Web OTP API integration — requests an SMS credential via `navigator.credentials.get` on `connectedCallback`; aborted cleanly on `disconnectedCallback`.
- Password manager badge guard — neutralises overlay badges injected by common credential extensions within the shadow DOM.
- Built-in timer footer and resend row; both fully restored by `reset()`.
- CDN IIFE bundle at `dist/verino-wc.min.js` — self-registers `<verino-input>` on load; no import or plugin call required.
- Full TypeScript types: `VerinoInput`.

---

[Unreleased]: https://github.com/boastack/verino/compare/@verino/web-component@1.0.0...HEAD
[1.0.0]: https://github.com/boastack/verino/releases/tag/%40verino%2Fweb-component%401.0.0
