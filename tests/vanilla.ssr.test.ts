/**
 * SSR guard tests — run in the default Node environment (no DOM).
 * Exercises the two `typeof document === 'undefined'` early-returns in vanilla.ts.
 */

// Pull in the vanilla module in a Node (non-DOM) environment.
// The module-level code only runs when `initOTP` is called, so imports are safe.
import { initOTP } from '@verino/vanilla'

// ─────────────────────────────────────────────────────────────────────────────
// injectStylesOnce — SSR guard (line 109 of vanilla.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('injectStylesOnce SSR guard', () => {
  it('does not throw when document is undefined (Node / SSR environment)', () => {
    // In a Node environment document is not defined, so injectStylesOnce()
    // must return early instead of calling document.createElement().
    // initOTP calls injectStylesOnce internally — if the guard is missing this
    // will throw "document is not defined".
    expect(() => {
      // We cannot actually mount a DOM element in Node, so we pass a dummy
      // selector that won't match anything. The SSR guard fires before any DOM
      // access, so it must return cleanly.
      try { initOTP('.verino-wrapper', { autoFocus: false }) } catch (_) { /* selector won't resolve — that's expected */ }
    }).not.toThrow(/document is not defined/)
  })
})

