<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner2.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/svelte</h1>

<h3 align="center">
  Svelte adapter for <a href="https://github.com/boastack/verino">Verino</a>. Reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/svelte"><img src="https://img.shields.io/npm/v/@verino/svelte?color=20C55C&label=%40verino%2Fsvelte" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/svelte"><img src="https://img.shields.io/bundlephobia/minzip/@verino/svelte?color=20C55C&label=gzip+size" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/svelte` wraps [`@verino/core`](https://www.npmjs.com/package/@verino/core) using Svelte's native primitives. State is exposed as `writable` and `derived` stores, every property you need in a template is available with the `$` prefix, no manual subscription code required.

The centerpiece is `use:otp.action`, a Svelte action placed on the hidden `<input>`. It wires all keyboard, paste, focus, and blur events to the core machine, starts the timer on mount, and calls `destroy()` automatically when the element is removed. Visual slot divs are purely decorative mirrors, hold no event listeners and carry no state of their own.

The store structure follows one key rule: **`otp` is a store** (`$otp` gives the full `OTPStateSnapshot`). All other stores (`slots`, `wrapperAttrs`, `timerSeconds`, `masked`, `separatorAfter`, etc.) must be **destructured from the return value before subscribing with `$`**.

Use `value` for live external control with a Svelte readable store. Use `defaultValue` for one-time prefill on mount.

---

## Why Use This Adapter?

- **Native Svelte stores.** State is exposed as `writable` and `derived` — use `$` subscription with no boilerplate.
- **`use:` action.** One directive wires the hidden input, timer, and cleanup lifecycle.
- **SvelteKit compatible.** SSR-safe — the DOM adapter only runs on the client.
- **Full markup control.** No opaque component wrapper.

---

## Installation

```bash
# npm
npm i @verino/svelte

# pnpm
pnpm add @verino/svelte

# yarn
yarn add @verino/svelte
```

**Peer dependency:** Svelte ≥ 4. `@verino/core` installs automatically.

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

---

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

### Live external control

Use `value` for live external control and `defaultValue` for one-time mount prefill. In Svelte, live external control means passing a readable store:

```svelte
<script>
  import { writable } from 'svelte/store'

  const code = writable('')
  const otp = useOTP({ length: 6, value: code, onChange: (v) => code.set(v) })
</script>
```

Use `setValue()` when you want a one-off programmatic fill without turning the field into a controlled store:

```svelte
<script>
  const otp = useOTP({ length: 6 })

  function prefill() { otp.setValue('123456') }
  function clear()   { otp.setValue('') }
</script>
```

Propagate user keystrokes back to an external variable via `onChange`:

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
      const ok = await api.verify(code)
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
  const otp = useOTP({ length: 6, timer: 60, onExpire: () => showExpired() })
  const { timerSeconds } = otp
</script>

