# Security Policy

## Supported Versions

Only the latest stable release of Verino receives security updates. We do not backport fixes to older major versions.

| Version | Supported          |
|---------|--------------------|
| 1.x.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Public issues are visible to everyone, including potential attackers. Use one of the private channels below instead.

### Option A — GitHub Private Security Advisory (preferred)

[github.com/verinojs/verino/security/advisories/new](https://github.com/verinojs/verino/security/advisories/new)

GitHub's advisory system allows us to collaborate privately on a fix before any public disclosure.

### Option B — Email

[security@verino.dev](mailto:security@verino.dev)

Please encrypt sensitive reports with our PGP key if possible.

---

## What to Include in Your Report

The more detail you provide, the faster we can assess and fix the issue:

- **Description** — What is the vulnerability? What can an attacker achieve?
- **Steps to reproduce** — A minimal, reproducible example if possible
- **Affected versions** — Which version(s) of which packages are affected?
- **Potential impact** — What is the worst-case scenario?
- **Suggested fix** — Optional, but very helpful if you have one

---

## Response Timeline

| Stage | Timeframe |
|---|---|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 7 days |
| Fix — Critical | 24–72 hours |
| Fix — High | Within 7 days |
| Fix — Medium | Within 30 days |
| Fix — Low | Next scheduled release |

We will keep you informed throughout the process. If you haven't heard back within 48 hours, please follow up — emails sometimes get lost.

---

## Disclosure Policy

We follow a **coordinated disclosure** process:

1. Reporter submits a private report
2. Maintainer acknowledges and begins investigation
3. A fix is developed in a private fork
4. Fix is reviewed and tested
5. A new release is published with the fix
6. A public GitHub Security Advisory is created with full details
7. Reporter is credited in the advisory and changelog (unless they prefer to remain anonymous)

We aim to disclose publicly within **90 days** of the initial report, sooner if the fix is ready earlier.

---

## Security Scope for Verino

Verino is a **UI component library** for rendering OTP input fields. Understanding its scope helps clarify what is and isn't a security concern.

### What Verino is responsible for

- ✅ Correct input rendering and visual display
- ✅ Accessible, keyboard-navigable input interaction
- ✅ Not leaking slot values outside the component unintentionally
- ✅ Safe handling of paste and autofill events
- ✅ Not introducing XSS vulnerabilities through DOM manipulation

### What Verino is NOT responsible for

- ❌ OTP code validation (always do this server-side)
- ❌ Rate limiting or brute-force protection
- ❌ Token storage or session management
- ❌ Network request security
- ❌ The security of the authentication system Verino is embedded in

### Important note for users

Verino renders input fields. It does not validate whether an OTP code is correct — that is always the responsibility of your server. **Never trust client-side validation alone.** A user can bypass any JavaScript validation; only your server can definitively verify an OTP.

---

## Known Security Properties

For your due diligence:

- Verino makes **no network requests** of its own
- Verino stores **no data** — slot values exist only in memory for the lifetime of the component
- Verino sets **no cookies**
- Input values **never leave the component** unless you explicitly handle them in `onComplete` or `onChange`
- The Web OTP API (`navigator.credentials.get`) is called by the vanilla adapter on Android Chrome to enable SMS autofill — this is an opt-in browser API, and no data is sent to Verino servers
- All DOM manipulation is scoped to the wrapper element you provide

---

## Bug Bounty

Verino is a solo-maintained open source project and does not currently offer a paid bug bounty program. We do publicly credit all security reporters who wish to be recognized, and we are deeply grateful for responsible disclosure.
