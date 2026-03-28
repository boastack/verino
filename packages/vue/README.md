<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner2.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/vue</h1>

<h3 align="center">
  Vue adapter for <a href="https://www.npmjs.com/package/verino" target="_blank" rel="noopener noreferrer">verino</a>. Build reliable OTP inputs from a single core.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/vue"><img src="https://img.shields.io/npm/v/@verino/vue?color=20C55C&label=%40verino%2Fvue" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/vue"><img src="https://img.shields.io/bundlephobia/minzip/@verino/vue?color=20C55C&label=gzip" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/Dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/vue` wraps the `verino` core state machine in a `useOTP` composable. All state is exposed as Vue `Ref` values so templates react automatically to slot changes, timer ticks, and field state.

Event handlers are returned as named functions you bind to the hidden `<input>` with `@keydown`, `@input`, `@paste`, `@focus`, and `@blur`. Visual slot divs are purely decorative mirrors and hold no event listeners.

The `value` option accepts either a plain `string` (static pre-fill, applied once on creation) or a `Ref<string>` (reactive two-way binding, watched via Vue's reactivity system).

---

## Installation

```bash
npm install @verino/vue
pnpm add @verino/vue
yarn add @verino/vue
```

**Peer dependency:** Vue ≥ 3. `verino` is installed automatically.

---

## Quick Start

```vue
<script setup lang="ts">
import { useOTP } from '@verino/vue'

const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
</script>

<template>
  <div
    v-bind="otp.wrapperAttrs.value"
    style="position: relative; display: inline-flex; gap: 8px"
  >
    <input
      :ref="(el) => (otp.inputRef.value = el as HTMLInputElement)"
      v-bind="otp.hiddenInputAttrs.value"
      style="position: absolute; inset: 0; opacity: 0; z-index: 1; cursor: text"
      @keydown="otp.onKeydown"
      @input="otp.onChange"
      @paste="otp.onPaste"
      @focus="otp.onFocus"
      @blur="otp.onBlur"
    />

    <div
      v-for="slot in otp.getSlots()"
      :key="slot.index"
      aria-hidden="true"
      :class="[
        'slot',
        slot.isActive && otp.isFocused.value && 'is-active',
        slot.isFilled && 'is-filled',
        otp.hasError.value && 'is-error',
      ].filter(Boolean)"
    >
      <span v-if="slot.isActive && !slot.isFilled && otp.isFocused.value" class="caret" />
      {{ slot.isFilled ? slot.value : otp.placeholder }}
    </div>
  </div>
</template>
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
| Reactive controlled value | `value: codeRef` (pass a `Ref<string>`) |
| Async verification lock | `otp.isDisabled.value = true/false` |
| Pre-fill on mount | `defaultValue: '123456'` |
| Display-only field | `readOnly: true` |

---

## Usage

### Controlled value

Pass a `Ref<string>` to `value` to drive the field reactively. The composable watches it via Vue's reactivity system — changes propagate automatically without triggering `onComplete`:

```ts
const code = ref('')
const otp  = useOTP({ length: 6, value: code })

// Clearing from parent:
code.value = ''
```

To propagate user keystrokes back to the ref, add `onChange`:

```ts
const otp = useOTP({ length: 6, value: code, onChange: (v) => (code.value = v) })
```

A plain `string` pre-fills slots once on creation and is not reactive to subsequent changes.

### Async verification

Set `otp.isDisabled.value` directly to lock the field during an async call:

```ts
const otp = useOTP({
  length: 6,
  onComplete: async (code) => {
    otp.isDisabled.value = true
    const ok = await verify(code)
    otp.isDisabled.value = false
    ok ? otp.setSuccess(true) : otp.setError(true)
  },
})
```

### Timer

`timerSeconds` is a live reactive ref — it updates every second while the timer is running:

```vue
<script setup lang="ts">
const otp = useOTP({ length: 6, timer: 60, onExpire: () => showExpiredMessage() })
</script>

<template>
  <p v-if="otp.timerSeconds.value > 0">
    Expires in {{ Math.floor(otp.timerSeconds.value / 60) }}:{{ String(otp.timerSeconds.value % 60).padStart(2, '0') }}
  </p>
</template>
```

### Masked input

```vue
<template>
  <div
    v-for="slot in otp.getSlots()"
    :key="slot.index"
    aria-hidden="true"
    class="slot"
  >
    {{ slot.isFilled ? (otp.masked.value ? otp.maskChar.value : slot.value) : otp.placeholder }}
  </div>
</template>
```

### Separator

`separatorAfter` is a reactive ref. Use `computed` to build a `Set` that handles both `number` and `number[]`:

```vue
<script setup lang="ts">
import { computed } from 'vue'

const otp    = useOTP({ length: 6, separatorAfter: 3, separator: '—' })
const sepSet = computed(() => {
  const v = otp.separatorAfter.value
  return new Set(Array.isArray(v) ? v : [v])
})
</script>

<template>
  <template v-for="slot in otp.getSlots()" :key="slot.index">
    <span v-if="sepSet.has(slot.index)" aria-hidden="true">{{ otp.separator.value }}</span>
    <div aria-hidden="true" class="slot">{{ slot.value }}</div>
  </template>
</template>
```

### State attributes

`getInputProps(index)` returns all `data-*` state attributes. Spread only the data attributes onto slot divs for CSS-driven styling:

```vue
<script setup lang="ts">
function slotDataAttrs(index: number) {
  const props = otp.getInputProps(index)
  const out: Record<string, unknown> = {}
  for (const key in props) if (key.startsWith('data-')) out[key] = props[key]
  return out
}
</script>

<template>
  <div
    v-for="slot in otp.getSlots()"
    :key="slot.index"
    class="slot"
    aria-hidden="true"
    v-bind="slotDataAttrs(slot.index)"
  >
    {{ slot.value }}
  </div>
</template>
```

```css
.slot[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
.slot[data-filled="true"]                   { background: #FFFFFF; }
.slot[data-invalid="true"]                  { border-color: #FB2C36; }
.slot[data-success="true"]                  { border-color: #00C950; }
.slot[data-disabled="true"]                 { opacity: 0.45; }
.slot[data-readonly="true"]                 { cursor: default; }
```

Spread `wrapperAttrs.value` on the container:

```vue
<div v-bind="otp.wrapperAttrs.value">
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
function useOTP(options?: VueOTPOptions): UseOTPResult
```

### `VueOTPOptions`

Extends `OTPOptions` from `verino` with:

```ts
type VueOTPOptions = OTPOptions & {
  value?:          string | Ref<string>   // Ref<string> = reactive; string = static pre-fill
  onChange?:       (code: string) => void // fires on INPUT, DELETE, CLEAR, PASTE
  separatorAfter?: number | number[]
  separator?:      string                 // default: '—'
  masked?:         boolean
  maskChar?:       string                 // default: '●'
}
```


### `UseOTPResult`

```ts
type UseOTPResult = {
  // Reactive state — access as otp.xxx.value
  slotValues:       Ref<string[]>
  activeSlot:       Ref<number>
  value:            Ref<string>           // computed joined code
  isComplete:       Ref<boolean>
  hasError:         Ref<boolean>
  hasSuccess:       Ref<boolean>
  isDisabled:       Ref<boolean>          // set directly to lock/unlock field
  isFocused:        Ref<boolean>
  timerSeconds:     Ref<number>           // live countdown; 0 when expired or no timer
  separatorAfter:   Ref<number | number[]>
  separator:        Ref<string>
  masked:           Ref<boolean>
  maskChar:         Ref<string>
  placeholder:      string                // plain string — no .value needed

  // Bindings
  inputRef:         Ref<HTMLInputElement | null>            // :ref binding
  hiddenInputAttrs: Ref<Record<string, unknown>>           // v-bind (use .value)
  wrapperAttrs:     Ref<Record<string, string | undefined>> // v-bind (use .value)

  // Event handlers
  onKeydown(e: KeyboardEvent): void
  onChange(e: Event):          void
  onPaste(e: ClipboardEvent):  void
  onFocus():                   void
  onBlur():                    void

  // Methods
  getCode():                                string
  getSlots():                               SlotEntry[]
  getInputProps(index: number):             InputProps & { 'data-focus': 'true' | 'false' }
  reset():                                  void
  setError(isError: boolean):               void
  setSuccess(isSuccess: boolean):           void
  setReadOnly(isReadOnly: boolean):         void
  focus(slotIndex: number):                 void
}
```

### `SlotEntry`

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
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + action |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `x-verino` directive |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)