<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner1.png" alt="verino" width="100%" />
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

## Overview

`verino` ships two things:

1. **Core** (`verino/core`): a zero DOM, zero-framework TypeScript state machine that manages OTP slot values, cursor position, completion, error/success states, and an optional countdown timer. All framework adapters import from here.

2. **Vanilla adapter** (`initOTP`): a DOM adapter built on the core using the single hidden input architecture. One real `<input>` captures all keyboard input, paste, and SMS autofill. Visual slot `<div>`s are styled mirrors driven by `data-*` attributes.

Most OTP libraries render one `<input>` per slot, which breaks autofill, complicates focus management, and degrades accessibility.

`verino` uses a single hidden input with visual slots as a projection layer. It is the architecture for building OTP inputs reliably across any environment.

---

## Features

- **Zero-dependency core.** `createOTP` is a pure TypeScript state machine with no DOM or framework imports. Runs in any environment and is fully testable.
- **Single hidden input architecture.** One transparent `<input>` captures all keyboard input, paste, and autofill while slots remain purely decorative. SMS autofill, Web OTP, screen readers, and IME work natively.
- **Accessible by default.** Built-in ARIA, `inputMode`, and `autocomplete="one-time-code"` ensure full accessibility with no extra setup.
- **Typed event system.** Subscribers receive a discriminated `OTPEvent` union (`INPUT`, `DELETE`, `PASTE`, `COMPLETE`, `RESET`, `ERROR`, `SUCCESS`, and more) for precise, event-driven updates.
- **Smart paste handling.** Clipboard input is filtered and distributed from the cursor forward. `pasteTransformer` allows custom preprocessing.
- **Built-in plugins.** Timer, Web OTP, and password manager guard plugins extend functionality without bloating the core.
- **Masked input mode.** `masked: true` renders secure slot values and enables password-style input on mobile.
- **Visual caret.** A blinking caret appears in the active empty slot for a natural typing experience.
- **Flexible formatting.** `separatorAfter` inserts visual group separators without affecting the code value.
- **Custom character rules.** `pattern` enables full control over allowed input, from numeric to fully custom sets.
- **Feedback hooks.** Optional haptic and sound feedback trigger on completion and error.
- **Full programmatic control.** Methods like `setError`, `setSuccess`, `reset()`, `focus(i)`, and `getCode()` work across all adapters.
- **CSS custom property theming.** All visual styles are exposed via scoped `--verino-*` custom properties.
- **Data attribute state hooks.** All UI state is exposed via `data-*` attributes for styling — no extra logic required.

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

## When to Use

### Use `verino` when:

- You're working in **vanilla JS/TS**
- You need a **no-build / CDN setup**
- You're building a **custom framework adapter**
- You're running logic **outside the DOM** (SSR, Web Workers)

### Use an adapter when:

- You're in a framework (React, Vue, Svelte, etc.)
- You want **reactive state + idiomatic APIs** (`useOTP`, composables, stores)

---

## Installation

```bash
npm install verino
pnpm add verino
yarn add verino
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

---

## Quick Start

### Vanilla DOM

```html
<div class="verino-wrapper" data-length="6"></div>

<script type="module">
  import { initOTP } from 'verino'

  const [otp] = initOTP('.verino-wrapper', {
    onComplete: (code) => verify(code),
  })
</script>
```

### Pure state machine (no DOM)

```ts
import { createOTP } from 'verino'

const otp = createOTP({ length: 6, type: 'numeric' })

otp.subscribe((state, event) => {
  if (event.type === 'COMPLETE') console.log(event.value)
})

otp.paste('123456', 0)
otp.getCode() // → '123456'
```

> **Note:** `verify(code)`, `sendCode()`, and similar functions used throughout the examples are placeholders — replace them with your own API calls or application logic.

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

## Usage

### Data attributes

All `OTPOptions` can be set as `data-*` attributes on the wrapper element. JS options take precedence when both are present.

```html
<div
  class="verino-wrapper"
  data-length="6"
  data-type="numeric"
  data-timer="60"
  data-separator-after="3"
  data-separator="—"
