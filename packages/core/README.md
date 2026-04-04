<a href="https://verino.vercel.app" target="_blank">
  <img src="https://raw.githubusercontent.com/boastack/verino/refs/heads/main/assets/banner1.png" alt="verino" width="100%" />
</a>

<h1 align="center">@verino/core</h1>

<h3 align="center">
  Reliable OTP input state machine that powers React, Vue, Svelte, Alpine, Vanilla JS, and Web Components.
</h3>

<p align="center">
  <a href="https://verino.vercel.app"><img src="https://img.shields.io/badge/verino.vercel.app-live-20C55C" alt="Live demo" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@verino/core"><img src="https://img.shields.io/npm/v/@verino/core?color=20C55C&label=version" alt="npm version" /></a>&nbsp;
  <a href="https://bundlephobia.com/package/@verino/core"><img src="https://img.shields.io/bundlephobia/minzip/@verino/core?color=20C55C&label=gzip+size" alt="gzip size" /></a>&nbsp;
  <img src="https://img.shields.io/badge/dependencies-0-20C55C" alt="Zero dependencies" />&nbsp;
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-20C55C" alt="TypeScript" /></a>
</p>

---

## Overview

`@verino/core` is the foundation of the Verino ecosystem: a **pure TypeScript state machine** for OTP and verification code inputs. The state machine itself has **no DOM, no framework, no side effects**, and runs identically in browsers, Node.js, Deno, Bun, and Web Workers. The `@verino/core/toolkit` subpath extends this with browser toolkit helpers for adapter authors.

### Core capabilities

- **Character filtering.** Each input passes a two-layer filter: a `type` guard (`'numeric'`, `'alphabet'`, `'alphanumeric'`, `'any'`) and an optional `pattern: RegExp`. Rejected characters fire an `INVALID_CHAR` event without mutating state, enabling shake animations, custom callbacks, or analytics without conditional logic in the adapter.

- **Cursor management.** The active slot index is tracked as a number in state. Arrow keys, `Backspace`, `Delete`, paste, and programmatic `move(i)` all go through the same pipeline. The cursor is always clamped to `[0, length − 1]` — no out-of-bounds state is possible.

- **Paste normalization.** Pasted text can be transformed via `pasteTransformer`, then applied character-by-character through the same filter pipeline starting from the current cursor slot. Overflow is silently discarded. A single `PASTE` event fires with the raw value and the start index.

- **Typed event system.** Every mutation emits a **discriminated union** `OTPEvent` alongside the updated state snapshot. Fourteen event types (`INPUT`, `DELETE`, `CLEAR`, `PASTE`, `COMPLETE`, `INVALID_CHAR`, `FOCUS`, `BLUR`, `RESET`, `MOVE`, `ERROR`, `SUCCESS`, `DISABLED`, `READONLY`) each carry only the payload relevant to that specific action. No catch-all event objects, no guessing at shape.

- **Timer engine.** `createTimer({ totalSeconds, onTick, onExpire })` runs a tick-based countdown independent of any framework scheduler. Adapters start and stop it in their mount/unmount lifecycle. The core state machine itself has no timers, it only stores the initial `timerSeconds` config value. Live countdown is always driven by `onTick`.

- **Programmatic state control.** `setError`, `setSuccess`, `setDisabled`, `setReadOnly`, `reset`, and `focus` are all first-class machine actions that go through the same event pipeline. Calling `setError(true)` emits an `ERROR` event and clears success state atomically.

- **Adapter toolkit.** `@verino/core/toolkit` exposes `triggerHapticFeedback()`, `triggerSoundFeedback()`, password-manager badge guard helpers, frame scheduling, input controller primitives, resend timer, and value-sync helpers used by DOM adapters.

- **Stable DOM ID helpers.** Each `createOTP()` call gets a deterministic instance prefix. By default that prefix comes from a process-local counter; in SSR or multi-request environments you can pass `idBase` to seed it per request. `getSlotId(i)`, `getGroupId()`, and `getErrorId()` produce stable `id` strings scoped to that instance. Adapters use these to wire `aria-labelledby` and `aria-describedby` without any DOM querying.

- **`data-*` attribute system.** `getInputProps(index)` returns a complete set of `data-*` attributes reflecting the machine's current state for every slot. Adapters spread these onto visual elements, enabling full CSS-driven state targeting with no JS class management.

- **Single-pipeline mutation.** All state changes flow through `action → applyState(patch, event) → state update → emit(event) → subscribers`. No direct mutations, no orphaned events. Race conditions and partial updates are structurally impossible.

### When to use `@verino/core` directly

