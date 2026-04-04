# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
# Build
pnpm build                                      # compile all packages → packages/*/dist/
pnpm build:cdn                                  # IIFE CDN bundles → packages/vanilla/dist/verino.min.js + verino-wc.min.js + verino-alpine.min.js
pnpm build:all                                  # build + build:cdn
pnpm dev                                        # turbo run build --watch (rebuild on file changes)

# Type checking
pnpm typecheck                                  # repo-wide typecheck across all packages (via turbo)
pnpm lint                                       # compatibility alias for pnpm typecheck

# Unit tests (Jest — run from repo root)
pnpm test                                       # all tests, no coverage
pnpm test:coverage                              # with coverage
node_modules/.bin/jest --testNamePattern="paste"   # run tests matching a name
node_modules/.bin/jest tests/core.test.ts          # run one test file

# E2E tests (Playwright)
pnpm test:e2e                                   # all browsers
npx playwright test --project=chromium         # one browser
npx playwright test tests/e2e/vanilla.spec.ts  # one spec file

# Bundle size guard (requires build first)
pnpm size                                       # check bundle sizes against limits in package.json#size-limit
pnpm size:ci                                    # same, output as JSON (used in CI)

# Changesets (versioning + release)
pnpm changeset                                  # create a new changeset
pnpm changeset status --since=origin/main      # check pending changesets
pnpm release                                    # build + publish all changed packages
```

There is no bare `npm test` — always use `pnpm test` or invoke Jest directly.

**Package-local note:** adapter-local `typecheck` now uses TypeScript build mode with project references, so package-level checks build `@verino/core` first instead of depending on a stale prebuilt `dist/`.

---

## Architecture

Verino is a zero-dependency OTP input library. The input state machine in `packages/core/src/machine.ts` is pure and side-effect free, while the `@verino/core` package also exposes a `toolkit` of shared utilities used by adapters. Six framework adapters independently wrap this core.

### Source Layout

```
packages/
  core/src/             ← @verino/core — pure state machine, zero DOM at the root API
    types.ts            ← OTPOptions, OTPState, InputProps, SlotEntry interfaces
    filter.ts           ← filterChar / filterString
    timer.ts            ← createTimer
    machine.ts          ← createOTP — pure state machine + subscriptions
    index.ts            ← pure root exports only
    toolkit/
      controller.ts     ← shared input primitives (applyTypedInput, handleOTPKeyAction, frameScheduler…)
      adapter-policy.ts ← seedProgrammaticValue / syncProgrammaticValue / migrateProgrammaticValue
      timer-policy.ts   ← createResendTimer (resend-cooldown state machine)
      feedback.ts       ← triggerHapticFeedback / triggerSoundFeedback
      password-manager.ts ← watchForPasswordManagerBadge (MutationObserver helper)
      index.ts          ← barrel re-export (@verino/core/toolkit)
  vanilla/src/          ← @verino/vanilla — DOM adapter + plugins
    index.ts            ← main barrel (initOTP + plugin types)
    vanilla.ts          ← DOM adapter; installs plugins below
    cdn.ts              ← CDN entry point; exports initOTP as `init` → window.Verino
    plugins/
      types.ts          ← VerinoPlugin, VerinoPluginContext, VerinoWrapper types
      index.ts          ← barrel re-export of all plugins + types
      timer-ui.ts       ← built-in countdown timer + resend row DOM
      web-otp.ts        ← Web OTP API (SMS autofill via navigator.credentials)
      pm-guard.ts       ← password manager badge guard (MutationObserver)
  react/     ← @verino/react   (separate npm package, own package.json + tsup build)
  vue/       ← @verino/vue
  svelte/    ← @verino/svelte
  alpine/    ← @verino/alpine
    src/cdn.ts  ← CDN entry point; sets window.VerinoAlpine
  web-component/ ← @verino/web-component

