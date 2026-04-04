<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner1.png" alt="verino" width="100%" />
</a>

<h1 align="center">verino</h1>

<h3 align="center">
  A single OTP state machine that powers React, Vue, Svelte, Alpine, Vanilla JS, and Web Components.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/core"><img src="https://img.shields.io/npm/v/@verino/core?color=20C55C&label=version" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/core"><img src="https://img.shields.io/bundlephobia/minzip/@verino/core?color=20C55C&label=core+gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

Verino is a headless OTP and verification code input library built around a single principle: **one state machine powers every framework adapter without reimplementing any logic.**

`@verino/core` is a zero-dependency, zero-DOM TypeScript state machine that handles character filtering, cursor movement, paste normalization, timer management, and a typed event system. Every adapter (React, Vue, Svelte, Alpine.js, Vanilla JS, and Web Components) wraps this core using the idiomatic primitives of its framework, such as hooks, composables, stores with actions, directives, or custom elements, without adding extra logic.

The key architectural decision is the **single hidden input.** A single `<input>` sits over purely decorative visual slots and captures keyboard events, paste, SMS autofill via `autocomplete="one-time-code"`, and the Web OTP API natively. Fixes ship once and apply to every framework simultaneously.

---

## Monorepo Architecture

```
verino/
├── packages/
│   ├── core/            @verino/core          — pure state machine, zero DOM
│   ├── vanilla/         @verino/vanilla        — DOM adapter + plugins
│   ├── react/           @verino/react          — useOTP hook + HiddenOTPInput
│   ├── vue/             @verino/vue            — useOTP composable (Ref<T>)
│   ├── svelte/          @verino/svelte         — useOTP store + use:action
│   ├── alpine/          @verino/alpine         — x-verino directive
│   └── web-component/   @verino/web-component  — <verino-input> custom element
├── tests/               unit (Jest), SSR, and E2E (Playwright) tests
├── examples/            runnable per-framework demos
├── .github/             CI workflows, issue templates, CONTRIBUTING.md
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**Dependency graph:** every adapter declares `@verino/core` as a direct dependency. No adapter depends on another adapter, and there are no circular references.

```
@verino/core
└── @verino/vanilla   (also ships timerUIPlugin, webOTPPlugin, pmGuardPlugin)
└── @verino/react
└── @verino/vue
└── @verino/svelte
└── @verino/alpine
└── @verino/web-component
```

---

## Packages

| Package | Install | Description |
|---|---|---|
| [`@verino/core`](./packages/core/README.md) | `npm i @verino/core` | Pure OTP state machine — zero DOM, zero framework |
| [`@verino/vanilla`](./packages/vanilla/README.md) | `npm i @verino/vanilla` | Vanilla DOM adapter + `timerUIPlugin`, `webOTPPlugin`, `pmGuardPlugin` |
| [`@verino/react`](./packages/react/README.md) | `npm i @verino/react` | `useOTP` hook + `HiddenOTPInput` component (React ≥ 18) |
| [`@verino/vue`](./packages/vue/README.md) | `npm i @verino/vue` | `useOTP` composable with `Ref<T>` reactive state (Vue ≥ 3) |
| [`@verino/svelte`](./packages/svelte/README.md) | `npm i @verino/svelte` | `useOTP` store + `use:action` directive (Svelte ≥ 4) |
| [`@verino/alpine`](./packages/alpine/README.md) | `npm i @verino/alpine` | `VerinoAlpine` plugin — `x-verino` directive (Alpine.js ≥ 3) |
| [`@verino/web-component`](./packages/web-component/README.md) | `npm i @verino/web-component` | `<verino-input>` Shadow DOM custom element |

> **You only need to install the adapter for your framework.** `@verino/core` is listed as a direct dependency of each adapter and installs automatically.

---

## Installation

### Monorepo development setup

**Prerequisites:** Node.js ≥ 18, pnpm ≥ 8.

```bash
git clone https://github.com/boastack/verino.git
cd verino
pnpm install
```

### Available scripts

```bash
pnpm build          # build all packages via Turborepo
pnpm build:cdn      # build CDN IIFE bundles
pnpm build:all      # build + CDN in one step
pnpm dev            # watch mode — rebuilds on change
pnpm test           # run Jest unit tests
pnpm test:coverage  # run tests with coverage report
pnpm test:e2e       # run Playwright end-to-end tests
pnpm typecheck      # type-check all packages
pnpm size           # check bundle sizes against declared limits
pnpm release        # build + publish via Changesets
```

---

## Quick Start

Install only the adapter for your framework:

```bash
# React
npm i @verino/react

