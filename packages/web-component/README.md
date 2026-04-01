<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner4.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/web-component</h1>

<h3 align="center">
  Web Component adapter for <a href="https://github.com/boastack/verino">verino</a>. Build reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/web-component"><img src="https://img.shields.io/npm/v/@verino/web-component?color=20C55C&label=%40verino%2Fweb-component" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/web-component"><img src="https://img.shields.io/bundlephobia/minzip/@verino/web-component?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/web-component` registers `<verino-input>`, a self-contained custom element that renders a complete OTP input field inside a Shadow DOM. Drop it in HTML and it works with no framework, no build step, and no template authoring required. Import the package once and `<verino-input>` is available everywhere.

Changing any observed attribute triggers a full shadow DOM rebuild, so the element always reflects its attribute state. CSS custom properties cascade through the shadow root, theming works from outside with no special configuration. All custom events are `composed: true` and cross the shadow boundary automatically.

---

## Why Use This Adapter?

- **Framework-agnostic.** Works in plain HTML, React, Vue, Svelte, or any other environment that can render HTML.
- **No peer dependencies.** Self-registers on import — no wrapper component needed.
- **Attribute-driven.** All common options are HTML attributes, including booleans and timer config.
- **Fully themeable.** CSS custom properties cascade through the shadow root.

---

## Installation

### npm

```bash
# npm
npm install @verino/web-component

# pnpm
pnpm add @verino/web-component

# yarn
yarn add @verino/web-component
```

No peer dependencies. Import the package to auto-register `<verino-input>`:

```js
import '@verino/web-component'
```

### CDN

```html
<script src="https://unpkg.com/@verino/web-component/dist/verino-wc.min.js"></script>
```

---

## Quick Start

```html
<verino-input length="6"></verino-input>

<script>
  document.querySelector('verino-input')
    .addEventListener('complete', (e) => verify(e.detail.code))
</script>
```

> **Note:** `verify(code)` and similar functions used in examples are placeholders — replace them with your own API calls or application logic.

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

### Attributes

Boolean attributes (`disabled`, `readonly`, `masked`, `blur-on-complete`, `select-on-focus`, `sound`) follow standard HTML semantics — presence = `true`, absence = `false`. `auto-focus` and `haptic` default to `true` when absent; set to `"false"` to opt out.

```html
<verino-input
  length="6"
  type="numeric"
  timer="60"
  resend-after="30"
  separator-after="3"
  separator="—"
  placeholder="○"
  name="otp_code"
  masked
  blur-on-complete
></verino-input>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `length` | number | `6` | Number of slots |
| `type` | `numeric \| alphabet \| alphanumeric \| any` | `numeric` | Character set |
| `timer` | number | `0` | Countdown in seconds (`0` = no timer) |
| `resend-after` | number | `30` | Resend button cooldown in seconds |
| `disabled` | boolean | `false` | Disable all input |
| `readonly` | boolean | `false` | Block mutations, preserve navigation |
| `separator-after` | string | — | Slot position(s) for separator — `"3"` or `"2,4"` |
| `separator` | string | `—` | Separator character |
| `masked` | boolean | `false` | Show mask glyph in filled slots |
| `mask-char` | string | `●` | Glyph used when `masked` is set |
| `name` | string | — | Hidden input `name` for native form submission |
| `placeholder` | string | — | Character shown in empty slots |
| `auto-focus` | `"false"` | `true` | Set to `"false"` to suppress focus on mount |
| `select-on-focus` | boolean | `false` | Select current slot character on focus |
| `blur-on-complete` | boolean | `false` | Blur input when all slots are filled |
| `default-value` | string | — | Pre-fill slots on mount; does not fire `complete` |
| `sound` | boolean | `false` | Play audio tone on completion |
| `haptic` | `"false"` | `true` | Set to `"false"` to suppress vibration feedback |

> `auto-focus` and `haptic` default to `true` when absent. Set the attribute to `"false"` to opt out.

### Events

All events bubble and are `composed: true` — they cross the shadow boundary without any special setup:

```js
const el = document.querySelector('verino-input')