examples/
  vanilla.html         ← standalone HTML (imports from packages/vanilla/dist/)
  react.tsx            ← usage pattern for React apps
  vue.vue              ← usage pattern for Vue apps
  svelte.svelte        ← usage pattern for Svelte apps
  alpine.html          ← standalone HTML (imports from packages/alpine/dist/)
  web-component.html   ← standalone HTML (imports from packages/web-component/dist/)

tests/
  core.test.ts                          ← pure state machine (Node, no DOM)
  core-toolkit.unit.test.ts             ← toolkit/controller + adapter-policy (Node)
  core-toolkit-dom.unit.test.ts         ← toolkit DOM helpers (jsdom)
  core-missing-coverage.unit.test.ts    ← targeted coverage for core edge cases
  adapter-contracts.unit.test.tsx       ← shared behavioral contract across all adapters
  vanilla.unit.test.ts                  ← vanilla DOM adapter (jsdom)
  vanilla.ssr.test.ts                   ← SSR / non-browser environment (Node)
  vanilla-missing-coverage.unit.test.ts ← targeted coverage for vanilla + plugins
  react.unit.test.tsx                   ← React adapter (jsdom)
  react-missing-coverage.unit.test.tsx
  vue.unit.test.ts                      ← Vue adapter (jsdom)
  vue-missing-coverage.unit.test.ts
  svelte.unit.test.ts                   ← Svelte adapter (jsdom)
  svelte-missing-coverage.unit.test.ts
  alpine-missing-coverage.unit.test.ts  ← Alpine adapter coverage (jsdom)
  web-component.unit.test.ts            ← Web Component (jsdom)
  web-component-missing-coverage.unit.test.ts
  e2e/
    vanilla.spec.ts          ← Playwright E2E (fixture: examples/vanilla.html)
    web-component.spec.ts    ← Playwright E2E (fixture: tests/fixtures/web-component.html)
  fixtures/
    web-component.html       ← static fixture page for web-component E2E tests
```

### Single Hidden-Input Pattern

```
[<input opacity:0 inset:0 z-index:1>]   ← one real input captures all events
[div] [div] [div] [div] [div] [div]     ← purely visual mirrors of state
```

One transparent `<input>` overlays the visual slot divs. The browser sees one real field — SMS autofill (`autocomplete="one-time-code"`), password managers, screen readers, and IME all work natively. Slot divs are display-only.

### Vanilla Adapter DOM Structure

```
.verino-wrapper        ← user's element; set CSS custom properties here
  └── .verino-element  (role="group" aria-labelledby="…")
        ├── .verino-sr-only   ← visually hidden group label ("6-digit verification code")
        ├── .verino-content   ← inline-flex; holds slot divs + separators
        │     ├── .verino-slot[data-slot="0"]
        │     ├── .verino-separator  (if separatorAfter configured)
        │     └── ...
        └── .verino-hidden-input
.verino-timer          ← sibling of wrapper, not inside it (timer-ui plugin)
.verino-resend         ← sibling of wrapper, not inside it (timer-ui plugin)
```

Footer elements (`.verino-timer`, `.verino-resend`) are inserted as **siblings** of `.verino-wrapper` by the `timerUIPlugin`. Their references are stored on `wrapperEl.__verinoFooterEl` and `wrapperEl.__verinoResendRowEl` so subsequent mounts can clean them up without fragile sibling-DOM walks.

### Vanilla Plugin System

The vanilla adapter installs three built-in plugins at mount time:

```ts
// Plugin contract — adapters/plugins/types.ts
type VerinoPlugin = {
  name:    string
  install: (ctx: VerinoPluginContext) => () => void   // returns cleanup fn
}

