/**
 * Verino — Web Component adapter E2E tests
 *
 * Fixture: tests/fixtures/web-component.html
 *   #otp         — 6-slot numeric, timer=60, separator-after=3
 *   #otp-masked  — 4-slot numeric, masked, mask-char="*", auto-focus="false"
 *   #events      — records dispatched events as data-* attributes
 *
 * Shadow DOM: all verino-wc-* elements live inside an open ShadowRoot.
 * Playwright's evaluate() is used for shadow-DOM operations.
 */

import { test, expect, type Page } from '@playwright/test'

const FIXTURE = '/tests/fixtures/web-component.html'

// ── Shadow DOM helpers ─────────────────────────────────────────────────────────

/** Fill the hidden input inside a host's shadow root and dispatch an input event. */
async function wcFill(page: Page, hostId: string, value: string): Promise<void> {
  await page.evaluate(({ id, v }) => {
    const host = document.getElementById(id) as any
    const input = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
    input.value = v
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { id: hostId, v: value })
}

/** Focus the hidden input inside a host's shadow root. */
async function wcFocus(page: Page, hostId: string): Promise<void> {
  await page.evaluate((id) => {
    const host = document.getElementById(id) as any
    ;(host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement).focus()
  }, hostId)
}

/**
 * Dispatch a synthetic paste event on the hidden input inside a host's shadow root.
 * Uses Object.defineProperty for cross-browser compatibility (Firefox does not
 * support setting clipboardData via the ClipboardEvent constructor).
 */
async function wcPaste(page: Page, hostId: string, text: string): Promise<void> {
  await page.evaluate(({ id, t }) => {
    const host = document.getElementById(id) as any
    const input = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (_type: string) => t },
    })
    input.dispatchEvent(event)
  }, { id: hostId, t: text })
}

/**
 * Count shadow slots matching an optional state key.
 * Maps semantic state names to data-* attribute selectors used by the WC adapter:
 *   'is-filled'    → [data-filled="true"]
 *   'is-error'     → [data-invalid="true"]
 *   'is-disabled'  → [data-disabled="true"]
 * If extraClass is empty, counts all slots.
 */
async function wcSlotCount(page: Page, hostId: string, extraClass = ''): Promise<number> {
  return page.evaluate(({ id, cls }) => {
    const host = document.getElementById(id) as any
    const attrMap: Record<string, string> = {
      'is-filled':   '[data-filled="true"]',
      'is-error':    '[data-invalid="true"]',
      'is-disabled': '[data-disabled="true"]',
    }
    const sel = '.verino-wc-slot' + (cls ? (attrMap[cls] ?? ('.' + cls)) : '')
    return host.shadowRoot.querySelectorAll(sel).length
  }, { id: hostId, cls: extraClass })
}

/**
 * Poll until wcSlotCount matches expected, then assert.
 * Playwright's expect retries automatically, but we need a custom retry for
 * evaluate()-based checks that return a scalar.
 */
async function expectSlotCount(
  page: Page,
  hostId: string,
  extraClass: string,
  expected: number,
): Promise<void> {
  await expect
    .poll(() => wcSlotCount(page, hostId, extraClass), { timeout: 5_000 })
    .toBe(expected)
}

/** Check whether a shadow slot has data-active="true". */
async function wcSlotIsActive(page: Page, hostId: string, slotIndex: number): Promise<boolean> {
  return page.evaluate(({ id, idx }) => {
    const host = document.getElementById(id) as any
    const slots = host.shadowRoot.querySelectorAll('.verino-wc-slot')
    return (slots[idx] as HTMLElement).getAttribute('data-active') === 'true'
  }, { id: hostId, idx: slotIndex })
}

/** Wait until a shadow slot reports data-active="true". */
async function expectWCSlotActive(page: Page, hostId: string, slotIndex: number): Promise<void> {
  await expect
    .poll(() => wcSlotIsActive(page, hostId, slotIndex), { timeout: 5_000 })
    .toBe(true)
}

