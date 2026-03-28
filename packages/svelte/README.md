<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner2.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/svelte</h1>

<h3 align="center">
  Svelte adapter for <a href="https://www.npmjs.com/package/verino" target="_blank" rel="noopener noreferrer">verino</a>. Build reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/svelte"><img src="https://img.shields.io/npm/v/@verino/svelte?color=20C55C&label=%40verino%2Fsvelte" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/svelte"><img src="https://img.shields.io/bundlephobia/minzip/@verino/svelte?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/Dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/svelte` wraps the `verino` core state machine in a `useOTP` composable. State is exposed as Svelte `writable` and `derived` stores — subscribe with the `$` prefix in templates.

The `use:otp.action` Svelte action wires all event listeners on the hidden `<input>` and starts the timer on mount. Visual slot divs are purely decorative mirrors and hold no event listeners.

`otp` itself is a store: `$otp` gives the full `OTPState`. Most other stores must be destructured before subscribing:

```svelte
<script>
  const { slots, wrapperAttrs, timerSeconds } = otp
</script>
```

---

## Installation

```bash
npm install @verino/svelte
pnpm add @verino/svelte
yarn add @verino/svelte
```

**Peer dependency:** Svelte ≥ 4. `verino` is installed automatically.

---

## Quick Start

```svelte
<script>
  import { useOTP } from '@verino/svelte'

  const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
  const { slots, wrapperAttrs } = otp
</script>

<div {...$wrapperAttrs} style="position: relative; display: inline-flex; gap: 8px">
  <input
    use:otp.action
    style="position: absolute; inset: 0; opacity: 0; z-index: 1; cursor: text"
  />

  {#each $slots as slot (slot.index)}
    <div
      aria-hidden="true"
      class="slot"
      class:is-active={slot.isActive}
      class:is-filled={slot.isFilled}
      class:is-error={$otp.hasError}
    >
      {#if slot.isActive && !slot.isFilled}
        <span class="caret" />
      {/if}
      {slot.isFilled ? slot.value : otp.placeholder}
    </div>
  {/each}
</div>
```

> **Note:** `verify(code)` and similar functions used in examples are placeholders — replace them with your own API calls or application logic.

---

## Common Patterns

| Pattern | Key options |
|---|---|
| SMS / email OTP | `type: 'numeric'`, `timer: 60`, `onResend` |
| 2FA / TOTP with grouping | `separatorAfter: 3` |
| PIN entry | `masked: true`, `blurOnComplete: true` |
| Alphanumeric code | `type: 'alphanumeric'`, `pasteTransformer` |
| Programmatic fill | `otp.setValue('123456')` — no `onComplete` fired |
| Async verification lock | `otp.setDisabled(true/false)` |
| Pre-fill on mount | `defaultValue: '123456'` |
| Display-only field | `readOnly: true` |

---

## Usage

### Controlled value

Use `setValue()` to fill the field programmatically without triggering `onComplete`:

```svelte
<script>
  const otp = useOTP({ length: 6 })

  function prefill() { otp.setValue('123456') }
  function clear()   { otp.setValue('') }
</script>
```

To receive every user keystroke, pass `onChange`:

```svelte
<script>
  let code = ''
  const otp = useOTP({ length: 6, onChange: (v) => (code = v) })
</script>
```

### Async verification

`setDisabled` updates both the store and the bound input element atomically:

```svelte
<script>
  const otp = useOTP({
    length: 6,
    onComplete: async (code) => {
      otp.setDisabled(true)
      const ok = await verify(code)
      otp.setDisabled(false)
      ok ? otp.setSuccess(true) : otp.setError(true)
    },
  })
</script>
```

### Timer

`timerSeconds` is a `Writable<number>` — destructure it before subscribing:

```svelte
<script>
  const otp = useOTP({ length: 6, timer: 60, onExpire: () => showExpiredMessage() })
  const { timerSeconds } = otp
</script>

{#if $timerSeconds > 0}
  <p>Expires in {Math.floor($timerSeconds / 60)}:{String($timerSeconds % 60).padStart(2, '0')}</p>
{/if}
```

### Masked input

`masked` and `maskChar` are `Writable` stores — destructure them:

```svelte
<script>
  const otp = useOTP({ length: 6, masked: true, maskChar: '●' })
  const { slots, masked, maskChar } = otp
</script>

{#each $slots as slot (slot.index)}
  <div aria-hidden="true" class="slot">
    {slot.isFilled ? ($masked ? $maskChar : slot.value) : otp.placeholder}
  </div>
{/each}
```

### Separator

`separatorAfter` is a `Writable` store. Build a reactive `Set` using `$:`:

```svelte
<script>
  const otp = useOTP({ length: 6, separatorAfter: 3, separator: '—' })
  const { slots, separatorAfter, separator } = otp

  $: sepSet = new Set(Array.isArray($separatorAfter) ? $separatorAfter : [$separatorAfter])
</script>

{#each $slots as slot (slot.index)}
  {#if sepSet.has(slot.index)}
    <span aria-hidden="true">{$separator}</span>
  {/if}
  <div
    aria-hidden="true"
    class="slot"
    class:is-active={slot.isActive}
    class:is-filled={slot.isFilled}
  >
    {slot.value}
  </div>
{/each}
```