# Vue
npm i @verino/vue

# Svelte
npm i @verino/svelte

# Alpine.js
npm i @verino/alpine

# Web Component
npm i @verino/web-component

# Vanilla JS
npm i @verino/vanilla
```

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

### Vue

```vue
<script setup lang="ts">
import { useOTP } from '@verino/vue'
const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
</script>

<template>
  <div v-bind="otp.wrapperAttrs.value" style="position: relative; display: inline-flex; gap: 8px">
    <input :ref="(el) => (otp.inputRef.value = el)" v-bind="otp.hiddenInputAttrs.value"
      style="position: absolute; inset: 0; opacity: 0; z-index: 1"
      @keydown="otp.onKeydown" @input="otp.onChange" @paste="otp.onPaste"
      @focus="otp.onFocus" @blur="otp.onBlur" />
    <div v-for="slot in otp.getSlots()" :key="slot.index" aria-hidden="true"
      :class="['slot', slot.isActive && 'is-active', slot.isFilled && 'is-filled']">
      {{ slot.isFilled ? slot.value : otp.placeholder }}
    </div>
  </div>
</template>
```

### Svelte

```svelte
<script>
  import { useOTP } from '@verino/svelte'
  const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
  const { slots, wrapperAttrs } = otp
</script>

<div {...$wrapperAttrs} style="position: relative; display: inline-flex; gap: 8px">
  <input use:otp.action style="position: absolute; inset: 0; opacity: 0; z-index: 1" />
  {#each $slots as slot (slot.index)}
    <div aria-hidden="true" class="slot" class:is-active={slot.isActive} class:is-filled={slot.isFilled}>
      {slot.isFilled ? slot.value : otp.placeholder}
    </div>
  {/each}
</div>
```

### Alpine.js

```html
<script defer src="https://unpkg.com/alpinejs"></script>
<script src="https://unpkg.com/@verino/alpine/dist/verino-alpine.min.js"></script>
<script>
  document.addEventListener('alpine:init', () => Alpine.plugin(VerinoAlpine))
</script>

<div x-data x-verino="{ length: 6, onComplete: (code) => verify(code) }"></div>
```

### Vanilla JS

```html
<div class="verino-wrapper" data-length="6" data-timer="60"></div>

<script type="module">
  import { initOTP } from '@verino/vanilla'
  const [otp] = initOTP('.verino-wrapper', {
    onComplete: (code) => verify(code),
  })
</script>
```

### Web Component

```html
<script src="https://unpkg.com/@verino/web-component/dist/verino-wc.min.js"></script>
<verino-input length="6" timer="60"></verino-input>

<script>
  document.querySelector('verino-input')
    .addEventListener('complete', (e) => verify(e.detail.code))
</script>
```

---

## Common Patterns

| Use case | Key options |
|---|---|
| SMS / email OTP | `type: 'numeric'`, `timer: 60`, `onResend` |
| TOTP / 2FA with separator | `separatorAfter: 3` |
| PIN entry | `masked: true`, `blurOnComplete: true` |
| Alphanumeric code | `type: 'alphanumeric'`, `pasteTransformer` |
| Invite / referral code | `separatorAfter: [3, 6]`, `pattern: /^[A-Z0-9]$/` |
| Hex activation key | `pattern: /^[0-9A-F]$/` |
| Async verification lock | `setDisabled(true / false)` around the API call |
| Native form submission | `name: 'otp_code'` |
| Pre-fill on mount | `defaultValue: '123456'` |
| Display-only / read-only | `readOnly: true` |

---

## CDN

```html
<!-- Vanilla JS -->
<script src="https://unpkg.com/@verino/vanilla/dist/verino.min.js"></script>

<!-- Alpine.js plugin -->
<script defer src="https://unpkg.com/alpinejs"></script>
<script src="https://unpkg.com/@verino/alpine/dist/verino-alpine.min.js"></script>
<script>
  document.addEventListener('alpine:init', () => Alpine.plugin(VerinoAlpine))
</script>

<!-- Web Component (auto-registers <verino-input>) -->
<script src="https://unpkg.com/@verino/web-component/dist/verino-wc.min.js"></script>
```

---

## How verino compares

Verino is the only OTP library built on a single core that supports all major web frameworks. The alternatives below are the most widely used within each ecosystem.

### React ecosystem

| Feature | verino | `input-otp` | `react-otp-input` |
|---|---|---|---|
| Pure headless state machine | ✅ | ✗ | ✗ |
| Typed event system | ✅ | ✗ | ✗ |
| Web OTP API (SMS intercept) | ✅ | ✗ | ✗ |
| Built-in timer and resend | ✅ | ✗ | ✗ |
| Masked mode | ✅ | ✗ | ✗ |
| Programmatic API | ✅ | ✗ | ✗ |
| Haptic + sound feedback | ✅ | ✗ | ✗ |
| CSS variable theming | ✅ | ✗ | ✗ |
| `data-*` state attributes | ✅ | ✗ | ✗ |
| Single hidden input | ✅ | ✅ | ✗ |
| Password manager guard | ✅ | ✅ | ✗ |
| Zero dependencies | ✅ | ✅ | ✗ |
| TypeScript (strict) | ✅ | ✅ | ✅ |

### Vue ecosystem

| Feature | verino | `vue3-otp-input` | `vue-input-otp` |
|---|---|---|---|
| Pure headless state machine | ✅ | ✗ | ✗ |
| Typed event system | ✅ | ✗ | ✗ |
| Web OTP API (SMS intercept) | ✅ | ✗ | ✗ |
| Built-in timer and resend | ✅ | ✗ | ✗ |
| Masked mode | ✅ | ✗ | ✗ |
| Programmatic API | ✅ | ✗ | ✗ |
| Haptic + sound feedback | ✅ | ✗ | ✗ |
| CSS variable theming | ✅ | ✗ | ✗ |
| `data-*` state attributes | ✅ | ✗ | ✗ |
| Reactive `Ref<T>` state | ✅ | ✗ | ✗ |
| Single hidden input | ✅ | ✗ | ✅ |
| Password manager guard | ✅ | ✗ | ✅ |
| Zero dependencies | ✅ | ✗ | ✅ |
| TypeScript (strict) | ✅ | ✗ | ✅ |

### Svelte ecosystem

| Feature | verino | `@k4ung/svelte-otp` | `svelte-otp` |
|---|---|---|---|
| Pure headless state machine | ✅ | ✗ | ✗ |
| Typed event system | ✅ | ✗ | ✗ |
| Web OTP API (SMS intercept) | ✅ | ✗ | ✗ |
| Built-in timer and resend | ✅ | ✗ | ✗ |
| Masked mode | ✅ | ✗ | ✅ |
| Programmatic API | ✅ | ✗ | ✗ |
| Haptic + sound feedback | ✅ | ✗ | ✗ |
| CSS variable theming | ✅ | ✗ | ✗ |
| `data-*` state attributes | ✅ | ✗ | ✗ |
| Native Svelte stores | ✅ | ✗ | ✗ |
| Single hidden input | ✅ | ✗ | ✗ |
| Password manager guard | ✅ | ✗ | ✅ |
| Zero dependencies | ✅ | ✅ | ✅ |
| TypeScript (strict) | ✅ | ✗ | ✗ |

### Cross-framework coverage

| Framework / environment | verino | Single alternative |
|---|---|---|
| React | ✅ | ✅ |
| Vue 3 | ✅ | Separate library |
| Svelte 4+ | ✅ | Separate library |
| Alpine.js | ✅ | ✗ |
| Web Components | ✅ | ✗ |
| Vanilla JS | ✅ | ✗ |
| Shared core | ✅ | ✗ |

---

## Contributing

See [CONTRIBUTING.md](./.github/CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/boastack/verino.git
cd verino && pnpm install

# Run before opening a PR
pnpm test && pnpm typecheck
```

- Changes to `@verino/core` require corresponding tests in `tests/core.test.ts`.
- All user-facing changes require a Changesets entry: `pnpm changeset`.
- For a new framework adapter, open a [framework request](https://github.com/boastack/verino/issues/new?template=framework_request.yml) first.

---

## Versioning

Verino follows [Semantic Versioning](https://semver.org). Releases are managed by [Changesets](https://github.com/changesets/changesets). Each package is versioned and published independently, a fix in `@verino/react` does not bump `@verino/vue`.

- **Patch** — bug fixes, internal refactors, no API change.
- **Minor** — new options, new exports, backwards-compatible additions.
- **Major** — breaking changes to the public API or option shapes.

---

## Roadmap

Verino continues to evolve with these upcoming enhancements:

- SolidJS adapter
- React Native adapter
- Storybook playground with live components
- Accessibility enhancements
- Performance refinements

[Open or upvote a feature request →](https://github.com/boastack/verino/issues/new?template=feature_request.yml)

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)