{#if $timerSeconds > 0}
  <p>
    Expires in {Math.floor($timerSeconds / 60)}:{String($timerSeconds % 60).padStart(2, '0')}
  </p>
{/if}
```

### Separator

`separatorAfter` is a `Writable` store. Build a reactive `Set` with `$:`:

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

### `data-*` state attributes

Spread `data-*` props onto slot divs for CSS driven state styling:

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
.slot[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
.slot[data-filled="true"]                    { background:   #FFFFFF; }
.slot[data-empty="true"]                     { background:   #FAFAFA; }
.slot[data-invalid="true"]                   { border-color: #FB2C36; }
.slot[data-success="true"]                   { border-color: #00C950; }
.slot[data-disabled="true"]                  { opacity: 0.45; pointer-events: none; }
.slot[data-readonly="true"]                  { cursor: default; }
.slot[data-complete="true"]                  { border-color: #00C950; }

/* Connected pill layout */
.slot[data-first="true"]                              { border-radius: 8px 0 0 8px; }
.slot[data-last="true"]                               { border-radius: 0 8px 8px 0; }
.slot[data-first="false"][data-last="false"]          { border-radius: 0; }

/* Target a specific slot by index */
.slot[data-slot="0"] { font-weight: 700; }
```

Spread `$wrapperAttrs` on the container for wrapper-level attributes:

```svelte
<div {...$wrapperAttrs}>
  <!-- data-complete, data-invalid, data-success, data-disabled, data-readonly -->
</div>
```

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

### `useOTP(options?)`

```ts
function useOTP(options?: SvelteOTPOptions): UseOTPResult
```

### `SvelteOTPOptions`

Builds on `CoreOTPOptions` from `@verino/core` with Svelte-specific state and rendering options:

```ts
type SvelteOTPOptions = CoreOTPOptions & {
  value?:          Readable<string>          // live external control via readable store
  onChange?:       (code: string) => void    // fires on INPUT, DELETE, CLEAR, PASTE
  separatorAfter?: number | number[]
  separator?:      string                    // default: '—'
  masked?:         boolean
  maskChar?:       string                    // default: '●'
}
```

### `UseOTPResult`

`otp` is a Svelte store — `$otp` gives the full `OTPStateSnapshot`. All other stores must be **destructured** before subscribing with `$`:

```ts
type UseOTPResult = {
  // Main store — $otp gives OTPStateSnapshot
  subscribe: Writable<OTPStateSnapshot>['subscribe']

  // Derived (read-only) stores — destructure, then use $storeName
  value:        Readable<string>
  isComplete:   Readable<boolean>
  hasError:     Readable<boolean>
  hasSuccess:   Readable<boolean>
  activeSlot:   Readable<number>
  slots:        Readable<SlotEntry[]>
  wrapperAttrs: Readable<Record<string, string | undefined>>

  // Writable stores — destructure, then use $storeName
  timerSeconds:   Writable<number>
  isDisabled:     Writable<boolean>
  isReadOnly:     Writable<boolean>
  separatorAfter: Writable<number | number[]>
  separator:      Writable<string>
  masked:         Writable<boolean>
  maskChar:       Writable<string>

  placeholder: string   // plain string — no $ needed

  // Svelte action
  action(node: HTMLInputElement): { destroy: () => void }

  // Methods
  getCode():                         string
  getSlots():                        SlotEntry[]    // non-reactive snapshot
  getInputProps(index: number):      InputProps & { 'data-focus': 'true' | 'false' }
  reset():                           void
  resend():                          void
  setError(v: boolean):              void
  setSuccess(v: boolean):            void
  setDisabled(v: boolean):           void
  setReadOnly(v: boolean):           void
  setValue(v: string | undefined):   void   // programmatic fill; no onComplete
  focus(slotIndex: number):          void
}
```

### `SlotEntry` (from `$slots`)

```ts
type SlotEntry = {
  index:    number
  value:    string    // slot character; '' when unfilled
  isActive: boolean
  isFilled: boolean
}
```

---

## Compatibility

| Environment | Requirement |
|---|---|
| Svelte | ≥ 4 |
| SvelteKit | ✅ (SSR-safe) |
| `@verino/core` | Same monorepo release |
| TypeScript | ≥ 5.0 |
| Node.js (SSR) | ≥ 18 |
| Module format | ESM + CJS |

---

## Integration with Core

`useOTP` calls `createOTP()` from `@verino/core` internally. Filtering, cursor logic, paste normalization, and event routing live in core; countdown, feedback, and toolkit helpers come from `@verino/core/toolkit`. The adapter maps that toolkit behavior into Svelte stores and actions.

See the [`@verino/core` README](https://github.com/boastack/verino/blob/main/packages/core/README.md) for the full state machine and event reference.

---

## Contributing

This package lives in the [verino monorepo](https://github.com/boastack/verino). See [CONTRIBUTING.md](https://github.com/boastack/verino/blob/main/.github/CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/boastack/verino.git
cd verino && pnpm i

# Run before opening a PR
pnpm --filter @verino/svelte build && pnpm test
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`@verino/core`](https://www.npmjs.com/package/@verino/core) | OTP state machine + toolkit |
| [`@verino/vanilla`](https://www.npmjs.com/package/@verino/vanilla) | Vanilla DOM adapter + `timerUIPlugin`, `webOTPPlugin`, `pmGuardPlugin` |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` component (React ≥ 18) |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable with reactive Vue refs (Vue ≥ 3) |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `VerinoAlpine` plugin — `x-verino` directive (Alpine.js ≥ 3) |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` Shadow DOM custom element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)