// Context passed to every plugin
type VerinoPluginContext = {
  otp, wrapperEl, hiddenInputEl, slotRowEl,
  slotCount, inputType, pattern?,
  timerSeconds, resendCooldown,
  onResend?, onTickCallback?, onExpire?,
  syncSlots: () => void   // force DOM sync from core state
}
```

Plugin cleanup functions are collected in `pluginCleanups` and called sequentially inside `instance.destroy()`. The `timerUIPlugin` subscribes to the OTP `RESET` event to restart the countdown automatically when `instance.reset()` or `instance.resend()` is called — no direct method call needed.

### React Adapter — Non-obvious Design Decision

The React adapter creates the core machine with `type: 'any'` (not the user-supplied `type`). This keeps the machine instance stable across re-renders — recreating it only when `length` or `idBase` changes. All type/pattern filtering is handled at the adapter layer using `typeRef` and `patternRef`. Consequence: `onInvalidChar` is never fired by the core in React; the adapter fires it manually in `getInputProps.onInput` and `onPaste`.

### Design Rules

- `packages/core/src/` must remain DOM-free and framework-free — tested in pure Node.js.
- Each adapter imports **only** from `'@verino/core'`. No cross-adapter imports.
- Zero runtime dependencies. Framework peer deps are optional.
- Build output via `tsup` for all packages (`packages/core/tsup.config.ts`, `packages/vanilla/tsup.config.ts` + adapter packages).
- Package is `"type": "module"` — all intra-package imports use explicit `.js` extensions.
- Root `tsconfig.json` is a TypeScript project references root (`"references": [...]`, `"files": []`). Every package `tsconfig.json` must have `"composite": true`.
- `sideEffects` array in `packages/vanilla/package.json` whitelists `vanilla.js`.
- Versioning via **changesets** — run `pnpm changeset` before merging any PR that touches a published package.
- Call `otp.destroy()` on component unmount to release the subscriber set and prevent leaks.

---

## Core System

### createOTP API

```ts
const otp = createOTP(options)

// State
otp.state          // Readonly<OTPState> — live reference; mutated in-place on every action
otp.getCode()      // joined code string
otp.getSnapshot()  // safe copy with cloned slotValues (use when caching)

// Subscription
const unsub = otp.subscribe((state, event) => render(state))
unsub()
// OTPEvent discriminated union (second arg to subscribe):
// { type: 'INPUT';        index: number; value: string }
// { type: 'DELETE';       index: number }
// { type: 'CLEAR';        index: number }
// { type: 'PASTE';        startIndex: number; value: string }
// { type: 'COMPLETE';     value: string }
// { type: 'INVALID_CHAR'; char: string; index: number }
// { type: 'FOCUS';        index: number }
// { type: 'BLUR';         index: number }
// { type: 'RESET' }
// { type: 'MOVE';         index: number }
// { type: 'ERROR';        hasError: boolean }
// { type: 'SUCCESS';      hasSuccess: boolean }
// { type: 'DISABLED';     isDisabled: boolean }
// { type: 'READONLY';     isReadOnly: boolean }

// Input actions
otp.insert(char, slotIndex)    // filtered by type + pattern; fires onInvalidChar on rejection
otp.delete(slotIndex)          // Backspace: clears current if filled, else clears previous + moves back
otp.clear(slotIndex)           // Delete-key: clear slot in-place, cursor stays
otp.paste(text, cursorSlot?)   // smart paste from cursorSlot forward (default: 0)
otp.move(slotIndex)            // move cursor to slotIndex

// State control
otp.setError(bool)             // sets hasError; clears hasSuccess when true
otp.setSuccess(bool)           // sets hasSuccess; clears hasError when true
otp.reset()                    // clears slots, hasError, hasSuccess; fires RESET
otp.setDisabled(bool)
otp.setReadOnly(bool)
otp.destroy()                  // clears all subscribers — call on component unmount

// DX helpers
otp.getSlots()            // SlotEntry[] — index, value, isActive, isFilled for each slot
otp.getSlotProps(index)   // full SlotProps for visual rendering (char, isSuccess, masked, …)
otp.getInputProps(index)  // event handlers + data-* attributes for the slot div