></div>
```

### Programmatic control

`initOTP` returns one `VerinoInstance` per wrapper found:

```ts
const [otp] = initOTP('.verino-wrapper', {
  length: 6,
  timer: 60,
  onComplete: async (code) => {
    otp.setDisabled(true)
    const ok = await verify(code)
    ok ? otp.setSuccess(true) : otp.setError(true)
    otp.setDisabled(false)
  },
  onResend: () => sendCode(),
})

otp.getCode()           // → "123456"
otp.reset()             // clear all slots, restart timer, re-focus
otp.setError(true)      // red ring on all slots
otp.setSuccess(true)    // green ring on all slots
otp.setDisabled(true)   // lock input during async verification
otp.destroy()           // remove all event listeners, stop timer
```

### CSS custom properties

Set any of these on the wrapper element to override defaults:

```css
.verino-wrapper {
  /* Dimensions */
  --verino-size:           56px;
  --verino-gap:            12px;
  --verino-radius:         10px;
  --verino-font-size:      24px;

  /* Colors */
  --verino-color:          #0A0A0A;
  --verino-bg:             #FAFAFA;
  --verino-bg-filled:      #FFFFFF;
  --verino-border-color:   #E5E5E5;
  --verino-active-color:   #3D3D3D;
  --verino-error-color:    #FB2C36;
  --verino-success-color:  #00C950;
  --verino-caret-color:    #3D3D3D;
  --verino-timer-color:    #5C5C5C;

  /* Placeholder, separator & mask */
  --verino-placeholder-color: #D3D3D3;
  --verino-placeholder-size:  16px;
  --verino-separator-color:   #A1A1A1;
  --verino-separator-size:    18px;
  --verino-masked-size:       16px;
}
```

### State attributes

Every visual slot and the wrapper element expose state as `data-*` attributes for CSS targeting:

#### Slot attributes

Each slot receives reactive attributes:

- `data-active` — current cursor position
- `data-focus` — input is focused
- `data-filled` / `data-empty`
- `data-invalid` / `data-success`
- `data-disabled` / `data-readonly`

Structural attributes:

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

```css
/* Active slot */
.verino-slot[data-active="true"][data-focus="true"] {
  border-color: var(--verino-active-color);
}

