<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner4.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/vanilla</h1>

<h3 align="center">
  Vanilla JS adapter for <a href="https://github.com/boastack/verino">Verino</a>. Reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/vanilla"><img src="https://img.shields.io/npm/v/@verino/vanilla?color=20C55C&label=%40verino%2Fvanilla" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/vanilla"><img src="https://img.shields.io/bundlephobia/minzip/@verino/vanilla?color=20C55C&label=gzip+size" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/vanilla` is the DOM adapter for [`@verino/core`](https://www.npmjs.com/package/@verino/core). It takes the pure state machine and provides everything needed to run it in the browser: slot rendering, hidden input wiring, `data-*` attribute management, CSS custom properties, and an optional plugin system.

`initOTP(target, options)` mounts a fully accessible OTP field into any container element (CSS selector or DOM node) and returns a `VerinoInstance[]` — one instance per matched element. Call `instance.destroy()` to remove all event listeners, stop active timers, and clean up any DOM elements added by plugins.

The adapter includes three tree-shakeable plugins as separate entry points. Import only what you need:

- **`timerUIPlugin`** — renders a live countdown badge and a cooldown-aware resend button inside the field.
- **`webOTPPlugin`** — intercepts incoming SMS OTPs via the Web OTP API (`navigator.credentials.get`) and fills the slots automatically.
- **`pmGuardPlugin`** — detects credential badge overlays injected by password managers (LastPass, 1Password, Dashlane, Bitwarden, Keeper) and repositions them to avoid covering the slot group.

---

## Why Use This Adapter?

- **No framework required.** Works in plain HTML, server-rendered apps, and bundled projects.  
- **Plugin system.** Tree-shakeable plugins for timer UI, Web OTP API, and password manager guards.  
- **CDN-ready.** A pre-built IIFE bundle works without any build tooling.  
- **Fully programmatic.** Control state with `setError`, `setSuccess`, `setDisabled`, `reset`, `focus`, and `getCode`.  

---

## Installation

```bash
# npm
npm i @verino/vanilla

# pnpm
pnpm add @verino/vanilla

# yarn
yarn add @verino/vanilla
```

**Peer dependency:** `@verino/core` installs automatically.

### CDN

```html
<script src="https://unpkg.com/@verino/vanilla/dist/verino.min.js"></script>
```

The IIFE bundle exposes `window.Verino`. Call `Verino.init(...)` directly.

---

## Quick Start

```html
<div class="verino-wrapper"></div>

<script type="module">
  import { initOTP } from '@verino/vanilla'

  const [otp] = initOTP('.verino-wrapper', {
    length:     6,
    type:       'numeric',
    onComplete: (code) => console.log('Done:', code),
  })
</script>
```
> **Note:** `verify(code)` and similar functions used in examples are placeholders — replace them with your own API calls or application logic.

`initOTP` returns `VerinoInstance[]`. Call `instance.destroy()` to clean up event listeners and DOM elements.

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

## Usage

`haptic` and `sound` are mount-configured in the vanilla adapter. If you need to change feedback behavior at runtime, destroy and re-initialise the instance with the new options.

### Async verification

```js
const [otp] = initOTP('.verino-wrapper', {
  length: 6,
  onComplete: async (code) => {
    otp.setDisabled(true)
    const ok = await api.verify(code)
    otp.setDisabled(false)
    ok ? otp.setSuccess(true) : otp.setError(true)
  },
})
```

### Timer and resend

Pass `timer` and `onResend` — the adapter renders the countdown badge and resend button automatically:

```js
const [otp] = initOTP('.verino-wrapper', {
  length:   6,
  timer:    60,
  onResend: () => requestNewCode(),
  onExpire: () => showExpiredMessage(),
})
```

Provide an `onTick` callback to drive a custom timer UI and disable the built-in footer:

```js
const [otp] = initOTP('.verino-wrapper', {
  timer:    60,
  onTick:   (remaining) => (timerEl.textContent = `0:${String(remaining).padStart(2, '0')}`),
  onExpire: () => showResendButton(),
  onResend: () => { otp.resend(); hideResendButton() },
})
```

### Masked input

```js
initOTP('.verino-wrapper', {
  masked:   true,
  maskChar: '●',  // default;
})
```

Or via attribute: `<div class="verino-wrapper" data-masked>`.

### Paste transformer

Strip formatting from real-world OTP SMS messages before distributing to slots:

```js
initOTP('.verino-wrapper', {
  pasteTransformer: (raw) => raw.replace(/[\s-]/g, ''),
  // 'G-123456' → '123456', '123 456' → '123456'
})
```

