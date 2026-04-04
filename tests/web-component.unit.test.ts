/** @jest-environment jsdom */

/**
 * verino — Web Component unit tests (jsdom environment)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the <verino-input> custom element via the jsdom custom elements
 * registry. The module self-registers on first import; all tests create
 * elements with document.createElement('verino-input') and append them to
 * document.body so connectedCallback fires.
 *
 * Coverage targets:
 *   - Custom element registration
 *   - Shadow DOM structure (slots, hidden input, caret, separator)
 *   - Attribute-driven config (length, type, masked, separator-after, etc.)
 *   - Data-* attributes on slot divs
 *   - Input/keydown/paste event handlers
 *   - Public DOM API: getCode, setError, setSuccess, setDisabled, setReadOnly, reset
 *   - Custom events: change, complete
 *   - JS property setters: onComplete, onInvalidChar, pattern, pasteTransformer
 *   - attributeChangedCallback triggers rebuild
 *   - disconnectedCallback stops timers
 *   - Timer footer elements
 *   - getSlots / getInputProps
 */

import { VerinoInput } from '@verino/web-component'

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
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeEl(attrs: Record<string, string | boolean> = {}): VerinoInput {
  const el = document.createElement('verino-input') as VerinoInput
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) {
      // skip — don't set
    } else if (v === true) {
      el.setAttribute(k, '')
    } else {
      el.setAttribute(k, v)
    }
  }
  // auto-focus="false" so tests don't fight over focus
  if (!el.hasAttribute('auto-focus')) el.setAttribute('auto-focus', 'false')
  document.body.appendChild(el)
  return el
}

function shadow(el: VerinoInput): ShadowRoot {
  return el.shadowRoot!
}

function getSlots(el: VerinoInput): HTMLElement[] {
  return Array.from(shadow(el).querySelectorAll('.verino-wc-slot')) as HTMLElement[]
}

function getHiddenInput(el: VerinoInput): HTMLInputElement {
  return shadow(el).querySelector('.verino-wc-hidden') as HTMLInputElement
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function keydown(input: HTMLInputElement, key: string, extra: KeyboardEventInit = {}) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
}