// All slots filled
el.addEventListener('complete', (e) => verify(e.detail.code))

// Timer reached zero
el.addEventListener('expire', () => console.log('Code expired'))

// Every input change — fires on typing, backspace, paste
el.addEventListener('change', (e) => console.log(e.detail.code))
```

### JS-only properties

Options that cannot be expressed as HTML attributes (functions and `RegExp`) are set as JavaScript properties:

```js
const el = document.querySelector('verino-input')

el.pattern          = /^[0-9A-F]$/
el.pasteTransformer = (raw) => raw.replace(/[\s-]/g, '')
el.onComplete       = (code) => verify(code)
el.onResend         = () => sendCode()
el.onFocus          = () => showHelp()
el.onBlur           = () => hideHelp()
el.onInvalidChar    = (char, index) => shake(index)
```

### Async verification

Use the DOM API to lock the field during an async call:

```js
const el = document.querySelector('verino-input')

el.addEventListener('complete', async ({ detail: { code } }) => {
  el.setDisabled(true)
  const ok = await verify(code)
  el.setDisabled(false)
  ok ? el.setSuccess(true) : el.setError(true)
})
```

### Separator

```html
<!-- Single: [*][*][*] — [*][*][*] -->
<verino-input length="6" separator-after="3" separator="—"></verino-input>

