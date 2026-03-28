<h1 align="center">@verino/alpine</h1>

<h3 align="center">
  Alpine.js adapter for <a href="https://www.npmjs.com/package/verino" target="_blank" rel="noopener noreferrer">verino</a>. Build reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/alpine"><img src="https://img.shields.io/npm/v/@verino/alpine?color=20C55C&label=%40verino%2Falpine" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/alpine"><img src="https://img.shields.io/bundlephobia/minzip/@verino/alpine?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/Dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/alpine` registers an `x-verino` directive. Place it on a container element with a configuration expression and verino builds the full OTP field inside (hidden input, visual slots, optional separator, optional countdown timer, and Resend button) with no template authoring required.

The expression is evaluated in the Alpine component scope, so reactive `$data` references work. Programmatic control is available on `el._verino` from any JavaScript context.

When Alpine destroys the component (e.g. via `x-if`), `cleanup()` is called automatically via Alpine's cleanup hook.

---

## Installation

### npm

```bash
npm install @verino/alpine
pnpm add @verino/alpine
yarn add @verino/alpine
```

**Peer dependency:** Alpine.js ≥ 3. `verino` is installed automatically.

Register the plugin before `Alpine.start()`:

```js
import Alpine from 'alpinejs'
import { VerinoAlpine } from '@verino/alpine'

Alpine.plugin(VerinoAlpine)
Alpine.start()
```

### CDN

```html
<script defer src="https://unpkg.com/alpinejs"></script>
<script src="https://unpkg.com/verino/dist/verino-alpine.min.js"></script>
<script>
  document.addEventListener('alpine:init', () => Alpine.plugin(VerinoAlpine))
</script>
```

---

## Quick Start

```html
<div
  x-data
  x-verino="{ length: 6, onComplete: (code) => verify(code) }"
></div>
```

> **Note:** `verify(code)` and similar functions used in examples are placeholders — replace them with your own API calls or application logic.

verino renders the full OTP field inside the element, wires all event handlers, and manages all state internally.

---

## Common Patterns

| Pattern | Key options |
|---|---|
| SMS / email OTP | `type: 'numeric'`, `timer: 60`, `onResend` |
| 2FA / TOTP with grouping | `separatorAfter: 3` |
| PIN entry | `masked: true`, `blurOnComplete: true` |
| Alphanumeric code | `type: 'alphanumeric'`, `pasteTransformer` |
| Built-in countdown + Resend UI | `timer: 60`, `onResend` |
| Custom timer display | `timer: 60`, `onTick: (r) => ...` |
| Async verification lock | `el._verino.setDisabled(true/false)` |
| Pre-fill on mount | `defaultValue: '123456'` |
| Display-only field | `readOnly: true` |

---

## Usage

### Reactive Alpine data references

The `x-verino` expression is evaluated in the Alpine component scope — reactive `$data` properties work directly:

```html
<div
  x-data="{ timer: 60 }"
  x-verino="{ length: 6, timer: timer, onComplete: (code) => verify(code) }"
></div>
```

### Built-in timer and Resend

When `timer` is set and no `onTick` is provided, verino renders a "Code expires in 1:00" footer and a "Didn't receive the code? Resend" section automatically:

```html
<div x-verino="{ length: 6, timer: 60, onResend: () => sendCode() }"></div>
```

### Custom timer display

Supply `onTick` to power your own UI instead:

```html
<div
  x-data="{ remaining: 60 }"
  x-verino="{ length: 6, timer: 60, onTick: (r) => (remaining = r) }"
></div>
<p x-text="`Expires in ${remaining}s`"></p>
```

### Programmatic control via `el._verino`

```html
<div id="otp-field" x-verino="{ length: 6, onComplete: handleComplete }"></div>

<script>
  const field = document.getElementById('otp-field')

  async function handleComplete(code) {
    field._verino.setDisabled(true)
    const ok = await verify(code)
    field._verino.setDisabled(false)
    ok ? field._verino.setSuccess(true) : field._verino.setError(true)
  }
</script>
```
### Separator and masking