// Accessibility ID helpers (stable per instance, collision-free)
otp.getSlotId(index)      // 'verino-1-slot-2'
otp.getGroupId()          // 'verino-1-group'
otp.getErrorId()          // 'verino-1-error'
```

**`otp.state` is typed `Readonly<OTPState>` at the TypeScript level** — mutating it directly is a compile error. Use the action methods. Internally, `slotValues` is mutated in-place before `applyState` runs; all other scalar fields are replaced. Use `getSnapshot()` for an isolated copy.

### OTPState

```ts
type OTPState = {
  slotValues:   string[]   // '' = unfilled; mutated in-place
  activeSlot:   number
  hasError:     boolean
  hasSuccess:   boolean    // mutually exclusive with hasError — setting one clears the other
  isComplete:   boolean
  isEmpty:      boolean    // NOT the complement of isComplete — partial fills have both false
  timerSeconds: number     // initial config value only — NOT a live countdown
  isDisabled:   boolean
  isReadOnly:   boolean
}
```

**`timerSeconds` in core state is not a live countdown.** Use `onTick` for remaining seconds. In React/Vue/Svelte adapters, `timerSeconds` is a live value (useState / Ref / Writable) driven by `createTimer` internally.

### OTPOptions Reference

```ts
type OTPOptions = {
  length?:           number          // default: 6
  type?:             'numeric' | 'alphabet' | 'alphanumeric' | 'any'  // default: 'numeric'
  pattern?:          RegExp          // overrides type for per-char validation; /g flag handled safely
  pasteTransformer?: (raw: string) => string

  onComplete?:    (code: string) => void
  onExpire?:      () => void
  onResend?:      () => void
  onTick?:        (remaining: number) => void  // fires every second; suppresses built-in timer UI in vanilla
  onInvalidChar?: (char: string, index: number) => void
  onChange?:      (code: string) => void       // adapter-level; every user interaction

  autoFocus?:      boolean   // default: true
  blurOnComplete?: boolean   // default: false
  selectOnFocus?:  boolean   // default: false
  placeholder?:    string    // shown in empty slots; never part of the value
  name?:           string    // hidden input name for native <form> submission
  masked?:         boolean   // renders maskChar in slots; type="password" on hidden input
  maskChar?:       string    // default: '●'

  onFocus?: () => void
  onBlur?:  () => void

  separatorAfter?: number | number[]  // slot index/indices after which to render a separator
  separator?:      string             // default: '—'

  defaultValue?: string   // uncontrolled initial value; does not trigger onComplete
  disabled?:     boolean
  readOnly?:     boolean
  timer?:        number   // countdown seconds
  haptic?:       boolean  // default: true
  sound?:        boolean  // default: false
}
```

`VanillaOnlyOptions` adds `onTick` and `resendAfter` (cooldown before Resend re-enables; default: 30).

### Character Filtering

```ts
filterChar(char, type, pattern?)   // '' if invalid
filterString(str, type, pattern?)  // filters every Unicode code point; uses Array.from() for emoji safety
```

When `pattern` is provided it **overrides `type`** for validation. `type` still drives `inputMode` and ARIA labels.

### onComplete Deferral

`onComplete` fires synchronously after the final `insert`/`paste` action. `reset()` clears slot values and fires RESET. Adapters that programmatically pre-fill slots set a `suppressComplete` flag around the fill loop to prevent spurious `onComplete` callbacks.

### getInputProps — data-* attribute system

`getInputProps(index)` returns event handlers plus a full set of `data-*` attributes for CSS-driven slot styling. Key distinction:

| Attribute | Meaning |
|---|---|
| `data-active` | Logical cursor position (`activeSlot === index`) — set even when blurred |
| `data-focus` | Hidden input has browser focus — `"false"` in core (DOM-free); adapters inject real focus state |
| `data-filled` | Slot contains a character — always the strict inverse of `data-empty` |
| `data-empty` | Slot is empty — always the strict inverse of `data-filled` |
| `data-complete` | Every slot is filled |
| `data-invalid` | Error state is active |
| `data-success` | Success state is active — mutually exclusive with `data-invalid` |
| `data-disabled` | Field is disabled |
| `data-readonly` | Field is read-only |
| `data-first` | Slot 0 |
| `data-last` | Last slot |

**Use `[data-active="true"][data-focus="true"]` to style the active slot only while focused.** Use `[data-active="true"]` alone to show cursor position regardless of focus.

`data-filled` and `data-empty` are guaranteed mutually exclusive and exhaustive.

`data-focus` is injected by each adapter (not the core) since the core is DOM-free:
- React/Vue/Svelte: included in `getInputProps()` return via adapter state
- Vanilla/Alpine/Web Component: set directly in the DOM sync loop

---

## Framework Adapters

### Vanilla — initOTP

```ts
const [instance] = initOTP('.verino-wrapper', options)
const [instance] = initOTP(wrapperEl, options)