/** Read text content of a shadow slot by index. */
async function wcSlotText(page: Page, hostId: string, slotIndex: number): Promise<string> {
  return page.evaluate(({ id, idx }) => {
    const host = document.getElementById(id) as any
    const slots = host.shadowRoot.querySelectorAll('.verino-wc-slot')
    return ((slots[idx] as HTMLElement).textContent ?? '').trim()
  }, { id: hostId, idx: slotIndex })
}


// ── Initial render ─────────────────────────────────────────────────────────────

test.describe('Web Component — render', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(() =>
      (document.getElementById('otp') as any)?.shadowRoot?.querySelector('.verino-wc-slot'),
    )
  })

  test('renders 6 slot divs in shadow DOM', async ({ page }) => {
    await expectSlotCount(page, 'otp', '', 6)
  })

  test('renders one separator inside the shadow root', async ({ page }) => {
    const count = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelectorAll('.verino-wc-separator').length
    })
    expect(count).toBe(1)
  })

  test('separator is rendered after the 3rd slot (separator-after="3")', async ({ page }) => {
    const prevIndex = await page.evaluate(() => {
      const host  = document.getElementById('otp') as any
      const sep   = host.shadowRoot.querySelector('.verino-wc-separator')
      const slots = Array.from(host.shadowRoot.querySelectorAll('.verino-wc-slot'))
      return slots.indexOf(sep.previousElementSibling as Element)
    })
    expect(prevIndex).toBe(2) // 0-based: slot at index 2 is the 3rd slot
  })

  test('hidden input has autocomplete="one-time-code"', async ({ page }) => {
    const ac = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').getAttribute('autocomplete')
    })
    expect(ac).toBe('one-time-code')
  })

  test('hidden input type is "text" when masked attribute is absent', async ({ page }) => {
    const type = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').type
    })
    expect(type).toBe('text')
  })
})


// ── attributeChangedCallback / rebuild ────────────────────────────────────────

test.describe('Web Component — attributeChangedCallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(() =>
      (document.getElementById('otp') as any)?.shadowRoot?.querySelector('.verino-wc-slot'),
    )
  })

  test('changing "length" attribute rebuilds with new slot count', async ({ page }) => {
    // Initial: 6 slots
    await expectSlotCount(page, 'otp', '', 6)
    await page.evaluate(() => document.getElementById('otp')!.setAttribute('length', '4'))
    await expectSlotCount(page, 'otp', '', 4)
  })

  test('changing "type" attribute rebuilds and updates inputMode', async ({ page }) => {
    // Switch from numeric → alphanumeric
    await page.evaluate(() => document.getElementById('otp')!.setAttribute('type', 'alphanumeric'))
    const inputMode = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').inputMode
    })
    expect(inputMode).toBe('text')
  })

  test('adding "masked" attribute rebuilds and switches hidden input to type="password"', async ({ page }) => {
    // Initially not masked → type="text"
    const before = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').type
    })
    expect(before).toBe('text')

    await page.evaluate(() => document.getElementById('otp')!.setAttribute('masked', ''))
    const after = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').type
    })
    expect(after).toBe('password')
  })

  test('removing "masked" attribute rebuilds and switches hidden input back to type="text"', async ({ page }) => {
    await page.evaluate(() => document.getElementById('otp')!.setAttribute('masked', ''))
    await page.evaluate(() => document.getElementById('otp')!.removeAttribute('masked'))
    const type = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').type
    })
    expect(type).toBe('text')
  })

  test('changing "separator-after" attribute rebuilds with new separator positions', async ({ page }) => {
    // Initial: one separator after slot 2 (index 2) from separator-after="3"
    await page.evaluate(() => document.getElementById('otp')!.setAttribute('separator-after', '2,4'))
    const count = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelectorAll('.verino-wc-separator').length
    })
    expect(count).toBe(2)
  })

  test('rebuild preserves existing slot values', async ({ page }) => {
    // Fill some slots
    await wcFill(page, 'otp', '123')
    await expectSlotCount(page, 'otp', 'is-filled', 3)

    // Trigger rebuild via structural attribute change
    await page.evaluate(() => document.getElementById('otp')!.setAttribute('length', '7'))
    await expectSlotCount(page, 'otp', 'is-filled', 3)

    const code = await page.evaluate(() => (document.getElementById('otp') as any).getCode())
    expect(code).toBe('123')
  })
})