- Building an adapter for a framework not yet covered. 
- Server-side form validation against OTP state without any DOM dependency. 
- Unit-testing OTP logic in Node.js with zero browser setup. 
- Embedding verino in a non-browser runtime (e.g., React Native gestures needing state without DOM).

---

## Installation

```bash
# npm
npm i @verino/core

# pnpm
pnpm add @verino/core

# yarn
yarn add @verino/core
```

No peer dependencies. Zero runtime dependencies.

---

## Quick Start

```ts
import { createOTP } from '@verino/core'

const otp = createOTP({
  length:     6,
  type:       'numeric',
  onComplete: (code) => console.log('Complete:', code),
})

// Subscribe to every state change
const unsub = otp.subscribe((state, event) => {
  console.log(event.type, otp.getCode())
})

// Drive the machine via actions
otp.insert('1', 0)
otp.insert('2', 1)
otp.paste('123456')   // fills all slots from index 0
otp.reset()           // clear + fire RESET event

// Clean up
unsub()
otp.destroy()
```

---

## State Machine Design

Every state change flows through one pipeline:

```
action → applyState(patch, event) → state updated → emit(event) → subscribers notified
```

No action mutates state directly. No event fires without a state update. No state update occurs without an event. The pipeline is the only entry point.

```ts
import { triggerHapticFeedback } from '@verino/core/toolkit'

otp.subscribe((state, event) => {
  switch (event.type) {
    case 'COMPLETE':     triggerHapticFeedback();        break
    case 'INVALID_CHAR': shake(event.index);             break
    case 'BLUR':         validateSlot(event.index);      break
    case 'ERROR':        announceError(event.hasError);  break
  }
})
```

---

## API Reference

### `createOTP(options?)`

```ts
function createOTP(options?: CoreOTPOptions): OTPInstance
```

### `CoreOTPOptions`

```ts
type CoreOTPOptions = {
  // Field shape
  length?:           number   // default: 6
  idBase?:           string   // stable ID prefix for SSR / multi-request environments
  type?:             'numeric' | 'alphabet' | 'alphanumeric' | 'any' // default: 'numeric'
  pattern?:          RegExp   // overrides type for per-char validation
  pasteTransformer?: (raw: string) => string

  // Behaviour
  disabled?:         boolean
  readOnly?:         boolean
  timer?:            number   // countdown in seconds; 0 = no timer

  // Callbacks
  onComplete?:    (code: string) => void
  onInvalidChar?: (char: string, index: number) => void
}

// `OTPOptions` is the broader adapter-facing config type (includes field
// behaviour, feedback, and timer/resend options). `createOTP()` intentionally
// accepts the narrower `CoreOTPOptions` surface only — adapter options like
// `autoFocus`, `placeholder`, `onExpire`, `onResend`, and `haptic` are handled
// at the adapter layer, not the core machine.
```

### `OTPInstance`

```ts
type OTPInstance = {
  // State access
  state:         OTPStateSnapshot
  getCode():     string        // joined slot values
  getSnapshot(): OTPStateSnapshot      // safe copy with cloned slotValues

  // Subscription
  subscribe(cb: (state: OTPStateSnapshot, event: OTPEvent) => void): () => void

  // Input actions (all guarded by filter and disabled/readOnly checks)
  insert(char: string, slotIndex: number):  void  // validated insert
  delete(slotIndex: number):                void  // Backspace — clear + move left
  clear(slotIndex: number):                 void  // Delete — clear in-place
  paste(text: string, cursorSlot?: number): void  // smart paste from cursorSlot
  move(slotIndex: number):                  void  // move cursor

  // Programmatic state control
  reset():                    void  // clear all slots + fire RESET
  setError(v: boolean):       void  // toggle error; clears success
  setSuccess(v: boolean):     void  // toggle success; clears error
  setDisabled(v: boolean):    void
  setReadOnly(v: boolean):    void
  destroy():                  void  // clear all subscribers

  // Slot helpers
  getSlots():                  SlotEntry[]
  getSlotProps(i: number):     SlotProps
  getInputProps(i: number):    InputProps

  // Stable DOM ID helpers (seed with idBase in SSR when needed)
  getSlotId(i: number): string  // e.g. 'verino-1-slot-2'
  getGroupId():         string  // e.g. 'verino-1-group'
  getErrorId():         string  // e.g. 'verino-1-error'
}
```

### `OTPStateSnapshot`

```ts
type OTPStateSnapshot = {
  slotValues:   readonly string[]  // '' = unfilled
  activeSlot:   number
  hasError:     boolean
  hasSuccess:   boolean   // mutually exclusive with hasError
  isComplete:   boolean
  isEmpty:      boolean   // NOT the complement of isComplete
  timerSeconds: number    // initial config value only — NOT a live countdown
  isDisabled:   boolean
  isReadOnly:   boolean
}
```