instance.reset()          // clear slots, restart timer, re-focus
instance.resend()         // reset + fire onResend
instance.setError(bool)
instance.setSuccess(bool)
instance.setDisabled(bool)
instance.setReadOnly(bool)
instance.getCode()
instance.focus(slotIndex)
instance.destroy()        // remove listeners + run plugin cleanups + call otp.destroy()
```

Data attributes on the wrapper element map to options: `data-length`, `data-type`, `data-timer`, `data-resend`, `data-separator-after`, `data-separator`, `data-masked`, `data-mask-char`, `data-placeholder`, `data-name`.

### React — useOTP

```tsx
const otp = useOTP(options)

<div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
  <HiddenOTPInput {...otp.hiddenInputProps} />
  {otp.getSlots().map((slot) => (
    <Slot key={slot.index} {...otp.getSlotProps(slot.index)} />
  ))}
</div>

// Methods: otp.getCode() / reset() / setError(bool) / setSuccess(bool) / setDisabled(bool) / focus(i)
// CSS-driven approach: spread dataAttrs(otp.getInputProps(i)) onto slot divs
```

`ReactOTPOptions` adds `value?: string` for controlled/form-library integration and `onChange`.

`SlotRenderProps` (from `getSlotProps(i)`): `char`, `index`, `isActive`, `isFilled`, `isError`, `isSuccess`, `isComplete`, `isDisabled`, `isFocused`, `hasFakeCaret` (`isActive && !isFilled && isFocused`), `masked`, `maskChar`, `placeholder`.

`HiddenOTPInput` — `forwardRef` wrapper that applies absolute-positioning styles automatically.

`getInputProps(i)` in the React adapter spreads core props then adds `data-focus` from the adapter's `isFocused` state.

**Live timer:**
```tsx
const otp = useOTP({ timer: 30 })
{otp.timerSeconds > 0 && <p>Expires in {otp.timerSeconds}s</p>}
```

### Vue — useOTP

```ts
const otp = useOTP(options)

// All state values are Ref<T>
otp.slotValues / otp.activeSlot / otp.value / otp.isComplete
otp.hasError / otp.hasSuccess / otp.isDisabled / otp.isFocused / otp.masked / otp.maskChar

// hiddenInputAttrs is a ComputedRef — use .value:
<input v-bind="otp.hiddenInputAttrs.value" :ref="(el) => (otp.inputRef.value = el)" />

// Iterate slots reactively:
v-for="slot in otp.getSlots()"   // reads from Vue refs — reactive in templates

// CSS-driven styling:
v-bind="slotDataAttrs(slot.index)"  // extract data-* from otp.getInputProps(i)
```

`VueOTPOptions.value` accepts `string | Ref<string>`. A `Ref<string>` is watched reactively.

**Live timer:** `otp.timerSeconds.value`

### Svelte — useOTP

```ts
const otp = useOTP(options)

// $otp subscribes to the main OTPState store (slotValues, activeSlot, isComplete, hasError, hasSuccess, …)
// Standalone stores (destructure before use):
const { timerSeconds, slots, separatorAfter, separator, masked, maskChar } = otp