// ── autoFocus ──────────────────────────────────────────────────────────────────

test.describe('Web Component — autoFocus', () => {
  test('autofocuses the shadow hidden input on mount', async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(() => {
      const host = document.getElementById('otp') as any
      const hidden = host?.shadowRoot?.querySelector('.verino-wc-hidden')
      return hidden && host.shadowRoot.activeElement === hidden
    }, { timeout: 5_000 })
  })
})


// ── Keyboard input ─────────────────────────────────────────────────────────────

test.describe('Web Component — keyboard input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    // Wait until shadow DOM is built and autoFocus has fired
    await page.waitForFunction(() => {
      const host = document.getElementById('otp') as any
      const hidden = host?.shadowRoot?.querySelector('.verino-wc-hidden')
      return hidden && host.shadowRoot.activeElement === hidden
    }, { timeout: 5_000 })
  })

  test('typing fills slots (data-filled="true")', async ({ page }) => {
    await wcFill(page, 'otp', '123456')
    await expectSlotCount(page, 'otp', 'is-filled', 6)
  })

  test('typing a single character advances the active slot', async ({ page }) => {
    await wcFill(page, 'otp', '1')
    // After 1 char, slot 1 (index 1) should have data-active="true"
    const isActive = await wcSlotIsActive(page, 'otp', 1)
    expect(isActive).toBe(true)
  })

  test('backspace removes the last character', async ({ page }) => {
    await wcFill(page, 'otp', '123')
    await expectSlotCount(page, 'otp', 'is-filled', 3)
    await wcFocus(page, 'otp')
    await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      const el   = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
      el.setSelectionRange(3, 3)
    })
    await page.keyboard.press('Backspace')
    await expectSlotCount(page, 'otp', 'is-filled', 2)
  })

  test('ArrowLeft moves focus to the previous slot', async ({ page }) => {
    await wcFill(page, 'otp', '12')
    await wcFocus(page, 'otp')
    await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      const el   = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
      el.setSelectionRange(2, 2)
    })
    await page.keyboard.press('ArrowLeft')
    await expectWCSlotActive(page, 'otp', 1)
  })

  test('ArrowRight moves focus to the next slot', async ({ page }) => {
    await wcFill(page, 'otp', '1')
    await wcFocus(page, 'otp')
    await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      const el   = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
      el.setSelectionRange(0, 0)
    })
    await page.keyboard.press('ArrowRight')
    await expectWCSlotActive(page, 'otp', 1)
  })
})


// ── Paste ──────────────────────────────────────────────────────────────────────

test.describe('Web Component — paste', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(() =>
      (document.getElementById('otp') as any)?.shadowRoot?.querySelector('.verino-wc-slot'),
    )
  })

  test('paste fills all slots from clipboard text', async ({ page }) => {
    await wcPaste(page, 'otp', '123456')
    await expectSlotCount(page, 'otp', 'is-filled', 6)
  })
})


// ── Custom events ──────────────────────────────────────────────────────────────

test.describe('Web Component — custom events', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(() =>
      (document.getElementById('otp') as any)?.shadowRoot?.querySelector('.verino-wc-slot'),
    )
  })

  test('"change" event fires on every input with the current code', async ({ page }) => {
    await wcFill(page, 'otp', '1')
    await expect(page.locator('#events')).toHaveAttribute('data-last-change', '1')
  })

  test('"complete" event fires with the full code when all slots are filled', async ({ page }) => {
    await wcFill(page, 'otp', '123456')
    await expect(page.locator('#events')).toHaveAttribute('data-last-complete', '123456')
  })

  test('"expire" event fires when the timer reaches zero', async ({ page }) => {
    await page.clock.install()
    await page.goto(FIXTURE)
    await page.waitForFunction(() =>
      (document.getElementById('otp') as any)?.shadowRoot?.querySelector('.verino-wc-timer'),
    )
    await page.clock.runFor(31_000)
    await expect(page.locator('#events')).toHaveAttribute('data-expired', 'true')
  })
})


