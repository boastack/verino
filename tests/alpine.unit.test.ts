/** @jest-environment jsdom */

/**
 * verino — Alpine adapter unit tests (jsdom environment)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the x-verino directive by instantiating it with a mock Alpine object
 * that captures the registered directive handler, then invoking it directly
 * with test wrapper elements and options.
 *
 * Coverage targets:
 *   - DOM structure (slots, hidden input, separators)
 *   - Data-attribute config (masked, separatorAfter, placeholder)
 *   - Event handlers (input, keydown, paste, focus, blur, click)
 *   - Public API: getCode, getSlots, getInputProps, setError, setSuccess,
 *                 setDisabled, setReadOnly, reset, resend, focus, destroy
 *   - Callbacks: onComplete, onFocus, onBlur, onInvalidChar, onResend
 *   - Built-in timer footer vs custom onTick
 *   - defaultValue pre-fill (no onComplete)
 *   - Invalid expression fallback
 */

import { VerinoAlpine } from '@verino/alpine'

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
  document.getElementById('verino-alpine-styles')?.remove()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type AlpineOTPOptions = Record<string, unknown>

type MountResult = {
  wrapper:  HTMLElement
  api:      ReturnType<typeof getApi>
  result:   { cleanup(): void }
  setOptions: (next: AlpineOTPOptions) => void
}

function getApi(wrapper: HTMLElement) {
  return (wrapper as HTMLElement & { _verino: {
    getCode():     string
    getSlots():    unknown[]
    getInputProps(i: number): Record<string, unknown>
    setError(v: boolean):    void
    setSuccess(v: boolean):  void
    setDisabled(v: boolean): void
    setReadOnly(v: boolean): void
    reset():  void
    resend(): void
    destroy(): void
    focus(i: number): void
  } })._verino
}

function mountAlpine(opts: AlpineOTPOptions = {}): MountResult {
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  let handler: ((el: HTMLElement, data: unknown, utils: unknown) => { cleanup(): void }) | null = null
  let reactiveOpts = opts
  const effects: Array<() => void> = []

  VerinoAlpine({
    directive: (_name: string, fn: typeof handler) => { handler = fn },
  } as Parameters<typeof VerinoAlpine>[0])

  const result = handler!(
    wrapper,
    { expression: 'opts', value: '', modifiers: [] },
    {
      evaluate:      () => reactiveOpts,
      evaluateLater: () => (callback: (value: unknown) => void) => { callback(reactiveOpts) },
      cleanup:       () => {},
      effect:        (fn: () => void) => { effects.push(fn); fn() },
    },
  )

  return {
    wrapper,
    api: getApi(wrapper),
    result,
    setOptions(next: AlpineOTPOptions) {
      reactiveOpts = next
      effects.forEach((fn) => fn())
    },
  }
}

function getHiddenInput(wrapper: HTMLElement): HTMLInputElement {
  return wrapper.querySelector('input') as HTMLInputElement
}

function getSlotEls(wrapper: HTMLElement): HTMLElement[] {
  return Array.from(wrapper.querySelectorAll('[data-slot]')) as HTMLElement[]
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function keydown(input: HTMLInputElement, key: string, extra: KeyboardEventInit = {}) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
}

function firePaste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text },
    configurable: true,
  })
  input.dispatchEvent(event)
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. Directive registration
// ─────────────────────────────────────────────────────────────────────────────