### State attributes

`getInputProps(index)` returns all `data-*` state attributes. Spread only the data attributes onto slot divs:

```svelte
<script>
  function slotDataAttrs(index) {
    const props = otp.getInputProps(index)
    const out = {}
    for (const key in props) if (key.startsWith('data-')) out[key] = props[key]
    return out
  }
</script>

{#each $slots as slot (slot.index)}
  <div class="slot" aria-hidden="true" {...slotDataAttrs(slot.index)}>
    {slot.value}
  </div>
{/each}
```

```css
.slot[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
.slot[data-filled="true"]                   { background: #FFFFFF; }
.slot[data-invalid="true"]                  { border-color: #FB2C36; }
.slot[data-success="true"]                  { border-color: #00C950; }
.slot[data-disabled="true"]                 { opacity: 0.45; }
.slot[data-readonly="true"]                 { cursor: default; }
```

Spread `$wrapperAttrs` on the container:

```svelte
<div {...$wrapperAttrs}>
  <!-- data-complete, data-invalid, data-success, data-disabled, data-readonly -->
</div>
```

#### Slot attributes

Slot-level attributes use string values (`"true"` / `"false"`):

- `data-active` — current cursor position
- `data-focus` — input is focused
- `data-filled` / `data-empty`
- `data-invalid` / `data-success`
- `data-disabled` / `data-readonly`
- `data-index` — slot index (`"0"`, `"1"`, …)
- `data-first` / `data-last` — useful for grouped/pill layouts
- `data-masked` — masked mode active

```css
/* Connected pill layout */
.slot[data-first="true"] { border-radius: 8px 0 0 8px; }
.slot[data-last="true"]  { border-radius: 0 8px 8px 0; }
.slot:not([data-first="true"]):not([data-last="true"]) {
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

---

## CSS custom properties

Style the field by setting `--verino-*` CSS custom properties on the wrapper element:

```css
.my-otp-wrapper {
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
- **`type="password"` in masked mode** — enables secure input and triggers the OS password keyboard on mobile.
- **Native form integration** — the `name` option includes the hidden input in `<form>` submission and `FormData`.
- **Keyboard navigation** — full support for `←`, `→`, `Backspace`, `Delete`, and `Tab`.

---

## API Reference

### `useOTP`

```ts
function useOTP(options?: SvelteOTPOptions): UseOTPResult
```

### `SvelteOTPOptions`

Extends `OTPOptions` from `verino` with:

```ts
type SvelteOTPOptions = OTPOptions & {
  value?:          string                    // static pre-fill; fires onChange
  onChange?:       (code: string) => void    // fires on INPUT, DELETE, CLEAR, PASTE
  separatorAfter?: number | number[]
  separator?:      string                    // default: '—'
  masked?:         boolean
  maskChar?:       string                    // default: '●'
}
```

### `UseOTPResult`

`otp` is a Svelte store — `$otp` yields full `OTPState`. All other stores must be destructured before subscribing with `$`:

```ts
type UseOTPResult = {
  // Main store — $otp yields OTPState (slotValues, activeSlot, hasError, etc.)
  subscribe: Writable<OTPState>['subscribe']

  // Derived stores — destructure, then subscribe as $storeName
  value:          Readable<string>
  isComplete:     Readable<boolean>
  hasError:       Readable<boolean>
  hasSuccess:     Readable<boolean>
  activeSlot:     Readable<number>
  slots:          Readable<SlotEntry[]>      // use in {#each $slots as slot}
  wrapperAttrs:   Readable<Record<string, string | undefined>>

  // Writable stores — destructure, then subscribe as $storeName
  timerSeconds:   Writable<number>           // live countdown; 0 when expired or no timer
  isDisabled:     Writable<boolean>
  isReadOnly:     Writable<boolean>
  separatorAfter: Writable<number | number[]>
  separator:      Writable<string>
  masked:         Writable<boolean>
  maskChar:       Writable<string>

  placeholder:    string                     // plain string — no subscription needed

  // Svelte action
  action(node: HTMLInputElement): { destroy: () => void }

  // Methods
  getCode():                                string
  getSlots():                               SlotEntry[]   // non-reactive snapshot
  getInputProps(index: number):             InputProps & { 'data-focus': 'true' | 'false' }
  reset():                                  void
  setError(isError: boolean):               void
  setSuccess(isSuccess: boolean):           void
  setDisabled(value: boolean):              void
  setReadOnly(value: boolean):              void
  setValue(v: string | undefined):          void  // programmatic fill; no onComplete
  focus(slotIndex: number):                 void
}
```

### `SlotEntry` (from `$slots`)

```ts
type SlotEntry = {
  index:    number
  value:    string    // slot character; '' when unfilled
  isActive: boolean   // cursor is at this slot
  isFilled: boolean   // slot contains a character
}
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`verino`](https://www.npmjs.com/package/verino) | Core state machine + vanilla adapter |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `x-verino` directive |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)