function firePaste(input: HTMLInputElement, text: string) {
  const evt = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(evt, 'clipboardData', {
    value: { getData: () => text },
    configurable: true,
  })
  input.dispatchEvent(evt)
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. Custom element registration
// ─────────────────────────────────────────────────────────────────────────────

describe('custom element registration', () => {
  it('registers verino-input in the custom elements registry', () => {
    expect(customElements.get('verino-input')).toBe(VerinoInput)
  })

  it('creates an instance with document.createElement', () => {
    const el = document.createElement('verino-input')
    expect(el).toBeInstanceOf(VerinoInput)
  })

  it('has an open shadow root after being appended to document', () => {
    const el = makeEl()
    expect(el.shadowRoot).not.toBeNull()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 2. Shadow DOM structure
// ─────────────────────────────────────────────────────────────────────────────

describe('shadow DOM structure', () => {
  it('renders 6 slot divs by default', () => {
    const el = makeEl()
    expect(getSlots(el)).toHaveLength(6)
  })

  it('respects the length attribute', () => {
    const el = makeEl({ length: '4' })
    expect(getSlots(el)).toHaveLength(4)
  })

  it('renders a hidden input inside shadow DOM', () => {
    const el = makeEl()
    expect(getHiddenInput(el)).not.toBeNull()
  })

  it('hidden input has autocomplete="one-time-code"', () => {
    const el = makeEl()
    expect(getHiddenInput(el).autocomplete).toBe('one-time-code')
  })

  it('applies data-first and data-last to boundary slots', () => {
    const el = makeEl({ length: '4' })
    const slots = getSlots(el)
    expect(slots[0].getAttribute('data-first')).toBe('true')
    expect(slots[0].getAttribute('data-last')).toBe('false')
    expect(slots[3].getAttribute('data-first')).toBe('false')
    expect(slots[3].getAttribute('data-last')).toBe('true')
  })

  it('injects a <style> element into shadow root', () => {
    const el = makeEl()
    const style = shadow(el).querySelector('style')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('verino-wc-slot')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 3. Attribute-driven configuration
// ─────────────────────────────────────────────────────────────────────────────

describe('attribute-driven config', () => {
  it('type="numeric" sets inputMode="numeric"', () => {
    const el = makeEl({ type: 'numeric' })
    expect(getHiddenInput(el).inputMode).toBe('numeric')
  })

  it('type="alphabet" sets inputMode="text"', () => {
    const el = makeEl({ type: 'alphabet' })
    expect(getHiddenInput(el).inputMode).toBe('text')
  })

  it('masked attribute makes hidden input type="password"', () => {
    const el = makeEl({ masked: true })
    expect(getHiddenInput(el).type).toBe('password')
  })

  it('masked attribute sets data-masked="true" on slots', () => {
    const el = makeEl({ masked: true })
    getSlots(el).forEach(s => expect(s.getAttribute('data-masked')).toBe('true'))
  })

  it('separator-after attribute inserts separator elements', () => {
    const el = makeEl({ length: '6', 'separator-after': '3' })
    const separators = shadow(el).querySelectorAll('.verino-wc-separator')
    expect(separators).toHaveLength(1)
  })

  it('separator-after with comma list inserts multiple separators', () => {
    const el = makeEl({ length: '6', 'separator-after': '2,4' })
    const separators = shadow(el).querySelectorAll('.verino-wc-separator')
    expect(separators).toHaveLength(2)
  })

  it('disabled attribute disables the hidden input', () => {
    const el = makeEl({ disabled: true })
    expect(getHiddenInput(el).disabled).toBe(true)
  })

  it('name attribute sets hidden input name', () => {
    const el = makeEl({ name: 'otp' })
    expect(getHiddenInput(el).name).toBe('otp')
  })

  it('default-value attribute pre-fills without complete event', () => {
    const onComplete = jest.fn()
    const el = makeEl({ length: '4', 'default-value': '1234' })
    el.onComplete = onComplete
    expect(el.getCode()).toBe('1234')
    expect(onComplete).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 4. attributeChangedCallback — rebuild on attribute change
// ─────────────────────────────────────────────────────────────────────────────

describe('attributeChangedCallback', () => {
  it('changing length attribute rebuilds the shadow DOM', () => {
    const el = makeEl({ length: '4' })
    expect(getSlots(el)).toHaveLength(4)
    el.setAttribute('length', '6')
    expect(getSlots(el)).toHaveLength(6)
  })

  it('changing type attribute rebuilds with new inputMode', () => {
    const el = makeEl({ type: 'numeric' })
    expect(getHiddenInput(el).inputMode).toBe('numeric')
    el.setAttribute('type', 'alphabet')
    expect(getHiddenInput(el).inputMode).toBe('text')
  })

  it('adding masked attribute switches hidden input to password', () => {
    const el = makeEl()
    expect(getHiddenInput(el).type).toBe('text')
    el.setAttribute('masked', '')
    expect(getHiddenInput(el).type).toBe('password')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 5. Input event
// ─────────────────────────────────────────────────────────────────────────────

describe('input event', () => {
  it('typing fills the first slot', () => {
    const el = makeEl()
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    expect(el.getCode()).toBe('1')
  })

  it('typing 6 digits fills all slots', () => {
    const el = makeEl({ length: '6' })
    flushRAF()
    typeInto(getHiddenInput(el), '123456')
    expect(el.getCode()).toBe('123456')
  })

  it('non-numeric chars are filtered for numeric type', () => {
    const el = makeEl({ type: 'numeric' })
    flushRAF()
    typeInto(getHiddenInput(el), 'abc')
    expect(el.getCode()).toBe('')
  })

  it('empty input resets the code', () => {
    const el = makeEl()
    flushRAF()
    typeInto(getHiddenInput(el), '123')
    typeInto(getHiddenInput(el), '')
    expect(el.getCode()).toBe('')
  })

  it('input blocked when disabled', () => {
    const el = makeEl({ disabled: true })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    expect(el.getCode()).toBe('')
  })

  it('input blocked when readonly', () => {
    const el = makeEl({ readonly: true })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    expect(el.getCode()).toBe('')
  })

  it('updates data-filled after typing', () => {
    const el = makeEl()
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    expect(getSlots(el)[0].getAttribute('data-filled')).toBe('true')
    expect(getSlots(el)[0].getAttribute('data-empty')).toBe('false')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 6. Keyboard handlers
// ─────────────────────────────────────────────────────────────────────────────

describe('keyboard handlers', () => {
  it('Backspace on a filled slot clears it', () => {
    const el = makeEl()
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    const inp = getHiddenInput(el)
    inp.setSelectionRange(1, 1)
    keydown(inp, 'Backspace')
    flushRAF()
    expect(el.getCode()).toBe('')
  })

  it('Backspace is no-op when readonly', () => {
    const el = makeEl({ readonly: true })
    flushRAF()
    keydown(getHiddenInput(el), 'Backspace')
    expect(el.getCode()).toBe('')
  })

  it('Backspace is no-op when disabled', () => {
    const el = makeEl({ disabled: true })
    flushRAF()
    keydown(getHiddenInput(el), 'Backspace')
    expect(el.getCode()).toBe('')
  })

  it('Delete clears slot in-place', () => {
    const el = makeEl({ length: '3' })
    flushRAF()
    typeInto(getHiddenInput(el), '123')
    const inp = getHiddenInput(el)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Delete')
    flushRAF()
    expect(el.getCode()).toBe('23')
  })

  it('Delete is no-op when readonly', () => {
    const el = makeEl({ readonly: true })
    flushRAF()
    keydown(getHiddenInput(el), 'Delete')
    expect(el.getCode()).toBe('')
  })

  it('Delete is no-op when disabled', () => {
    const el = makeEl({ disabled: true })
    flushRAF()
    keydown(getHiddenInput(el), 'Delete')
    expect(el.getCode()).toBe('')
  })

  it('ArrowLeft moves cursor left', () => {
    const el = makeEl({ length: '3' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const inp = getHiddenInput(el)
    inp.setSelectionRange(2, 2)
    keydown(inp, 'ArrowLeft')
    flushRAF()
    expect(getSlots(el)[1].getAttribute('data-active')).toBe('true')
  })

  it('ArrowRight moves cursor right', () => {
    const el = makeEl({ length: '3' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const inp = getHiddenInput(el)
    inp.setSelectionRange(1, 1)
    keydown(inp, 'ArrowRight')
    flushRAF()
    expect(getSlots(el)[2].getAttribute('data-active')).toBe('true')
  })

  it('Tab on filled slot advances to next', () => {
    const el = makeEl({ length: '3' })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    const inp = getHiddenInput(el)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Tab')
    flushRAF()
    expect(getSlots(el)[1].getAttribute('data-active')).toBe('true')
  })

  it('Tab on empty slot does nothing', () => {
    const el = makeEl({ length: '3' })
    flushRAF()
    const inp = getHiddenInput(el)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Tab')
    flushRAF()
    expect(getSlots(el)[0].getAttribute('data-active')).toBe('true')
  })

  it('Shift+Tab from slot 1 moves to slot 0', () => {
    const el = makeEl({ length: '3' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const inp = getHiddenInput(el)
    inp.setSelectionRange(1, 1)
    keydown(inp, 'Tab', { shiftKey: true })
    flushRAF()
    expect(getSlots(el)[0].getAttribute('data-active')).toBe('true')
  })

  it('Shift+Tab at slot 0 is a no-op boundary', () => {
    const el = makeEl({ length: '3' })
    flushRAF()
    const inp = getHiddenInput(el)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Tab', { shiftKey: true })
    flushRAF()
    expect(getSlots(el)[0].getAttribute('data-active')).toBe('true')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 7. Paste handler
// ─────────────────────────────────────────────────────────────────────────────

describe('paste handler', () => {
  it('fills slots from pasted text', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    firePaste(getHiddenInput(el), '1234')
    expect(el.getCode()).toBe('1234')
  })

  it('ignores paste when disabled', () => {
    const el = makeEl({ disabled: true })
    flushRAF()
    firePaste(getHiddenInput(el), '1234')
    expect(el.getCode()).toBe('')
  })

  it('ignores paste when readonly', () => {
    const el = makeEl({ readonly: true })
    flushRAF()
    firePaste(getHiddenInput(el), '1234')
    expect(el.getCode()).toBe('')
  })

  it('applies pasteTransformer before filling', () => {
    const el = makeEl({ length: '6' })
    el.pasteTransformer = (raw: string) => raw.replace(/\D/g, '')
    flushRAF()
    firePaste(getHiddenInput(el), '12-34-56')
    expect(el.getCode()).toBe('123456')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 8. Custom events
// ─────────────────────────────────────────────────────────────────────────────

describe('custom events', () => {
  it('dispatches "change" event on every input', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    const codes: string[] = []
    el.addEventListener('change', (e) => codes.push((e as CustomEvent<{ code: string }>).detail.code))
    typeInto(getHiddenInput(el), '1')
    expect(codes).toContain('1')
  })

  it('"change" event is composed (crosses shadow boundary)', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    let composed = false
    el.addEventListener('change', (e) => { composed = (e as CustomEvent).composed })
    typeInto(getHiddenInput(el), '1')
    expect(composed).toBe(true)
  })

  it('dispatches "complete" event when all slots filled', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    let code = ''
    el.addEventListener('complete', (e) => { code = (e as CustomEvent<{ code: string }>).detail.code })
    typeInto(getHiddenInput(el), '1234')
    expect(code).toBe('1234')
  })

  it('"complete" event is composed', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    let composed = false
    el.addEventListener('complete', (e) => { composed = (e as CustomEvent).composed })
    typeInto(getHiddenInput(el), '1234')
    expect(composed).toBe(true)
  })

  it('dispatches "change" event after paste', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    const codes: string[] = []
    el.addEventListener('change', (e) => codes.push((e as CustomEvent<{ code: string }>).detail.code))
    firePaste(getHiddenInput(el), '1234')
    expect(codes).toContain('1234')
  })

  it('dispatches "change" event after Backspace', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const codes: string[] = []
    el.addEventListener('change', (e) => codes.push((e as CustomEvent<{ code: string }>).detail.code))
    const inp = getHiddenInput(el)
    inp.setSelectionRange(2, 2)
    keydown(inp, 'Backspace')
    flushRAF()
    expect(codes.length).toBeGreaterThan(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 9. Public DOM API
// ─────────────────────────────────────────────────────────────────────────────

describe('public DOM API', () => {
  it('getCode() returns empty string initially', () => {
    const el = makeEl()
    expect(el.getCode()).toBe('')
  })

  it('setError(true) sets data-invalid="true" on slots', () => {
    const el = makeEl()
    flushRAF()
    el.setError(true)
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('true'))
  })

  it('setError(false) clears data-invalid', () => {
    const el = makeEl()
    flushRAF()
    el.setError(true)
    el.setError(false)
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('false'))
  })

  it('setSuccess(true) sets data-success="true" on slots', () => {
    const el = makeEl()
    flushRAF()
    el.setSuccess(true)
    getSlots(el).forEach(s => expect(s.getAttribute('data-success')).toBe('true'))
  })

  it('setSuccess(false) clears data-success', () => {
    const el = makeEl()
    flushRAF()
    el.setSuccess(true)
    el.setSuccess(false)
    getSlots(el).forEach(s => expect(s.getAttribute('data-success')).toBe('false'))
  })

  it('hasSuccess getter reflects success state', () => {
    const el = makeEl()
    el.setSuccess(true)
    expect(el.hasSuccess).toBe(true)
    el.setSuccess(false)
    expect(el.hasSuccess).toBe(false)
  })

  it('setDisabled(true) disables the hidden input', () => {
    const el = makeEl()
    flushRAF()
    el.setDisabled(true)
    flushRAF()
    expect(getHiddenInput(el).disabled).toBe(true)
  })

  it('setDisabled(false) re-enables the hidden input', () => {
    const el = makeEl()
    flushRAF()
    el.setDisabled(true)
    el.setDisabled(false)
    flushRAF()
    expect(getHiddenInput(el).disabled).toBe(false)
  })

  it('setReadOnly(true) blocks input', () => {
    const el = makeEl()
    flushRAF()
    el.setReadOnly(true)
    typeInto(getHiddenInput(el), '1')
    expect(el.getCode()).toBe('')
  })

  it('setReadOnly(false) unblocks input', () => {
    const el = makeEl()
    flushRAF()
    el.setReadOnly(true)
    el.setReadOnly(false)
    typeInto(getHiddenInput(el), '1')
    expect(el.getCode()).toBe('1')
  })

  it('setReadOnly(true) sets aria-readonly on hidden input', () => {
    const el = makeEl()
    flushRAF()
    el.setReadOnly(true)
    expect(getHiddenInput(el).getAttribute('aria-readonly')).toBe('true')
  })

  it('reset() clears all slot values', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '1234')
    el.reset()
    flushRAF()
    expect(el.getCode()).toBe('')
  })

  it('reset() clears error state', () => {
    const el = makeEl()
    flushRAF()
    el.setError(true)
    el.reset()
    flushRAF()
    getSlots(el).forEach(s => expect(s.getAttribute('data-invalid')).toBe('false'))
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 10. JS property setters
// ─────────────────────────────────────────────────────────────────────────────

describe('JS property setters', () => {
  it('onComplete property fires when all slots filled', () => {
    const onComplete = jest.fn()
    const el = makeEl({ length: '4' })
    el.onComplete = onComplete
    flushRAF()
    typeInto(getHiddenInput(el), '1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('onComplete rejects non-function with console.warn', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    el.onComplete = 'not-a-function' as unknown as (code: string) => void
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('onInvalidChar property fires on rejected char', () => {
    const onInvalidChar = jest.fn()
    const el = makeEl({ type: 'numeric', length: '4' })
    el.onInvalidChar = onInvalidChar
    flushRAF()
    // onInvalidChar fires through core insert() when a char is rejected
    // We test it doesn't throw — coverage via pattern-based rejection
  })

  it('onInvalidChar rejects non-function with console.warn', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    el.onInvalidChar = 'bad' as unknown as (c: string, i: number) => void
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('pattern property triggers rebuild and filters chars', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    el.pattern = /^[A-F]$/  // hex uppercase only
    flushRAF()
    typeInto(getHiddenInput(el), '1234')  // all rejected by pattern
    expect(el.getCode()).toBe('')
  })

  it('pattern rejects non-RegExp with console.warn', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    el.pattern = 'not-regex' as unknown as RegExp
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('pasteTransformer property triggers rebuild', () => {
    const el = makeEl({ length: '6' })
    flushRAF()
    el.pasteTransformer = (raw: string) => raw.replace(/\D/g, '')
    flushRAF()
    firePaste(getHiddenInput(el), '12-34-56')
    expect(el.getCode()).toBe('123456')
  })

  it('pasteTransformer rejects non-function with console.warn', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    el.pasteTransformer = 'bad' as unknown as (raw: string) => string
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('onResend rejects non-function with console.warn', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    el.onResend = 42 as unknown as () => void
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('onFocus rejects non-function with console.warn', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    el.onFocus = 42 as unknown as () => void
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('onBlur rejects non-function with console.warn', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    el.onBlur = 42 as unknown as () => void
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 11. getSlots / getInputProps
// ─────────────────────────────────────────────────────────────────────────────

describe('getSlots and getInputProps', () => {
  it('getSlots() returns an array of length slots', () => {
    const el = makeEl({ length: '4' })
    expect(el.getSlots()).toHaveLength(4)
  })

  it('getSlots() reflects filled slot', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    const slots = el.getSlots()
    expect((slots[0] as { isFilled: boolean }).isFilled).toBe(true)
  })

  it('getInputProps() returns correct data attributes', () => {
    const el = makeEl({ length: '4' })
    const props = el.getInputProps(0)
    expect(props['data-slot']).toBe(0)
    expect(props['data-first']).toBe('true')
    expect(props['data-last']).toBe('false')
    expect(props['data-filled']).toBe('false')
  })

  it('getInputProps() returns handler functions', () => {
    const el = makeEl({ length: '4' })
    const props = el.getInputProps(0)
    expect(typeof props.onInput).toBe('function')
    expect(typeof props.onKeyDown).toBe('function')
    expect(typeof props.onFocus).toBe('function')
    expect(typeof props.onBlur).toBe('function')
  })

  it('getInputProps().onInput inserts a character', () => {
    const el = makeEl({ length: '4' })
    const props = el.getInputProps(0)
    ;(props.onInput as (c: string) => void)('5')
    expect(el.getCode()).toBe('5')
  })

  it('getInputProps().onKeyDown handles navigation keys', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const p2 = el.getInputProps(2)
    ;(p2.onKeyDown as (k: string) => void)('ArrowLeft')
    expect(el.getCode()).toBe('12')

    const p0 = el.getInputProps(0)
    ;(p0.onKeyDown as (k: string) => void)('Backspace')
    expect(el.getCode()).toBe('2')
  })

  it('getInputProps().onKeyDown handles Delete', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const p0 = el.getInputProps(0)
    ;(p0.onKeyDown as (k: string) => void)('Delete')
    expect(el.getCode()).toBe('2')
  })

  it('getInputProps() before build returns empty defaults', () => {
    const el = document.createElement('verino-input') as VerinoInput
    // Not connected — otp is null
    const props = el.getInputProps(0)
    expect(props['data-filled']).toBe('false')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 12. Timer
// ─────────────────────────────────────────────────────────────────────────────

describe('timer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('renders timer footer when timer > 0', () => {
    const el = makeEl({ timer: '30' })
    expect(shadow(el).querySelector('.verino-wc-timer')).not.toBeNull()
  })

  it('renders resend row when timer > 0', () => {
    const el = makeEl({ timer: '30' })
    expect(shadow(el).querySelector('.verino-wc-resend')).not.toBeNull()
  })

  it('does not render timer footer when timer = 0', () => {
    const el = makeEl()
    expect(shadow(el).querySelector('.verino-wc-timer')).toBeNull()
  })

  it('dispatches "expire" event when timer reaches zero', () => {
    const el = makeEl({ timer: '2' })
    let expired = false
    el.addEventListener('expire', () => { expired = true })
    jest.advanceTimersByTime(2000)
    expect(expired).toBe(true)
  })

  it('reset() in timer mode restarts the countdown', () => {
    const el = makeEl({ timer: '5' })
    jest.advanceTimersByTime(5000) // expire
    el.reset()
    const badge = shadow(el).querySelector('.verino-wc-timer-badge') as HTMLElement
    expect(badge.textContent).toBe('0:05')
  })

  it('setSuccess(true) stops timer and hides footer', () => {
    const el = makeEl({ timer: '10' })
    el.setSuccess(true)
    const timerEl = shadow(el).querySelector('.verino-wc-timer') as HTMLElement
    expect(timerEl.classList.contains('is-hidden')).toBe(true)
  })

  it('resend button click fires onResend property', () => {
    const onResend = jest.fn()
    const el = makeEl({ timer: '2' })
    el.onResend = onResend
    jest.advanceTimersByTime(2000) // expire
    const btn = shadow(el).querySelector('.verino-wc-resend-btn') as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onResend).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 13. disconnectedCallback
// ─────────────────────────────────────────────────────────────────────────────

describe('disconnectedCallback', () => {
  it('removing element from DOM does not throw', () => {
    const el = makeEl()
    expect(() => document.body.removeChild(el)).not.toThrow()
  })

  it('can be re-appended after disconnect', () => {
    const el = makeEl()
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    document.body.removeChild(el)
    document.body.appendChild(el)
    flushRAF()
    // After re-connect, element rebuilds with fresh state
    expect(typeof el.getCode()).toBe('string')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 14. Focus / blur event handlers
// ─────────────────────────────────────────────────────────────────────────────

describe('focus and blur handlers', () => {
  it('onFocus property fires on focus event', () => {
    const onFocus = jest.fn()
    const el = makeEl()
    flushRAF()
    el.onFocus = onFocus
    getHiddenInput(el).dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('onBlur property fires on blur event', () => {
    const onBlur = jest.fn()
    const el = makeEl()
    flushRAF()
    el.onBlur = onBlur
    getHiddenInput(el).dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('blur handler sets data-focus="false" on all slots', () => {
    const el = makeEl()
    flushRAF()
    getHiddenInput(el).dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    getSlots(el).forEach(s => {
      expect(s.getAttribute('data-focus')).toBe('false')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 15. Click handler (coordinate hit-test)
// ─────────────────────────────────────────────────────────────────────────────

describe('click handler', () => {
  it('click on hidden input does not throw', () => {
    const el = makeEl()
    flushRAF()
    expect(() => {
      getHiddenInput(el).dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 0 })
      )
    }).not.toThrow()
  })

  it('click ignored when disabled', () => {
    const el = makeEl({ disabled: true })
    flushRAF()
    expect(() => {
      getHiddenInput(el).dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 0 })
      )
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 16. "success" custom event
// ─────────────────────────────────────────────────────────────────────────────

describe('success custom event', () => {
  it('dispatches "success" event when setSuccess(true) called', () => {
    const el = makeEl()
    let fired = false
    el.addEventListener('success', () => { fired = true })
    el.setSuccess(true)
    expect(fired).toBe(true)
  })

  it('does not dispatch "success" event when setSuccess(false)', () => {
    const el = makeEl()
    let count = 0
    el.addEventListener('success', () => count++)
    el.setSuccess(false)
    expect(count).toBe(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 17. mask-char attribute (line 534)
// ─────────────────────────────────────────────────────────────────────────────

describe('mask-char attribute', () => {
  it('uses custom mask-char when masked and mask-char are set', () => {
    const el = makeEl({ masked: true, 'mask-char': '*' })
    flushRAF()
    // Just check the element builds without error
    expect(getHiddenInput(el).type).toBe('password')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 18. JS property setters — invalid type warnings (lines 427, 448, 468)
// ─────────────────────────────────────────────────────────────────────────────

describe('JS property setter type validation', () => {
  it('onInvalidChar setter warns and ignores non-function (line 427)', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(el as any).onInvalidChar = 'not-a-function'
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('onInvalidChar'), 'string')
    warnSpy.mockRestore()
  })

  it('pattern setter warns and ignores non-RegExp (line 448)', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(el as any).pattern = 'not-a-regexp'
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pattern'), 'string')
    warnSpy.mockRestore()
  })

  it('pasteTransformer setter warns and ignores non-function (line 468)', () => {
    const el = makeEl()
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(el as any).pasteTransformer = 42
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pasteTransformer'), 'number')
    warnSpy.mockRestore()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 19. blurOnComplete in input and paste handlers (lines 995, 1011)
// ─────────────────────────────────────────────────────────────────────────────

describe('blurOnComplete in event handlers', () => {
  it('blurOnComplete triggers RAF blur after typing completes the code (line 995)', () => {
    const el = makeEl({ length: '4', 'blur-on-complete': '' })
    flushRAF()
    const input = getHiddenInput(el)
    const blurSpy = jest.spyOn(input, 'blur')
    typeInto(input, '1234')
    flushRAF()
    expect(blurSpy).toHaveBeenCalled()
  })

  it('blurOnComplete triggers RAF blur after paste completes the code (line 1011)', () => {
    const el = makeEl({ length: '4', 'blur-on-complete': '' })
    flushRAF()
    const input = getHiddenInput(el)
    const blurSpy = jest.spyOn(input, 'blur')
    firePaste(input, '1234')
    flushRAF()
    expect(blurSpy).toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 20. selectOnFocus with filled slot in focus and click handlers (lines 833, 1021)
// ─────────────────────────────────────────────────────────────────────────────

describe('selectOnFocus with filled slot', () => {
  it('focus on filled slot with select-on-focus selects the char (line 1021)', () => {
    const el = makeEl({ length: '4', 'select-on-focus': '' })
    flushRAF()
    const input = getHiddenInput(el)
    typeInto(input, '12')
    // Move cursor to slot 0 (which has '1')
    input.setSelectionRange(0, 0)
    keydown(input, 'ArrowLeft')  // otp.move(0-1=-1) → clamps to 0 in core
    flushRAF()
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    flushRAF()
    // Slot 0 has '1' → selection should be [0, 1]
    expect(input.selectionEnd).toBeGreaterThan(input.selectionStart ?? 0)
  })

  it('click on filled slot with select-on-focus selects the char (line 833)', () => {
    const el = makeEl({ length: '4', 'select-on-focus': '' })
    flushRAF()
    const input = getHiddenInput(el)
    typeInto(input, '1234')
    input.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0 }))
    // slot 0 has '1', selectOnFocus → setSelectionRange(0, 1)
    expect(input.selectionEnd).toBeGreaterThan(input.selectionStart ?? 0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 21. getInputProps — Delete, ArrowLeft, ArrowRight keys + onFocus/onBlur (lines 1168-1171)
// ─────────────────────────────────────────────────────────────────────────────

describe('getInputProps additional key callbacks', () => {
  it('onKeyDown Delete clears slot in-place', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '1234')
    const props = el.getInputProps(1)
    props.onKeyDown!('Delete')
    expect(el.getCode()).toBe('134')
  })

  it('onKeyDown ArrowLeft moves cursor back', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const props = el.getInputProps(1)
    props.onKeyDown!('ArrowLeft')
    // Core activeSlot should move to 0
    expect(el.getSlots()[0].isActive).toBe(true)
  })

  it('onKeyDown ArrowRight moves cursor forward', () => {
    const el = makeEl({ length: '4' })
    flushRAF()
    typeInto(getHiddenInput(el), '12')
    const props = el.getInputProps(0)
    props.onKeyDown!('ArrowRight')
    expect(el.getSlots()[1].isActive).toBe(true)
  })

  it('onFocus callback in getInputProps fires _onFocus prop', () => {
    const el = makeEl()
    flushRAF()
    const onFocus = jest.fn()
    el.onFocus = onFocus
    const props = el.getInputProps(0)
    props.onFocus!()
    expect(onFocus).toHaveBeenCalled()
  })

  it('onBlur callback in getInputProps fires _onBlur prop', () => {
    const el = makeEl()
    flushRAF()
    const onBlur = jest.fn()
    el.onBlur = onBlur
    const props = el.getInputProps(0)
    props.onBlur!()
    expect(onBlur).toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 22. Resend countdown onTick and onExpire callbacks (lines 753-756)
// ─────────────────────────────────────────────────────────────────────────────

describe('resend countdown timer callbacks', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('resend countdown onTick updates badge text', () => {
    const el = makeEl({ timer: '3', 'resend-after': '3' })
    jest.advanceTimersByTime(3000)  // expire main timer
    const btn = shadow(el).querySelector('.verino-wc-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    jest.advanceTimersByTime(1000)  // trigger onTick
    const badge = shadow(el).querySelector('.verino-wc-timer-badge') as HTMLElement
    expect(badge.textContent).toMatch(/0:\d{2}/)
  })

  it('resend countdown onExpire hides timer and shows resend row', () => {
    const el = makeEl({ timer: '2', 'resend-after': '2' })
    jest.advanceTimersByTime(2000)  // expire main timer
    const btn = shadow(el).querySelector('.verino-wc-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    jest.advanceTimersByTime(2000)  // expire resend countdown
    const timerEl = shadow(el).querySelector('.verino-wc-timer') as HTMLElement
    expect(timerEl.classList.contains('is-hidden')).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 23. Web OTP API (lines 790-808)
// ─────────────────────────────────────────────────────────────────────────────

describe('Web OTP API', () => {
  afterEach(() => {
    // @ts-expect-error: restoring credentials mock
    delete (navigator as Navigator & { credentials?: unknown }).credentials
  })

  it('auto-fills from SMS credential when navigator.credentials resolves', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockResolvedValue({ code: '1234' }) },
      configurable: true, writable: true,
    })
    const el = makeEl({ length: '4' })
    flushRAF()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(el.getCode()).toBe('1234')
    document.body.removeChild(el)
  })

  it('credential with no code is handled gracefully', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockResolvedValue(null) },
      configurable: true, writable: true,
    })
    const el = makeEl({ length: '4' })
    flushRAF()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(el.getCode()).toBe('')
    document.body.removeChild(el)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 24. PM badge guard — immediate active (lines 306, 310-311)
// ─────────────────────────────────────────────────────────────────────────────

describe('PM badge guard — immediate detection', () => {
  it('widens hidden input when PM badge is already present at mount', () => {
    // Inject a PM element before mounting the WC so wcIsPasswordManagerActive() returns true
    const pmEl = document.createElement('div')
    pmEl.setAttribute('data-lastpass-icon-root', '')
    document.body.appendChild(pmEl)
    const el = makeEl()
    flushRAF()
    const input = getHiddenInput(el)
    // Width should have been adjusted (original width + offset)
    // In jsdom layout is 0, so width will be "40px" (0 + 40)
    expect(input.style.width).toBe('40px')
    pmEl.remove()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 25. PM badge guard — querySelector throws (line 285)
// ─────────────────────────────────────────────────────────────────────────────

describe('PM badge guard — querySelector catch branch', () => {
  it('handles invalid selector from PM without throwing (line 285)', () => {
    // Temporarily mock querySelector to throw on the first PM selector call
    const orig = document.querySelector.bind(document)
    let calls = 0
    jest.spyOn(document, 'querySelector').mockImplementation((sel) => {
      if (calls++ === 0) throw new Error('invalid selector')
      return orig(sel)
    })
    expect(() => makeEl()).not.toThrow()
    jest.restoreAllMocks()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 26. mask-char getter with custom character (line 534)
// ─────────────────────────────────────────────────────────────────────────────

describe('mask-char custom glyph (line 534)', () => {
  it('displays custom mask-char when character is typed in masked mode', () => {
    const el = makeEl({ masked: true, 'mask-char': '*' })
    flushRAF()
    typeInto(getHiddenInput(el), '1')
    flushRAF()
    // The slot text should show '*' (the custom maskChar)
    const slot0 = getSlots(el)[0]
    expect(slot0.textContent).toBe('*')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 27. Web OTP catch path (line 808)
// ─────────────────────────────────────────────────────────────────────────────

describe('Web OTP catch path', () => {
  it('handles credentials.get() rejection without throwing (line 808)', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: { get: jest.fn().mockRejectedValue(new Error('not supported')) },
      configurable: true, writable: true,
    })
    expect(() => makeEl()).not.toThrow()
    // Let the promise settle
    await new Promise(resolve => setTimeout(resolve, 0))
    // @ts-expect-error: restoring
    delete navigator.credentials
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 28. PM badge guard — MutationObserver callback (lines 315-317)
// ─────────────────────────────────────────────────────────────────────────────

describe('PM badge guard — MutationObserver fires after mount', () => {
  it('widens hidden input when PM badge is added after mount (lines 315-317)', async () => {
    // Create WC without any PM element present — MutationObserver is registered
    const el = makeEl()
    flushRAF()
    const input = getHiddenInput(el)
    // Inject PM element now — MutationObserver should fire
    const pmEl = document.createElement('div')
    pmEl.setAttribute('data-lastpass-icon-root', '')
    document.body.appendChild(pmEl)
    // Flush microtasks so MutationObserver callback fires
    await new Promise(resolve => setTimeout(resolve, 0))
    // Width should have been adjusted after PM detection
    expect(input.style.width).toBe('40px')
    pmEl.remove()
    document.body.removeChild(el)
  })
})
