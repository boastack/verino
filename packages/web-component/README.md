<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner4.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/web-component</h1>

<h3 align="center">
  Web Component adapter for <a href="https://www.npmjs.com/package/verino" target="_blank" rel="noopener noreferrer">verino</a>. Build reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/web-component"><img src="https://img.shields.io/npm/v/@verino/web-component?color=20C55C&label=%40verino%2Fweb-component" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/web-component"><img src="https://img.shields.io/bundlephobia/minzip/@verino/web-component?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/Dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/web-component` registers `<verino-input>`, a self-contained custom element that renders a complete OTP input field inside a Shadow DOM. Drop it in HTML and it works with no framework, no build step, and no template authoring required.

Changing any observed attribute triggers a full shadow DOM rebuild, so the element always reflects its attribute state. CSS custom properties cascade through the shadow root so the field is fully themeable from outside. All custom events are `composed: true` and cross the shadow boundary automatically.

---

## Installation

### npm

```bash
npm install @verino/web-component
pnpm add @verino/web-component
yarn add @verino/web-component
```

No peer dependencies. Import the package to auto-register `<verino-input>`:

```js
import '@verino/web-component'
```

### CDN

```html
<script src="https://unpkg.com/verino/dist/verino-wc.min.js"></script>
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

| Pattern | Key attributes / properties |
|---|---|
| SMS / email OTP | `type="numeric"` `timer="60"` |
| 2FA / TOTP with grouping | `separator-after="3"` |
| PIN entry | `masked` `blur-on-complete` |
| Alphanumeric code | `type="alphanumeric"` + `pasteTransformer` property |
| Grouped code | `separator-after="3,6"` + `pattern` property |
| Hex activation key | `separator-after="2,4,6"` + `pattern` property |
| Async verification lock | `el.setDisabled(true/false)` around API call |
| Pre-fill on mount | `default-value="123456"` |
| Display-only field | `readonly` |

---

## Usage

### Attributes

Boolean attributes (`disabled`, `readonly`, `masked`, `blur-on-complete`, `select-on-focus`, `sound`) follow standard HTML semantics — presence means `true`, absence means `false`. `auto-focus` and `haptic` default to `true` when absent; set to `"false"` to opt out.

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
| `timer` | number | `0` | Countdown seconds (`0` = no timer) |
| `resend-after` | number | `30` | Resend cooldown seconds |
| `disabled` | boolean | `false` | Disable all input |
| `readonly` | boolean | `false` | Block mutations, preserve navigation |
| `separator-after` | `"3"` or `"2,4"` | — | Slot position(s) for visual separator (1-based, comma-separated for multiple) |
| `separator` | string | `—` | Separator character |
| `masked` | boolean | `false` | Show mask glyph instead of real characters |
| `mask-char` | string | `●` | Glyph used when `masked` is set |
| `name` | string | — | Hidden input `name` for native form submission |
| `placeholder` | string | — | Character shown in empty slots |
| `auto-focus` | `"false"` | `true` | Set to `"false"` to suppress focus on mount |
| `select-on-focus` | boolean | `false` | Select current slot character on focus |
| `blur-on-complete` | boolean | `false` | Blur input when all slots are filled |
| `default-value` | string | — | Pre-fill slots on mount — does not fire `complete` |
| `sound` | boolean | `false` | Play audio tone on completion |
| `haptic` | `"false"` | `true` | Set to `"false"` to suppress vibration feedback |

> `auto-focus` and `haptic` default to `true` when absent. Set the attribute to `"false"` to opt out.

### Events

All events bubble and are `composed: true` — they cross the shadow root boundary without any special setup:

```js
const el = document.querySelector('verino-input')

// All slots filled
el.addEventListener('complete', (e) => {
  console.log(e.detail.code)  // → '123456'
})

// Timer reached zero
el.addEventListener('expire', () => {
  console.log('Code expired')
})

// Every input change (typing, backspace, paste)
el.addEventListener('change', (e) => {
  console.log(e.detail.code)  // → partial code as user types
})
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