> `timerSeconds` in core state reflects the **initial** configuration value, not a live countdown. Use `onTick` to receive live countdown values. Adapter packages expose a live reactive countdown internally via `createTimer`.

### `OTPEvent` — Typed Discriminated Union

| Event type | Payload fields | When it fires |
|---|---|---|
| `INPUT` | `index`, `value` | A valid character was accepted into a slot |
| `DELETE` | `index` | Backspace — slot cleared, cursor moved left |
| `CLEAR` | `index` | Delete key — slot cleared in-place |
| `PASTE` | `startIndex`, `value` | A string was pasted from `startIndex` forward |
| `COMPLETE` | `value` | All slots are now filled |
| `INVALID_CHAR` | `char`, `index` | A character was rejected by the type/pattern filter |
| `FOCUS` | `index` | Logical focus moved to slot `index` |
| `BLUR` | `index` | Logical blur — `index` is the slot active at blur time |
| `RESET` | — | All slots cleared; state returned to initial |
| `MOVE` | `index` | Cursor moved via arrow keys or programmatic `move()` |
| `ERROR` | `hasError` | Error state toggled |
| `SUCCESS` | `hasSuccess` | Success state toggled |
| `DISABLED` | `isDisabled` | Disabled state toggled |
| `READONLY` | `isReadOnly` | Read-only state toggled |

### Character Filtering

```ts
import { filterChar, filterString } from '@verino/core'

filterChar('5', 'numeric')              // '5'
filterChar('A', 'numeric')              // '' — rejected
filterChar('a', 'alphabet')             // 'a'
filterString('abc123', 'alphanumeric')  // 'abc123'
filterString('a🐶b', 'alphabet')        // 'ab' — emoji stripped safely
```

When `pattern` is provided it overrides `type` for per-character validation. `type` still drives `inputMode` and ARIA labels on the hidden input.

### `data-*` Attribute System

`getInputProps(index)` returns a complete set of `data-*` state attributes for every slot. Adapters spread these onto visual slot elements, enabling full CSS-driven state styling with no JS class management.

#### Slot attributes (string `"true"` / `"false"`)

| Attribute | Meaning |
|---|---|
| `data-active` | Logical cursor is at this slot — set even when the field is blurred |
| `data-focus` | Browser focus is on the hidden input — `"false"` from core; adapters inject real focus |
| `data-filled` | Slot contains a character |
| `data-empty` | Slot is unfilled — always the complement of `data-filled` |
| `data-invalid` | Error state is active on the field |
| `data-success` | Success state is active — mutually exclusive with `data-invalid` |
| `data-disabled` | Field is currently disabled |
| `data-readonly` | Field is in read-only mode |
| `data-complete` | All slots are filled |
| `data-first` | This is slot `0` — useful for pill/connected layouts |
| `data-last` | This is the last slot — useful for pill/connected layouts |
| `data-slot` | The slot's zero-based position as a string (`"0"`, `"1"`, …) |

#### Wrapper attributes (boolean presence — no value)

These are set on the containing element, not individual slots. Target them with attribute presence selectors:

| Attribute | When present |
|---|---|
| `data-complete` | All slots are filled |
| `data-invalid` | Error state is active |
| `data-success` | Success state is active |
| `data-disabled` | Field is disabled |
| `data-readonly` | Field is read-only |


```css
/* Slot-level — use string value selectors */
[data-active="true"][data-focus="true"] { border-color: #3D3D3D; }
[data-filled="true"]                    { background:   #FFFFFF; }
[data-empty="true"]                     { background:   #FAFAFA; }
[data-invalid="true"]                   { border-color: #FB2C36; }
[data-success="true"]                   { border-color: #00C950; }
[data-disabled="true"]                  { opacity: 0.45; pointer-events: none; }
[data-readonly="true"]                  { cursor: default; }
[data-complete="true"]                  { border-color: #00C950; }

/* Wrapper-level (boolean presence selectors) */
.verino-wrapper[data-invalid]  { outline: 2px solid #FB2C36; }
.verino-wrapper[data-success]  { outline: 2px solid #00C950; }
.verino-wrapper[data-disabled] { opacity: 0.6; }

/* Connected pill layout */
[data-first="true"]                              { border-radius: 8px 0 0 8px; }
[data-last="true"]                               { border-radius: 0 8px 8px 0; }
[data-first="false"][data-last="false"]          { border-radius: 0; }

/* Target a specific slot by index */
[data-slot="0"] { font-weight: 700; }
```

### Utility Exports