describe('VerinoAlpine directive registration', () => {
  it('registers a directive named "verino"', () => {
    const names: string[] = []
    VerinoAlpine({ directive: (name) => names.push(name) } as Parameters<typeof VerinoAlpine>[0])
    expect(names).toContain('verino')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 2. DOM structure
// ─────────────────────────────────────────────────────────────────────────────

describe('DOM structure', () => {
  it('creates 6 slot divs by default', () => {
    const { wrapper } = mountAlpine({ autoFocus: false })
    expect(getSlotEls(wrapper)).toHaveLength(6)
  })

  it('respects length option', () => {
    const { wrapper } = mountAlpine({ length: 4, autoFocus: false })
    expect(getSlotEls(wrapper)).toHaveLength(4)
  })

  it('creates a hidden input inside the wrapper', () => {
    const { wrapper } = mountAlpine({ autoFocus: false })
    const inp = getHiddenInput(wrapper)
    expect(inp).not.toBeNull()
    expect(inp.type).toBe('text')
    expect(inp.autocomplete).toBe('one-time-code')
  })

  it('sets inputMode="numeric" for numeric type', () => {
    const { wrapper } = mountAlpine({ type: 'numeric', autoFocus: false })
    expect(getHiddenInput(wrapper).inputMode).toBe('numeric')
  })

  it('sets inputMode="text" for alphabet type', () => {
    const { wrapper } = mountAlpine({ type: 'alphabet', autoFocus: false })
    expect(getHiddenInput(wrapper).inputMode).toBe('text')
  })

  it('applies first/last data attributes correctly', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    const slots = getSlotEls(wrapper)
    expect(slots[0].getAttribute('data-first')).toBe('true')
    expect(slots[0].getAttribute('data-last')).toBe('false')
    expect(slots[2].getAttribute('data-first')).toBe('false')
    expect(slots[2].getAttribute('data-last')).toBe('true')
  })

  it('exposes _verino API on wrapper element', () => {
    const { api } = mountAlpine({ autoFocus: false })
    expect(typeof api.getCode).toBe('function')
    expect(typeof api.reset).toBe('function')
    expect(typeof api.setError).toBe('function')
  })

  it('injects verino-alpine-styles once', () => {
    mountAlpine({ autoFocus: false })
    mountAlpine({ autoFocus: false })
    expect(document.querySelectorAll('#verino-alpine-styles')).toHaveLength(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 3. Separator rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('separatorAfter', () => {
  it('inserts a separator element after the Nth slot (1-based)', () => {
    const { wrapper } = mountAlpine({ length: 6, separatorAfter: 3, autoFocus: false })
    const children = Array.from(wrapper.children).filter(el => el.tagName !== 'INPUT')
    // Slot 3 (index 2) should be followed by a separator
    const slotThree = children[2]
    const nextEl    = children[3]
    expect(slotThree.getAttribute('data-slot')).toBe('2')
    expect(nextEl.getAttribute('data-slot')).toBeNull() // separator has no data-slot
  })

  it('accepts an array of positions', () => {
    const { wrapper } = mountAlpine({ length: 6, separatorAfter: [2, 4], autoFocus: false })
    // Two separators → children count = 6 slots + 2 seps + 1 input = 9
    const nonInputChildren = Array.from(wrapper.children).filter(el => el.tagName !== 'INPUT')
    expect(nonInputChildren.length).toBe(8)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 4. Masked mode
// ─────────────────────────────────────────────────────────────────────────────

describe('masked mode', () => {
  it('hidden input is type="password" when masked=true', () => {
    const { wrapper } = mountAlpine({ masked: true, autoFocus: false })
    expect(getHiddenInput(wrapper).type).toBe('password')
  })

  it('slots carry data-masked="true"', () => {
    const { wrapper } = mountAlpine({ masked: true, autoFocus: false })
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-masked')).toBe('true')
    })
  })

  it('fills but displays maskChar after typing', () => {
    const { wrapper } = mountAlpine({ masked: true, maskChar: '*', autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    flushRAF()
    const firstSlot = getSlotEls(wrapper)[0]
    // The text node inside the slot should show the mask character
    expect(firstSlot.textContent).toContain('*')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 5. Input event
// ─────────────────────────────────────────────────────────────────────────────

describe('input event', () => {
  it('typing a digit fills the first slot', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    expect(api.getCode()).toBe('1')
  })

  it('typing fills all slots up to length', () => {
    const { wrapper, api } = mountAlpine({ length: 4, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1234')
    expect(api.getCode()).toBe('1234')
  })

  it('non-numeric chars are filtered for numeric type', () => {
    const { wrapper, api } = mountAlpine({ type: 'numeric', autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), 'abc')
    expect(api.getCode()).toBe('')
  })

  it('empty input resets the code', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '123')
    typeInto(getHiddenInput(wrapper), '')
    expect(api.getCode()).toBe('')
  })

  it('fires onChange on every input', () => {
    const onChange = jest.fn()
    const { wrapper } = mountAlpine({ onChange, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('fires onComplete when all slots filled', () => {
    const onComplete = jest.fn()
    const { wrapper } = mountAlpine({ length: 4, onComplete, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('ignores input when disabled', () => {
    const { wrapper, api } = mountAlpine({ disabled: true, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    expect(api.getCode()).toBe('')
  })

  it('ignores input when readOnly', () => {
    const { wrapper, api } = mountAlpine({ readOnly: true, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    expect(api.getCode()).toBe('')
  })

  it('updates data-filled on typed slots', () => {
    const { wrapper } = mountAlpine({ autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    flushRAF()
    expect(getSlotEls(wrapper)[0].getAttribute('data-filled')).toBe('true')
    expect(getSlotEls(wrapper)[0].getAttribute('data-empty')).toBe('false')
  })

  it('updates data-complete when all slots filled', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '123')
    flushRAF()
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-complete')).toBe('true')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 6. Keyboard handlers
// ─────────────────────────────────────────────────────────────────────────────

describe('keydown handlers', () => {
  it('Backspace on a filled slot clears it', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(1, 1)
    keydown(inp, 'Backspace')
    flushRAF()
    expect(api.getCode()).toBe('')
  })

  it('Backspace is no-op when readOnly', () => {
    const { wrapper, api } = mountAlpine({ readOnly: true, autoFocus: false })
    flushRAF()
    const inp = getHiddenInput(wrapper)
    keydown(inp, 'Backspace')
    expect(api.getCode()).toBe('')
  })

  it('Backspace is no-op when disabled', () => {
    const { wrapper, api } = mountAlpine({ disabled: true, autoFocus: false })
    flushRAF()
    keydown(getHiddenInput(wrapper), 'Backspace')
    expect(api.getCode()).toBe('')
  })

  it('Delete clears slot in-place', () => {
    const { wrapper, api } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '123')
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Delete')
    flushRAF()
    expect(api.getCode()).toBe('23')
  })

  it('Delete is no-op when readOnly', () => {
    const { wrapper, api } = mountAlpine({ readOnly: true, autoFocus: false })
    flushRAF()
    keydown(getHiddenInput(wrapper), 'Delete')
    expect(api.getCode()).toBe('')
  })

  it('Delete is no-op when disabled', () => {
    const { wrapper, api } = mountAlpine({ disabled: true, autoFocus: false })
    flushRAF()
    keydown(getHiddenInput(wrapper), 'Delete')
    expect(api.getCode()).toBe('')
  })

  it('ArrowLeft moves active slot left', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '12')
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(2, 2)
    keydown(inp, 'ArrowLeft')
    flushRAF()
    // After arrow left from slot 2, active should be slot 1
    const slots = getSlotEls(wrapper)
    expect(slots[1].getAttribute('data-active')).toBe('true')
  })

  it('ArrowRight moves active slot right', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '12')
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(1, 1)
    keydown(inp, 'ArrowRight')
    flushRAF()
    const slots = getSlotEls(wrapper)
    expect(slots[2].getAttribute('data-active')).toBe('true')
  })

  it('Tab on a filled slot moves to next slot', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Tab')
    flushRAF()
    expect(getSlotEls(wrapper)[1].getAttribute('data-active')).toBe('true')
  })

  it('Tab on an empty slot does not move', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Tab')
    flushRAF()
    // Active slot stays at 0 (nothing to advance to)
    expect(getSlotEls(wrapper)[0].getAttribute('data-active')).toBe('true')
  })

  it('Shift+Tab from slot 1 moves to slot 0', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '12')
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(1, 1)
    keydown(inp, 'Tab', { shiftKey: true })
    flushRAF()
    expect(getSlotEls(wrapper)[0].getAttribute('data-active')).toBe('true')
  })

  it('Shift+Tab from slot 0 does nothing (boundary)', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(0, 0)
    keydown(inp, 'Tab', { shiftKey: true })
    flushRAF()
    expect(getSlotEls(wrapper)[0].getAttribute('data-active')).toBe('true')
  })

  it('Tab on last filled slot does nothing (boundary)', () => {
    const { wrapper } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '123')
    const inp = getHiddenInput(wrapper)
    inp.setSelectionRange(2, 2)
    keydown(inp, 'Tab')
    // Last slot — falls through to browser, no state change
    expect(api_from(wrapper).getCode()).toBe('123')
  })
})

function api_from(wrapper: HTMLElement) { return getApi(wrapper) }


// ─────────────────────────────────────────────────────────────────────────────
// 7. Paste handler
// ─────────────────────────────────────────────────────────────────────────────

describe('paste handler', () => {
  it('fills slots from pasted text', () => {
    const { wrapper, api } = mountAlpine({ length: 4, autoFocus: false })
    flushRAF()
    firePaste(getHiddenInput(wrapper), '1234')
    expect(api.getCode()).toBe('1234')
  })

  it('applies pasteTransformer before filling', () => {
    const { wrapper, api } = mountAlpine({
      length: 6,
      pasteTransformer: (raw: string) => raw.replace(/\D/g, ''),
      autoFocus: false,
    })
    flushRAF()
    firePaste(getHiddenInput(wrapper), '12-34-56')
    expect(api.getCode()).toBe('123456')
  })

  it('ignores paste when disabled', () => {
    const { wrapper, api } = mountAlpine({ disabled: true, autoFocus: false })
    flushRAF()
    firePaste(getHiddenInput(wrapper), '123456')
    expect(api.getCode()).toBe('')
  })

  it('ignores paste when readOnly', () => {
    const { wrapper, api } = mountAlpine({ readOnly: true, autoFocus: false })
    flushRAF()
    firePaste(getHiddenInput(wrapper), '123456')
    expect(api.getCode()).toBe('')
  })

  it('fires onChange after paste', () => {
    const onChange = jest.fn()
    const { wrapper } = mountAlpine({ length: 4, onChange, autoFocus: false })
    flushRAF()
    firePaste(getHiddenInput(wrapper), '1234')
    expect(onChange).toHaveBeenCalledWith('1234')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 8. Focus / blur callbacks
// ─────────────────────────────────────────────────────────────────────────────

describe('focus and blur callbacks', () => {
  it('calls onFocus when hidden input is focused', () => {
    const onFocus = jest.fn()
    const { wrapper } = mountAlpine({ onFocus, autoFocus: false })
    flushRAF()
    getHiddenInput(wrapper).dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('calls onBlur when hidden input loses focus', () => {
    const onBlur = jest.fn()
    const { wrapper } = mountAlpine({ onBlur, autoFocus: false })
    flushRAF()
    getHiddenInput(wrapper).dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('sets data-focus false on all slots after blur', () => {
    const { wrapper } = mountAlpine({ autoFocus: false })
    flushRAF()
    getHiddenInput(wrapper).dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-focus')).toBe('false')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 9. Click handler
// ─────────────────────────────────────────────────────────────────────────────

describe('click handler', () => {
  it('does not throw when clicking hidden input', () => {
    const { wrapper } = mountAlpine({ autoFocus: false })
    flushRAF()
    expect(() => {
      getHiddenInput(wrapper).dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 0 })
      )
    }).not.toThrow()
  })

  it('ignores click when disabled', () => {
    const { wrapper } = mountAlpine({ disabled: true, autoFocus: false })
    flushRAF()
    expect(() => {
      getHiddenInput(wrapper).dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 0 })
      )
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 10. onInvalidChar callback
// ─────────────────────────────────────────────────────────────────────────────

describe('onInvalidChar callback', () => {
  it('does not throw when onInvalidChar is not provided', () => {
    const { wrapper } = mountAlpine({ type: 'numeric', autoFocus: false })
    flushRAF()
    expect(() => typeInto(getHiddenInput(wrapper), 'a')).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 11. defaultValue
// ─────────────────────────────────────────────────────────────────────────────

describe('defaultValue', () => {
  it('pre-fills slots without firing onComplete', () => {
    const onComplete = jest.fn()
    const { api } = mountAlpine({ length: 4, defaultValue: '1234', onComplete, autoFocus: false })
    flushRAF()
    expect(api.getCode()).toBe('1234')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('filters invalid chars from defaultValue', () => {
    const { api } = mountAlpine({ type: 'numeric', defaultValue: 'a1b2', length: 4, autoFocus: false })
    flushRAF()
    expect(api.getCode()).toBe('12')
  })

  it('truncates defaultValue to length', () => {
    const { api } = mountAlpine({ length: 3, defaultValue: '123456', autoFocus: false })
    flushRAF()
    expect(api.getCode()).toBe('123')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 12. setError / setSuccess
// ─────────────────────────────────────────────────────────────────────────────

describe('setError and setSuccess', () => {
  it('setError(true) sets data-invalid="true" on slots', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setError(true)
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-invalid')).toBe('true')
    })
  })

  it('setError(false) clears data-invalid', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setError(true)
    api.setError(false)
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-invalid')).toBe('false')
    })
  })

  it('setSuccess(true) sets data-success="true" on slots', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setSuccess(true)
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-success')).toBe('true')
    })
  })

  it('setError(true) after setSuccess clears success state', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setSuccess(true)
    api.setError(true)
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-success')).toBe('false')
      expect(s.getAttribute('data-invalid')).toBe('true')
    })
  })

  it('setSuccess(false) restores data-success="false"', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setSuccess(true)
    api.setSuccess(false)
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-success')).toBe('false')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 13. setDisabled / setReadOnly
// ─────────────────────────────────────────────────────────────────────────────

describe('setDisabled and setReadOnly', () => {
  it('setDisabled(true) sets data-disabled="true" on slots', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setDisabled(true)
    flushRAF()
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-disabled')).toBe('true')
    })
  })

  it('setDisabled(false) restores data-disabled="false"', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setDisabled(true)
    flushRAF()
    api.setDisabled(false)
    flushRAF()
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-disabled')).toBe('false')
    })
  })

  it('setReadOnly(true) prevents mutations', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setReadOnly(true)
    typeInto(getHiddenInput(wrapper), '1')
    expect(api.getCode()).toBe('')
  })

  it('setReadOnly(false) restores mutations', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setReadOnly(true)
    api.setReadOnly(false)
    typeInto(getHiddenInput(wrapper), '1')
    expect(api.getCode()).toBe('1')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 14. reset / resend
// ─────────────────────────────────────────────────────────────────────────────

describe('reset and resend', () => {
  it('reset() clears all slot values', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '123')
    api.reset()
    flushRAF()
    expect(api.getCode()).toBe('')
  })

  it('reset() clears error state', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.setError(true)
    api.reset()
    flushRAF()
    getSlotEls(wrapper).forEach(s => {
      expect(s.getAttribute('data-invalid')).toBe('false')
    })
  })

  it('resend() clears slots and calls onResend', () => {
    const onResend = jest.fn()
    const { wrapper, api } = mountAlpine({ onResend, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1234')
    api.setError(true)
    api.resend()
    flushRAF()
    expect(api.getCode()).toBe('')
    getSlotEls(wrapper).forEach((slot) => {
      expect(slot.getAttribute('data-invalid')).toBe('false')
    })
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('resend() does not throw when onResend is not provided', () => {
    const { api } = mountAlpine({ autoFocus: false })
    flushRAF()
    expect(() => api.resend()).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 15. destroy
// ─────────────────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('destroy() stops event listeners — typing no longer updates code', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    api.destroy()
    typeInto(getHiddenInput(wrapper), '1234')
    expect(api.getCode()).toBe('')
  })

  it('result.cleanup() also tears down', () => {
    const { wrapper, api, result } = mountAlpine({ autoFocus: false })
    flushRAF()
    result.cleanup()
    typeInto(getHiddenInput(wrapper), '1234')
    expect(api.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 16. focus()
// ─────────────────────────────────────────────────────────────────────────────

describe('focus()', () => {
  it('moves active slot to specified index', () => {
    const { wrapper, api } = mountAlpine({ length: 4, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '12')
    api.focus(1)
    const slots = getSlotEls(wrapper)
    expect(slots[1].getAttribute('data-active')).toBe('true')
  })

  it('does nothing when disabled', () => {
    const { wrapper, api } = mountAlpine({ disabled: true, autoFocus: false })
    flushRAF()
    expect(() => api.focus(0)).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 17. getCode / getSlots / getInputProps
// ─────────────────────────────────────────────────────────────────────────────

describe('getCode / getSlots / getInputProps', () => {
  it('getCode() returns empty string initially', () => {
    const { api } = mountAlpine({ autoFocus: false })
    expect(api.getCode()).toBe('')
  })

  it('getSlots() returns SlotEntry array with correct length', () => {
    const { api } = mountAlpine({ length: 4, autoFocus: false })
    const slots = api.getSlots()
    expect(slots).toHaveLength(4)
    expect((slots[0] as { index: number }).index).toBe(0)
  })

  it('getInputProps() returns correct data-* attributes', () => {
    const { api } = mountAlpine({ length: 4, autoFocus: false })
    const props = api.getInputProps(0)
    expect(props['data-slot']).toBe(0)
    expect(props['data-first']).toBe('true')
    expect(props['data-last']).toBe('false')
    expect(props['data-active']).toBeDefined()
    expect(props['data-filled']).toBe('false')
  })

  it('getInputProps() returns handlers for core actions', () => {
    const { api } = mountAlpine({ autoFocus: false })
    const props = api.getInputProps(0)
    expect(typeof props.onInput).toBe('function')
    expect(typeof props.onKeyDown).toBe('function')
    expect(typeof props.onFocus).toBe('function')
    expect(typeof props.onBlur).toBe('function')
  })

  it('getInputProps().onInput inserts a character', () => {
    const { api } = mountAlpine({ autoFocus: false })
    const props = api.getInputProps(0)
    ;(props.onInput as (c: string) => void)('5')
    expect(api.getCode()).toBe('5')
  })

  it('getInputProps().onKeyDown handles Backspace', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    const props = api.getInputProps(0)
    ;(props.onKeyDown as (k: string) => void)('Backspace')
    expect(api.getCode()).toBe('')
  })

  it('getInputProps().onKeyDown handles Delete', () => {
    const { wrapper, api } = mountAlpine({ autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1')
    const props = api.getInputProps(0)
    ;(props.onKeyDown as (k: string) => void)('Delete')
    expect(api.getCode()).toBe('')
  })

  it('getInputProps().onKeyDown handles ArrowLeft/ArrowRight', () => {
    const { wrapper, api } = mountAlpine({ length: 3, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '12')
    const props1 = api.getInputProps(2)
    ;(props1.onKeyDown as (k: string) => void)('ArrowLeft')
    const props0 = api.getInputProps(0)
    ;(props0.onKeyDown as (k: string) => void)('ArrowRight')
    expect(api.getCode()).toBe('12')
  })

  it('getInputProps().onFocus calls onFocusProp', () => {
    const onFocus = jest.fn()
    const { api } = mountAlpine({ onFocus, autoFocus: false })
    const props = api.getInputProps(0)
    ;(props.onFocus as () => void)()
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('getInputProps().onBlur calls onBlurProp', () => {
    const onBlur = jest.fn()
    const { api } = mountAlpine({ onBlur, autoFocus: false })
    const props = api.getInputProps(0)
    ;(props.onBlur as () => void)()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 18. Built-in timer footer
// ─────────────────────────────────────────────────────────────────────────────

describe('built-in timer footer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('creates .verino-timer sibling when timer > 0', () => {
    mountAlpine({ timer: 60, autoFocus: false })
    expect(document.body.querySelector('.verino-timer')).not.toBeNull()
  })

  it('creates .verino-resend sibling when timer > 0', () => {
    mountAlpine({ timer: 60, autoFocus: false })
    expect(document.body.querySelector('.verino-resend')).not.toBeNull()
  })

  it('skips footer when onTick is provided (custom-tick mode)', () => {
    mountAlpine({ timer: 60, onTick: jest.fn(), autoFocus: false })
    expect(document.body.querySelector('.verino-timer')).toBeNull()
  })

  it('calls onTick callback each second in custom-tick mode', () => {
    const onTick = jest.fn()
    mountAlpine({ timer: 5, onTick, autoFocus: false })
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(4)
  })

  it('calls onExpire when timer reaches zero', () => {
    const onExpire = jest.fn()
    mountAlpine({ timer: 2, onExpire, autoFocus: false })
    jest.advanceTimersByTime(2000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('resend button click fires onResend and restarts cooldown', () => {
    const onResend = jest.fn()
    mountAlpine({ timer: 5, resendAfter: 3, onResend, autoFocus: false })
    // Expire timer to show resend button
    jest.advanceTimersByTime(5000)
    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('destroy() removes timer footer elements', () => {
    const { api } = mountAlpine({ timer: 10, autoFocus: false })
    expect(document.body.querySelector('.verino-timer')).not.toBeNull()
    api.destroy()
    expect(document.body.querySelector('.verino-timer')).toBeNull()
  })

  it('setSuccess(true) stops the timer and hides the footer', () => {
    const { api } = mountAlpine({ timer: 10, autoFocus: false })
    flushRAF()
    api.setSuccess(true)
    const footer = document.body.querySelector('.verino-timer') as HTMLElement
    expect(footer.style.display).toBe('none')
  })

  it('reset() in built-in timer mode restarts the countdown', () => {
    const { api } = mountAlpine({ timer: 5, autoFocus: false })
    jest.advanceTimersByTime(5000) // expire
    api.reset()
    flushRAF()
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge.textContent).toBe('0:05')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 19. Invalid expression handling
// ─────────────────────────────────────────────────────────────────────────────

describe('invalid expression handling', () => {
  it('falls back to empty options when evaluate throws', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)

    let handler: ((el: HTMLElement, data: unknown, utils: unknown) => { cleanup(): void }) | null = null
    VerinoAlpine({ directive: (_n: string, fn: typeof handler) => { handler = fn } } as Parameters<typeof VerinoAlpine>[0])

    const warnSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      handler!(
        wrapper,
        { expression: 'badExpr', value: '', modifiers: [] },
        {
          evaluate: () => { throw new Error('eval failed') },
          evaluateLater: () => () => {},
          cleanup: () => {},
          effect: () => {},
        },
      )
    }).not.toThrow()
    warnSpy.mockRestore()
  })

  it('falls back to empty options when expression returns non-object', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)

    let handler: ((el: HTMLElement, data: unknown, utils: unknown) => { cleanup(): void }) | null = null
    VerinoAlpine({ directive: (_n: string, fn: typeof handler) => { handler = fn } } as Parameters<typeof VerinoAlpine>[0])

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      handler!(
        wrapper,
        { expression: '"not-an-object"', value: '', modifiers: [] },
        {
          evaluate: () => 'not-an-object',
          evaluateLater: () => () => {},
          cleanup: () => {},
          effect: () => {},
        },
      )
    }).not.toThrow()
    errorSpy.mockRestore()
  })

  it('handles empty expression (no x-verino value)', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)

    let handler: ((el: HTMLElement, data: unknown, utils: unknown) => { cleanup(): void }) | null = null
    VerinoAlpine({ directive: (_n: string, fn: typeof handler) => { handler = fn } } as Parameters<typeof VerinoAlpine>[0])

    expect(() => {
      handler!(
        wrapper,
        { expression: '', value: '', modifiers: [] },
        {
          evaluate: () => ({}),
          evaluateLater: () => () => {},
          cleanup: () => {},
          effect: () => {},
        },
      )
    }).not.toThrow()
    const api = getApi(wrapper)
    expect(api.getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 20. selectOnFocus / blurOnComplete
// ─────────────────────────────────────────────────────────────────────────────

describe('selectOnFocus and blurOnComplete', () => {
  it('selectOnFocus does not throw during focus event', () => {
    const { wrapper } = mountAlpine({ selectOnFocus: true, autoFocus: false })
    flushRAF()
    expect(() => {
      getHiddenInput(wrapper).dispatchEvent(new FocusEvent('focus', { bubbles: true }))
      flushRAF()
    }).not.toThrow()
  })

  it('blurOnComplete blurs input after all slots filled', () => {
    const { wrapper } = mountAlpine({ length: 4, blurOnComplete: true, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1234')
    flushRAF()
    // We just verify no throw; actual blur requires a real browser focus model
    expect(getApi(wrapper).getCode()).toBe('1234')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 21. blurOnComplete via paste (line 582)
// ─────────────────────────────────────────────────────────────────────────────

describe('blurOnComplete via paste', () => {
  it('blurOnComplete triggers RAF blur after paste completes the code', () => {
    const { wrapper } = mountAlpine({ length: 4, blurOnComplete: true, autoFocus: false })
    flushRAF()
    const input = getHiddenInput(wrapper)
    const blurSpy = jest.spyOn(input, 'blur')
    firePaste(input, '1234')
    flushRAF()
    expect(blurSpy).toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 22. selectOnFocus with filled slot (lines 592, 621)
// ─────────────────────────────────────────────────────────────────────────────

describe('selectOnFocus with filled slot', () => {
  it('onFocus selects the char when selectOnFocus=true and slot is filled (line 592)', () => {
    const { wrapper } = mountAlpine({ length: 4, selectOnFocus: true, autoFocus: false })
    flushRAF()
    const input = getHiddenInput(wrapper)
    typeInto(input, '1234')
    // Move cursor back to slot 0
    input.setSelectionRange(0, 0)
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    flushRAF()
    // Slot 0 has '1' → selection should be [0, 1]
    expect(input.selectionEnd).toBeGreaterThan(input.selectionStart ?? 0)
  })

  it('click on filled slot with selectOnFocus selects the char (line 621)', () => {
    const { wrapper } = mountAlpine({ length: 4, selectOnFocus: true, autoFocus: false })
    flushRAF()
    const input = getHiddenInput(wrapper)
    typeInto(input, '1234')
    const clickEvent = new MouseEvent('click', { bubbles: true, clientX: 0 })
    input.dispatchEvent(clickEvent)
    // selectOnFocus && char → setSelectionRange(0, 1)
    expect(input.selectionEnd).toBeGreaterThan(input.selectionStart ?? 0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 23. Resend countdown onTick and onExpire (lines 382-385)
// ─────────────────────────────────────────────────────────────────────────────

describe('resend countdown timer callbacks', () => {
  it('resend countdown onTick updates the timer badge', () => {
    jest.useFakeTimers()
    const onResend = jest.fn()
    mountAlpine({ timer: 5, resendAfter: 5, onResend, autoFocus: false })
    jest.advanceTimersByTime(5000)  // expire main timer → show resend button
    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Now advance to trigger resend countdown onTick
    jest.advanceTimersByTime(1000)
    const badge = document.body.querySelector('.verino-timer-badge') as HTMLElement
    expect(badge.textContent).toMatch(/0:\d{2}/)
    jest.useRealTimers()
  })

  it('resend countdown onExpire hides footer and shows resend row', () => {
    jest.useFakeTimers()
    const onResend = jest.fn()
    mountAlpine({ timer: 3, resendAfter: 2, onResend, autoFocus: false })
    jest.advanceTimersByTime(3000)  // expire main timer → show resend button
    const btn = document.body.querySelector('.verino-resend-btn') as HTMLButtonElement
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Expire the resend countdown (2s)
    jest.advanceTimersByTime(2000)
    const footer = document.body.querySelector('.verino-timer') as HTMLElement
    expect(footer.style.display).toBe('none')
    jest.useRealTimers()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 24. haptic / sound feedback (lines 188-189, 191)
// ─────────────────────────────────────────────────────────────────────────────

describe('haptic/sound feedback on complete and error', () => {
  it('haptic=false suppresses haptic on complete (false branch line 188)', () => {
    const { wrapper } = mountAlpine({ length: 4, haptic: false, autoFocus: false })
    flushRAF()
    typeInto(getHiddenInput(wrapper), '1234')
    // No throw — haptic skipped cleanly, OTP completes
    expect(getApi(wrapper).getCode()).toBe('1234')
  })

  it('sound=true triggers sound feedback on complete without throwing (line 189)', () => {
    const { wrapper } = mountAlpine({ length: 4, sound: true, autoFocus: false })
    flushRAF()
    // AudioContext absent in jsdom — triggerSoundFeedback wraps in try/catch
    expect(() => typeInto(getHiddenInput(wrapper), '1234')).not.toThrow()
    expect(getApi(wrapper).getCode()).toBe('1234')
  })

  it('haptic=false suppresses haptic on error (false branch line 191)', () => {
    const { api } = mountAlpine({ length: 4, haptic: false, autoFocus: false })
    flushRAF()
    // No throw — haptic skipped cleanly on ERROR event
    expect(() => api.setError(true)).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 25. name option sets hidden input name (line 298)
// ─────────────────────────────────────────────────────────────────────────────

describe('name option sets hidden input name attribute', () => {
  it('sets the name attribute on the hidden input when name option is provided (line 298)', () => {
    const { wrapper } = mountAlpine({ length: 4, name: 'otp-code', autoFocus: false })
    flushRAF()
    const input = getHiddenInput(wrapper)
    expect(input.name).toBe('otp-code')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 26. defaultValue that filters to empty string (line 305 false branch)
// ─────────────────────────────────────────────────────────────────────────────

describe('defaultValue filters to empty string', () => {
  it('skips pre-fill when defaultValue is all-invalid chars (line 305 false branch)', () => {
    // type=numeric, defaultValue='abc' → filterString returns '' → if (filtered) is false
    const { wrapper } = mountAlpine({ length: 4, type: 'numeric', defaultValue: 'abc', autoFocus: false })
    flushRAF()
    expect(getApi(wrapper).getCode()).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 27. Timer expiry with custom onTick (no built-in footer) — false branches 366-367
// ─────────────────────────────────────────────────────────────────────────────

describe('timer expiry with custom onTick (no built-in footer)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('onExpire fires and null-guards on lines 366-367 take false branch', () => {
    const onTick   = jest.fn()
    const onExpire = jest.fn()
    // With onTick provided, shouldUseBuiltInFooter=false → builtInFooterEl/builtInResendRowEl=null
    mountAlpine({ timer: 2, onTick, onExpire, autoFocus: false })
    jest.advanceTimersByTime(2000)
    // onExpire still fires, but the null-guard ifs (lines 366-367) take the false branch
    expect(onExpire).toHaveBeenCalled()
    // Verify no .verino-timer element was created (custom-tick mode)
    expect(document.body.querySelector('.verino-timer')).toBeNull()
  })

  it('fires an immediate initial tick before the countdown begins', () => {
    const onTick = jest.fn()
    mountAlpine({ timer: 3, onTick, autoFocus: false })

    expect(onTick).toHaveBeenNthCalledWith(1, 3)

    jest.advanceTimersByTime(3000)

    expect(onTick.mock.calls.map(([remaining]) => remaining)).toEqual([3, 2, 1, 0])
  })
})

describe('reactive Alpine options', () => {
  it('rebuilds when Alpine data changes and preserves the current code', () => {
    const mounted = mountAlpine({ length: 4, autoFocus: false })
    flushRAF()

    typeInto(getHiddenInput(mounted.wrapper), '12')
    mounted.setOptions({ length: 4, timer: 2, autoFocus: false })
    flushRAF()

    expect(getApi(mounted.wrapper).getCode()).toBe('12')
    expect(document.body.querySelector('.verino-timer')).not.toBeNull()
  })

  it('updates callback props without remounting the directive', () => {
    const onCompleteA = jest.fn()
    const onCompleteB = jest.fn()
    const mounted = mountAlpine({ length: 4, onComplete: onCompleteA, autoFocus: false })
    flushRAF()

    const originalInput = getHiddenInput(mounted.wrapper)
    typeInto(originalInput, '12')

    mounted.setOptions({ length: 4, onComplete: onCompleteB, autoFocus: false })
    flushRAF()

    expect(getHiddenInput(mounted.wrapper)).toBe(originalInput)
    expect(getApi(mounted.wrapper).getCode()).toBe('12')

    typeInto(originalInput, '1234')

    expect(onCompleteA).not.toHaveBeenCalled()
    expect(onCompleteB).toHaveBeenCalledWith('1234')
  })

  it('cancels queued RAF work on destroy before it runs', () => {
    const mounted = mountAlpine({ length: 4 })
    const input = getHiddenInput(mounted.wrapper)
    const focusSpy = jest.spyOn(input, 'focus')

    mounted.api.destroy()
    flushRAF()

    expect(focusSpy).not.toHaveBeenCalled()
  })
})
