<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner4.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/alpine</h1>

<h3 align="center">
  Alpine.js adapter for <a href="https://github.com/boastack/verino">Verino</a>. Reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/alpine"><img src="https://img.shields.io/npm/v/@verino/alpine?color=20C55C&label=%40verino%2Falpine" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/alpine"><img src="https://img.shields.io/bundlephobia/minzip/@verino/alpine?color=20C55C&label=gzip+size" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/alpine` registers the `VerinoAlpine` plugin, which provides the `x-verino` directive. Attach it to any container element with a configuration expression, and Verino automatically builds the full OTP field (hidden input, visual slots, optional separators, countdown timer, and resend button) with no template authoring required.

The expression is evaluated in the Alpine component scope and kept in sync through Alpine's reactivity, so `$data` references keep working after the directive is created. Programmatic runtime control is available on `el._verino` from any JavaScript context.

When Alpine destroys the component (via `x-if` or `x-for`), `destroy()` is called automatically via Alpine's `cleanup()` hook.

---

## Why Use This Adapter?

- **Zero template work.** One `x-verino` directive renders the full OTP field, including visual slots, caret, separators, and timer.  
- **Reactive Alpine data.** The `x-verino` expression evaluates in Alpine’s component scope — `$data` properties work seamlessly.  
- **Automatic cleanup.** No manual teardown is needed when the element is removed via `x-if`.  
- **CDN-ready.** A pre-built IIFE bundle works out of the box, with no bundler required.

---

## Installation

### npm

```bash
# npm
npm i @verino/alpine

# pnpm
pnpm add @verino/alpine

# yarn
yarn add @verino/alpine
```

**Peer dependency:** Alpine.js ≥ 3. `@verino/core` installs automatically.

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
<script src="https://unpkg.com/@verino/alpine/dist/verino-alpine.min.js"></script>
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

Verino renders the complete OTP field inside the element, wires all event handlers, and manages all state internally.

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

### Reactive Alpine data

The `x-verino` expression is evaluated in the Alpine component scope — reactive `$data` properties work directly:

```html
<div
  x-data="{ timer: 60 }"
  x-verino="{ length: 6, timer: timer, onComplete: (code) => verify(code) }"
></div>
```

### Timer and resend

When `timer` is set and no `onTick` is provided, verino renders a "Code expires in 1:00" footer and a "Didn't receive the code? Resend" section automatically:

```html
<div x-verino="{ length: 6, timer: 60, onResend: () => sendCode() }"></div>
```

Provide an `onTick` callback to drive a custom timer UI and disable the built-in footer:

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
    const ok = await api.verify(code)
    field._verino.setDisabled(false)
    ok ? field._verino.setSuccess(true) : field._verino.setError(true)
  }
</script>
```

### Separator

```html
<!-- Single separator: [*][*][*] — [*][*][*] -->
<div x-verino="{ length: 6, separatorAfter: 3 }"></div>

<!-- Multiple separators: [*][*] — [*][*] — [*][*] — [*][*] -->
<div x-verino="{ length: 8, separatorAfter: [2, 4, 6] }"></div>
```

### Masked input

```html
<div x-verino="{ length: 6, masked: true, maskChar: '●' }"></div>
```

### `data-*` state attributes

Since verino renders the full DOM inside the directive’s container, all `data-*` attributes are applied automatically — no additional template work is required.

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
#verino-field[data-complete] { outline: 2px solid #00C950; }
#verino-field[data-invalid]  { outline: 2px solid #FB2C36; }
#verino-field[data-disabled] { opacity: 0.6; }

/* Connected pill layout */
.verino-slot[data-first="true"]                              { border-radius: 8px 0 0 8px; }
.verino-slot[data-last="true"]                               { border-radius: 0 8px 8px 0; }
.verino-slot[data-first="false"][data-last="false"]          { border-radius: 0; }

/* Target a specific slot by index */
.verino-slot[data-slot="0"] { font-weight: 700; }
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
#verino-field {
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

### Plugin registration

```ts
import { VerinoAlpine } from '@verino/alpine'
Alpine.plugin(VerinoAlpine)   // call before Alpine.start()
```

### `x-verino` expression options

The directive accepts the core machine options from `@verino/core`, plus these Alpine/browser helper options:

| Option | Type | Default | Description |
|---|---|---|---|
| `separatorAfter` | `number \| number[]` | — | Separator position(s) |
| `separator` | `string` | `'—'` | Separator character |
| `onChange` | `(code: string) => void` | — | Fires on INPUT, DELETE, CLEAR, PASTE |
| `onTick` | `(remaining: number) => void` | — | Custom tick callback; suppresses built-in timer UI |
| `resendAfter` | `number` | `30` | Resend button cooldown in seconds |
| `masked` | `boolean` | `false` | Show mask glyph in filled slots |
| `maskChar` | `string` | `'●'` | Mask glyph |

### `el._verino`

Exposed on the wrapper element after mount:

```ts
el._verino = {
  getCode():                          string
  getSlots():                         SlotEntry[]
  getInputProps(slotIndex: number):   InputProps
  reset():                            void   // clear slots + restart timer + re-focus
  resend():                           void   // reset + fire onResend
  setError(v: boolean):               void
  setSuccess(v: boolean):             void   // stops timer on success
  setDisabled(v: boolean):            void
  setReadOnly(v: boolean):            void
  focus(slotIndex: number):           void
  destroy():                          void   // stop timers + remove footer elements
}
```

> Call `el._verino.destroy()` before manually removing the element from the DOM. When Alpine destroys the component via `x-if` or `x-for`, `destroy()` is called automatically via Alpine's `cleanup()` hook.

---

## Compatibility

| Environment | Requirement |
|---|---|
| Alpine.js | ≥ 3 |
| `@verino/core` | Same monorepo release |
| TypeScript | ≥ 5.0 |
| Browsers | All evergreen |
| Module format | ESM + IIFE (CDN) |

---

## Integration with Core

`VerinoAlpine` calls `createOTP()` from `@verino/core` when the `x-verino` directive mounts. Character filtering, cursor logic, paste normalization, and event routing live in core; countdown, feedback, scheduling, and toolkit helpers come from `@verino/core/toolkit`.

See the [`@verino/core` README](https://github.com/boastack/verino/blob/main/packages/core/README.md) for the full state machine and event reference.

---

## Contributing

This package lives in the [verino monorepo](https://github.com/boastack/verino). See [CONTRIBUTING.md](https://github.com/boastack/verino/blob/main/.github/CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/boastack/verino.git
cd verino && pnpm i

# Run before opening a PR
pnpm --filter @verino/alpine build && pnpm test
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`@verino/core`](https://www.npmjs.com/package/@verino/core) | OTP state machine + toolkit |
| [`@verino/vanilla`](https://www.npmjs.com/package/@verino/vanilla) | Vanilla DOM adapter + `timerUIPlugin`, `webOTPPlugin`, `pmGuardPlugin` |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` component (React ≥ 18) |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable with reactive Vue refs (Vue ≥ 3) |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + `use:action` directive (Svelte ≥ 4) |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` Shadow DOM custom element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)