Single separator (groups a 6-digit field as `[*][*][*] — [*][*][*]`):

```html
<div x-verino="{ length: 6, separatorAfter: 3 }"></div>
```

Multiple separators (groups an 8-character field as `[*][*] — [*][*] — [*][*] — [*][*]`):

```html
<div x-verino="{ length: 8, separatorAfter: [2, 4, 6] }"></div>
```

Masked input (hides characters using a glyph):

```html
<div x-verino="{ length: 6, masked: true, maskChar: '●' }"></div>
```

### State attributes

Slot `data-*` attributes use string values `'true'` / `'false'`. Wrapper-level attributes are presence-only:

```css
/* Slot-level */
[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
[data-filled="true"]                   { background: #FFFFFF; }
[data-invalid="true"]                  { border-color: #FB2C36; }
[data-success="true"]                  { border-color: #00C950; }
[data-disabled="true"]                 { opacity: 0.45; }
[data-readonly="true"]                 { cursor: default; }

/* Wrapper-level — presence attributes */
[data-complete] { ... }
[data-invalid]  { ... }
[data-success]  { ... }
```

Scope to a specific field using an `id` or class:

```css
#otp-field [data-active="true"][data-focus="true"] { border-color: #6366F1; }
```

#### Slot attributes

Slot-level attributes use string values (`"true"` / `"false"`):

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

#### Wrapper attributes

Set on the wrapper element as boolean presence attributes (no value):

- `data-complete`
- `data-invalid`
- `data-success`
- `data-disabled`
- `data-readonly`

#### CSS classes

Applied automatically to the rendered DOM:

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

Style the OTP field by setting `--verino-*` CSS custom properties on the wrapper element:

```css
#otp-field {
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
}
```

See the [full CSS custom properties list](https://www.npmjs.com/package/verino#theming) in the main verino docs.

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

### Plugin registration

```ts
import { VerinoAlpine } from '@verino/alpine'

Alpine.plugin(VerinoAlpine)  // before Alpine.start()
```

### `x-verino` expression options

All `OTPOptions` from `verino` are accepted, plus:

| Option | Type | Description |
|---|---|---|
| `separatorAfter` | `number \| number[]` | Separator position(s) after slot index |
| `separator` | `string` | Separator character (default: `'—'`) |
| `onChange` | `(code: string) => void` | Fires on INPUT, DELETE, CLEAR, PASTE |
| `onTick` | `(remaining: number) => void` | Custom tick callback; suppresses built-in timer UI |
| `resendAfter` | `number` | Resend button cooldown in seconds (default: `30`) |
| `masked` | `boolean` | Show mask glyph in filled slots |
| `maskChar` | `string` | Mask glyph (default: `'●'`) |

### `el._verino`

Exposed on the wrapper element after mount:

```ts
el._verino = {
  getCode():                          string
  getSlots():                         SlotEntry[]
  getInputProps(slotIndex: number):   InputProps
  reset():                            void   // clear slots, restart timer, re-focus
  resend():                           void   // reset + fire onResend
  setError(isError: boolean):         void
  setSuccess(isSuccess: boolean):     void   // stops timer on success
  setDisabled(value: boolean):        void
  setReadOnly(value: boolean):        void
  focus(slotIndex: number):           void
  destroy():                          void   // stops timers, removes footer elements
}
```

> Call `el._verino.destroy()` before manually removing the element from the DOM. When Alpine destroys the component via `x-if` or `x-for`, `destroy()` is called automatically via Alpine's `cleanup()` hook.

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`verino`](https://www.npmjs.com/package/verino) | Core state machine + vanilla adapter |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + action |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` element |

---

## License

MIT © [Olawale Balo](https://github.com/walebuilds)