// ── DOM API ────────────────────────────────────────────────────────────────────

test.describe('Web Component — DOM API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(() =>
      (document.getElementById('otp') as any)?.shadowRoot?.querySelector('.verino-wc-slot'),
    )
  })

  test('getCode() returns the current code string', async ({ page }) => {
    await wcFill(page, 'otp', '4567')
    const code = await page.evaluate(() => (document.getElementById('otp') as any).getCode())
    expect(code).toBe('4567')
  })

  test('setError(true) applies is-error class to all slots', async ({ page }) => {
    await page.evaluate(() => (document.getElementById('otp') as any).setError(true))
    await expectSlotCount(page, 'otp', 'is-error', 6)
  })

  test('setError(false) removes is-error class from all slots', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('otp') as any
      el.setError(true)
      el.setError(false)
    })
    await expectSlotCount(page, 'otp', 'is-error', 0)
  })

  test('reset() clears all slots and removes error state', async ({ page }) => {
    await wcFill(page, 'otp', '123456')
    await page.evaluate(() => (document.getElementById('otp') as any).setError(true))
    await page.evaluate(() => (document.getElementById('otp') as any).reset())
    await expectSlotCount(page, 'otp', 'is-filled', 0)
    await expectSlotCount(page, 'otp', 'is-error',  0)
  })

  test('setDisabled(true) applies is-disabled to all slots and disables the input', async ({ page }) => {
    await page.evaluate(() => (document.getElementById('otp') as any).setDisabled(true))
    await expectSlotCount(page, 'otp', 'is-disabled', 6)
    const isDisabled = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').disabled
    })
    expect(isDisabled).toBe(true)
  })

  test('setDisabled(false) re-enables the input', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('otp') as any
      el.setDisabled(true)
      el.setDisabled(false)
    })
    await expectSlotCount(page, 'otp', 'is-disabled', 0)
    const isDisabled = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').disabled
    })
    expect(isDisabled).toBe(false)
  })
})


// ── Timer ──────────────────────────────────────────────────────────────────────

test.describe('Web Component — timer', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.pauseAt(new Date(0))
    await page.goto(FIXTURE)
    await page.waitForFunction(() => {
      const host   = document.getElementById('otp') as any
      const timer  = host?.shadowRoot?.querySelector('.verino-wc-timer')
      return timer && timer.textContent.trim() !== ''
    }, { timeout: 5_000 })
  })

  test('timer element shows the initial countdown value (0:30)', async ({ page }) => {
    const text = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-timer').textContent.trim()
    })
    expect(text).toContain('0:30')
  })

  test('timer counts down by 10 seconds', async ({ page }) => {
    await page.clock.runFor(10_000)
    const text = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      return host.shadowRoot.querySelector('.verino-wc-timer').textContent.trim()
    })
    expect(text).toContain('0:20')
  })

  test('expire event fires and timer element is hidden when timer reaches zero', async ({ page }) => {
    await page.clock.runFor(31_000)
    // Fixture records the 'expire' event as data-expired="true"
    await expect(page.locator('#events')).toHaveAttribute('data-expired', 'true')
    // Timer element should be hidden — WC hides via classList.add('is-hidden'),
    // not inline style, so we check the class rather than el.style.display.
    const timerHidden = await page.evaluate(() => {
      const host = document.getElementById('otp') as any
      const el = host.shadowRoot.querySelector('.verino-wc-timer') as HTMLElement
      return el.classList.contains('is-hidden')
    })
    expect(timerHidden).toBe(true)
  })
})


// ── Masked mode ────────────────────────────────────────────────────────────────

