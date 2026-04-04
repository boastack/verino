<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner2.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/react</h1>

<h3 align="center">
  React adapter for <a href="https://github.com/boastack/verino">verino</a>. Build reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/react"><img src="https://img.shields.io/npm/v/@verino/react?color=20C55C&label=%40verino%2Freact" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/react"><img src="https://img.shields.io/bundlephobia/minzip/@verino/react?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/react` wraps [`@verino/core`](https://www.npmjs.com/package/@verino/core) in a `useOTP` hook. The hook manages React state, wires all event handlers, and returns everything needed to render a fully accessible OTP field with full control over markup and styling.

`HiddenOTPInput` is a positioned `<input>` that captures all keyboard input, paste, and native SMS autofill. Visual slot divs are purely decorative mirrors, hold no event listeners and carry no state of their own.

The core instance is created once via `useMemo` and never recreated on re-renders. All callback options (`onComplete`, `onExpire`, etc.) are stored in refs so they can be updated without restarting the effect.

---

## Why Use This Adapter?

- **Full markup control.** `useOTP` provides render props — you own the JSX, no opaque wrapper.  
- **React 18 ready.** Fully compatible with concurrent features, Suspense, and strict mode.  
- **`react-hook-form` friendly.** Pass `value` and `onChange` to integrate with any form library.  
- **Stable instance.** The `@verino/core` state machine is created once and persists across re-renders.

---

## Installation

```bash
# npm
npm install @verino/react

# pnpm
pnpm add @verino/react

# yarn
yarn add @verino/react
```

**Peer dependency:** React ≥ 18. `@verino/core` installs automatically.

---

## Quick Start

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

### Controlled value / react-hook-form

Pass `value` and `onChange` to sync the field with external state. Programmatic updates do not trigger `onComplete`:

```tsx
const [code, setCode] = useState('')
const otp = useOTP({ length: 6, value: code, onChange: setCode })
```

With `react-hook-form`:

```tsx
import { useForm, Controller } from 'react-hook-form'

function OTPField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const otp = useOTP({ length: 6, value, onChange })
  return (
    <div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
      <HiddenOTPInput {...otp.hiddenInputProps} />
      {otp.getSlots().map((slot) => {
        const { char, isActive, isFilled, isError } = otp.getSlotProps(slot.index)
        return (
          <div key={slot.index} className={['slot', isActive && 'is-active', isFilled && 'is-filled', isError && 'is-error'].filter(Boolean).join(' ')}>
            {char}
          </div>
        )
      })}
    </div>
  )
}

function MyForm() {
  const { control, handleSubmit } = useForm<{ otp: string }>()
  return (
    <form onSubmit={handleSubmit((data) => console.log(data.otp))}>
      <Controller name="otp" control={control} render={({ field }) => (
        <OTPField value={field.value} onChange={field.onChange} />
      )} />
    </form>
  )
}
```

### Async verification

```tsx
const otp = useOTP({
  length: 6,
  onComplete: async (code) => {
    otp.setDisabled(true)
    const ok = await api.verify(code)
    otp.setDisabled(false)
    ok ? otp.setSuccess(true) : otp.setError(true)
  },
})
```

### Timer

`timerSeconds` is a live reactive countdown, it updates every second:

```tsx
const otp = useOTP({ length: 6, timer: 60, onExpire: () => showExpired() })

{otp.timerSeconds > 0 && (
  <p>
    Expires in {Math.floor(otp.timerSeconds / 60)}:
    {String(otp.timerSeconds % 60).padStart(2, '0')}
  </p>
)}
```

### Separator

```tsx
import { Fragment } from 'react'

const otp    = useOTP({ length: 6, separatorAfter: 3, separator: '—' })
const sepSet = new Set(
  Array.isArray(otp.separatorAfter) ? otp.separatorAfter : [otp.separatorAfter]
)

{otp.getSlots().map((slot) => (
  <Fragment key={slot.index}>
    {sepSet.has(slot.index) && <span aria-hidden="true">{otp.separator}</span>}
    <div className="slot">{otp.getSlotProps(slot.index).char}</div>
  </Fragment>
))}
```

### Masked input

```tsx
const otp = useOTP({ length: 6, masked: true, maskChar: '●' })

{otp.getSlots().map((slot) => {
  const { char, isFilled, masked, maskChar, placeholder } = otp.getSlotProps(slot.index)
  return (
    <div key={slot.index} className="slot">
      {isFilled ? (masked ? maskChar : char) : placeholder}
    </div>
  )
})}
```

### `data-*` state attributes

Spread `data-*` props onto slot divs for CSS driven state styling:

```tsx
function dataAttrs(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key in props) if (key.startsWith('data-')) out[key] = props[key]
  return out
}

{otp.getSlots().map((slot) => (
  <div key={slot.index} className="slot" {...dataAttrs(otp.getInputProps(slot.index))}>
    {otp.getSlotProps(slot.index).char}
  </div>
))}
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

Spread `wrapperProps` on the container for wrapper-level attributes:

```tsx
<div className="otp-wrapper" {...otp.wrapperProps}>
  {/* receives data-complete, data-invalid, data-success, data-disabled, data-readonly */}
</div>
```

---

## CSS Custom Properties

Style the field using `--verino-*` CSS custom properties on the wrapper element:

```css
.verino-wrapper {
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
function useOTP(options?: ReactOTPOptions): UseOTPResult
```

### `ReactOTPOptions`

Extends `OTPOptions` from `@verino/core` with:

```ts
type ReactOTPOptions = OTPOptions & {
  value?:          string                   // controlled value; does not trigger onComplete
  onChange?:       (code: string) => void   // fires on INPUT, DELETE, CLEAR, PASTE
  separatorAfter?: number | number[]
  separator?:      string                   // default: '—'
  masked?:         boolean
  maskChar?:       string                   // default: '●'
}
```

### `UseOTPResult`

```ts
type UseOTPResult = {
  // Reactive state (plain values — update triggers re-render)
  slotValues:     string[]
  activeSlot:     number
  isComplete:     boolean
  hasError:       boolean
  hasSuccess:     boolean
  isDisabled:     boolean
  isFocused:      boolean
  timerSeconds:   number           // live countdown; 0 when expired or no timer
  separatorAfter: number | number[]
  separator:      string

  // Bindings
  hiddenInputProps: HiddenInputProps
  wrapperProps:     Record<string, string | undefined>

  // Slot helpers
  getCode():                         string
  getSlots():                        SlotEntry[]
  getSlotProps(index: number):       SlotRenderProps
  getInputProps(index: number):      InputProps & { 'data-focus': 'true' | 'false' }

  // Programmatic control
  reset():                           void
  setError(v: boolean):              void
  setSuccess(v: boolean):            void
  setDisabled(v: boolean):           void
  setReadOnly(v: boolean):           void
  focus(slotIndex?: number):         void
}

### `SlotRenderProps`

```ts
type SlotRenderProps = {
  char:         string
  index:        number
  isActive:     boolean
  isFilled:     boolean
  isError:      boolean
  isSuccess:    boolean
  isComplete:   boolean
  isDisabled:   boolean
  isFocused:    boolean
  hasFakeCaret: boolean   // render your caret here: active + empty + focused
  masked:       boolean
  maskChar:     string
  placeholder:  string
}
```

### `HiddenOTPInput`

```ts
const HiddenOTPInput: React.ForwardRefExoticComponent<
  React.InputHTMLAttributes<HTMLInputElement>
>
```

Renders a `position: absolute; opacity: 0` input that covers the slot row. Spread `otp.hiddenInputProps` directly — all event wiring is included.

---

## Compatibility

| Environment | Requirement |
|---|---|
| React | ≥ 18 |
| `@verino/core` | Same monorepo release |
| TypeScript | ≥ 5.0 |
| Node.js (SSR) | ≥ 18 |
| Module format | ESM + CJS |

---

## Integration with Core

`useOTP` calls `createOTP()` from `@verino/core` inside `useMemo`. All filtering, cursor logic, paste, timer management, and event routing live in core. The hook only syncs core state into React's `useState` and exposes the programmatic API.

See the [`@verino/core` README](https://github.com/boastack/verino/blob/main/packages/core/README.md) for the full state machine and event reference.

---

## Contributing

This package lives in the [verino monorepo](https://github.com/boastack/verino). See [CONTRIBUTING.md](https://github.com/boastack/verino/blob/main/.github/CONTRIBUTING.md) for guidelines.

```bash
# Clone and install
git clone https://github.com/boastack/verino.git
cd verino && pnpm install

# Run before opening a PR
pnpm --filter @verino/react build && pnpm test
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`@verino/core`](https://www.npmjs.com/package/@verino/core) | Pure OTP state machine — zero DOM, zero framework |
| [`@verino/vanilla`](https://www.npmjs.com/package/@verino/vanilla) | Vanilla DOM adapter + `timerUIPlugin`, `webOTPPlugin`, `pmGuardPlugin` |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable with `Ref<T>` reactive state (Vue ≥ 3) |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + `use:action` directive (Svelte ≥ 4) |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `VerinoAlpine` plugin — `x-verino` directive (Alpine.js ≥ 3) |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` Shadow DOM custom element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)