<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner2.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/react</h1>

<h3 align="center">
  React adapter for <a href="https://www.npmjs.com/package/verino" target="_blank" rel="noopener noreferrer">verino</a>. Build reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/react"><img src="https://img.shields.io/npm/v/@verino/react?color=20C55C&label=%40verino%2Freact" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/react"><img src="https://img.shields.io/bundlephobia/minzip/@verino/react?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/Dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/react` wraps the `verino` core state machine in a `useOTP` hook. The hook manages React state, wires all event handlers, and returns everything needed to render a fully accessible OTP field with full control over markup and styling.

`HiddenOTPInput` is a positioned `<input>` that captures all keyboard input, paste, and native SMS autofill. Visual slot divs are purely decorative mirrors, hold no event listeners and carry no state of their own.

The core instance is created once via `useMemo` and never recreated on re-renders. All callback options (`onComplete`, `onExpire`, etc.) are stored in refs so they can be updated without restarting the effect.

---

## Installation

```bash
npm install @verino/react
pnpm add @verino/react
yarn add @verino/react
```

**Peer dependency:** React ≥ 18. `verino` is installed automatically.

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

| Pattern | Key options |
|---|---|
| SMS / email OTP | `type: 'numeric'`, `timer: 60`, `onResend` |
| 2FA / TOTP with grouping | `separatorAfter: 3` |
| PIN entry | `masked: true`, `blurOnComplete: true` |
| Alphanumeric code | `type: 'alphanumeric'`, `pasteTransformer` |
| react-hook-form integration | `value: code`, `onChange: setCode` |
| Async verification lock | `disabled: isVerifying` via React state |
| Pre-fill on mount | `defaultValue: '123456'` |
| Display-only field | `readOnly: true` |

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

`useOTP` does not expose `setDisabled()` — control disabled state via a React state variable passed as the `disabled` option:

```tsx
const [isVerifying, setIsVerifying] = useState(false)

const otp = useOTP({
  length:   6,
  disabled: isVerifying,
  onComplete: async (code) => {
    setIsVerifying(true)
    const ok = await verify(code)
    setIsVerifying(false)
    ok ? otp.setSuccess(true) : otp.setError(true)
  },
})
```

### Timer

`timerSeconds` is a live reactive countdown — it updates every second:

```tsx
const otp = useOTP({ length: 6, timer: 60, onExpire: () => showExpiredMessage() })

{otp.timerSeconds > 0 && (
  <p>Expires in {Math.floor(otp.timerSeconds / 60)}:{String(otp.timerSeconds % 60).padStart(2, '0')}</p>
)}
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

### Separator

```tsx
import { Fragment } from 'react'

const otp = useOTP({ length: 6, separatorAfter: 3, separator: '—' })

const sepSet = new Set(Array.isArray(otp.separatorAfter) ? otp.separatorAfter : [otp.separatorAfter])

{otp.getSlots().map((slot) => (
  <Fragment key={slot.index}>
    {sepSet.has(slot.index) && <span aria-hidden="true">{otp.separator}</span>}
    <div className="slot">{otp.getSlotProps(slot.index).char}</div>
  </Fragment>
))}
```

### State attributes

`getInputProps(index)` returns all `data-*` state attributes alongside event handlers. Spread only the data attributes onto visual divs:

```tsx
function dataAttrs(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key in props) if (key.startsWith('data-')) out[key] = props[key]
  return out
}

{otp.getSlots().map((slot) => (
  <div key={slot.index} className="slot" {...dataAttrs(otp.getInputProps(slot.index))}>
    {slot.value}
  </div>
))}
```

```css
.slot[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
.slot[data-filled="true"]                   { background: #FFFFFF; }
.slot[data-invalid="true"]                  { border-color: #FB2C36; }
.slot[data-success="true"]                  { border-color: #00C950; }
.slot[data-disabled="true"]                 { opacity: 0.45; }
.slot[data-readonly="true"]                 { cursor: default; }
```

Spread `wrapperProps` on the outer container for wrapper-level state attributes:

```tsx
<div className="otp-row" {...otp.wrapperProps}>
  {/* receives data-complete, data-invalid, data-success, data-disabled, data-readonly */}
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
function useOTP(options?: ReactOTPOptions): UseOTPResult
```

### `ReactOTPOptions`

Extends `OTPOptions` from `verino` with:

```ts
type ReactOTPOptions = OTPOptions & {
  value?:          string                  // controlled value; does not trigger onComplete
  onChange?:       (code: string) => void  // fires on INPUT, DELETE, CLEAR, PASTE
  separatorAfter?: number | number[]
  separator?:      string                  // default: '—'
  masked?:         boolean
  maskChar?:       string                  // default: '●'
}
```

### `UseOTPResult`

```ts
type UseOTPResult = {
  slotValues:       string[]
  activeSlot:       number
  isComplete:       boolean
  hasError:         boolean
  hasSuccess:       boolean
  isDisabled:       boolean
  isFocused:        boolean
  timerSeconds:     number                 // live countdown; 0 when expired or no timer
  separatorAfter:   number | number[]
  separator:        string

  hiddenInputProps: HiddenInputProps       // spread onto <HiddenOTPInput />
  wrapperProps:     Record<string, string | undefined>

  getCode():                              string
  getSlots():                             SlotEntry[]
  getSlotProps(index: number):            SlotRenderProps
  getInputProps(index: number):           InputProps & { 'data-focus': 'true' | 'false' }

  reset():                                void
  setError(isError: boolean):             void
  setSuccess(isSuccess: boolean):         void
  setReadOnly(isReadOnly: boolean):       void
  focus(slotIndex: number):               void
}
```

> **`setDisabled` is not available** on `UseOTPResult`. Control disabled state by passing `disabled` as an option driven by a React state variable (e.g. `useOTP({ disabled: isVerifying })`).

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
  hasFakeCaret: boolean   // true when active, empty, and focused — render caret here
  masked:       boolean
  maskChar:     string
  placeholder:  string
}
```

### `HiddenOTPInput`

```ts
const HiddenOTPInput: React.ForwardRefExoticComponent<React.InputHTMLAttributes<HTMLInputElement>>
```

Renders a `position: absolute; opacity: 0` input covering the slot row. Spread `otp.hiddenInputProps` directly — all event wiring is included.

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`verino`](https://www.npmjs.com/package/verino) | Core state machine + vanilla adapter |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + action |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `x-verino` directive |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)