test.describe('Web Component — masked mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(() =>
      (document.getElementById('otp-masked') as any)?.shadowRoot?.querySelector('.verino-wc-slot'),
    )
  })

  test('masked attribute sets hidden input type to "password"', async ({ page }) => {
    const type = await page.evaluate(() => {
      const host = document.getElementById('otp-masked') as any
      return host.shadowRoot.querySelector('.verino-wc-hidden').type
    })
    expect(type).toBe('password')
  })

  test('filled slots render the maskChar instead of the real digit', async ({ page }) => {
    await wcFill(page, 'otp-masked', '1')
    const text = await wcSlotText(page, 'otp-masked', 0)
    expect(text).toBe('*')
  })

  test('getCode() still returns the real code even when masked', async ({ page }) => {
    await wcFill(page, 'otp-masked', '1234')
    const code = await page.evaluate(() => (document.getElementById('otp-masked') as any).getCode())
    expect(code).toBe('1234')
  })
})


// ── Tab / Shift+Tab keyboard navigation ────────────────────────────────────────

/** Set the hidden input's selection range inside the shadow root. */
async function wcSetCursor(page: Page, hostId: string, pos: number): Promise<void> {
  await page.evaluate(({ id, p }) => {
    const host = document.getElementById(id) as any
    const input = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
    input.setSelectionRange(p, p)
  }, { id: hostId, p: pos })
}

test.describe('Web Component — Tab / Shift+Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('verino-input')
    await wcFocus(page, 'otp')
    // Wait for the shadow focus event to set data-active="true" on slot 0
    await page.waitForFunction((id) => {
      const host = document.getElementById(id) as any
      return !!host?.shadowRoot?.querySelector('.verino-wc-slot[data-active="true"]')
    }, 'otp', { timeout: 3_000 })
  })

  test('Tab on empty slot 0 releases focus from the component (falls through)', async ({ page }) => {
    // Slot 0 is empty — Tab is not intercepted, browser moves focus away from shadow host
    await page.keyboard.press('Tab')
    const isHiddenFocused = await page.evaluate((id) => {
      const host = document.getElementById(id) as any
      const input = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
      return document.activeElement === host || host.shadowRoot.activeElement === input
    }, 'otp')
    expect(isHiddenFocused).toBe(false)
  })

  test('Tab on a filled slot advances to the next slot', async ({ page }) => {
    await wcFill(page, 'otp', '1')
    await wcFocus(page, 'otp')
    // Dispatch Tab with cursor at 0 atomically (avoids rAF timing races)
    const moved = await page.evaluate((id) => {
      const host = document.getElementById(id) as any
      const input = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
      input.setSelectionRange(0, 0)
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
      const slots = host.shadowRoot.querySelectorAll('.verino-wc-slot')
      return (slots[1] as HTMLElement).getAttribute('data-active') === 'true'
    }, 'otp')
    expect(moved).toBe(true)
  })

  test('Shift+Tab on slot > 0 moves to the previous slot', async ({ page }) => {
    await wcFill(page, 'otp', '12')
    await wcFocus(page, 'otp')
    // Dispatch Shift+Tab with cursor at 2 atomically
    const moved = await page.evaluate((id) => {
      const host = document.getElementById(id) as any
      const input = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
      input.setSelectionRange(2, 2)
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
      const slots = host.shadowRoot.querySelectorAll('.verino-wc-slot')
      return (slots[1] as HTMLElement).getAttribute('data-active') === 'true'
    }, 'otp')
    expect(moved).toBe(true)
  })

  test('Shift+Tab on slot 0 releases focus from the component (falls through)', async ({ page, browserName }) => {
    // Firefox keeps focus on opacity:0 absolutely-positioned inputs when Shift+Tab is
    // pressed at the boundary — this is a known Firefox quirk, not a library bug.
    test.skip(browserName === 'firefox', 'Firefox focus-boundary behaviour differs for opacity:0 inputs')
    await wcSetCursor(page, 'otp', 0)
    await page.keyboard.press('Shift+Tab')
    const isHiddenFocused = await page.evaluate((id) => {
      const host = document.getElementById(id) as any
      const input = host.shadowRoot.querySelector('.verino-wc-hidden') as HTMLInputElement
      return host.shadowRoot.activeElement === input
    }, 'otp')
    expect(isHiddenFocused).toBe(false)
  })
})