/* Filled vs empty */
.verino-slot[data-filled="true"] { background: #FFFFFF; }
.verino-slot[data-empty="true"]  { color: #D3D3D3; }

/* Error / success */
.verino-slot[data-invalid="true"]  { border-color: var(--verino-error-color); }
.verino-slot[data-success="true"]  { border-color: var(--verino-success-color); }

/* Disabled / read-only */
.verino-slot[data-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
}
.verino-slot[data-readonly="true"] { cursor: default; }
```

> **Custom adapters:** `getInputProps(index)` returns `data-index` (not `data-slot`) plus all relevant state attributes.

#### Wrapper attributes

The wrapper reflects global state using boolean presence attributes:

- `data-complete`
- `data-invalid`
- `data-success`
- `data-disabled`
- `data-readonly`

```css
.verino-wrapper[data-complete] {
  border-color: var(--verino-success-color);
}

.verino-wrapper[data-invalid] {
  animation: shake 0.2s ease;
}

.verino-wrapper[data-disabled] {
  pointer-events: none;
  opacity: 0.6;
}
```

```html
<!-- Tailwind example -->
<div class="verino-wrapper data-[complete]:ring-2 data-[complete]:ring-green-500 data-[invalid]:ring-2 data-[invalid]:ring-red-500"></div>
```

#### CSS classes

Applied automatically by the vanilla adapter:

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

### Custom timer display

Supply `onTick` to power your own UI instead:

```ts
const [otp] = initOTP('.verino-wrapper', {
  timer:    60,
  onTick:   (remaining) => (timerEl.textContent = `0:${String(remaining).padStart(2, '0')}`),
  onExpire: () => showResendButton(),
  onResend: () => { otp.resend(); hideResendButton() },
})
```

### Masked input

```ts
initOTP('.verino-wrapper', {
  masked:   true,
  maskChar: '●',  // default; any single character
})
```

Or via attribute: `<div class="verino-wrapper" data-masked>`.

### Paste transformer

Strip formatting from real-world OTP SMS messages before distributing to slots:

```ts
initOTP('.verino-wrapper', {
  pasteTransformer: (raw) => raw.replace(/[\s-]/g, ''),
  // 'G-123456' → '123456', '123 456' → '123456'
})
```

### Direct core usage

```ts
import { createOTP, createTimer } from 'verino'

const otp = createOTP({
  length: 6,
  type:   'alphanumeric',
  onComplete:    (code)       => submitForm(code),
  onInvalidChar: (char, index) => shake(index),
})

const unsub = otp.subscribe((state, event) => {
  switch (event.type) {
    case 'COMPLETE':     return verify(event.value)
    case 'INVALID_CHAR': return showToast(`'${event.char}' not allowed`)
    case 'ERROR':        if (event.hasError) vibrateDevice(); break
  }
})

// Clean up
unsub()
otp.destroy()
```

---

## Configuration Options

All options are accepted by every adapter unless otherwise noted.

| Option | Type | Default | Description |
|---|---|---|---|
| `length` | `number` | `6` | Number of input slots |
| `type` | `'numeric' \| 'alphabet' \| 'alphanumeric' \| 'any'` | `'numeric'` | Character class |
| `pattern` | `RegExp` | — | Per-character regex; overrides `type` for validation |
| `pasteTransformer` | `(raw: string) => string` | — | Transforms clipboard text before filtering |
| `onComplete` | `(code: string) => void` | — | Fired when all slots are filled |
| `onExpire` | `() => void` | — | Fired when countdown reaches zero |
| `onResend` | `() => void` | — | Fired when resend is triggered |
| `onTick` | `(remaining: number) => void` | — | Fired every second; suppresses built-in timer UI in vanilla/alpine/web-component |
| `onInvalidChar` | `(char: string, index: number) => void` | — | Fired when a typed character is rejected |
| `onChange` | `(code: string) => void` | — | Fired on every user interaction — framework adapters only (React, Vue, Svelte) |
| `onFocus` | `() => void` | — | Fired when hidden input gains focus |
| `onBlur` | `() => void` | — | Fired when hidden input loses focus |
| `timer` | `number` | `0` | Countdown duration in seconds (`0` = disabled) |
| `resendAfter` | `number` | `30` | Resend button cooldown in seconds |
| `autoFocus` | `boolean` | `true` | Focus the hidden input on mount |
| `blurOnComplete` | `boolean` | `false` | Blur on completion (auto-advance to next field) |
| `selectOnFocus` | `boolean` | `false` | Select-and-replace behavior on focused filled slot |
| `placeholder` | `string` | `''` | Character shown in empty slots (e.g. `'○'`, `'_'`) |
| `masked` | `boolean` | `false` | Render `maskChar` in slots; sets `type="password"` on hidden input — vanilla/alpine/web-component |
| `maskChar` | `string` | `'●'` | Glyph used in masked mode — vanilla/alpine/web-component |
| `name` | `string` | — | Hidden input `name` for `<form>` / `FormData` |
| `separatorAfter` | `number \| number[]` | — | Slot index/indices after which to render a visual separator — vanilla/alpine/web-component |
| `separator` | `string` | `'—'` | Separator character to render — vanilla/alpine/web-component |
| `disabled` | `boolean` | `false` | Disable all input on mount |
| `readOnly` | `boolean` | `false` | Block mutations while keeping the field focusable and copyable |
| `defaultValue` | `string` | — | Uncontrolled pre-fill on mount; does not trigger `onComplete` |
| `haptic` | `boolean` | `true` | `navigator.vibrate(10)` on completion and error |
| `sound` | `boolean` | `false` | Play 880 Hz tone via Web Audio on completion |

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

### `initOTP`

```ts
function initOTP(
  target:  string | HTMLElement,   // default: '.verino-wrapper'
  options: VanillaOnlyOptions,
): VerinoInstance[]
```

Mounts verino on every element matching `target`. Returns one `VerinoInstance` per element. Call without arguments to mount all `.verino-wrapper` elements on the page.

### `VerinoInstance`

- `getCode()` → Returns the current code string  
- `reset()` → Clears all slots, restarts timer, and re-focuses  
- `resend()` → `reset()` + fires `onResend`  
- `setError(isError)` → Toggles error state (clears success)  
- `setSuccess(isSuccess)` → Toggles success state (clears error)  
- `setDisabled(value)` → Enables or disables input  
- `setReadOnly(value)` → Prevents mutation while keeping focus and copy  
- `focus(index)` → Moves focus to a slot  
- `destroy()` → Cleans up listeners, timer, and Web OTP

### `createOTP`

```ts
function createOTP(options?: OTPOptions): {
  readonly state:   Readonly<OTPState>
  insert(char: string, slotIndex: number):       OTPState
  delete(slotIndex: number):                     OTPState
  clear(slotIndex: number):                      OTPState
  paste(text: string, cursorSlot?: number):      OTPState
  move(slotIndex: number):                       OTPState
  focus(slotIndex: number):                      void
  blur():                                        void
  setError(isError: boolean):                    OTPState
  setSuccess(isSuccess: boolean):                OTPState
  reset():                                       OTPState
  setDisabled(value: boolean):                   void
  setReadOnly(value: boolean):                   void
  destroy():                                     void
  getCode():                                     string
  getSnapshot():                                 OTPState
  getState():                                    OTPState   // alias for getSnapshot()
  getSlots():                                    SlotEntry[]
  getSlotProps(index: number):                   SlotProps
  getInputProps(index: number):                  InputProps
  getSlotId(index: number):                      string
  getGroupId():                                  string
  getErrorId():                                  string
  subscribe(listener: StateListener):            () => void
}
```

### `OTPOptions`

```ts
type OTPOptions = {
  length?:           number        // default: 6
  type?:             InputType     // default: 'numeric'
  timer?:            number        // seconds; 0 = no timer
  resendAfter?:      number        // resend cooldown seconds; default: 30
  disabled?:         boolean       // default: false
  readOnly?:         boolean       // default: false
  pattern?:          RegExp        // per-character validation regex
  pasteTransformer?: (raw: string) => string
  defaultValue?:     string
  autoFocus?:        boolean       // default: true
  name?:             string        // hidden input name attr
  placeholder?:      string        // char shown in empty slots
  selectOnFocus?:    boolean       // default: false
  blurOnComplete?:   boolean       // default: false
  haptic?:           boolean       // default: true
  sound?:            boolean       // default: false
  onComplete?:       (code: string) => void
  onTick?:           (remainingSeconds: number) => void
  onExpire?:         () => void
  onResend?:         () => void
  onFocus?:          () => void
  onBlur?:           () => void
  onInvalidChar?:    (char: string, index: number) => void
}
```

`VanillaOnlyOptions` extends `OTPOptions` with:

```ts
type VanillaOnlyOptions = OTPOptions & {
  separatorAfter?: number | number[]  // slot index/indices for visual separator
  separator?:      string             // separator character; default: '—'
  masked?:         boolean
  maskChar?:       string             // default: '●'
}
```

### `InputType`

```ts
type InputType = 'numeric' | 'alphabet' | 'alphanumeric' | 'any'
```

### `OTPState`

```ts
type OTPState = {
  slotValues:   string[]
  activeSlot:   number
  hasError:     boolean
  hasSuccess:   boolean
  isComplete:   boolean
  isEmpty:      boolean
  timerSeconds: number   // initial value mirror — not a live countdown
  isDisabled:   boolean
  isReadOnly:   boolean
}
```

> **`timerSeconds` is not a live countdown.** It reflects the initial `timer` value and does not update. Use `onTick` for remaining time, or read the adapter’s reactive state (React/Vue/Svelte) for a live value.

### `OTPEvent`

Discriminated union passed as the second argument to `subscribe` listeners. Narrow on `event.type` for precise access to event-specific data:

```ts
type OTPEvent =
  | { type: 'INPUT';        index: number; value: string }
  | { type: 'DELETE';       index: number }
  | { type: 'CLEAR';        index: number }
  | { type: 'PASTE';        startIndex: number; value: string }
  | { type: 'COMPLETE';     value: string }
  | { type: 'INVALID_CHAR'; char: string; index: number }
  | { type: 'FOCUS';        index: number }
  | { type: 'BLUR';         index: number }
  | { type: 'RESET' }
  | { type: 'MOVE';         index: number }
  | { type: 'ERROR';        hasError: boolean }
  | { type: 'SUCCESS';      hasSuccess: boolean }
  | { type: 'DISABLED';     isDisabled: boolean }
  | { type: 'READONLY';     isReadOnly: boolean }
```

### `createTimer`

Standalone countdown utility used by the vanilla adapter, also available for custom UIs.

```ts
function createTimer(options: TimerOptions): TimerControls

type TimerOptions = {
  totalSeconds: number
  onTick?:      (remainingSeconds: number) => void
  onExpire?:    () => void
}

type TimerControls = {
  start():   void   // begin countdown
  stop():    void   // pause
  reset():   void   // stop + restore to totalSeconds
  restart(): void   // reset + start
}
```

`start()` is idempotent — calling it multiple times won’t create duplicate timers. If `totalSeconds <= 0`, `onExpire` fires immediately.

### `formatCountdown`

Formats a second count as a `m:ss` string. Used internally by the built-in timer UI; exported for custom timer displays.

```ts
function formatCountdown(totalSeconds: number): string

formatCountdown(65) // → '1:05'
formatCountdown(30) // → '0:30'
formatCountdown(9)  // → '0:09'
```

### `filterChar` / `filterString`

```ts
function filterChar(char: string, type: InputType, pattern?: RegExp): string
function filterString(str: string,  type: InputType, pattern?: RegExp): string
```

### `triggerHapticFeedback` / `triggerSoundFeedback`

```ts
function triggerHapticFeedback(): void  // navigator.vibrate([50])
function triggerSoundFeedback():  void  // Web Audio API tone
```

### Plugin types

```ts
type VerinoPlugin = {
  name:    string
  install: (ctx: VerinoPluginContext) => () => void  // returns cleanup
}
```

### Sub-path exports

| Import path | Description |
|---|---|
| `verino` | `initOTP`, `createOTP`, core utilities + vanilla adapter |
| `verino/core` | Core only — `createOTP`, `createTimer`, `formatCountdown`, `filterChar`, `filterString` (no DOM) |
| `verino/plugins/timer-ui` | `timerUIPlugin` — countdown badge + resend UI |
| `verino/plugins/web-otp` | `webOTPPlugin` — SMS autofill via Web OTP API |
| `verino/plugins/pm-guard` | `pmGuardPlugin` — password manager badge guard |

```ts
import { initOTP, createOTP } from 'verino'
import { createOTP }          from 'verino/core'
import { timerUIPlugin }      from 'verino/plugins/timer-ui'
import { webOTPPlugin }       from 'verino/plugins/web-otp'
import { pmGuardPlugin }      from 'verino/plugins/pm-guard'
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + action |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `x-verino` directive |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)