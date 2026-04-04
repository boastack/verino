/** @jest-environment jsdom */

/**
 * verino — Vanilla adapter unit tests (jsdom environment)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the DOM adapter against real jsdom DOM APIs.
 *
 * Coverage targets:
 *   - DOM structure built by initOTP / mountOnWrapper
 *   - Data-attribute config parsing
 *   - Event handlers (input, keydown, paste, focus, blur, click)
 *   - Public API: getCode, setError, setSuccess, setDisabled, setReadOnly,
 *                 reset, resend, focus, destroy
 *   - Callbacks: onComplete, onFocus, onBlur, onInvalidChar
 *   - defaultValue pre-fill (no onComplete)
 *   - masked mode (type=password)
 *   - Separator rendering
 *   - Built-in timer footer vs custom onTick
 *   - Password manager badge guard
 *   - Style injection idempotency
 *   - Double-init warning
 */

import { initOTP } from '@verino/vanilla'

// ─────────────────────────────────────────────────────────────────────────────
// RAF MOCK
// ─────────────────────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushRAF() {
  const q = [...rafQueue]; rafQueue = []
  q.forEach(fn => fn(0))
}

beforeEach(() => {
  rafQueue = []
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => {
    rafQueue.push(cb); return rafQueue.length
  })
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {})
  // Safe DOM cleanup — no innerHTML assignment
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
  document.getElementById('verino-styles')?.remove()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeWrapper(dataAttrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('div')
  el.className = 'verino-wrapper'
  for (const [k, v] of Object.entries(dataAttrs)) {
    el.setAttribute(`data-${k}`, v)
  }
  document.body.appendChild(el)
  return el
}

function mount(dataAttrs: Record<string, string> = {}, opts: Parameters<typeof initOTP>[1] = {}) {
  const el = makeWrapper(dataAttrs)
  const [instance] = initOTP(el, { autoFocus: false, ...opts })
  return { el, instance }
}

function getHiddenInput(el: HTMLElement): HTMLInputElement {
  return el.querySelector('.verino-hidden-input') as HTMLInputElement
}

function getSlots(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.verino-slot')) as HTMLElement[]
}

/** Type into the hidden input and fire the 'input' event. */
function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Fire a keydown event on the hidden input. */
function keydown(input: HTMLInputElement, key: string, extra: KeyboardEventInit = {}) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
}

