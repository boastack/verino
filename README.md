<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner.png" alt="verino" width="100%" />
</a>

<h1 align="center">verino</h1>

<h3 align="center">
  A single OTP state machine that powers React, Vue, Svelte, Alpine, Vanilla JS, and Web Components.
</h3>

<p align="center">
  Built by <a href="https://github.com/walebuilds">@Olawale Balo</a> — Product Designer + Design Engineer
</p>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/verino"><img src="https://img.shields.io/npm/v/verino?color=20C55C&label=verino" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/verino"><img src="https://img.shields.io/bundlephobia/minzip/verino?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/Dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## What is verino?

verino is a headless OTP and verification code input library. The core is a zero-dependency, zero DOM TypeScript state machine with an event system. Each framework package wraps that core using idiomatic primitives such as a hook, composable, store and action, directive, or custom element, without reimplementing any logic.

Every adapter shares the same single hidden input architecture. One real `<input>` captures keyboard events, native SMS autofill with `autocomplete="one-time-code"`, and the Web OTP API, while visual slot elements are purely decorative and driven by `data-*` attributes.

---

## Packages

| Package | Description | Version |
|---|---|---|
| [`verino`](./packages/verino) | Core state machine + vanilla DOM adapter | [![npm](https://img.shields.io/npm/v/verino?color=20C55C)](https://www.npmjs.com/package/verino) |
| [`@verino/react`](./packages/react) | `useOTP` hook + `HiddenOTPInput` component | [![npm](https://img.shields.io/npm/v/@verino/react?color=20C55C)](https://www.npmjs.com/package/@verino/react) |
| [`@verino/vue`](./packages/vue) | `useOTP` composable | [![npm](https://img.shields.io/npm/v/@verino/vue?color=20C55C)](https://www.npmjs.com/package/@verino/vue) |
| [`@verino/svelte`](./packages/svelte) | `useOTP` store + `action` | [![npm](https://img.shields.io/npm/v/@verino/svelte?color=20C55C)](https://www.npmjs.com/package/@verino/svelte) |
| [`@verino/alpine`](./packages/alpine) | `x-verino` directive | [![npm](https://img.shields.io/npm/v/@verino/alpine?color=20C55C)](https://www.npmjs.com/package/@verino/alpine) |
| [`@verino/web-component`](./packages/web-component) | `<verino-input>` custom element | [![npm](https://img.shields.io/npm/v/@verino/web-component?color=20C55C)](https://www.npmjs.com/package/@verino/web-component) |

---

## Architecture

```
verino (core + vanilla adapter)
├── createOTP()        ← pure state machine, zero DOM
├── initOTP()          ← vanilla DOM adapter
└── adapters/
    └── plugins/
        ├── timerUIPlugin   ← built-in countdown + resend UI
        ├── webOTPPlugin    ← SMS autofill via Web OTP API
        └── pmGuardPlugin   ← password manager badge guard

@verino/react          → useOTP hook + HiddenOTPInput
@verino/vue            → useOTP composable
@verino/svelte         → useOTP store + Svelte action
@verino/alpine         → VerinoAlpine plugin (x-verino directive)
@verino/web-component  → VerinoInput custom element (<verino-input>)
```

All adapter packages import `createOTP` from `verino`. No adapter reimplements event handling, character filtering, cursor movement, paste logic, or timer management.

---

## Features

- **One core, six adapters.** A single pure state machine powers every adapter (React, Vue, Svelte, Alpine.js, Vanilla JS, and Web Components) so fixes and improvements ship to all frameworks simultaneously.
- **Native autofill, no synthetic events.** A transparent `<input>` overlays the visual slots, capturing keyboard input, paste, SMS autofill, Web OTP API, password managers, screen readers, and IME natively.
- **Accessible by default.** `role="group"`, `aria-labelledby`, per-slot screen reader labels, `inputMode`, and `autocomplete="one-time-code"` are built in, with all visual slots marked `aria-hidden`.
- **Full programmatic control.** `setError`, `setSuccess`, `setDisabled`, `setReadOnly`, `reset()`, `focus(i)`, and `getCode()` are available across every adapter for seamless integration with async flows and external state.
- **Built-in timer and resend.** Pass `timer: 60` for a live countdown badge and cooldown-aware resend button wired to `reset()`, or provide `onTick` to power custom UI with the same timer logic.
- **Rich event system.** Subscribers receive a typed `OTPEvent` discriminated union alongside state (`INPUT`, `DELETE`, `PASTE`, `COMPLETE`, `RESET`, `ERROR`, `SUCCESS`, and more) for precise, event-driven reactions.
- **Password manager guard.** Floating credential badges from LastPass, 1Password, Dashlane, Bitwarden, and Keeper are automatically detected and repositioned via `MutationObserver` before they overlap your slots.
- **CSS variable theming.** Size, gap, radius, font, border, active ring, error and success states, caret, and placeholder are exposed as scoped CSS custom properties with no stylesheet overrides required.

---

## How verino compares

| Feature | verino | input-otp | react-otp-input |
|---|---|---|---|
| Pure headless state machine | ✅ | ✗ | ✗ |
| Typed event system | ✅ | ✗ | ✗ |
| Web OTP API (SMS intercept) | ✅ | ✗ | ✗ |
| Built-in timer and resend | ✅ | ✗ | ✗ |
| Masked mode | ✅ | ✗ | ✗ |
| Programmatic API (`setError`, `setSuccess`, `reset`, `focus`) | ✅ | ✗ | ✗ |
| Haptic and sound feedback | ✅ | ✗ | ✗ |
| `blurOnComplete` | ✅ | ✗ | ✗ |
| `onInvalidChar` callback | ✅ | ✗ | ✗ |
| `readOnly` mode | ✅ | ✗ | ✗ |
| `data-*` state attributes | ✅ | ✗ | ✗ |
| CSS variable theming | ✅ | ✗ | ✗ |
| Vanilla JS | ✅ | ✗ | ✗ |
| Vue | ✅ | ✗ | ✗ |
| Svelte | ✅ | ✗ | ✗ |
| Alpine.js | ✅ | ✗ | ✗ |
| Web Component | ✅ | ✗ | ✗ |
| React | ✅ | ✅ | ✅ |
| Single hidden input | ✅ | ✅ | ✗ |
| Password manager guard | ✅ | ✅ | ✗ |
| Zero dependencies | ✅ | ✅ | ✗ |
| TypeScript | ✅ | ✅ | ✅ |

---

## Installation

Install only the adapter for your framework — `verino` is declared as a dependency and installed automatically:

```bash
# React
npm i @verino/react

# Vue
npm i @verino/vue

# Svelte
npm i @verino/svelte

# Alpine.js
npm i @verino/alpine

# Web Component (framework-free)
npm i @verino/web-component

# Vanilla JS / TypeScript
npm i verino
```

### CDN

A pre-built IIFE bundle exposes `window.Verino.init`, identical to `initOTP`:

```html
<script src="https://unpkg.com/verino/dist/verino.min.js"></script>
<div class="verino-wrapper"></div>
<script>
  Verino.init('.verino-wrapper', { onComplete: (code) => console.log(code) })
</script>
```

Alpine.js CDN bundle — exposes `window.VerinoAlpine`:

```html
<script defer src="https://unpkg.com/alpinejs"></script>
<script src="https://unpkg.com/verino/dist/verino-alpine.min.js"></script>
<script>
  document.addEventListener('alpine:init', () => Alpine.plugin(VerinoAlpine))
</script>
```

Web Component CDN bundle — auto-registers `<verino-input>`:

```html
<script src="https://unpkg.com/verino/dist/verino-wc.min.js"></script>
<verino-input length="6" name="otp"></verino-input>
<script>
  document.querySelector('verino-input').addEventListener('complete', (e) => console.log(e.detail.code))
</script>
```

---

## Quick Example

### React

```tsx
import { useOTP, HiddenOTPInput } from '@verino/react'

function OTPField() {
  const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })

  return (
    <div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
      <HiddenOTPInput {...otp.hiddenInputProps} />
      {otp.getSlots().map((slot) => {
        const { char, isActive, isFilled, isError, hasFakeCaret, placeholder } = otp.getSlotProps(slot.index)
        return (
          <div
            key={slot.index}
            className={['slot', isActive && 'is-active', isFilled && 'is-filled', isError && 'is-error'].filter(Boolean).join(' ')}
          >
            {hasFakeCaret && <span className="caret" />}
            {isFilled ? char : placeholder}
          </div>
        )
      })}
    </div>
  )
}
```

### Vanilla JS

```html
<div class="verino-wrapper" data-length="6" data-timer="60"></div>

<script type="module">
  import { initOTP } from 'verino'
  const [otp] = initOTP('.verino-wrapper', {
    onComplete: (code) => verify(code),
  })
</script>
```

### Web Component

```html
<script type="module" src="https://unpkg.com/@verino/web-component"></script>
<verino-input length="6" timer="60"></verino-input>

<script>
  document.querySelector('verino-input')
    .addEventListener('complete', (e) => verify(e.detail.code))
</script>
```

---

## Common Patterns

| Pattern | Key options |
|---|---|
| SMS / email OTP | `type: 'numeric'`, `timer: 60`, `onResend` |
| 2FA / TOTP with grouping | `separatorAfter: 3` |
| PIN entry | `masked: true`, `blurOnComplete: true` |
| Alphanumeric code | `type: 'alphanumeric'`, `pasteTransformer` |
| Invite / referral code | `separatorAfter: [3, 6]`, `pattern: /^[A-Z0-9]$/` |
| Hex activation key | `pattern: /^[0-9A-F]$/` |
| Async verification lock | `setDisabled(true/false)` around API call |
| Native form submission | `name: 'otp_code'` |
| Pre-fill on mount | `defaultValue: '123456'` |
| Display-only field | `readOnly: true` |

---

## Monorepo Development

This repository is a [pnpm](https://pnpm.io) workspace managed by [Turborepo](https://turbo.build).

```bash
pnpm install        # install dependencies
pnpm build          # build all packages
pnpm build:cdn      # build CDN bundles
pnpm test           # run unit tests
pnpm typecheck      # type-check all packages
pnpm dev            # watch mode
```

```
verino/
├── packages/
│   ├── verino/          # core + vanilla adapter
│   ├── react/
│   ├── vue/
│   ├── svelte/
│   ├── alpine/
│   └── web-component/
├── tests/               # unit, SSR, and e2e tests
├── examples/            # per-framework demos
└── dist/                # CDN bundles (generated)
```

---

## Contributing

See [CONTRIBUTING.md](./.github/CONTRIBUTING.md) for guidelines. Issues and pull requests are welcome.

```bash
# Run all tests before submitting a PR
pnpm test
pnpm typecheck
```

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)