### Plugins

Plugins are separate entry points — import only what you need:

```js
import { initOTP }        from '@verino/vanilla'
import { timerUIPlugin }  from '@verino/vanilla/plugins/timer-ui'
import { webOTPPlugin }   from '@verino/vanilla/plugins/web-otp'
import { pmGuardPlugin }  from '@verino/vanilla/plugins/pm-guard'
```

| Plugin | Entry point | What it does |
|---|---|---|
| `timerUIPlugin` | `@verino/vanilla/plugins/timer-ui` | Renders countdown badge + cooldown-aware resend button |
| `webOTPPlugin` | `@verino/vanilla/plugins/web-otp` | Intercepts SMS OTP via `navigator.credentials.get` and auto-fills |
| `pmGuardPlugin` | `@verino/vanilla/plugins/pm-guard` | Repositions LastPass, 1Password, Dashlane, Bitwarden, Keeper badge overlays |

### CDN usage

```html
<script src="https://unpkg.com/@verino/vanilla/dist/verino.min.js"></script>
<div class="verino-wrapper"></div>
<script>
  Verino.init('.verino-wrapper', {
    length:     6,
    onComplete: (code) => console.log(code),
  })
</script>
```

---

### `data-*` state attributes

Each slot element receives `data-*` attributes reflecting the current state of the machine. Style the field entirely with CSS, no JavaScript class management required

#### Slot attributes

Slot-level attributes use string values (`"true"` / `"false"`):

| Attribute | Meaning |
|---|---|
| `data-active` | Logical cursor is at this slot (set even when the field is blurred) |
| `data-focus` | Browser focus is on the hidden input |
| `data-filled` | Slot contains a character |
| `data-empty` | Slot is unfilled (complement of `data-filled`) |
| `data-invalid` | Error state is active |
| `data-success` | Success state is active (mutually exclusive with `data-invalid`) |
| `data-disabled` | Field is disabled |
| `data-readonly` | Field is in read-only mode |
| `data-complete` | All slots are filled |
| `data-masked` | Masked mode is active |
| `data-first` | This is the first slot `0` |
| `data-last` | This is the last slot |
| `data-slot` | Zero-based position of the slot as a string ("0", "1", …) |

#### Wrapper attributes

Set on the wrapper element as boolean presence attributes (no value):

| Attribute | When present |
|---|---|
| `data-complete` | All slots are filled |
| `data-invalid` | Error state is active |
| `data-success` | Success state is active |
| `data-disabled` | Field is disabled |
| `data-readonly` | Field is read-only |


```css
/* Slot-level — scope to your field with an id or class prefix */
[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
[data-filled="true"]                    { background:   #FFFFFF; }
[data-empty="true"]                     { background:   #FAFAFA; }
[data-invalid="true"]                   { border-color: #FB2C36; }
[data-success="true"]                   { border-color: #00C950; }
[data-disabled="true"]                  { opacity: 0.45; pointer-events: none; }
[data-readonly="true"]                  { cursor: default; }
[data-masked="true"]                    { letter-spacing: 0.15em; }
[data-complete="true"]                  { border-color: #00C950; }

/* Wrapper-level (boolean presence selectors) */
.verino-wrapper[data-complete]  { outline: 2px solid #00C950; }
.verino-wrapper[data-invalid]   { outline: 2px solid #FB2C36; }
.verino-wrapper[data-disabled]  { opacity: 0.6; }

/* Connected pill layout */
[data-first="true"]                     { border-radius: 8px 0 0 8px; }
[data-last="true"]                      { border-radius: 0 8px 8px 0; }
[data-first="false"][data-last="false"] { border-radius: 0; }

/* Target a specific slot by index */
[data-slot="0"] { font-weight: 700; }
```

Verino automatically adds these CSS classes to the rendered DOM:

- `.verino-slot` — each slot
- `.verino-caret` — blinking caret
- `.verino-separator` — group separator

Footer (added by `timerUIPlugin`):

- `.verino-timer` — countdown container
- `.verino-timer-badge` — timer badge
- `.verino-resend` — resend container
- `.verino-resend-btn` — resend button

> State is always exposed via `data-*` attributes, not class names.

---

## CSS Custom Properties

Style the field using `--verino-*` CSS custom properties on the wrapper element:

```css
.verino-wrapper  {
  /* Dimensions */
  --verino-size:          56px;
  --verino-gap:           12px;
  --verino-radius:        10px;
  --verino-font-size:     24px;

  /* Colors */
  --verino-bg:            #FAFAFA;
  --verino-bg-filled:     #FFFFFF;
  --verino-color:         #0A0A0A;
  --verino-border-color:  #E5E5E5;
  --verino-active-color:  #3D3D3D;
  --verino-error-color:   #FB2C36;
  --verino-success-color: #00C950;
  --verino-caret-color:   #3D3D3D;

  /* Placeholder, separator & mask */
  --verino-placeholder-color: #D3D3D3;
  --verino-placeholder-size:  16px;
  --verino-separator-color:   #A1A1A1;
  --verino-separator-size:    18px;
  --verino-masked-size:       16px;
}
```

---

## Accessibility

- **Single ARIA-labelled input** — the hidden input carries `aria-label="Enter your N-digit code"` (or `N-character code` for non-numeric types). Screen readers announce one field, not multiple slots.
- **All visual elements are `aria-hidden`** — slots, separators, caret, and timer UI are removed from the accessibility tree.
- **`inputMode`** — set to `"numeric"` or `"text"` based on `type`, triggering the correct mobile keyboard.
- **`autocomplete="one-time-code"`** — enables native SMS autofill on iOS and Android.
- **Anti-interference** — `spellcheck="false"`, `autocorrect="off"`, and `autocapitalize="off"` prevent unwanted browser input behavior.
- **`maxLength`** — constrains the hidden input to `length`, preventing overflow from IME and composition events.
- **`type="password"` in masked mode** — enables secure input and triggers the password keyboard on mobile.
- **Native form integration** — the `name` option includes the hidden input in `<form>` submission and `FormData`.
- **Keyboard navigation** — full support for `←`, `→`, `Backspace`, `Delete`, and `Tab`.

---

## API Reference

### `initOTP(target, options?)`

```ts
function initOTP(
  target: string | HTMLElement,
  options?: VanillaOTPOptions
): VerinoInstance[]
```

`target` can be a CSS selector string or a DOM element.

### `VanillaOTPOptions`

All `OTPOptions` from `@verino/core`, plus:

| Option | Type | Default | Description |
|---|---|---|---|
| `separatorAfter` | `number \| number[]` | — | Insert a visual separator after these slot indices |
| `separator` | `string` | `'—'` | Separator character |
| `masked` | `boolean` | `false` | Show mask glyph in filled slots |
| `maskChar` | `string` | `'●'` | Glyph used in masked mode |
| `onChange` | `(code: string) => void` | — | Fires on every input change |
| `resendAfter` | `number` | `30` | Resend button cooldown in seconds |

### `VerinoInstance` methods

| Method | Description |
|---|---|
| `getCode()` | Return the current assembled value |
| `reset()` | Clear all slots, restart timer, re-focus |
| `resend()` | Reset + fire `onResend` callback |
| `setError(v)` | Toggle error state |
| `setSuccess(v)` | Toggle success state; stops timer |
| `setDisabled(v)` | Lock or unlock the field |
| `setReadOnly(v)` | Toggle read-only mode |
| `focus(i?)` | Focus slot `i` (defaults to first empty slot) |
| `destroy()` | Remove all event listeners and clean up DOM |

---

## Compatibility

| Environment | Requirement |
|---|---|
| `@verino/core` | Same monorepo release |
| Browsers | All evergreen; IE not supported |
| Node.js (SSR) | ≥ 18 (DOM-free core only) |
| TypeScript | ≥ 5.0 |
| Module format | ESM (no CJS build for vanilla) |

---

## Integration with Core

`@verino/vanilla` calls `createOTP()` from `@verino/core` internally. Character filtering, cursor logic, paste normalization, and event routing live in core; countdown, feedback, scheduling, and toolkit helpers come from `@verino/core/toolkit`. The vanilla adapter handles DOM construction, attribute management, and plugin lifecycle.

See the [`@verino/core` README](https://github.com/boastack/verino/blob/main/packages/core/README.md) for the full state machine and event reference.

---

## Contributing

This package lives in the [verino monorepo](https://github.com/boastack/verino). See [CONTRIBUTING.md](https://github.com/boastack/verino/blob/main/.github/CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/boastack/verino.git
cd verino && pnpm i

# Run before opening a PR
pnpm --filter @verino/vanilla build && pnpm test
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`@verino/core`](https://www.npmjs.com/package/@verino/core) | OTP state machine + toolkit |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` component (React ≥ 18) |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable with reactive Vue refs (Vue ≥ 3) |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + `use:action` directive (Svelte ≥ 4) |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `VerinoAlpine` plugin — `x-verino` directive (Alpine.js ≥ 3) |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` Shadow DOM custom element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)