```ts
import { createTimer, formatCountdown }                from '@verino/core'
import { triggerHapticFeedback, triggerSoundFeedback } from '@verino/core/toolkit'

// Timer engine used internally by all adapters
const timer = createTimer({
  totalSeconds: 60,
  onTick:   (remaining) => console.log(remaining),
  onExpire: () => console.log('expired'),
})
timer.start()
timer.stop()
timer.reset()    // stop + restore to totalSeconds (does not restart)
timer.restart()  // reset + immediately start again

// Feedback helpers — call on COMPLETE or ERROR events
triggerHapticFeedback()  // navigator.vibrate([10])
triggerSoundFeedback()   // plays a short audio tone via AudioContext
```

---

## Building a Custom Adapter

`@verino/core` is intentionally framework-agnostic. A minimal custom adapter follows four steps:

```ts
import { createOTP, filterString } from '@verino/core'

// 1. Create the machine
const otp = createOTP({ length: 6, onComplete: handleComplete })

// 2. Subscribe and sync to your framework's reactivity
otp.subscribe((state, event) => {
  myFramework.setState({ slots: state.slotValues, hasError: state.hasError })
})

// 3. Connect the hidden input's native events to machine actions
input.addEventListener('keydown', (e) => {
  const pos = input.selectionStart ?? 0
  if (e.key === 'Backspace') { e.preventDefault(); otp.delete(pos) }
  else if (e.key === 'Delete') { e.preventDefault(); otp.clear(pos) }
  else if (e.key === 'ArrowLeft')  { e.preventDefault(); otp.move(pos - 1) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); otp.move(pos + 1) }
})
input.addEventListener('input', (e) => {
  // Real adapters diff the full input value against known slot state to handle
  // IME composition, autocomplete, and multiple characters in one event.
  // This minimal example reads the last character as a basic illustration.
  const val = filterString((e.target as HTMLInputElement).value, 'numeric')
  otp.reset()
  for (let i = 0; i < Math.min(val.length, 6); i++) otp.insert(val[i], i)
})
input.addEventListener('paste', (e) => {
  e.preventDefault()
  otp.paste(e.clipboardData?.getData('text') ?? '')
})
input.addEventListener('focus', () => otp.move(otp.state.activeSlot))
input.addEventListener('blur',  () => { /* sync blur state if needed */ })

// 4. Expose the programmatic API to consumers
export { otp }
```

No character filtering, cursor logic, paste normalization, event routing, or countdown/input logic belongs in the adapter.

---

## Local Development

```bash
# Clone and install
git clone https://github.com/boastack/verino.git
cd verino && pnpm i

# Build core
pnpm --filter @verino/core build

# Run all tests and typecheck
pnpm test && pnpm typecheck
```

Core tests live in [`tests/core.test.ts`](https://github.com/boastack/verino/blob/main/tests/core.test.ts). All changes to `@verino/core` require corresponding test coverage.

---

## Compatibility

| Environment | Requirement |
|---|---|
| TypeScript | ≥ 5.0 (strict mode supported) |
| Node.js | ≥ 18 |
| Browsers | All evergreen browsers |
| Bundlers | ESM and CJS builds shipped |

---

## Contributing

See [CONTRIBUTING.md](https://github.com/boastack/verino/blob/main/.github/CONTRIBUTING.md) for guidelines. For bug reports use the [bug report template](https://github.com/boastack/verino/issues/new?template=bug_report.yml).

```bash
# Run before opening a PR
pnpm --filter @verino/core build && pnpm test
```

---

## Ecosystem

| Package | Purpose |
|---|---|
| [`@verino/vanilla`](https://www.npmjs.com/package/@verino/vanilla) | Vanilla DOM adapter + `timerUIPlugin`, `webOTPPlugin`, `pmGuardPlugin` |
| [`@verino/react`](https://www.npmjs.com/package/@verino/react) | `useOTP` hook + `HiddenOTPInput` component (React ≥ 18) |
| [`@verino/vue`](https://www.npmjs.com/package/@verino/vue) | `useOTP` composable with reactive Vue refs (Vue ≥ 3) |
| [`@verino/svelte`](https://www.npmjs.com/package/@verino/svelte) | `useOTP` store + `use:action` directive (Svelte ≥ 4) |
| [`@verino/alpine`](https://www.npmjs.com/package/@verino/alpine) | `VerinoAlpine` plugin — `x-verino` directive (Alpine.js ≥ 3) |
| [`@verino/web-component`](https://www.npmjs.com/package/@verino/web-component) | `<verino-input>` Shadow DOM custom element |

---

## License

MIT © 2026 [Olawale Balo](https://github.com/walebuilds)