// $slots is a derived Readable<SlotEntry[]> — use for reactive slot iteration:
{#each $slots as slot (slot.index)}

// getInputProps reads from otp.state at call time — returns current data-* attrs:
{...slotDataAttrs(otp.getInputProps(slot.index))}

// Svelte action — bind to the single hidden input:
<input use:otp.action />   // wires keydown, input, paste, focus, blur handlers

// Methods
otp.getCode() / reset() / setError(bool) / setSuccess(bool) / setDisabled(bool) / setReadOnly(bool)
otp.focus(slotIndex) / otp.setValue(v)  // setValue: programmatic fill, no onComplete
```

`data-focus` in Svelte's `getInputProps` is sourced from a closure variable updated by the action's focus/blur handlers — accurate at render time since `{#each $slots}` re-renders on every store update.

**Live timer:** `$timerSeconds`

### Alpine — VerinoAlpine

```js
Alpine.plugin(VerinoAlpine)

<div x-data x-verino="{ length: 6, timer: 60, onComplete(code) { verify(code) } }"></div>

// Per-element API
el._verino.getCode() / reset() / resend() / setError(bool) / setSuccess(bool) / setDisabled(bool) / focus(i)
el._verino.destroy()            // stop timers + remove footer elements; call before removing the element
el._verino.getSlots()           // SlotEntry[] snapshot
el._verino.getInputProps(index) // data-* attrs + handlers (data-focus from document.activeElement)
```

### Web Component — verino-input

HTML attributes: `length`, `type`, `timer`, `disabled`, `readonly`, `separator-after`, `separator`, `name`, `placeholder`, `auto-focus`, `select-on-focus`, `blur-on-complete`, `masked`, `mask-char`.

JS-only setters (cannot be HTML attributes — accept functions/RegExp):
```js
el.pattern / el.pasteTransformer / el.onComplete / el.onResend / el.onFocus / el.onBlur / el.onInvalidChar
```

DOM methods: `reset()`, `setError(bool)`, `setSuccess(bool)`, `setDisabled(bool)`, `setReadOnly(bool)`, `getCode()`, `getSlots()`, `getInputProps(index)`.

Custom events (all `bubbles: true`, `composed: true`): `complete { code }`, `expire`, `change { code }`.

---

## CSS Custom Properties

Set on `.verino-wrapper` (or `<verino-input>` host) — all cascade into the shadow root:

| Property | Default | Controls |
|---|---|---|
| `--verino-size` | `56px` | slot width + height |
| `--verino-gap` | `12px` | gap between slots |
| `--verino-radius` | `10px` | slot border radius |
| `--verino-font-size` | `24px` | digit font size |
| `--verino-color` | `#0A0A0A` | digit text color |
| `--verino-bg` | `#FAFAFA` | empty slot background |
| `--verino-bg-filled` | `#FFFFFF` | filled slot background |
| `--verino-border-color` | `#E5E5E5` | default border |
| `--verino-active-color` | `#3D3D3D` | active slot border + ring |
| `--verino-error-color` | `#FB2C36` | error border, ring + badge |
| `--verino-success-color` | `#00C950` | success border + ring |
| `--verino-caret-color` | `#3D3D3D` | fake caret |
| `--verino-timer-color` | `#757575` | footer label text |
| `--verino-separator-color` | `#A1A1A1` | separator text |
| `--verino-separator-size` | `18px` | separator font size |
| `--verino-placeholder-size` | `16px` | placeholder char font size |
| `--verino-placeholder-color` | `#D3D3D3` | placeholder char color |
| `--verino-masked-size` | `16px` | masked glyph font size |
| `--verino-slot-font` | `inherit` | slot font-family (web-component only) |

---

## Package Exports & Build

Seven independently published packages:

| Export | Package dir | Purpose |
|---|---|---|
| `@verino/core` | `packages/core` | Pure state machine only — zero DOM. Built with `tsup`. |
| `@verino/vanilla` | `packages/vanilla` | DOM adapter + plugins (bundles core). Built with `tsup`. |
| `@verino/vanilla/plugins` | `packages/vanilla` | All plugin types + built-in plugin instances. |
| `@verino/vanilla/plugins/timer-ui` | `packages/vanilla` | Countdown timer + resend row plugin (tree-shakeable). |
| `@verino/vanilla/plugins/web-otp` | `packages/vanilla` | Web OTP API plugin (tree-shakeable). |
| `@verino/vanilla/plugins/pm-guard` | `packages/vanilla` | Password manager badge guard plugin (tree-shakeable). |
| `@verino/react` | `packages/react` | Built with `tsup`. |
| `@verino/vue` | `packages/vue` | Built with `tsup`. |
| `@verino/svelte` | `packages/svelte` | Built with `tsup`. |
| `@verino/alpine` | `packages/alpine` | Built with `tsup`. |
| `@verino/web-component` | `packages/web-component` | Built with `tsup`. `sideEffects: true`. |

All adapter packages require `"publishConfig": { "access": "public" }` — they are scoped and default to private on npm without it.

CDN bundles (`pnpm build:cdn`):
- `packages/vanilla/dist/verino.min.js` → `window.Verino` global (`init`, `createOTP`, `filterChar`, `filterString`, `formatCountdown`)
- `packages/web-component/dist/verino-wc.min.js` → auto-registers `<verino-input>`
- `packages/alpine/dist/verino-alpine.min.js` → `window.VerinoAlpine` plugin

Note: the CDN vanilla bundle exports `initOTP` as `init` — use `window.Verino.init(...)`, not `window.Verino.initOTP(...)`.

Bundle size limits are declared in the root `package.json` under `"size-limit"` and enforced in CI by the `size` job in `.github/workflows/ci.yml`.

---

## Testing

### Unit Tests (Jest)

Coverage thresholds (enforced on `pnpm test:coverage`): 97.9% statements, 89.5% branches, 95% functions, 99% lines globally; `packages/core/src/` at 100% all metrics.

```bash
pnpm test                                              # all tests
node_modules/.bin/jest --testNamePattern="paste"       # filter by name
node_modules/.bin/jest tests/core.test.ts --no-coverage  # single file
```

`-missing-coverage` test files target specific uncovered lines identified by the coverage report — they exist alongside the main test files for each adapter.

### E2E Tests (Playwright)

- `tests/e2e/vanilla.spec.ts` — fixture: `examples/vanilla.html`
- `tests/e2e/web-component.spec.ts` — fixture: `tests/fixtures/web-component.html`

Runs against chromium, firefox, webkit, mobile-chrome. Static server auto-starts on port 3000.

Key Playwright patterns:
| Pattern | Technique |
|---|---|
| Hidden input interaction | `page.evaluate()` to set `.value` + dispatch `input` event |
| Fake timers | `page.clock.install()` **before** `page.goto()`, then `page.clock.runFor(ms)` |
| Synthetic paste | `Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } })` |
| Shadow DOM access | `page.evaluate(() => host.shadowRoot.querySelector(...))` |
| Slot state assertions | Use `[data-filled="true"]`, `[data-active="true"]`, `[data-invalid="true"]`, `[data-success="true"]` — never CSS class names |

---

## Versioning

Verino uses [changesets](https://github.com/changesets/changesets) for versioning and publishing.

```bash
pnpm changeset           # interactive — select changed packages + bump type
pnpm changeset status    # see what will be released
pnpm release             # build + publish (CI uses changesets/action@v1)
```

The `.changeset/config.json` sets `"access": "public"` for all scoped packages. The release CI workflow (`.github/workflows/release.yml`) either opens a "Version Packages" PR or publishes directly, depending on whether pending changesets exist.

---

## Internal References

- `docs/ADAPTER_POLICY.md` — read before changing any shared adapter behavior. Documents which behaviors are shared contracts vs intentional per-adapter exceptions. Prevents silent drift between adapters.
- `scripts/serve-static.mjs` — static file server used by Playwright (`playwright.config.ts` `webServer`). Required for E2E tests; do not delete.