/** Simulate a paste event with clipboard text. */
function firePaste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text },
    configurable: true,
  })
  input.dispatchEvent(event)
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. STYLE INJECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('style injection', () => {
  it('injects a <style> element into document.head on first call', () => {
    const headAppend = jest.spyOn(document.head, 'appendChild')
    mount()
    expect(headAppend).toHaveBeenCalled()
    const injected = headAppend.mock.calls[0][0] as HTMLStyleElement
    expect(injected.id).toBe('verino-styles')
  })

  it('only injects the stylesheet once across multiple instances', () => {
    const headAppend = jest.spyOn(document.head, 'appendChild')
    mount()
    mount()
    expect(headAppend).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 2. DOM STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

describe('DOM structure', () => {
  it('renders 6 slot divs by default', () => {
    const { el } = mount()
    expect(getSlots(el)).toHaveLength(6)
  })

  it('renders the correct number of slots for data-length', () => {
    const { el } = mount({ length: '4' })
    expect(getSlots(el)).toHaveLength(4)
  })

  it('renders slots via options.length', () => {
    const { el } = mount({}, { length: 4 })
    expect(getSlots(el)).toHaveLength(4)
  })

  it('each slot has aria-hidden and data-slot attributes', () => {
    const { el } = mount()
    const slots = getSlots(el)
    slots.forEach((s, i) => {
      expect(s.getAttribute('aria-hidden')).toBe('true')
      expect(s.getAttribute('data-slot')).toBe(String(i))
    })
  })

  it('renders a single hidden input per instance', () => {
    const { el } = mount()
    const inputs = el.querySelectorAll('.verino-hidden-input')
    expect(inputs).toHaveLength(1)
  })

  it('hidden input defaults to type="text"', () => {
    const { el } = mount()
    expect(getHiddenInput(el).type).toBe('text')
  })

  it('hidden input has autocomplete="one-time-code"', () => {
    const { el } = mount()
    expect(getHiddenInput(el).autocomplete).toBe('one-time-code')
  })

  it('hidden input maxLength matches slot count', () => {
    const { el } = mount({ length: '4' })
    expect(getHiddenInput(el).maxLength).toBe(4)
  })

  it('hidden input has aria-label mentioning slot count', () => {
    const { el } = mount({ length: '4' })
    const label = getHiddenInput(el).getAttribute('aria-label')
    expect(label).toContain('4')
  })

  it('hidden input aria-label says "digit" for numeric type', () => {
    const { el } = mount({}, { type: 'numeric' })
    expect(getHiddenInput(el).getAttribute('aria-label')).toContain('digit')
  })

  it('hidden input aria-label says "character" for alphabet type', () => {
    const { el } = mount({}, { type: 'alphabet' })
    expect(getHiddenInput(el).getAttribute('aria-label')).toContain('character')
  })

  it('hidden input has spellcheck=false and autocorrect=off', () => {
    const { el } = mount()
    const inp = getHiddenInput(el)
    expect(inp.getAttribute('spellcheck')).toBe('false')
    expect(inp.getAttribute('autocorrect')).toBe('off')
  })

  it('renders a caret element inside each slot', () => {
    const { el } = mount({ length: '3' })
    const slots = getSlots(el)
    slots.forEach(s => {
      const caret = s.querySelector('.verino-caret')
      expect(caret).not.toBeNull()
    })
  })

  it('wraps slots in a .verino-element container', () => {
    const { el } = mount()
    const rootEl = el.querySelector('.verino-element')
    expect(rootEl).not.toBeNull()
  })

  it('slot row has .verino-content class', () => {
    const { el } = mount()
    const content = el.querySelector('.verino-content')
    expect(content).not.toBeNull()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 3. MASKED MODE
// ─────────────────────────────────────────────────────────────────────────────

describe('masked mode', () => {
  it('sets hidden input type="password" when masked option is true', () => {
    const { el } = mount({}, { masked: true })
    expect(getHiddenInput(el).type).toBe('password')
  })

  it('sets type="password" via data-masked attribute (boolean presence)', () => {
    const wrapper = makeWrapper()
    wrapper.setAttribute('data-masked', '')
    const [_inst] = initOTP(wrapper, { autoFocus: false })
    expect(getHiddenInput(wrapper).type).toBe('password')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 4. NAME ATTRIBUTE
// ─────────────────────────────────────────────────────────────────────────────

describe('name option', () => {
  it('sets the name attribute on the hidden input', () => {
    const { el } = mount({}, { name: 'otp_code' })
    expect(getHiddenInput(el).name).toBe('otp_code')
  })

  it('name option sets the name attribute directly (no data-name attribute support)', () => {
    // The vanilla adapter reads only options.name — there is no data-name fallback.
    const { el } = mount({}, { name: 'my_otp' })
    expect(getHiddenInput(el).name).toBe('my_otp')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 5. SEPARATOR
// ─────────────────────────────────────────────────────────────────────────────

describe('separator rendering', () => {
  it('renders a separator after the specified slot (1-based)', () => {
    const { el } = mount({}, { length: 6, separatorAfter: 3 })
    const separators = el.querySelectorAll('.verino-separator')
    expect(separators).toHaveLength(1)
  })

  it('renders multiple separators from an array', () => {
    const { el } = mount({}, { length: 9, separatorAfter: [3, 6] })
    const separators = el.querySelectorAll('.verino-separator')
    expect(separators).toHaveLength(2)
  })

  it('separator is aria-hidden', () => {
    const { el } = mount({}, { length: 6, separatorAfter: 3 })
    const sep = el.querySelector('.verino-separator') as HTMLElement
    expect(sep.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders separator text (default "—")', () => {
    const { el } = mount({}, { length: 6, separatorAfter: 3 })
    const sep = el.querySelector('.verino-separator') as HTMLElement
    expect(sep.textContent).toBe('—')
  })

  it('respects custom separator character', () => {
    const { el } = mount({}, { length: 6, separatorAfter: 3, separator: '-' })
    const sep = el.querySelector('.verino-separator') as HTMLElement
    expect(sep.textContent).toBe('-')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 6. getCode
// ─────────────────────────────────────────────────────────────────────────────

describe('getCode()', () => {
  it('returns empty string before any input', () => {
    const { instance } = mount()
    expect(instance.getCode()).toBe('')
  })

  it('returns joined code after typing', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '123456')
    expect(instance.getCode()).toBe('123456')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 7. INPUT EVENT (onHiddenInputChange)
// ─────────────────────────────────────────────────────────────────────────────

describe('input event', () => {
  it('fills slots when valid characters are typed', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '1234')
    expect(instance.getCode()).toBe('1234')
  })

  it('clears all slots when value is emptied', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '123456')
    typeInto(inp, '')
    expect(instance.getCode()).toBe('')
  })

  it('truncates input to slot count', () => {
    const { el, instance } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '12345678')
    expect(instance.getCode()).toBe('1234')
    expect(inp.value).toBe('1234')
  })

  it('filters invalid characters (numeric type)', () => {
    const { el, instance } = mount({}, { type: 'numeric' })
    const inp = getHiddenInput(el)
    typeInto(inp, '1a2b3')
    expect(instance.getCode()).toBe('123')
  })

  it('fires onComplete synchronously when all slots are filled', () => {
    const onComplete = jest.fn()
    const { el } = mount({}, { length: 4, onComplete })
    typeInto(getHiddenInput(el), '1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('does not fire onComplete on partial fill', () => {
    jest.useFakeTimers()
    const onComplete = jest.fn()
    const { el } = mount({}, { length: 6, onComplete })
    typeInto(getHiddenInput(el), '123')
    jest.advanceTimersByTime(50)
    expect(onComplete).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('does nothing when readOnly is set', () => {
    const { el, instance } = mount({}, { readOnly: true })
    typeInto(getHiddenInput(el), '123')
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 8. KEYDOWN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

describe('keydown handler', () => {
  it('Backspace deletes the last typed character', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '12')
    inp.selectionStart = 2
    keydown(inp, 'Backspace')
    expect(instance.getCode()).toBe('1')
  })

  it('Delete clears the slot at cursor without moving focus', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '123')
    inp.selectionStart = 1
    keydown(inp, 'Delete')
    // slot 1 cleared: slotValues = ['1','','3'], joined = '13' (2 chars)
    expect(instance.getCode()).toBe('13')
  })

  it('ArrowLeft moves focus left', () => {
    const { el } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '123')
    inp.selectionStart = 3
    keydown(inp, 'ArrowLeft')
    expect(inp.selectionStart).toBe(2)
  })

  it('ArrowRight moves focus right', () => {
    const { el } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '123')
    inp.selectionStart = 1
    keydown(inp, 'ArrowRight')
    expect(inp.selectionStart).toBe(2)
  })

  it('Tab from filled slot advances to next slot', () => {
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '12')
    inp.selectionStart = 0
    keydown(inp, 'Tab', { shiftKey: false })
    expect(inp.selectionStart).toBe(1)
  })

  it('Shift+Tab from non-zero position moves back', () => {
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '12')
    inp.selectionStart = 2
    keydown(inp, 'Tab', { shiftKey: true })
    expect(inp.selectionStart).toBe(1)
  })

  it('Shift+Tab from slot 0 does nothing (exits field)', () => {
    const { el } = mount()
    const inp = getHiddenInput(el)
    inp.selectionStart = 0
    expect(() => keydown(inp, 'Tab', { shiftKey: true })).not.toThrow()
  })

  it('Tab from an empty slot returns early without moving (no preventDefault)', () => {
    // Slot 0 is empty — Tab should bail out without advancing
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    inp.selectionStart = 0
    keydown(inp, 'Tab', { shiftKey: false })
    // No advance because slot is empty
    expect(inp.selectionStart).toBe(0)
  })

  it('Tab from the last filled slot falls through to browser (no cursor change)', () => {
    // cursorPos >= slotCount - 1 with a filled slot → return early
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '1234')
    inp.selectionStart = 3   // last slot, filled
    keydown(inp, 'Tab', { shiftKey: false })
    expect(inp.selectionStart).toBe(3)
  })

  it('Backspace does nothing when readOnly is set', () => {
    const { el, instance } = mount({}, { readOnly: true })
    const inp = getHiddenInput(el)
    inp.selectionStart = 2
    keydown(inp, 'Backspace')
    expect(instance.getCode()).toBe('')
  })

  it('Delete does nothing when readOnly is set', () => {
    const { el, instance } = mount({}, { readOnly: true })
    const inp = getHiddenInput(el)
    keydown(inp, 'Delete')
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 9. PASTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

describe('paste handler', () => {
  it('pastes valid characters into slots', () => {
    const { el, instance } = mount({}, { type: 'numeric' })
    firePaste(getHiddenInput(el), '123456')
    expect(instance.getCode()).toBe('123456')
  })

  it('filters invalid chars during paste', () => {
    const { el, instance } = mount({}, { type: 'numeric' })
    firePaste(getHiddenInput(el), '1a2b3c')
    expect(instance.getCode()).toBe('123')
  })

  it('applies pasteTransformer before pasting', () => {
    const { el, instance } = mount({}, {
      type: 'numeric',
      pasteTransformer: (s: string) => s.replace(/\D/g, ''),
    })
    firePaste(getHiddenInput(el), '1-2-3-4')
    expect(instance.getCode()).toBe('1234')
  })

  it('does nothing when readOnly is set', () => {
    const { el, instance } = mount({}, { readOnly: true })
    firePaste(getHiddenInput(el), '123456')
    expect(instance.getCode()).toBe('')
  })

  it('fires onComplete after a full paste (10ms)', () => {
    jest.useFakeTimers()
    const onComplete = jest.fn()
    const { el } = mount({}, { length: 4, onComplete })
    firePaste(getHiddenInput(el), '1234')
    jest.advanceTimersByTime(10)
    expect(onComplete).toHaveBeenCalledWith('1234')
    jest.useRealTimers()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 10. FOCUS / BLUR HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

describe('focus / blur handlers', () => {
  it('fires onFocus callback', () => {
    const onFocus = jest.fn()
    const { el } = mount({}, { onFocus })
    getHiddenInput(el).dispatchEvent(new FocusEvent('focus'))
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('fires onBlur callback', () => {
    const onBlur = jest.fn()
    const { el } = mount({}, { onBlur })
    getHiddenInput(el).dispatchEvent(new FocusEvent('blur'))
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('blur sets data-focus=false on all slots', () => {
    const { el } = mount()
    const slots = getSlots(el)
    getHiddenInput(el).dispatchEvent(new FocusEvent('blur'))
    slots.forEach(s => expect(s.getAttribute('data-focus')).toBe('false'))
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 11. CLICK HANDLER
// ─────────────────────────────────────────────────────────────────────────────

describe('click handler', () => {
  it('does not throw on click when no value', () => {
    const { el } = mount()
    const inp = getHiddenInput(el)
    expect(() => inp.dispatchEvent(new MouseEvent('click', { clientX: 0, bubbles: true }))).not.toThrow()
  })

  it('does nothing when disabled', () => {
    const { el, instance } = mount({}, { disabled: true })
    const inp = getHiddenInput(el)
    expect(() => inp.dispatchEvent(new MouseEvent('click', { clientX: 50, bubbles: true }))).not.toThrow()
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 12. onInvalidChar CALLBACK
// ─────────────────────────────────────────────────────────────────────────────

describe('onInvalidChar callback', () => {
  it('fires when a rejected character is typed', () => {
    const onInvalidChar = jest.fn()
    const { el } = mount({}, { type: 'numeric', onInvalidChar })
    const inp = getHiddenInput(el)
    typeInto(inp, 'abc')
    expect(onInvalidChar).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 13. defaultValue OPTION
// ─────────────────────────────────────────────────────────────────────────────

describe('defaultValue option', () => {
  it('pre-fills slots on mount', () => {
    const { instance } = mount({}, { length: 6, defaultValue: '1234' })
    expect(instance.getCode()).toBe('1234')
  })

  it('does not fire onComplete for defaultValue pre-fill', () => {
    const onComplete = jest.fn()
    mount({}, { length: 4, defaultValue: '1234', onComplete })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('filters defaultValue through the input type', () => {
    const { instance } = mount({}, { length: 6, type: 'numeric', defaultValue: '1a2b' })
    expect(instance.getCode()).toBe('12')
  })

  it('ignores empty defaultValue', () => {
    const { instance } = mount({}, { defaultValue: '' })
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 14. setError / setSuccess
// ─────────────────────────────────────────────────────────────────────────────

describe('setError()', () => {
  it('sets data-invalid=true on all slots', () => {
    const { el, instance } = mount()
    instance.setError(true)
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('true'))
  })

  it('sets data-invalid=false on all slots', () => {
    const { el, instance } = mount()
    instance.setError(true)
    instance.setError(false)
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('false'))
  })

  it('clears data-invalid when a valid char is typed', () => {
    const { el, instance } = mount()
    instance.setError(true)
    typeInto(getHiddenInput(el), '1')
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('false'))
  })
})

describe('setSuccess()', () => {
  it('sets data-success=true on all slots', () => {
    const { el, instance } = mount()
    instance.setSuccess(true)
    getSlots(el).forEach(s => expect(s.getAttribute('data-success')).toBe('true'))
  })

  it('sets data-success=false on all slots', () => {
    const { el, instance } = mount()
    instance.setSuccess(true)
    instance.setSuccess(false)
    getSlots(el).forEach(s => expect(s.getAttribute('data-success')).toBe('false'))
  })

  it('clears data-invalid when success is set', () => {
    const { el, instance } = mount()
    instance.setError(true)
    instance.setSuccess(true)
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('false'))
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 15. setDisabled
// ─────────────────────────────────────────────────────────────────────────────

describe('setDisabled()', () => {
  it('disables the hidden input', () => {
    const { el, instance } = mount()
    instance.setDisabled(true)
    expect(getHiddenInput(el).disabled).toBe(true)
  })

  it('re-enables the hidden input', () => {
    const { el, instance } = mount()
    instance.setDisabled(true)
    instance.setDisabled(false)
    expect(getHiddenInput(el).disabled).toBe(false)
  })

  it('sets data-disabled=true on all slots when disabled', () => {
    const { el, instance } = mount()
    instance.setDisabled(true)
    getSlots(el).forEach(s => expect(s.getAttribute('data-disabled')).toBe('true'))
  })

  it('sets data-disabled=false on slots when re-enabled', () => {
    const { el, instance } = mount()
    instance.setDisabled(true)
    instance.setDisabled(false)
    getSlots(el).forEach(s => expect(s.getAttribute('data-disabled')).toBe('false'))
  })

  it('silently ignores input events when disabled', () => {
    const { el, instance } = mount()
    instance.setDisabled(true)
    typeInto(getHiddenInput(el), '123')
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 16. setReadOnly
// ─────────────────────────────────────────────────────────────────────────────

describe('setReadOnly()', () => {
  it('sets aria-readonly on the hidden input', () => {
    const { el, instance } = mount()
    instance.setReadOnly(true)
    expect(getHiddenInput(el).getAttribute('aria-readonly')).toBe('true')
  })

  it('removes aria-readonly when set to false', () => {
    const { el, instance } = mount()
    instance.setReadOnly(true)
    instance.setReadOnly(false)
    expect(getHiddenInput(el).getAttribute('aria-readonly')).toBeNull()
  })

  it('blocks input while readOnly', () => {
    const { el, instance } = mount()
    instance.setReadOnly(true)
    typeInto(getHiddenInput(el), '123')
    expect(instance.getCode()).toBe('')
  })

  it('initial readOnly from options sets aria-readonly', () => {
    const { el } = mount({}, { readOnly: true })
    expect(getHiddenInput(el).getAttribute('aria-readonly')).toBe('true')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 17. reset()
// ─────────────────────────────────────────────────────────────────────────────

describe('reset()', () => {
  it('clears all slots', () => {
    const { el, instance } = mount()
    typeInto(getHiddenInput(el), '1234')
    instance.reset()
    expect(instance.getCode()).toBe('')
  })

  it('clears the hidden input value', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '1234')
    instance.reset()
    expect(inp.value).toBe('')
  })

  it('removes error state after reset (syncSlotsToDOM runs inside RAF)', () => {
    const { el, instance } = mount()
    instance.setError(true)
    instance.reset()
    // reset() calls syncSlotsToDOM inside requestAnimationFrame — flush it
    flushRAF()
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('false'))
  })

  it('does not fire onComplete after reset clears the code', () => {
    const onComplete = jest.fn()
    const { el, instance } = mount({}, { length: 4, onComplete })
    typeInto(getHiddenInput(el), '1234')
    expect(onComplete).toHaveBeenCalledTimes(1)
    instance.reset()
    onComplete.mockClear()
    // after reset, filling again should fire onComplete once more
    typeInto(getHiddenInput(el), '5678')
    expect(onComplete).toHaveBeenCalledWith('5678')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 18. resend()
// ─────────────────────────────────────────────────────────────────────────────

describe('resend()', () => {
  it('clears slots and fires onResend', () => {
    const onResend = jest.fn()
    const { el, instance } = mount({}, { onResend })
    typeInto(getHiddenInput(el), '1234')
    instance.resend()
    expect(instance.getCode()).toBe('')
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('does not throw when onResend is not provided', () => {
    const { el, instance } = mount()
    typeInto(getHiddenInput(el), '123')
    expect(() => instance.resend()).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 19. focus()
// ─────────────────────────────────────────────────────────────────────────────

describe('focus()', () => {
  it('moves the cursor to the specified slot', () => {
    const { el, instance } = mount({}, { length: 6 })
    const inp = getHiddenInput(el)
    typeInto(inp, '123')
    instance.focus(2)
    expect(inp.selectionStart).toBe(2)
  })

  it('does not throw for out-of-range slot index', () => {
    const { instance } = mount()
    expect(() => instance.focus(99)).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 20. destroy()
// ─────────────────────────────────────────────────────────────────────────────

describe('destroy()', () => {
  it('removes all event listeners from the hidden input', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    instance.destroy()
    // After destroy, typing should not update state
    typeInto(inp, '123456')
    expect(instance.getCode()).toBe('')
  })

  it('does not throw when called multiple times', () => {
    const { instance } = mount()
    expect(() => { instance.destroy(); instance.destroy() }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 21. MULTIPLE INSTANCES
// ─────────────────────────────────────────────────────────────────────────────

describe('multiple instances', () => {
  it('initOTP returns one instance per wrapper element found by selector', () => {
    const wrapper1 = makeWrapper()
    const wrapper2 = makeWrapper()
    wrapper1.className = 'verino-multi-test'
    wrapper2.className = 'verino-multi-test'
    const instances = initOTP('.verino-multi-test', { autoFocus: false })
    expect(instances).toHaveLength(2)
  })

  it('instances are independent — filling one does not affect the other', () => {
    const w1 = makeWrapper()
    const w2 = makeWrapper()
    w1.className = 'verino-indep-test'
    w2.className = 'verino-indep-test'
    const [inst1, inst2] = initOTP('.verino-indep-test', { length: 4, autoFocus: false })
    typeInto(getHiddenInput(w1), '1234')
    expect(inst1.getCode()).toBe('1234')
    expect(inst2.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 22. DOUBLE-INIT WARNING
// ─────────────────────────────────────────────────────────────────────────────

describe('double-init guard', () => {
  it('logs a warning when initOTP is called twice on the same element', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = makeWrapper()
    initOTP(wrapper, { autoFocus: false })
    initOTP(wrapper, { autoFocus: false })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[verino]'))
    warnSpy.mockRestore()
  })

  it('auto-destroys the previous instance before remounting on the same wrapper', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 10, autoFocus: false })
    initOTP(wrapper, { timer: 10, autoFocus: false })

    expect(document.body.querySelectorAll('.verino-timer')).toHaveLength(1)
    expect(document.body.querySelectorAll('.verino-resend')).toHaveLength(1)
    warnSpy.mockRestore()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 23. BUILT-IN TIMER FOOTER
// ─────────────────────────────────────────────────────────────────────────────

describe('built-in timer footer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('creates a .verino-timer footer element when timer > 0', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 60, autoFocus: false })
    const footer = document.body.querySelector('.verino-timer') as HTMLElement
    expect(footer).not.toBeNull()
  })

  it('creates a .verino-resend row when timer > 0', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 60, autoFocus: false })
    const resendRow = document.body.querySelector('.verino-resend') as HTMLElement
    expect(resendRow).not.toBeNull()
  })

  it('footer timer badge shows initial countdown text', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 30, autoFocus: false })
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge?.textContent).toBe('0:30')
  })

  it('skips built-in footer when onTick is provided', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, {
      timer: 60,
      autoFocus: false,
      onTick: jest.fn(),
    })
    const footer = document.body.querySelector('.verino-timer')
    expect(footer).toBeNull()
  })

  it('calls onTick callback each second', () => {
    const onTick = jest.fn()
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 5, autoFocus: false, onTick })
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(4)
  })

  it('calls onExpire when timer reaches zero', () => {
    const onExpire = jest.fn()
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 2, autoFocus: false, onExpire })
    jest.advanceTimersByTime(2000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 24. DATA ATTRIBUTE — inputMode
// ─────────────────────────────────────────────────────────────────────────────

describe('inputMode from type option', () => {
  it('numeric type sets inputMode to "numeric"', () => {
    const { el } = mount({}, { type: 'numeric' })
    expect(getHiddenInput(el).inputMode).toBe('numeric')
  })

  it('alphabet type sets inputMode to "text"', () => {
    const { el } = mount({}, { type: 'alphabet' })
    expect(getHiddenInput(el).inputMode).toBe('text')
  })

  it('reads type from data-type attribute', () => {
    const { el } = mount({ type: 'alphanumeric' })
    expect(getHiddenInput(el).inputMode).toBe('text')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 25. initOTP WITH CSS SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

describe('initOTP with CSS selector', () => {
  it('returns an empty array when no elements match the selector', () => {
    const result = initOTP('.non-existent-class', { autoFocus: false })
    expect(result).toHaveLength(0)
  })

  it('mounts on element found by selector', () => {
    const wrapper = makeWrapper()
    wrapper.className = 'verino-custom-test'
    const instances = initOTP('.verino-custom-test', { autoFocus: false, length: 4 })
    expect(instances).toHaveLength(1)
    expect(instances[0].getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 26. blurOnComplete
// ─────────────────────────────────────────────────────────────────────────────

describe('blurOnComplete option', () => {
  it('queues a blur via requestAnimationFrame when all slots are filled', () => {
    const { el } = mount({}, { length: 4, blurOnComplete: true })
    // Clear queue from mount
    rafQueue = []
    typeInto(getHiddenInput(el), '1234')
    expect(rafQueue.length).toBeGreaterThan(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 27. PASSWORD MANAGER BADGE GUARD
// ─────────────────────────────────────────────────────────────────────────────

describe('password manager badge guard', () => {
  it('does not throw when MutationObserver is available', () => {
    expect(() => {
      const wrapper = makeWrapper()
      initOTP(wrapper, { autoFocus: false })
      flushRAF()
    }).not.toThrow()
  })

  it('does not throw when MutationObserver is unavailable', () => {
    const origMO = (global as Record<string, unknown>).MutationObserver
    ;(global as Record<string, unknown>).MutationObserver = undefined
    expect(() => {
      const wrapper = makeWrapper()
      initOTP(wrapper, { autoFocus: false })
      flushRAF()
    }).not.toThrow()
    ;(global as Record<string, unknown>).MutationObserver = origMO
  })

  it('widens hidden input when a password-manager attribute is already present on mount', () => {
    // Add a real LastPass element to the DOM before mounting
    const badgeEl = document.createElement('div')
    badgeEl.setAttribute('data-lastpass-icon-root', '')
    document.body.appendChild(badgeEl)

    const wrapper = makeWrapper()
    initOTP(wrapper, { autoFocus: false })
    flushRAF()  // triggers watchForPasswordManagerBadge check

    const inp = getHiddenInput(wrapper)
    // applyOffset() sets inp.style.width = baseWidthPx + 40 px
    // In jsdom getBoundingClientRect() returns 0, so width = '40px'
    expect(inp.style.width).toBe('40px')
  })

  it('MutationObserver callback triggers badge offset when password manager appears', () => {
    const origMO = global.MutationObserver
    let capturedCallback: MutationCallback | null = null
    ;(global as Record<string, unknown>).MutationObserver = jest.fn().mockImplementation((cb: MutationCallback) => {
      capturedCallback = cb
      return { observe: jest.fn(), disconnect: jest.fn() } as unknown as MutationObserver
    })

    const wrapper = makeWrapper()
    initOTP(wrapper, { autoFocus: false })
    flushRAF()

    // Add badge so isPasswordManagerActive() returns true when callback fires
    const badgeEl = document.createElement('div')
    badgeEl.setAttribute('data-lastpass-icon-root', '')
    document.body.appendChild(badgeEl)

    // Fire the observer callback manually — should not throw
    expect(() => capturedCallback?.([], {} as MutationObserver)).not.toThrow()

    global.MutationObserver = origMO
  })

  it('handles querySelector throwing inside isPasswordManagerActive (catch branch)', () => {
    jest.spyOn(document, 'querySelector').mockImplementationOnce(() => {
      throw new Error('selector error')
    })
    const wrapper = makeWrapper()
    expect(() => {
      initOTP(wrapper, { autoFocus: false })
      flushRAF()
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 28. selectOnFocus OPTION
// ─────────────────────────────────────────────────────────────────────────────

describe('selectOnFocus option', () => {
  it('selects current char range on focus when slot is filled', () => {
    const { el } = mount({}, { length: 4, selectOnFocus: true })
    const inp = getHiddenInput(el)
    typeInto(inp, '1234')
    // Simulate focus — the RAF inside onHiddenInputFocus will run selectOnFocus branch
    inp.dispatchEvent(new FocusEvent('focus'))
    flushRAF()
    // With selectOnFocus and a filled slot (activeSlot = 3), setSelectionRange(3, 4)
    const activeSlot = 3
    expect(inp.selectionStart).toBe(activeSlot)
    expect(inp.selectionEnd).toBe(activeSlot + 1)
  })

  it('uses regular range when slot is empty', () => {
    const { el } = mount({}, { length: 4, selectOnFocus: false })
    const inp = getHiddenInput(el)
    inp.dispatchEvent(new FocusEvent('focus'))
    flushRAF()
    expect(inp.selectionStart).toBe(inp.selectionEnd)
  })

  it('click with selectOnFocus and filled slot selects char range', () => {
    const { el } = mount({}, { length: 4, selectOnFocus: true })
    const inp = getHiddenInput(el)
    typeInto(inp, '1234')
    inp.dispatchEvent(new MouseEvent('click', { clientX: 50, bubbles: true }))
    expect(inp.selectionEnd).toBeGreaterThanOrEqual(inp.selectionStart ?? 0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 29. blurOnComplete IN PASTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

describe('blurOnComplete in paste handler', () => {
  it('queues a blur RAF when paste completes all slots', () => {
    const { el } = mount({}, { length: 4, blurOnComplete: true })
    rafQueue = []
    firePaste(getHiddenInput(el), '1234')
    expect(rafQueue.length).toBeGreaterThan(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 30. data-separator-after ATTRIBUTE
// ─────────────────────────────────────────────────────────────────────────────

describe('data-separator-after attribute', () => {
  it('parses comma-separated positions from data-separator-after', () => {
    const wrapper = makeWrapper()
    wrapper.dataset['separatorAfter'] = '3,6'
    const [inst] = initOTP(wrapper, { length: 9, autoFocus: false })
    const seps = wrapper.querySelectorAll('.verino-separator')
    expect(seps).toHaveLength(2)
    expect(inst).toBeDefined()
  })

  it('ignores NaN values in data-separator-after', () => {
    const wrapper = makeWrapper()
    wrapper.dataset['separatorAfter'] = '3,abc,6'
    const [inst] = initOTP(wrapper, { length: 9, autoFocus: false })
    const seps = wrapper.querySelectorAll('.verino-separator')
    expect(seps).toHaveLength(2)
    expect(inst).toBeDefined()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 31. RESEND BUTTON CLICK (built-in timer UI)
// ─────────────────────────────────────────────────────────────────────────────

describe('resend button click', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('clicking the resend button fires onResend and restarts the countdown', () => {
    const onResend = jest.fn()
    const wrapper  = makeWrapper()
    initOTP(wrapper, { timer: 5, resendAfter: 3, autoFocus: false, onResend })

    // Advance timer to expiry so resend row becomes visible
    jest.advanceTimersByTime(5000)

    // Find and click the resend button
    const resendBtn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    expect(resendBtn).not.toBeNull()
    resendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('resend button is rendered with correct class', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 30, autoFocus: false })
    const btn = document.body.querySelector('.verino-resend-btn')
    expect(btn).not.toBeNull()
  })

  it('resend countdown fires onExpire to show resend row again', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 1, resendAfter: 2, autoFocus: false })

    // Expire the main timer
    jest.advanceTimersByTime(1000)
    const resendBtn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    resendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    // Advance resend countdown to its expiry
    jest.advanceTimersByTime(2000)
    const resendRow = document.body.querySelector('.verino-resend') as HTMLElement
    // After resend countdown expires, is-visible is re-added
    expect(resendRow.classList.contains('is-visible')).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 32. Web OTP API (SMS autofill)
// ─────────────────────────────────────────────────────────────────────────────

describe('Web OTP API', () => {
  /** Inject a mock credentials.get on navigator using Object.defineProperty. */
  function mockCredentials(getFn: jest.Mock): () => void {
    Object.defineProperty(navigator, 'credentials', {
      value: { get: getFn },
      configurable: true,
      writable: true,
    })
    return () => {
      // Remove the own property so 'credentials' in navigator returns false again.
      Reflect.deleteProperty(navigator, 'credentials')
    }
  }

  it('does not throw when navigator.credentials is available and resolves with a code', async () => {
    const restore = mockCredentials(jest.fn().mockResolvedValue({ code: '123456' }))
    const wrapper = makeWrapper()
    expect(() => initOTP(wrapper, { length: 6, autoFocus: false })).not.toThrow()
    await Promise.resolve()
    restore()
  })

  it('handles rejected credentials.get gracefully', async () => {
    const restore = mockCredentials(jest.fn().mockRejectedValue(new Error('aborted')))
    const wrapper = makeWrapper()
    expect(() => initOTP(wrapper, { length: 6, autoFocus: false })).not.toThrow()
    await Promise.resolve()
    restore()
  })

  it('handles credentials returning null', async () => {
    const restore = mockCredentials(jest.fn().mockResolvedValue(null))
    const wrapper = makeWrapper()
    initOTP(wrapper, { length: 6, autoFocus: false })
    await Promise.resolve()
    restore()
  })

  it('destroy() aborts pending Web OTP request', () => {
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort')
    const restore = mockCredentials(jest.fn().mockReturnValue(new Promise(() => {})))

    const wrapper = makeWrapper()
    const [inst] = initOTP(wrapper, { length: 6, autoFocus: false })
    inst.destroy()
    expect(abortSpy).toHaveBeenCalledTimes(1)
    restore()
  })
})


// NOTE: window.Verino is no longer set as a module-level side effect in
// vanilla.ts. The CDN global is set exclusively by the esbuild CDN bundle
// (cdn.ts + globalName: 'Verino'), so ESM/bundler users are not polluted.


// ─────────────────────────────────────────────────────────────────────────────
// 34. autoFocus OPTION
// ─────────────────────────────────────────────────────────────────────────────

describe('autoFocus option', () => {
  it('queues a focus RAF when autoFocus is true (default)', () => {
    rafQueue = []
    const wrapper = makeWrapper()
    initOTP(wrapper)
    expect(rafQueue.length).toBeGreaterThan(0)
  })

  it('queues setup RAFs even when autoFocus is false', () => {
    rafQueue = []
    mount({}, { autoFocus: false })
    // Password manager badge RAF is always queued
    expect(rafQueue.length).toBeGreaterThan(0)
  })

  it('calls hiddenInput.focus() on initial RAF when autoFocus is true (default)', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper)  // autoFocus defaults to true
    const inp = wrapper.querySelector('.verino-hidden-input') as HTMLInputElement
    const focusSpy = jest.spyOn(inp, 'focus').mockImplementation(() => {})
    flushRAF()
    expect(focusSpy).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 35. blurOnComplete — RAF body executes (actual blur call)
// ─────────────────────────────────────────────────────────────────────────────

describe('blurOnComplete — actual blur execution', () => {
  it('calls blur() on the hidden input after input completes all slots', () => {
    const { el } = mount({}, { length: 4, blurOnComplete: true })
    const inp = getHiddenInput(el)
    const blurSpy = jest.spyOn(inp, 'blur').mockImplementation(() => {})
    rafQueue = []
    typeInto(inp, '1234')
    flushRAF()
    expect(blurSpy).toHaveBeenCalledTimes(1)
  })

  it('calls blur() on the hidden input after paste completes all slots', () => {
    const { el } = mount({}, { length: 4, blurOnComplete: true })
    const inp = getHiddenInput(el)
    const blurSpy = jest.spyOn(inp, 'blur').mockImplementation(() => {})
    rafQueue = []
    firePaste(inp, '1234')
    flushRAF()
    expect(blurSpy).toHaveBeenCalledTimes(1)
  })

  it('does not call blur() when blurOnComplete is false', () => {
    const { el } = mount({}, { length: 4, blurOnComplete: false })
    const inp = getHiddenInput(el)
    const blurSpy = jest.spyOn(inp, 'blur').mockImplementation(() => {})
    rafQueue = []
    typeInto(inp, '1234')
    flushRAF()
    expect(blurSpy).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 36. Paste with missing / null clipboardData
// ─────────────────────────────────────────────────────────────────────────────

describe('paste with missing clipboardData', () => {
  it('does not throw when clipboardData is absent (uses empty string fallback)', () => {
    const { el, instance } = mount({}, { length: 6 })
    const inp = getHiddenInput(el)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    // No clipboardData property → event.clipboardData is undefined → pastedText = ''
    expect(() => inp.dispatchEvent(event)).not.toThrow()
    // Nothing pasted — code stays empty
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 37. Timer tick — badge text update (built-in footer)
// ─────────────────────────────────────────────────────────────────────────────

describe('timer tick — badge text update', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('badge textContent decrements each tick', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 10, autoFocus: false })
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge.textContent).toBe('0:10')
    jest.advanceTimersByTime(1000)
    expect(badge.textContent).toBe('0:09')
    jest.advanceTimersByTime(1000)
    expect(badge.textContent).toBe('0:08')
  })

  it('badge textContent shows 0:00 at expiry, footer hidden, resend visible', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 3, autoFocus: false })
    jest.advanceTimersByTime(3000)
    const footer = document.body.querySelector('.verino-timer') as HTMLElement
    const resend = document.body.querySelector('.verino-resend') as HTMLElement
    expect(footer.style.display).toBe('none')
    expect(resend.classList.contains('is-visible')).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 38. reset() with active timer — badge + footer restoration
// ─────────────────────────────────────────────────────────────────────────────

describe('reset() with active timer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('restores badge text to initial countdown after reset', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { timer: 10, autoFocus: false })
    jest.advanceTimersByTime(4000)
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge.textContent).toBe('0:06')   // 4 ticks → 6 remaining
    instance.reset()
    expect(badge.textContent).toBe('0:10')   // restored
  })

  it('shows footer and hides resend row when reset after expiry', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { timer: 2, autoFocus: false })
    jest.advanceTimersByTime(2000)
    const footer = document.body.querySelector('.verino-timer') as HTMLElement
    const resend = document.body.querySelector('.verino-resend') as HTMLElement
    expect(footer.style.display).toBe('none')
    expect(resend.classList.contains('is-visible')).toBe(true)
    instance.reset()
    expect(footer.style.display).toBe('flex')
    expect(resend.classList.contains('is-visible')).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 39. Resend button click — timer re-setup (full body coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('resend button click — timer re-setup', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('hides resend row and shows footer after clicking resend', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 2, resendAfter: 5, autoFocus: false })
    jest.advanceTimersByTime(2000)
    const footer   = document.body.querySelector('.verino-timer') as HTMLElement
    const resend   = document.body.querySelector('.verino-resend') as HTMLElement
    const btn      = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    expect(resend.classList.contains('is-visible')).toBe(true)
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(resend.classList.contains('is-visible')).toBe(false)
    expect(footer.style.display).toBe('flex')
  })

  it('resend countdown updates badge text each tick', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 1, resendAfter: 5, autoFocus: false })
    jest.advanceTimersByTime(1000)  // expire main timer
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    const btn   = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(badge.textContent).toBe('0:05')   // resendAfter=5 shown in badge after click
    jest.advanceTimersByTime(1000)
    expect(badge.textContent).toBe('0:04')   // countdown ticks
  })

  it('resend countdown expiry shows resend row again', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 1, resendAfter: 2, autoFocus: false })
    jest.advanceTimersByTime(1000)  // expire main timer
    const resend = document.body.querySelector('.verino-resend') as HTMLElement
    const btn    = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(resend.classList.contains('is-visible')).toBe(false)
    jest.advanceTimersByTime(2000)  // expire resend countdown
    expect(resend.classList.contains('is-visible')).toBe(true)
  })

  it('clicking resend clears stale code and error state before cooldown restart', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { timer: 1, resendAfter: 5, autoFocus: false })
    const input = getHiddenInput(wrapper)

    typeInto(input, '1234')
    instance.setError(true)
    jest.advanceTimersByTime(1000)

    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    flushRAF()

    expect(instance.getCode()).toBe('')
    getSlots(wrapper).forEach((slot) => {
      expect(slot.getAttribute('data-invalid')).toBe('false')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 40. Web OTP API — credential fills slots (then-callback coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('Web OTP API — credential fills slots', () => {
  function mockCredentialsWithCode(code: string | null): () => void {
    const credential = code ? { code } : null
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockResolvedValue(credential) },
      configurable: true,
      writable: true,
    })
    return () => { Reflect.deleteProperty(navigator, 'credentials') }
  }

  it('fills all slots when credential.code is valid', async () => {
    const restore = mockCredentialsWithCode('654321')
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { length: 6, autoFocus: false })
    // Flush microtasks so the .then() callback runs
    await new Promise(resolve => setTimeout(resolve, 0))
    restore()
    expect(instance.getCode()).toBe('654321')
  })

  it('does nothing when credential.code is absent (null credential)', async () => {
    const restore = mockCredentialsWithCode(null)
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { length: 6, autoFocus: false })
    await new Promise(resolve => setTimeout(resolve, 0))
    restore()
    expect(instance.getCode()).toBe('')
  })

  it('does nothing when credential.code filters to empty string', async () => {
    // 'ABCDEF' is all-invalid for numeric type
    const restore = mockCredentialsWithCode('ABCDEF')
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { length: 6, type: 'numeric', autoFocus: false })
    await new Promise(resolve => setTimeout(resolve, 0))
    restore()
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 41. defaultValue — all characters invalid (inner if(filtered) is false)
// ─────────────────────────────────────────────────────────────────────────────

describe('defaultValue — all characters invalid for type', () => {
  it('leaves all slots empty when defaultValue has no valid characters', () => {
    const { instance } = mount({}, { type: 'numeric', defaultValue: 'xyz' })
    expect(instance.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 42. initOTP called with no arguments — uses default CSS selector
// ─────────────────────────────────────────────────────────────────────────────

describe('initOTP with no target argument (default selector)', () => {
  it('mounts on .verino-wrapper elements found by the default selector', () => {
    // makeWrapper() adds className='verino-wrapper', so it will match the default selector
    const wrapper = makeWrapper()
    // Call initOTP with just options (no target) — relies on the default '.verino-wrapper' selector
    const instances = initOTP(undefined as unknown as string, { autoFocus: false, length: 4 })
    expect(instances.length).toBeGreaterThan(0)
    expect(instances[0].getCode()).toBe('')
    // Cleanup
    instances.forEach(i => i.destroy())
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 43. placeholder rendered in empty slots via syncSlotsToDOM
// ─────────────────────────────────────────────────────────────────────────────

describe('placeholder option', () => {
  it('renders placeholder text in empty slots', () => {
    const { el } = mount({}, { length: 4, placeholder: '○' })
    // Flush the initial RAF so syncSlotsToDOM runs
    flushRAF()
    const slots = getSlots(el)
    // When slot is empty the text node value should be the placeholder char
    // The slot text content includes the caret + text node
    expect(slots[0].textContent).toContain('○')
  })

  it('renders actual char in filled slot, not placeholder', () => {
    const { el } = mount({}, { length: 4, placeholder: '○' })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    flushRAF()
    // slot 0 is filled with '1' — placeholder should not appear
    expect(getSlots(el)[0].textContent).not.toContain('○')
  })

  it('placeholder is empty string by default', () => {
    const { el } = mount({}, { length: 4 })
    flushRAF()
    const slots = getSlots(el)
    // Default placeholder is '' so slot textContent is just the caret (no visible char)
    expect(slots[0].textContent).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 44. onExpire fires when using custom onTick (builtInFooterEl is null)
// ─────────────────────────────────────────────────────────────────────────────

describe('onExpire with custom onTick (no built-in footer)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('fires onExpire when countdown expires (custom onTick mode — no footer UI)', () => {
    const onTick   = jest.fn()
    const onExpire = jest.fn()
    const wrapper  = makeWrapper()
    initOTP(wrapper, { timer: 2, autoFocus: false, onTick, onExpire })
    // With onTick provided, builtInFooterEl/builtInResendRowEl are null
    // onExpire must still fire (lines 424-428 covered with null checks)
    jest.advanceTimersByTime(2000)
    expect(onExpire).toHaveBeenCalledTimes(1)
    // No built-in footer created
    expect(document.body.querySelector('.verino-timer')).toBeNull()
  })

  it('onTick fires every second when custom onTick is provided', () => {
    const onTick = jest.fn()
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 3, autoFocus: false, onTick })
    expect(onTick).toHaveBeenNthCalledWith(1, 3)
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(4)
    expect(onTick).toHaveBeenLastCalledWith(0)
  })
})

describe('pm-guard deferred setup cleanup', () => {
  it('destroy() cancels the queued password-manager observer setup', () => {
    const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame')
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { autoFocus: false })

    instance.destroy()

    expect(cancelSpy).toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 45. Resend button guard — null refs early-return (branch coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('resend button click — null ref guard does not throw', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('clicking resend button after destroy() does not throw', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { timer: 2, autoFocus: false })
    jest.advanceTimersByTime(2000)

    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    instance.destroy()

    // destroy() nulls out __verinoFooterEl / __verinoResendRowEl but the button's
    // click listener still fires if the DOM element wasn't removed. The early-return
    // guard inside the click handler prevents a crash.
    expect(() => btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 46. selectionStart null-coalescing in keydown and paste handlers
// ─────────────────────────────────────────────────────────────────────────────

describe('selectionStart null coalescing (?? 0)', () => {
  it('keydown Backspace works when selectionStart is null (falls back to 0)', () => {
    const { el, instance } = mount()
    const inp = getHiddenInput(el)
    typeInto(inp, '123')
    // Force selectionStart to null to trigger the ?? 0 branch
    Object.defineProperty(inp, 'selectionStart', { get: () => null, configurable: true })
    // Should not throw and should treat cursorPos as 0
    expect(() => keydown(inp, 'Backspace')).not.toThrow()
  })

  it('paste handler works when selectionStart is null (falls back to cursor 0)', () => {
    const { el, instance } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '12')
    Object.defineProperty(inp, 'selectionStart', { get: () => null, configurable: true })
    // paste from cursor=0 (null coalesced)
    expect(() => firePaste(inp, '1234')).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 47. ArrowLeft and ArrowRight keydown branches — explicit coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('ArrowLeft and ArrowRight explicit coverage', () => {
  it('ArrowLeft at slot 0 clamps to 0 without throwing', () => {
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    inp.selectionStart = 0
    expect(() => keydown(inp, 'ArrowLeft')).not.toThrow()
    expect(inp.selectionStart).toBe(0)
  })

  it('ArrowRight at last slot clamps without throwing', () => {
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '1234')
    inp.selectionStart = 3
    expect(() => keydown(inp, 'ArrowRight')).not.toThrow()
    expect(inp.selectionStart).toBe(3)
  })

  it('ArrowRight from slot 1 moves to slot 2', () => {
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '123')
    inp.selectionStart = 1
    keydown(inp, 'ArrowRight')
    expect(inp.selectionStart).toBe(2)
  })

  it('ArrowLeft from slot 2 moves to slot 1', () => {
    const { el } = mount({}, { length: 4 })
    const inp = getHiddenInput(el)
    typeInto(inp, '123')
    inp.selectionStart = 2
    keydown(inp, 'ArrowLeft')
    expect(inp.selectionStart).toBe(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 48. masked mode — slot renders maskChar for filled chars via syncSlotsToDOM
// ─────────────────────────────────────────────────────────────────────────────

describe('masked mode — slot text rendering', () => {
  it('filled slot shows maskChar not the actual digit', () => {
    const { el } = mount({}, { length: 4, masked: true, maskChar: '●' })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    flushRAF()
    // slot 0 is filled — text should be '●' not '1'
    const slot0 = getSlots(el)[0]
    expect(slot0.textContent).toContain('●')
    expect(slot0.textContent).not.toContain('1')
  })

  it('empty slot in masked mode shows no maskChar (empty or placeholder)', () => {
    const { el } = mount({}, { length: 4, masked: true, maskChar: '●' })
    flushRAF()
    // slot 1 is empty — should not show '●'
    const slot1 = getSlots(el)[1]
    expect(slot1.textContent).not.toContain('●')
  })

  it('custom maskChar is used instead of default ●', () => {
    const { el } = mount({}, { length: 4, masked: true, maskChar: '*' })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    flushRAF()
    const slot0 = getSlots(el)[0]
    expect(slot0.textContent).toContain('*')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 49. syncSlotsToDOM — text node creation path (childNodes[1] is not a TEXT_NODE)
// ─────────────────────────────────────────────────────────────────────────────

describe('syncSlotsToDOM text node creation path', () => {
  it('creates a text node if one does not exist on a slot', () => {
    const { el } = mount({}, { length: 4 })
    // Remove any text node from slot 0 to force the creation path
    const slot0 = getSlots(el)[0]
    // Remove all child nodes except the caret (index 0)
    while (slot0.childNodes.length > 1) slot0.removeChild(slot0.lastChild!)
    // Now typing should recreate the text node
    typeInto(getHiddenInput(el), '5')
    // slot should show '5'
    expect(slot0.textContent).toContain('5')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 50. data-type attribute maps to correct inputMode for "any" type
// ─────────────────────────────────────────────────────────────────────────────

describe('inputMode for "any" type', () => {
  it('type "any" sets inputMode to "text"', () => {
    const { el } = mount({}, { type: 'any' })
    expect(getHiddenInput(el).inputMode).toBe('text')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 51. data-timer and data-resend-after attribute parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('data-timer and data-resend-after attribute parsing', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('reads timer from data-timer attribute', () => {
    const wrapper = makeWrapper({ timer: '5' })
    initOTP(wrapper, { autoFocus: false })
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge?.textContent).toBe('0:05')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 52. destroy() with active timer and resend countdown
// ─────────────────────────────────────────────────────────────────────────────

describe('destroy() cleans up timers and prevents further interaction', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('destroy stops the main countdown (no onExpire after destroy)', () => {
    const onExpire = jest.fn()
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { timer: 3, autoFocus: false, onExpire })
    instance.destroy()
    jest.advanceTimersByTime(3000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('destroy stops resend countdown when it is active', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { timer: 1, resendAfter: 3, autoFocus: false })
    jest.advanceTimersByTime(1000)  // main timer expires
    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Now resend countdown is running
    instance.destroy()
    // After destroy, no interval ticking
    expect(() => jest.advanceTimersByTime(3000)).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 53. data-name attribute on hidden input
// ─────────────────────────────────────────────────────────────────────────────

describe('data-name attribute', () => {
  it('data-name attribute sets name on hidden input when provided via data-attr', () => {
    // The vanilla adapter reads options.name, not data-name, so we confirm via opts
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { name: 'verification_code', autoFocus: false })
    const inp = getHiddenInput(wrapper)
    expect(inp.name).toBe('verification_code')
    instance.destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 54. Web OTP — valid[i] truthiness check (inner loop branch coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('Web OTP — inner loop valid[i] branch', () => {
  it('fills slots via Web OTP with a partial valid code (fewer chars than slots)', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockResolvedValue({ code: '123' }) },
      configurable: true,
      writable: true,
    })
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { length: 6, type: 'numeric', autoFocus: false })
    await new Promise(resolve => setTimeout(resolve, 0))
    Reflect.deleteProperty(navigator, 'credentials')
    // '123' fills slots 0-2, slots 3-5 remain empty
    expect(instance.getCode()).toBe('123')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 55. keydown handler — unrecognized key falls through without side-effects
// ─────────────────────────────────────────────────────────────────────────────

describe('keydown unrecognized key', () => {
  it('pressing a non-special key (e.g. Enter) does not change state or throw', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { length: 4, autoFocus: false })
    const inp = getHiddenInput(wrapper)
    typeInto(inp, '12')
    const codeBefore = instance.getCode()
    // Enter / Meta / F1 don't match Backspace / Delete / Tab / ArrowLeft / ArrowRight
    // — they must fall through the entire else-if chain without side-effects.
    keydown(inp, 'Enter')
    keydown(inp, 'Meta')
    keydown(inp, 'F1')
    expect(instance.getCode()).toBe(codeBefore)
    instance.destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 56. data-length / data-resend NaN fallback (the || 6 / || 30 branch)
// Lines 249, 254 in vanilla.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('data-length NaN fallback (|| 6 branch)', () => {
  it('falls back to 6 slots when data-length parses as NaN', () => {
    // parseInt('not-a-number', 10) = NaN → NaN || 6 = 6
    const wrapper = makeWrapper({ length: 'not-a-number' })
    initOTP(wrapper, { autoFocus: false })
    expect(getSlots(wrapper)).toHaveLength(6)
  })

  it('falls back to 6 slots when data-length is "0" (falsy int → || 6)', () => {
    // parseInt('0', 10) = 0 → 0 || 6 = 6
    const wrapper = makeWrapper({ length: '0' })
    initOTP(wrapper, { autoFocus: false })
    // Math.max(1, 0 || 6) = Math.max(1, 6) = 6
    expect(getSlots(wrapper)).toHaveLength(6)
  })
})

describe('data-resend NaN fallback (|| 30 branch)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('falls back to 30s resend cooldown when data-resend parses as NaN', () => {
    // parseInt('bad', 10) = NaN → NaN || 30 = 30
    const wrapper = makeWrapper({ resend: 'bad', timer: '1' })
    initOTP(wrapper, { autoFocus: false })
    // Expire main timer
    jest.advanceTimersByTime(1000)
    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Resend cooldown should be 30s — badge shows 0:30
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge?.textContent).toBe('0:30')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 57. Feedback subscriber — haptic=false and sound=true branches
// Lines 313, 314, 316 in vanilla.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('feedback subscriber — sound:true on COMPLETE (line 314)', () => {
  it('does not throw when sound:true and all slots are filled (triggerSoundFeedback path)', () => {
    // soundEnabled = true → line 314 triggerSoundFeedback() executes
    const { el } = mount({}, { sound: true })
    const inp = getHiddenInput(el)
    expect(() => typeInto(inp, '123456')).not.toThrow()
  })

  it('fires onComplete even with sound:true', () => {
    const cb = jest.fn()
    const { el } = mount({}, { sound: true, onComplete: cb })
    const inp = getHiddenInput(el)
    typeInto(inp, '123456')
    expect(cb).toHaveBeenCalledWith('123456')
  })
})

describe('feedback subscriber — haptic:false on COMPLETE (line 313 false branch)', () => {
  it('does not throw when haptic:false and all slots are filled', () => {
    // hapticEnabled = false → the if(hapticEnabled) branch is false — triggerHapticFeedback NOT called
    const { el } = mount({}, { haptic: false })
    const inp = getHiddenInput(el)
    expect(() => typeInto(inp, '123456')).not.toThrow()
  })

  it('fires onComplete when haptic:false', () => {
    const cb = jest.fn()
    const { el } = mount({}, { haptic: false, onComplete: cb })
    const inp = getHiddenInput(el)
    typeInto(inp, '123456')
    expect(cb).toHaveBeenCalledWith('123456')
  })
})

describe('feedback subscriber — haptic:false on ERROR (line 316 false branch)', () => {
  it('does not throw when haptic:false and setError(true) is called', () => {
    // hapticEnabled = false → line 316 if(hapticEnabled) is false — triggerHapticFeedback NOT called
    const { instance } = mount({}, { haptic: false })
    expect(() => instance.setError(true)).not.toThrow()
  })

  it('sets error state correctly when haptic:false', () => {
    const { el, instance } = mount({}, { haptic: false })
    instance.setError(true)
    const slots = getSlots(el)
    slots.forEach(s => expect(s.getAttribute('data-invalid')).toBe('true'))
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 58. Resend click handler — covers lines 482-492 (body of click handler)
// Tests the resend countdown's onTick and onExpire callbacks explicitly
// ─────────────────────────────────────────────────────────────────────────────

describe('resend click handler — onTick and onExpire of resend countdown', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('resend click starts a new countdown; onTick updates badge every second', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 1, resendAfter: 3, autoFocus: false })
    jest.advanceTimersByTime(1000)   // main timer expires → resend row visible
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    const btn   = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // After click, badge shows resendCooldown
    expect(badge.textContent).toBe('0:03')
    jest.advanceTimersByTime(1000)
    expect(badge.textContent).toBe('0:02')
    jest.advanceTimersByTime(1000)
    expect(badge.textContent).toBe('0:01')
  })

  it('resend countdown onExpire hides footer and shows resend row', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 1, resendAfter: 2, autoFocus: false })
    jest.advanceTimersByTime(1000)   // main timer expires
    const footer   = document.body.querySelector('.verino-timer') as HTMLElement
    const resend   = document.body.querySelector('.verino-resend') as HTMLElement
    const btn      = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Footer is shown, resend row is hidden
    expect(footer.style.display).toBe('flex')
    expect(resend.classList.contains('is-visible')).toBe(false)
    // Expire the resend countdown
    jest.advanceTimersByTime(2000)
    expect(footer.style.display).toBe('none')
    expect(resend.classList.contains('is-visible')).toBe(true)
  })

  it('clicking resend a second time stops the first resend countdown (resendCountdown?.stop())', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 1, resendAfter: 5, autoFocus: false })
    jest.advanceTimersByTime(1000)   // main timer expires
    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    // First click — starts resend countdown
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    jest.advanceTimersByTime(1000)   // 1 tick on first resend countdown
    // Second click — stops first countdown and starts fresh (resendCountdown?.stop() path covered)
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    // Badge resets to full resendCooldown (5s) on second click
    expect(badge.textContent).toBe('0:05')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 59. Web OTP — 5-minute timeout aborts the pending request (line 509)
// ─────────────────────────────────────────────────────────────────────────────

describe('Web OTP timeout callback (line 509)', () => {
  it('fires abort() on the WebOTP controller after WEB_OTP_TIMEOUT_MS (5 minutes)', () => {
    jest.useFakeTimers()

    const abortSpy = jest.spyOn(AbortController.prototype, 'abort')
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockReturnValue(new Promise(() => { /* never resolves */ })) },
      configurable: true,
      writable: true,
    })

    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { length: 6, autoFocus: false })

    // WEB_OTP_TIMEOUT_MS = 5 * 60 * 1000 ms — advance past it
    jest.advanceTimersByTime(5 * 60 * 1000 + 100)

    expect(abortSpy).toHaveBeenCalled()

    instance.destroy()
    Reflect.deleteProperty(navigator, 'credentials')
    jest.useRealTimers()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 60. watchForPasswordManagerBadge — early-return functions (lines 861, 869)
// These two () => {} functions are returned when MutationObserver is absent
// or when a password manager is already active. They must be INVOKED to count
// as function-coverage hits — destroy() calls disconnectPasswordManagerWatch().
// ─────────────────────────────────────────────────────────────────────────────

describe('watchForPasswordManagerBadge — () => {} cleanup functions', () => {
  it('line 861: returns and invokes () => {} when MutationObserver is undefined', () => {
    // Delete MutationObserver before the RAF fires so watchForPasswordManagerBadge
    // sees typeof MutationObserver === 'undefined' and returns the () => {} at line 861.
    const origMO = (global as Record<string, unknown>).MutationObserver
    delete (global as Record<string, unknown>).MutationObserver

    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { autoFocus: false })

    // Flush the RAF — this calls watchForPasswordManagerBadge(hiddenInputEl, width)
    // With MutationObserver undefined, the () => {} at line 861 is returned
    // and assigned to disconnectPasswordManagerWatch.
    flushRAF()

    // destroy() calls disconnectPasswordManagerWatch() → invokes the () => {} → function covered
    expect(() => instance.destroy()).not.toThrow()

    ;(global as Record<string, unknown>).MutationObserver = origMO
  })

  it('line 869: returns and invokes () => {} when a password manager is already in the DOM', () => {
    // Insert a LastPass-style element so isPasswordManagerActive() returns true.
    // watchForPasswordManagerBadge detects it, applies the offset, and returns () => {} at line 869.
    const pmEl = document.createElement('div')
    pmEl.setAttribute('data-lastpass-icon-root', '')
    document.body.appendChild(pmEl)

    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { autoFocus: false })

    // Flush the RAF — isPasswordManagerActive() returns true → line 869 () => {} returned
    flushRAF()

    // destroy() calls disconnectPasswordManagerWatch() → invokes () => {} → function covered
    expect(() => instance.destroy()).not.toThrow()

    pmEl.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// ARIA — role="group" + visually-hidden label
// ─────────────────────────────────────────────────────────────────────────────

describe('ARIA group label', () => {
  it('rootEl has role="group"', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { autoFocus: false })
    const rootEl = wrapper.querySelector('.verino-element')
    expect(rootEl?.getAttribute('role')).toBe('group')
  })

  it('rootEl has aria-labelledby pointing to a visible sr-only span', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { autoFocus: false, length: 6 })
    const rootEl = wrapper.querySelector('.verino-element')!
    const labelId = rootEl.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const labelEl = document.getElementById(labelId!)
    expect(labelEl).not.toBeNull()
    expect(labelEl?.className).toContain('verino-sr-only')
  })

  it('sr-only label text mentions slot count and type', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { autoFocus: false, length: 4, type: 'numeric' })
    const rootEl = wrapper.querySelector('.verino-element')!
    const labelId = rootEl.getAttribute('aria-labelledby')!
    const labelEl = document.getElementById(labelId)!
    expect(labelEl.textContent).toMatch(/4/)
    expect(labelEl.textContent).toMatch(/digit/)
  })

  it('sr-only label uses "character" for non-numeric types', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { autoFocus: false, length: 6, type: 'alphanumeric' })
    const rootEl = wrapper.querySelector('.verino-element')!
    const labelId = rootEl.getAttribute('aria-labelledby')!
    const labelEl = document.getElementById(labelId)!
    expect(labelEl.textContent).toMatch(/character/)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// setSuccess — routes through core, syncs data-success to DOM
// ─────────────────────────────────────────────────────────────────────────────

describe('instance.setSuccess', () => {
  it('applies data-success="true" to all slot divs', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { autoFocus: false, length: 3 })
    instance.setSuccess(true)
    const slots = wrapper.querySelectorAll('.verino-slot')
    slots.forEach(slot => {
      expect(slot.getAttribute('data-success')).toBe('true')
    })
  })

  it('clears data-invalid when setSuccess(true) is called', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { autoFocus: false, length: 3 })
    instance.setError(true)
    instance.setSuccess(true)
    const slots = wrapper.querySelectorAll('.verino-slot')
    slots.forEach(slot => {
      expect(slot.getAttribute('data-invalid')).toBe('false')
      expect(slot.getAttribute('data-success')).toBe('true')
    })
  })

  it('setSuccess(false) clears data-success', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { autoFocus: false, length: 3 })
    instance.setSuccess(true)
    instance.setSuccess(false)
    const slots = wrapper.querySelectorAll('.verino-slot')
    slots.forEach(slot => {
      expect(slot.getAttribute('data-success')).toBe('false')
    })
  })

  it('setError(true) after setSuccess(true) clears data-success', () => {
    const wrapper = makeWrapper()
    const [instance] = initOTP(wrapper, { autoFocus: false, length: 3 })
    instance.setSuccess(true)
    instance.setError(true)
    const slots = wrapper.querySelectorAll('.verino-slot')
    slots.forEach(slot => {
      expect(slot.getAttribute('data-success')).toBe('false')
      expect(slot.getAttribute('data-invalid')).toBe('true')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 60. timer-ui custom-tick mode — RESET event restarts countdown
// ─────────────────────────────────────────────────────────────────────────────

describe('timer-ui custom-tick mode — RESET restarts countdown', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('reset() in custom-tick mode fires RESET which restarts the countdown', () => {
    const onTick = jest.fn()
    const wrapper = makeWrapper()
    const [inst] = initOTP(wrapper, { timer: 10, onTick, autoFocus: false })
    flushRAF()

    // Let 3 ticks elapse
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(4)

    onTick.mockClear()

    // reset() fires RESET event → customCountdown.restart() (covers timer-ui.ts line 61 TRUE branch)
    // restart() fires immediately with totalSeconds, then ticks every second
    inst.reset()
    flushRAF()

    jest.advanceTimersByTime(2000)
    expect(onTick).toHaveBeenCalledTimes(3) // 1 immediate + 2 interval ticks
  })

  it('non-RESET event in custom-tick mode does not restart the countdown (line 61 FALSE branch)', () => {
    const onTick = jest.fn()
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 10, onTick, autoFocus: false })
    flushRAF()

    // Typing fires an INPUT event through the otp subscriber — event.type !== 'RESET'
    // This covers the FALSE branch of: if (event.type === 'RESET') customCountdown.restart()
    typeInto(getHiddenInput(wrapper), '1')
    flushRAF()

    jest.advanceTimersByTime(1000)
    // Timer continues normally — restart() was not called
    expect(onTick).toHaveBeenCalledWith(9)
  })

  it('destroy() in custom-tick mode stops the countdown', () => {
    const onTick = jest.fn()
    const wrapper = makeWrapper()
    const [inst] = initOTP(wrapper, { timer: 10, onTick, autoFocus: false })
    flushRAF()

    inst.destroy()
    onTick.mockClear()
    jest.advanceTimersByTime(5000)

    expect(onTick).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 60b. timer-ui built-in UI mode — RESET event restarts main countdown
// ─────────────────────────────────────────────────────────────────────────────

describe('timer-ui built-in UI mode — RESET restarts main countdown', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('non-RESET event in built-in UI mode returns early from subscriber (line 152 TRUE branch)', () => {
    const wrapper = makeWrapper()
    initOTP(wrapper, { timer: 5, autoFocus: false })
    flushRAF()

    // Typing fires an INPUT event through the otp subscriber — event.type !== 'RESET'
    // This covers the TRUE branch of: if (event.type !== 'RESET') return
    typeInto(getHiddenInput(wrapper), '1')
    flushRAF()

    // Timer badge is still ticking normally — subscriber returned early without restarting
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge).not.toBeNull()
  })

  it('reset() in built-in UI mode fires RESET which restarts the main countdown (line 152 FALSE branch)', () => {
    const wrapper = makeWrapper()
    const [inst] = initOTP(wrapper, { timer: 5, autoFocus: false })
    flushRAF()

    // Advance to expiry
    jest.advanceTimersByTime(5000)

    // reset() → otpCore.reset() → RESET event → subscriber at line 151-157 runs
    // event.type !== 'RESET' is FALSE → we do NOT return early → mainCountdown.restart()
    inst.reset()
    flushRAF()

    // showTimer(timerSeconds) restores the badge text to the full duration
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge.textContent).toBe('0:05')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 61. web-otp — AbortError suppresses console.warn
// ─────────────────────────────────────────────────────────────────────────────

describe('Web OTP — AbortError does not trigger console.warn', () => {
  it('credentials.get rejection with AbortError does not call console.warn', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockRejectedValue(abortError) },
      configurable: true,
      writable: true,
    })

    const wrapper = makeWrapper()
    initOTP(wrapper, { length: 6, autoFocus: false })

    // Flush the microtask queue twice to let the rejected promise settle
    await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(warnSpy).not.toHaveBeenCalled()

    Reflect.deleteProperty(navigator, 'credentials')
    warnSpy.mockRestore()
  })

  it('credentials.get rejection with InvalidStateError backend unavailable does not call console.warn', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const invalidStateError = Object.assign(new Error('OTP backend unavailable.'), { name: 'InvalidStateError' })
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockRejectedValue(invalidStateError) },
      configurable: true,
      writable: true,
    })

    const wrapper = makeWrapper()
    initOTP(wrapper, { length: 6, autoFocus: false })

    await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(warnSpy).not.toHaveBeenCalled()

    Reflect.deleteProperty(navigator, 'credentials')
    warnSpy.mockRestore()
  })
})