### Separator and masking

Single separator (groups a 6-digit field as `[*][*][*] — [*][*][*]`):

```html
<verino-input length="6" separator-after="3" separator="—"></verino-input>
```

Multiple separators (groups an 8-character field as `[*][*] — [*][*] — [*][*] — [*][*]`):

```html
<verino-input length="8" separator-after="2,4,6"></verino-input>
```

Masked input (hides characters using a glyph):

```html
<verino-input length="6" masked mask-char="●"></verino-input>
```

### State attributes

Verino sets `data-*` attributes on every visual slot inside the shadow root and on the host element itself for external CSS targeting.

#### Slot attributes (shadow DOM)

Inside the shadow root, slot elements receive string-value attributes (`"true"` / `"false"`). These drive the built-in shadow stylesheet and are accessible via `getInputProps(index)`:

- `data-active` — current cursor position
- `data-focus` — input is focused
- `data-filled` / `data-empty`
- `data-invalid` / `data-success`
- `data-disabled` / `data-readonly`
- `data-slot` — slot index (`"0"`, `"1"`, …)
- `data-first` / `data-last` — useful for grouped/pill layouts
- `data-masked` — masked mode active

```css
/* Connected pill layout */
.verino-slot[data-first="true"] { border-radius: 8px 0 0 8px; }
.verino-slot[data-last="true"]  { border-radius: 0 8px 8px 0; }
.verino-slot:not([data-first="true"]):not([data-last="true"]) {
  border-radius: 0;
}
```

#### Host attributes

Set on `<verino-input>` itself as boolean presence attributes (no value) — target from outside the shadow root:

- `data-complete`
- `data-invalid`
- `data-success`
- `data-disabled`
- `data-readonly`

```css
/* Host element attributes — target from outside */
verino-input[data-complete] { outline: 2px solid #00C950; }
verino-input[data-invalid]  { outline: 2px solid #FB2C36; }
verino-input[data-success]  { outline: 2px solid #00C950; }
verino-input[data-disabled] { opacity: 0.6; }
verino-input[data-readonly] { cursor: default; }
```

#### CSS classes

Applied automatically inside the shadow root:

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

## CSS custom properties

CSS custom properties cascade through the shadow root — set them on `verino-input` from outside:

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
- **`type="password"` in masked mode** — enables secure input and triggers the OS password keyboard on mobile.
- **Native form integration** — the `name` option includes the hidden input in `<form>` submission and `FormData`.
- **Keyboard navigation** — full support for `←`, `→`, `Backspace`, `Delete`, and `Tab`.

---

## API Reference

### `VerinoInput`

```ts
class VerinoInput extends HTMLElement {
  // Observed attributes (any change triggers a shadow DOM rebuild):
  // length, type, timer, resend-after, disabled, readonly,
  // separator-after, separator, masked, mask-char, name, placeholder,
  // auto-focus, select-on-focus, blur-on-complete, default-value, sound, haptic

  // JS-only setters:
  set pattern(re: RegExp | undefined)
  set pasteTransformer(fn: ((raw: string) => string) | undefined)
  set onComplete(fn: ((code: string) => void) | undefined)
  set onResend(fn: (() => void) | undefined)
  set onFocus(fn: (() => void) | undefined)
  set onBlur(fn: (() => void) | undefined)
  set onInvalidChar(fn: ((char: string, index: number) => void) | undefined)

  // DOM API:
  reset():                         void   // clear slots, restart timer, re-focus
  setError(isError: boolean):      void   // red ring; clears success
  setSuccess(isSuccess: boolean):  void   // green ring; stops timer; clears error
  setDisabled(value: boolean):     void   // lock/unlock without rebuild
  setReadOnly(value: boolean):     void   // block mutations, preserve navigation
  get hasSuccess(): boolean

  getCode():                       string
  getSlots():                      SlotEntry[]
  getInputProps(index: number):    InputProps
}
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`verino`](https://www.npmjs.com/package/verino) | Core state machine + vanilla adapter |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + action |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `x-verino` directive |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)