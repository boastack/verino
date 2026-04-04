# Adapter Policy

Read this before changing any adapter behavior.

This document does three things:

- makes shared behavior explicit and traceable to a single source of truth
- makes adapter-local exceptions explicit and intentional
- prevents one adapter from quietly drifting away from the others

If a change touches any row marked as shared, it must go through the shared layer first — not as a one-off adapter patch.

---

## Change Rules

1. If the source of truth is `@verino/core` or `@verino/core/toolkit`, change that layer first. Adapters follow.
2. If the behavior is adapter-local, update that package's README and its adapter-specific tests in the same PR.
3. If a new feature does not clearly fit an existing row in the matrix below, add it to this document before implementing it.
4. Any change to shared behavior must add or update the cross-adapter contract suite in [`tests/adapter-contracts.unit.test.tsx`](../tests/adapter-contracts.unit.test.tsx).

---

## Shared Behavior

| Behavior | Source of truth | React | Vue | Svelte | Alpine | Vanilla | Web Component |
|---|---|---|---|---|---|---|---|
| Slot state, cursor movement, delete / clear / paste transitions | `@verino/core` machine | framework binding only | framework binding only | framework binding only | directive wiring only | DOM wiring only | custom-element wiring only |
| External value control (`value`) | `@verino/core/toolkit` + adapter binding | live external string prop | live Vue watch source | live readable store | no dedicated public contract | no dedicated public contract | element-local contract |
| One-time prefill (`defaultValue`) | `@verino/core/toolkit` | mount-only | mount-only | mount-only | mount-only | mount-only | mount-only |
| Input filtering (`type`, `pattern`) and paste normalization (`pasteTransformer`) | `@verino/core` + `@verino/core/toolkit` | pass config, no forked semantics | pass config, no forked semantics | pass config, no forked semantics | pass config, no forked semantics | pass config, no forked semantics | pass config, no forked semantics |
| Focus, selection, and blur scheduling | `@verino/core/toolkit/controller.ts` | supplies input ref only | supplies input ref only | supplies input node only | supplies input node only | supplies hidden input only | supplies hidden input only |
| Reset / resend / timer baseline semantics | toolkit + adapter timer wiring | thin shell | thin shell | thin shell | built-in footer / local DOM | built-in footer / plugins | built-in footer / shadow DOM |
| Disabled and readOnly semantics | core machine semantics | prop + ref wiring | ref / composable wiring | store / action wiring | directive patching | imperative DOM patching | attr / property patching |
| Hidden input sync and `data-*` attribute contract | shared attr types + toolkit | React prop bags | Vue refs / computed attrs | Svelte attr bags | generated DOM attrs | generated DOM attrs | host attrs + shadow attrs |
| Feedback helpers (`haptic`, `sound`) | `@verino/core/toolkit` | live subscription wiring | live subscription wiring | live subscription wiring | live subscription wiring | mount-configured only | live subscription wiring |
| Request-scoped IDs (`idBase`) | `@verino/core` + adapter pass-through | pass-through | pass-through | pass-through | pass-through | pass-through | pass-through |

---

## Adapter-Specific Exceptions

These are intentional. Do not normalize them without a deliberate decision that applies across the entire adapter layer.

**React** — the core machine instance is stable across re-renders, with live refs handling dynamic callbacks and config. If you change structural options like `type` or `pattern`, preserve the stable-machine policy unless the repo decides to move away from it everywhere.

**Vue** — `value` is live external control only when the caller passes a Vue watch source (a `Ref<string>`). Plain strings belong on `defaultValue`, not `value`.

**Svelte** — `value` is live external control only through a readable store. Plain strings belong on `defaultValue` or an imperative instance method call.

**Alpine** — there is no dedicated top-level `value` contract. Reactive control flows through the directive expression and the directive's own update path.

**Vanilla** — there is no live external `value` prop. Use `defaultValue` for mount-time prefill and the returned instance methods for runtime changes. `haptic` and `sound` are mount-configured only; runtime changes to feedback behavior require `destroy()` followed by re-initialization.

**Web Component** — structural attributes (those that change field shape or length) trigger a full shadow DOM rebuild. Runtime attributes patch in place without rebuilding. Preserve that split; do not flatten it unless the change is evaluated across the entire adapter policy layer.

---

## What Must Never Drift

- `defaultValue` is a one-time mount prefill. It must never fire completion callbacks by itself, in any adapter.
- Input filtering and paste normalization rules must always come from `@verino/core/toolkit`, never from hand-written per-adapter logic.
- Focus scheduling must come from the shared frame scheduler, not raw `requestAnimationFrame` calls introduced in new adapter code.
- If any adapter gains a new product-level behavior for `value`, `reset`, `resend`, timer handling, or any callback, that change must be evaluated for every other adapter before the PR merges.

---

## Pre-Merge Checklist

Before merging any adapter change, confirm all of the following:

- [ ] Does this change belong in `@verino/core` or `@verino/core/toolkit` rather than inside a single adapter?
- [ ] Does the adapter's README still accurately describe its runtime behavior after this change?
- [ ] Does the shared contract suite need a new or updated test case?
- [ ] If the change is intentionally adapter-local, is that exception documented in the table above?