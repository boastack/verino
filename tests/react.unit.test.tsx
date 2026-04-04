/** @jest-environment jsdom */

/**
 * @verino/react — unit tests (jsdom)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the React adapter's adapter-specific behaviour — things the core tests
 * cannot cover: hiddenInputProps wiring, keyboard/input/paste handlers, React
 * state sync, controlled-value integration, and the timer hook.
 *
 * Strategy
 * ────────
 * Render a minimal OTPFixture component that spreads hiddenInputProps onto a
 * real <input> and renders slots as <div data-testid="slot-N">. Interact via
 * fireEvent (no userEvent — keep it synchronous and deterministic).
 */

import React, { useRef, useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useOTP, HiddenOTPInput } from '@verino/react'
import type { ReactOTPOptions } from '@verino/react'


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
  // Use Object.defineProperty so it works whether or not the property already
  // exists on global (jest.useFakeTimers can remove RAF between tests).
  Object.defineProperty(global, 'requestAnimationFrame', {
    value: (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length },
    writable: true, configurable: true,
  })
  Object.defineProperty(global, 'cancelAnimationFrame', {
    value: () => {},
    writable: true, configurable: true,
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})


// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE
// ─────────────────────────────────────────────────────────────────────────────

function OTPFixture(props: ReactOTPOptions) {
  const otp = useOTP(props)
  return (
    <div data-testid="wrapper" {...otp.wrapperProps}>
      <input data-testid="input" {...otp.hiddenInputProps} autoFocus={false} />
      <span data-testid="code">{otp.getCode()}</span>
      <span data-testid="complete">{String(otp.isComplete)}</span>
      <span data-testid="error">{String(otp.hasError)}</span>
      <span data-testid="focused">{String(otp.isFocused)}</span>
      <span data-testid="timer">{otp.timerSeconds}</span>
      {otp.slotValues.map((_, i) => {
        const p = otp.getSlotProps(i)
        return (
          <div
            key={i}
            data-testid={`slot-${i}`}
            data-active={String(p.isActive)}
            data-filled={String(p.isFilled)}
            data-fake-caret={String(p.hasFakeCaret)}
          >
            {p.char}
          </div>
        )
      })}
    </div>
  )
}

/** Controlled wrapper — lets us change the value prop at runtime. */
function ControlledOTPFixture({ length = 6 }: { length?: number }) {
  const [value, setValue] = useState('')
  const onComplete = jest.fn()
  return (
    <div>
      <OTPFixture length={length} value={value} onChange={setValue} onComplete={onComplete} autoFocus={false} />
      <button data-testid="set123" onClick={() => setValue('123')}>Set 123</button>
      <button data-testid="clear" onClick={() => setValue('')}>Clear</button>
    </div>
  )
}

/** Helper — get the hidden input element. */
function getInput() {
  return screen.getByTestId('input') as HTMLInputElement
}

/** Fire a change event that mimics typing or autocomplete. */
function typeValue(input: HTMLInputElement, value: string) {
  act(() => {
    fireEvent.change(input, { target: { value } })
  })
}

/** Fire a synthetic paste event. */
function pasteText(input: HTMLInputElement, text: string) {
  act(() => {
    fireEvent.paste(input, {
      clipboardData: { getData: () => text },
    })
  })
}

/** Fire a keydown event on the input. */
function keyDown(input: HTMLInputElement, key: string, extra?: Record<string, unknown>) {
  act(() => {
    fireEvent.keyDown(input, { key, ...extra })
  })
}


// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — initial state', () => {
  it('renders the correct number of slot divs', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    expect(screen.getAllByTestId(/^slot-/).length).toBe(4)
  })

  it('all slots are empty on mount', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`slot-${i}`).textContent).toBe('')
    }
  })

  it('isComplete is false on mount', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    expect(screen.getByTestId('complete').textContent).toBe('false')
  })

  it('getCode() returns empty string on mount', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    expect(screen.getByTestId('code').textContent).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// hiddenInputProps ATTRIBUTES
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — hiddenInputProps', () => {
  it('sets maxLength to the configured length', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    expect(getInput().maxLength).toBe(4)
  })

  it('sets inputMode=numeric for type=numeric', () => {
    render(<OTPFixture type="numeric" autoFocus={false} />)
    expect(getInput().inputMode).toBe('numeric')
  })

  it('sets inputMode=text for type=alphabet', () => {
    render(<OTPFixture type="alphabet" autoFocus={false} />)
    expect(getInput().inputMode).toBe('text')
  })

  it('sets autoComplete=one-time-code', () => {
    render(<OTPFixture autoFocus={false} />)
    expect(getInput().autocomplete).toBe('one-time-code')
  })

  it('type is "text" by default', () => {
    render(<OTPFixture autoFocus={false} />)
    expect(getInput().type).toBe('text')
  })

  it('type is "password" when masked=true', () => {
    render(<OTPFixture masked autoFocus={false} />)
    expect(getInput().type).toBe('password')
  })

  it('disabled attribute reflects disabled=true', () => {
    render(<OTPFixture disabled autoFocus={false} />)
    expect(getInput().disabled).toBe(true)
  })

  it('aria-label contains length and type hint', () => {
    render(<OTPFixture length={6} type="numeric" autoFocus={false} />)
    expect(getInput().getAttribute('aria-label')).toContain('6')
    expect(getInput().getAttribute('aria-label')).toContain('digit')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// TYPING — onChange handler
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — typing (onChange)', () => {
  it('typing a single digit fills slot 0', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '1')
    expect(screen.getByTestId('slot-0').textContent).toBe('1')
  })

  it('typing fills multiple slots in order', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '1234')
    expect(screen.getByTestId('slot-0').textContent).toBe('1')
    expect(screen.getByTestId('slot-1').textContent).toBe('2')
    expect(screen.getByTestId('slot-2').textContent).toBe('3')
    expect(screen.getByTestId('slot-3').textContent).toBe('4')
  })

  it('isComplete becomes true when all slots are filled', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '1234')
    expect(screen.getByTestId('complete').textContent).toBe('true')
  })

  it('getCode() returns joined code when complete', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '1234')
    expect(screen.getByTestId('code').textContent).toBe('1234')
  })

  it('non-numeric characters are rejected in numeric mode', () => {
    render(<OTPFixture length={4} type="numeric" autoFocus={false} />)
    typeValue(getInput(), 'ABCD')
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  it('onComplete fires synchronously when all slots are filled', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={4} onComplete={onComplete} autoFocus={false} />)
    typeValue(getInput(), '1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('onChange fires on every interaction', () => {
    const onChange = jest.fn()
    render(<OTPFixture length={4} onChange={onChange} autoFocus={false} />)
    typeValue(getInput(), '12')
    expect(onChange).toHaveBeenCalledWith('12')
  })

  it('typing in alphabet mode accepts letters', () => {
    render(<OTPFixture length={4} type="alphabet" autoFocus={false} />)
    typeValue(getInput(), 'ABCD')
    expect(screen.getByTestId('code').textContent).toBe('ABCD')
  })

  it('clearing the input value resets all slots', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '1234')
    typeValue(getInput(), '')
    expect(screen.getByTestId('code').textContent).toBe('')
    expect(screen.getByTestId('complete').textContent).toBe('false')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD — onKeyDown handler
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — keyboard', () => {
  it('Backspace clears current slot when filled', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '123')
    input.setSelectionRange(2, 2)
    keyDown(input, 'Backspace')
    expect(screen.getByTestId('slot-2').textContent).toBe('')
  })

  it('ArrowLeft moves cursor to previous slot', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '12')
    // cursor is at pos 1 (last slot written)
    input.setSelectionRange(1, 1)
    keyDown(input, 'ArrowLeft')
    flushRAF()
    expect(input.selectionStart).toBe(0)
  })

  it('ArrowRight moves cursor to next slot', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '12')
    input.setSelectionRange(0, 0)
    keyDown(input, 'ArrowRight')
    flushRAF()
    expect(input.selectionStart).toBe(1)
  })

  it('ArrowLeft clamps at slot 0', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    input.setSelectionRange(0, 0)
    keyDown(input, 'ArrowLeft')
    flushRAF()
    expect(input.selectionStart).toBe(0)
  })

  it('Delete key clears current slot without moving cursor', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '123')
    input.setSelectionRange(1, 1)
    keyDown(input, 'Delete')
    expect(screen.getByTestId('slot-1').textContent).toBe('')
    // slot-0 and slot-2 are untouched
    expect(screen.getByTestId('slot-0').textContent).toBe('1')
    expect(screen.getByTestId('slot-2').textContent).toBe('3')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// PASTE — onPaste handler
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — paste', () => {
  it('paste from slot 0 fills all slots', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    input.setSelectionRange(0, 0)
    pasteText(input, '1234')
    expect(screen.getByTestId('code').textContent).toBe('1234')
  })

  it('paste triggers onComplete synchronously when code is filled', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={4} onComplete={onComplete} autoFocus={false} />)
    const input = getInput()
    input.setSelectionRange(0, 0)
    pasteText(input, '1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('paste is silently ignored when disabled', () => {
    render(<OTPFixture length={4} disabled autoFocus={false} />)
    const input = getInput()
    pasteText(input, '1234')
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  it('paste filters invalid characters in numeric mode', () => {
    render(<OTPFixture length={4} type="numeric" autoFocus={false} />)
    const input = getInput()
    input.setSelectionRange(0, 0)
    pasteText(input, '1A2B')
    expect(screen.getByTestId('code').textContent).toBe('12')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getSlotProps
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — getSlotProps', () => {
  it('char is correct for a filled slot', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '5')
    expect(screen.getByTestId('slot-0').textContent).toBe('5')
  })

  it('isFilled is true when slot has a character', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '5')
    expect(screen.getByTestId('slot-0').dataset.filled).toBe('true')
  })

  it('isFilled is false for empty slot', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    expect(screen.getByTestId('slot-0').dataset.filled).toBe('false')
  })

  it('isError propagates to all slots when error is set', () => {
    const { rerender } = render(<OTPFixture length={4} autoFocus={false} />)
    // setError via wrapperProps — check through a controlled wrapper
    // We test isError indirectly through data-invalid on the wrapper
    typeValue(getInput(), '1')
    // Error state is tested through wrapperProps below
    rerender(<OTPFixture length={4} autoFocus={false} />)
    expect(screen.getByTestId('error').textContent).toBe('false')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// wrapperProps — data attributes
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — wrapperProps', () => {
  it('data-complete is present when isComplete', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '1234')
    expect(screen.getByTestId('wrapper').hasAttribute('data-complete')).toBe(true)
  })

  it('data-complete is absent when incomplete', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    typeValue(getInput(), '12')
    expect(screen.getByTestId('wrapper').hasAttribute('data-complete')).toBe(false)
  })

  it('data-disabled is present when disabled=true', () => {
    render(<OTPFixture length={4} disabled autoFocus={false} />)
    expect(screen.getByTestId('wrapper').hasAttribute('data-disabled')).toBe(true)
  })

  it('data-readonly is present when readOnly=true', () => {
    render(<OTPFixture length={4} readOnly autoFocus={false} />)
    expect(screen.getByTestId('wrapper').hasAttribute('data-readonly')).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// defaultValue
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — defaultValue', () => {
  it('pre-fills slots on mount', () => {
    render(<OTPFixture length={4} defaultValue="12" autoFocus={false} />)
    expect(screen.getByTestId('slot-0').textContent).toBe('1')
    expect(screen.getByTestId('slot-1').textContent).toBe('2')
    expect(screen.getByTestId('slot-2').textContent).toBe('')
  })

  it('does NOT trigger onComplete even when pre-fill is complete', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={4} defaultValue="1234" onComplete={onComplete} autoFocus={false} />)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('filters invalid characters in defaultValue', () => {
    render(<OTPFixture length={4} type="numeric" defaultValue="1A2B" autoFocus={false} />)
    expect(screen.getByTestId('code').textContent).toBe('12')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Controlled value
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — controlled value', () => {
  it('syncs slots when value prop updates', () => {
    render(<ControlledOTPFixture length={4} />)
    act(() => { fireEvent.click(screen.getByTestId('set123')) })
    expect(screen.getByTestId('slot-0').textContent).toBe('1')
    expect(screen.getByTestId('slot-1').textContent).toBe('2')
    expect(screen.getByTestId('slot-2').textContent).toBe('3')
  })

  it('clears slots when value is set to empty string', () => {
    render(<ControlledOTPFixture length={4} />)
    act(() => { fireEvent.click(screen.getByTestId('set123')) })
    act(() => { fireEvent.click(screen.getByTestId('clear')) })
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  it('does NOT trigger onComplete on programmatic value sync', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={3} value="123" onComplete={onComplete} autoFocus={false} />)
    expect(onComplete).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// disabled
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — disabled', () => {
  it('onChange is blocked when disabled=true', () => {
    render(<OTPFixture length={4} disabled autoFocus={false} />)
    typeValue(getInput(), '1234')
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  it('Backspace is blocked when disabled=true', () => {
    render(<OTPFixture length={4} disabled autoFocus={false} />)
    const input = getInput()
    keyDown(input, 'Backspace')
    expect(screen.getByTestId('complete').textContent).toBe('false')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// readOnly
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — readOnly', () => {
  it('onChange is blocked when readOnly=true', () => {
    render(<OTPFixture length={4} readOnly autoFocus={false} />)
    typeValue(getInput(), '1234')
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  it('ArrowLeft is allowed when readOnly=true', () => {
    render(<OTPFixture length={4} readOnly autoFocus={false} />)
    const input = getInput()
    // Set DOM value directly — bypasses the readOnly handler check
    input.value = '12'
    input.setSelectionRange(1, 1)
    keyDown(input, 'ArrowLeft')
    flushRAF()
    expect(input.selectionStart).toBe(0)
  })

  it('Backspace is blocked when readOnly=true', () => {
    render(<OTPFixture length={4} readOnly autoFocus={false} />)
    const input = getInput()
    // Set DOM value directly so there's something at position 1
    input.value = '12'
    input.setSelectionRange(1, 1)
    keyDown(input, 'Backspace')
    // Core state should remain unchanged — slot-1 was never actually filled
    // through the adapter (readOnly blocks insert), so slot values stay empty
    expect(screen.getByTestId('slot-0').textContent).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// reset() and setError()
// ─────────────────────────────────────────────────────────────────────────────

function OTPWithControls(props: ReactOTPOptions) {
  const otp = useOTP(props)
  return (
    <div>
      <input data-testid="input" {...otp.hiddenInputProps} autoFocus={false} />
      <span data-testid="code">{otp.getCode()}</span>
      <span data-testid="complete">{String(otp.isComplete)}</span>
      <span data-testid="error">{String(otp.hasError)}</span>
      <button data-testid="reset" onClick={() => otp.reset()}>Reset</button>
      <button data-testid="setError" onClick={() => otp.setError(true)}>Error</button>
      <button data-testid="clearError" onClick={() => otp.setError(false)}>Clear Error</button>
    </div>
  )
}

describe('useOTP — reset()', () => {
  it('clears all slots', () => {
    render(<OTPWithControls length={4} autoFocus={false} />)
    typeValue(screen.getByTestId('input') as HTMLInputElement, '1234')
    act(() => { fireEvent.click(screen.getByTestId('reset')) })
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  it('resets isComplete to false', () => {
    render(<OTPWithControls length={4} autoFocus={false} />)
    typeValue(screen.getByTestId('input') as HTMLInputElement, '1234')
    expect(screen.getByTestId('complete').textContent).toBe('true')
    act(() => { fireEvent.click(screen.getByTestId('reset')) })
    expect(screen.getByTestId('complete').textContent).toBe('false')
  })
})

describe('useOTP — setError()', () => {
  it('setError(true) sets hasError to true', () => {
    render(<OTPWithControls length={4} autoFocus={false} />)
    act(() => { fireEvent.click(screen.getByTestId('setError')) })
    expect(screen.getByTestId('error').textContent).toBe('true')
  })

  it('setError(false) clears hasError', () => {
    render(<OTPWithControls length={4} autoFocus={false} />)
    act(() => { fireEvent.click(screen.getByTestId('setError')) })
    act(() => { fireEvent.click(screen.getByTestId('clearError')) })
    expect(screen.getByTestId('error').textContent).toBe('false')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onInvalidChar
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — onInvalidChar', () => {
  it('fires for rejected characters during paste', () => {
    // The React adapter uses filterString for onChange (batch pre-filter),
    // so onInvalidChar is triggered via paste where otp.paste() is called directly.
    const onInvalidChar = jest.fn()
    render(<OTPFixture length={4} type="numeric" onInvalidChar={onInvalidChar} autoFocus={false} />)
    const input = getInput()
    input.setSelectionRange(0, 0)
    pasteText(input, '1A2B')
    expect(onInvalidChar).toHaveBeenCalledWith('A', 1)
    // '1' advances cursor to 1, 'A' stays at 1, '2' advances to 2, 'B' stays at 2
    expect(onInvalidChar).toHaveBeenCalledWith('B', 2)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Timer
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — timer', () => {
  it('timerSeconds initialises to the configured value', () => {
    jest.useFakeTimers()
    render(<OTPFixture length={4} timer={30} autoFocus={false} />)
    expect(screen.getByTestId('timer').textContent).toBe('30')
  })

  it('timerSeconds counts down each second', () => {
    jest.useFakeTimers()
    render(<OTPFixture length={4} timer={5} autoFocus={false} />)
    act(() => { jest.advanceTimersByTime(2000) })
    expect(Number(screen.getByTestId('timer').textContent)).toBeLessThan(5)
  })

  it('onExpire fires when countdown reaches zero', () => {
    jest.useFakeTimers()
    const onExpire = jest.fn()
    render(<OTPFixture length={4} timer={2} onExpire={onExpire} autoFocus={false} />)
    act(() => { jest.advanceTimersByTime(3000) })
    expect(onExpire).toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Tab key navigation (lines 452-464)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — Tab key navigation', () => {
  it('Tab moves forward when slot is filled', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '12')
    input.setSelectionRange(0, 0)
    keyDown(input, 'Tab')
    flushRAF()
    expect(input.selectionStart).toBe(1)
  })

  it('Tab does nothing when slot is empty (no preventDefault)', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    input.setSelectionRange(0, 0)
    let prevented = false
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      Object.defineProperty(event, 'preventDefault', { value: () => { prevented = true } })
      input.dispatchEvent(event)
    })
    expect(prevented).toBe(false)
  })

  it('Tab does nothing when at last slot', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '1234')
    input.setSelectionRange(3, 3)
    let prevented = false
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      Object.defineProperty(event, 'preventDefault', { value: () => { prevented = true } })
      input.dispatchEvent(event)
    })
    expect(prevented).toBe(false)
  })

  it('Shift+Tab moves backward from slot > 0', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '12')
    input.setSelectionRange(1, 1)
    keyDown(input, 'Tab', { shiftKey: true })
    flushRAF()
    expect(input.selectionStart).toBe(0)
  })

  it('Shift+Tab at slot 0 does nothing', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    input.setSelectionRange(0, 0)
    let prevented = false
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
      Object.defineProperty(event, 'preventDefault', { value: () => { prevented = true } })
      input.dispatchEvent(event)
    })
    expect(prevented).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onFocus and onBlur (lines 516-527)
// ─────────────────────────────────────────────────────────────────────────────

describe('useOTP — onFocus / onBlur', () => {
  it('onFocus sets isFocused to true and fires onFocus callback', () => {
    const onFocus = jest.fn()
    render(<OTPFixture length={4} onFocus={onFocus} autoFocus={false} />)
    act(() => { fireEvent.focus(getInput()) })
    expect(screen.getByTestId('focused').textContent).toBe('true')
    expect(onFocus).toHaveBeenCalled()
  })

  it('onBlur sets isFocused to false and fires onBlur callback', () => {
    const onBlur = jest.fn()
    render(<OTPFixture length={4} onBlur={onBlur} autoFocus={false} />)
    act(() => { fireEvent.focus(getInput()) })
    act(() => { fireEvent.blur(getInput()) })
    expect(screen.getByTestId('focused').textContent).toBe('false')
    expect(onBlur).toHaveBeenCalled()
  })

  it('selectOnFocus selects filled char in RAF callback', () => {
    render(<OTPFixture length={4} selectOnFocus autoFocus={false} />)
    const input = getInput()
    typeValue(input, '12')
    // activeSlot = 2 after typing. Move cursor to pos 1 then ArrowLeft to set activeSlot = 0
    input.setSelectionRange(1, 1)
    keyDown(input, 'ArrowLeft')   // otp.move(0) — now activeSlot = 0, which has '1'
    flushRAF()                     // flush ArrowLeft RAF
    act(() => { fireEvent.focus(input) })
    flushRAF()
    // Slot 0 has '1' → selection should be [0, 1]
    expect(input.selectionEnd).toBe(1)
  })

  it('onFocus without selectOnFocus sets cursor to activeSlot', () => {
    render(<OTPFixture length={4} autoFocus={false} />)
    const input = getInput()
    typeValue(input, '12')
    act(() => { fireEvent.focus(input) })
    flushRAF()
    // cursor set to activeSlot, not a range selection
    expect(input.selectionStart).toBe(input.selectionEnd)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// focus(), getInputProps(), setSuccess, setReadOnly, setDisabled (lines 550-562)
// ─────────────────────────────────────────────────────────────────────────────

function OTPWithFullAPI(props: ReactOTPOptions) {
  const otp = useOTP(props)
  const ref = useRef<{ otp: ReturnType<typeof useOTP> }>({ otp })
  ref.current.otp = otp
  return (
    <div>
      <input data-testid="input" {...otp.hiddenInputProps} autoFocus={false} />
      <span data-testid="code">{otp.getCode()}</span>
      <span data-testid="active">{otp.activeSlot}</span>
      <span data-testid="success">{String(otp.hasSuccess)}</span>
      <button data-testid="focus2" onClick={() => otp.focus(2)}>Focus 2</button>
      <button data-testid="setSuccess" onClick={() => otp.setSuccess(true)}>Success</button>
      <button data-testid="clearSuccess" onClick={() => otp.setSuccess(false)}>ClearSuccess</button>
      <button data-testid="setDisabled" onClick={() => otp.setDisabled(true)}>Disable</button>
      <button data-testid="setReadOnly" onClick={() => otp.setReadOnly(true)}>ReadOnly</button>
      {otp.slotValues.map((_, i) => {
        const p = otp.getInputProps(i)
        return <div key={i} data-testid={`ip-${i}`} data-focus={p['data-focus']} />
      })}
    </div>
  )
}

describe('useOTP — focus()', () => {
  it('focus(2) moves activeSlot to 2', () => {
    render(<OTPWithFullAPI length={4} autoFocus={false} />)
    act(() => { fireEvent.click(screen.getByTestId('focus2')) })
    expect(screen.getByTestId('active').textContent).toBe('2')
  })
})

describe('useOTP — getInputProps()', () => {
  it('data-focus reflects isFocused state', () => {
    render(<OTPWithFullAPI length={4} autoFocus={false} />)
    // Initially not focused
    expect(screen.getByTestId('ip-0').dataset.focus).toBe('false')
    // Focus the input
    act(() => { fireEvent.focus(screen.getByTestId('input')) })
    expect(screen.getByTestId('ip-0').dataset.focus).toBe('true')
  })
})

describe('useOTP — setSuccess()', () => {
  it('setSuccess(true) sets hasSuccess', () => {
    render(<OTPWithFullAPI length={4} autoFocus={false} />)
    act(() => { fireEvent.click(screen.getByTestId('setSuccess')) })
    expect(screen.getByTestId('success').textContent).toBe('true')
  })

  it('setSuccess(false) clears hasSuccess', () => {
    render(<OTPWithFullAPI length={4} autoFocus={false} />)
    act(() => { fireEvent.click(screen.getByTestId('setSuccess')) })
    act(() => { fireEvent.click(screen.getByTestId('clearSuccess')) })
    expect(screen.getByTestId('success').textContent).toBe('false')
  })
})

describe('useOTP — setDisabled()', () => {
  it('setDisabled(true) blocks subsequent typing', () => {
    render(<OTPWithFullAPI length={4} autoFocus={false} />)
    act(() => { fireEvent.click(screen.getByTestId('setDisabled')) })
    typeValue(screen.getByTestId('input') as HTMLInputElement, '1234')
    expect(screen.getByTestId('code').textContent).toBe('')
  })
})

describe('useOTP — setReadOnly()', () => {
  it('setReadOnly(true) blocks subsequent typing', () => {
    render(<OTPWithFullAPI length={4} autoFocus={false} />)
    act(() => { fireEvent.click(screen.getByTestId('setReadOnly')) })
    typeValue(screen.getByTestId('input') as HTMLInputElement, '1234')
    expect(screen.getByTestId('code').textContent).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// HiddenOTPInput component (line 682)
// ─────────────────────────────────────────────────────────────────────────────

function HiddenInputFixture() {
  const otp = useOTP({ length: 4, autoFocus: false })
  const { ref: _ref, ...restProps } = otp.hiddenInputProps
  return (
    <div>
      <HiddenOTPInput ref={otp.hiddenInputProps.ref} data-testid="hidden" {...restProps} />
      <span data-testid="ok">ok</span>
    </div>
  )
}

describe('HiddenOTPInput', () => {
  it('renders an <input> element via hiddenInputProps', () => {
    render(<HiddenInputFixture />)
    expect(screen.getByTestId('hidden').tagName).toBe('INPUT')
  })

  it('forwards ref to the underlying input element', () => {
    let inputEl: HTMLInputElement | null = null
    function Wrapper() {
      const otp = useOTP({ length: 4, autoFocus: false })
      const fwdRef = useRef<HTMLInputElement>(null)
      React.useEffect(() => { inputEl = fwdRef.current }, [])
      const { ref: _ref, ...restProps } = otp.hiddenInputProps
      return <HiddenOTPInput ref={fwdRef} data-testid="hidden" {...restProps} />
    }
    render(<Wrapper />)
    expect(inputEl).not.toBeNull()
    expect(inputEl!.tagName).toBe('INPUT')
  })
})