<!-- Multiple: [*][*] — [*][*] — [*][*] — [*][*] -->
<verino-input length="8" separator-after="2,4,6"></verino-input>
```

### Masked input

```html
<verino-input length="6" masked mask-char="●"></verino-input>
```

---

### `data-*` state attributes

The web component exposes state in two places: the host element (`<verino-input>` itself, targetable from outside the shadow root) and shadow slot elements (inside the shadow DOM).

#### Host attributes

Set on `<verino-input>` itself as boolean presence attributes (no value) — target from outside the shadow root:

| Attribute | When present |
|---|---|
| `data-complete` | All slots are filled |
| `data-invalid` | Error state is active |
| `data-success` | Success state is active |
| `data-disabled` | Field is disabled |
| `data-readonly` | Field is read-only |

```css
/* Host element attributes — target from outside */
verino-input[data-complete] { outline: 2px solid #00C950; }
verino-input[data-invalid]  { outline: 2px solid #FB2C36; }
verino-input[data-success]  { outline: 2px solid #00C950; }
verino-input[data-disabled] { opacity: 0.6; }
verino-input[data-readonly] { cursor: default; }
```

#### Slot attributes (shadow DOM)

Inside the shadow root, slot elements receive string-value attributes (`"true"` / `"false"`). These drive the built-in shadow stylesheet and are accessible via `getInputProps(index)`:

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

```css
/* Applied inside the shadow root via the built-in shadow stylesheet */
.verino-wc-slot[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
.verino-wc-slot[data-filled="true"]                    { background:   #FFFFFF; }
.verino-wc-slot[data-empty="true"]                     { background:   #FAFAFA; }
.verino-wc-slot[data-invalid="true"]                   { border-color: #FB2C36; }
.verino-wc-slot[data-success="true"]                   { border-color: #00C950; }
.verino-wc-slot[data-disabled="true"]                  { opacity: 0.45; pointer-events: none; }
.verino-wc-slot[data-readonly="true"]                  { cursor: default; }
.verino-wc-slot[data-masked="true"]                    { letter-spacing: 0.15em; }
.verino-wc-slot[data-complete="true"]                  { border-color: #00C950; }

/* Connected pill layout */
.verino-wc-slot[data-first="true"]                              { border-radius: 8px 0 0 8px; }
.verino-wc-slot[data-last="true"]                               { border-radius: 0 8px 8px 0; }
.verino-wc-slot[data-first="false"][data-last="false"]          { border-radius: 0; }

/* Target a specific slot by index */
.verino-wc-slot[data-slot="0"] { font-weight: 700; }
```

Verino automatically adds these CSS classes to the shadow DOM:

- `.verino-wc-slot` — each slot
- `.verino-wc-caret` — blinking caret
- `.verino-wc-separator` — group separator

Footer (built into the element when `timer` is set):

- `.verino-wc-timer` — countdown container
- `.verino-wc-timer-badge` — timer badge
- `.verino-wc-resend` — resend container
- `.verino-wc-resend-btn` — resend button

> State is always exposed via `data-*` attributes, not class names.

---

## CSS custom properties

CSS custom properties cascade through the shadow root; set them on `verino-input` externally:

```css
verino-input {
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
  --verino-timer-color:   #5C5C5C;

  /* Placeholder, separator & mask */
  --verino-placeholder-color: #D3D3D3;
  --verino-placeholder-size:  16px;
  --verino-separator-color:   #A1A1A1;
  --verino-separator-size:    18px;
  --verino-masked-size:       16px;
  --verino-slot-font:         inherit;
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

### `VerinoInput`

```ts
class VerinoInput extends HTMLElement {
  // Observed attributes — any change triggers a shadow DOM rebuild:
  // length, type, timer, resend-after, disabled, readonly,
  // separator-after, separator, masked, mask-char, name, placeholder,
  // auto-focus, select-on-focus, blur-on-complete, default-value, sound, haptic

  // JS-only setters (cannot be expressed as HTML attributes)
  set pattern(re: RegExp | undefined)
  set pasteTransformer(fn: ((raw: string) => string) | undefined)
  set onComplete(fn: ((code: string) => void) | undefined)
  set onResend(fn: (() => void) | undefined)
  set onFocus(fn: (() => void) | undefined)
  set onBlur(fn: (() => void) | undefined)
  set onInvalidChar(fn: ((char: string, index: number) => void) | undefined)

  // DOM methods
  reset():                        void   // clear slots + restart timer + re-focus
  setError(v: boolean):           void   // toggle error; clears success
  setSuccess(v: boolean):         void   // toggle success; stops timer; clears error
  setDisabled(v: boolean):        void
  setReadOnly(v: boolean):        void
  get hasSuccess():               boolean

  getCode():                      string
  getSlots():                     SlotEntry[]
  getInputProps(index: number):   InputProps
}
```

---

## Compatibility

| Environment | Requirement |
|---|---|
| Browsers | All evergreen (Shadow DOM + Custom Elements v1 required) |
| `@verino/core` | Same monorepo release |
| TypeScript | ≥ 5.0 |
| Frameworks | Framework-agnostic — works anywhere HTML renders |
| Module format | ESM + IIFE (CDN) |

---

## Integration with Core

`VerinoInput` calls `createOTP()` from `@verino/core` when the element connects to the DOM. All character filtering, cursor logic, paste normalisation, timer management, and event routing live in core. The custom element only handles shadow DOM construction, attribute reflection, and custom event dispatch.

See the [`@verino/core` README](https://github.com/boastack/verino/blob/main/packages/core/README.md) for the full state machine and event reference.

---

## Contributing

This package lives in the [verino monorepo](https://github.com/boastack/verino). See [CONTRIBUTING.md](https://github.com/boastack/verino/blob/main/.github/CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/boastack/verino.git
cd verino && pnpm install

# Run before opening a PR
pnpm --filter @verino/web-component build && pnpm test
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`@verino/core`](https://www.npmjs.com/package/@verino/core) | Pure OTP state machine — zero DOM, zero framework |
| [`@verino/vanilla`](https://www.npmjs.com/package/@verino/vanilla) | Vanilla DOM adapter + `timerUIPlugin`, `webOTPPlugin`, `pmGuardPlugin` |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` component (React ≥ 18) |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable with `Ref<T>` reactive state (Vue ≥ 3) |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + `use:action` directive (Svelte ≥ 4) |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `VerinoAlpine` plugin — `x-verino` directive (Alpine.js ≥ 3) |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)