/** @jest-environment jsdom */

/**
 * @verino/react-native — unit tests (jsdom)
 * ─────────────────────────────────────────────────────────────────────────────
 * The React Native adapter never imports `react-native` — `hiddenInputProps`
 * is a plain props object meant to be spread onto a consumer's `<TextInput>`.
 * To exercise it under Jest/jsdom, `FakeTextInput` below bridges RN's prop
 * contract (onChangeText receives the full new value; onKeyPress receives
 * `{ nativeEvent: { key } }`) onto a real DOM `<input>`, which reports the
 * same "full value on every edit" semantics via `onChange`/`e.target.value`
 * and the same `key` naming via `onKeyDown`/`e.key`. This lets the hook's
 * actual handler logic run unmodified.
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useOTP } from '@verino/react-native'
import type { ReactNativeOTPOptions, TextInputRefLike, HiddenInputProps } from '@verino/react-native'


// ─────────────────────────────────────────────────────────────────────────────
// RAF MOCK
// ─────────────────────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []

function flushRAF() {
  const q = [...rafQueue]; rafQueue = []
  act(() => { q.forEach(fn => fn(0)) })
}

beforeEach(() => {
  rafQueue = []
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
// FAKE TextInput — bridges RN prop contract onto a real DOM <input>
// ─────────────────────────────────────────────────────────────────────────────

const FakeTextInput = forwardRef<TextInputRefLike, HiddenInputProps>((props, ref) => {
  const domRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => ({
    focus: () => domRef.current?.focus(),
    blur:  () => domRef.current?.blur(),
    isFocused: () => document.activeElement === domRef.current,
    setSelection: (start: number, end: number) => domRef.current?.setSelectionRange(start, end),
  }))

  return (
    <input
      data-testid="hidden"
      ref={domRef}
      value={props.value}
      readOnly={!props.editable}
      autoFocus={!!props.autoFocus}
      onChange={(e) => props.onChangeText(e.target.value)}
      onKeyDown={(e) => props.onKeyPress({ nativeEvent: { key: e.key } })}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
    />
  )
})
FakeTextInput.displayName = 'FakeTextInput'


// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE
// ─────────────────────────────────────────────────────────────────────────────

function OTPFixture(props: ReactNativeOTPOptions) {
  const otp = useOTP(props)
  return (
    <div data-testid="wrapper">
      <FakeTextInput {...otp.hiddenInputProps} />
      <span data-testid="code">{otp.getCode()}</span>
      <span data-testid="complete">{String(otp.isComplete)}</span>
      <span data-testid="error">{String(otp.hasError)}</span>
      <span data-testid="success">{String(otp.hasSuccess)}</span>
      <span data-testid="disabled">{String(otp.isDisabled)}</span>
      <span data-testid="readonly">{String(otp.isReadOnly)}</span>
      <span data-testid="focused">{String(otp.isFocused)}</span>
      <span data-testid="timer">{otp.timerSeconds}</span>
      <span data-testid="active">{otp.activeSlot}</span>
      {otp.getSlots().map((slot) => {
        const p = otp.getSlotProps(slot.index)
        return (
          <div
            key={slot.index}
            data-testid={`slot-${slot.index}`}
            data-active={String(p.isActive)}
            data-filled={String(p.isFilled)}
            data-fake-caret={String(p.hasFakeCaret)}
            onClick={p.onPress}
          >
            {p.isFilled ? p.char : p.placeholder}
          </div>
        )
      })}
      <button data-testid="reset" onClick={() => otp.reset()}>reset</button>
      <button data-testid="resend" onClick={() => otp.resend()}>resend</button>
      <button data-testid="set-error" onClick={() => otp.setError(true)}>setError</button>
      <button data-testid="clear-error" onClick={() => otp.setError(false)}>clearError</button>
      <button data-testid="set-success" onClick={() => otp.setSuccess(true)}>setSuccess</button>
      <button data-testid="set-disabled" onClick={() => otp.setDisabled(true)}>setDisabled</button>
      <button data-testid="clear-disabled" onClick={() => otp.setDisabled(false)}>clearDisabled</button>
      <button data-testid="set-readonly" onClick={() => otp.setReadOnly(true)}>setReadOnly</button>
      <button data-testid="focus-2" onClick={() => otp.focus(2)}>focus2</button>
    </div>
  )
}

/** Controlled wrapper — lets us change the value prop at runtime. */
function ControlledOTPFixture({ length = 6, onComplete }: { length?: number; onComplete?: (code: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div>
      <OTPFixture length={length} value={value} onChange={setValue} onComplete={onComplete} autoFocus={false} />
      <button data-testid="set123" onClick={() => setValue('123')}>Set 123</button>
      <button data-testid="clear" onClick={() => setValue('')}>Clear</button>
    </div>
  )
}

function getInput() {
  return screen.getByTestId('hidden') as HTMLInputElement
}

function typeFullValue(value: string) {
  fireEvent.change(getInput(), { target: { value } })
}

function pressKey(key: string) {
  fireEvent.keyDown(getInput(), { key })
}


// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('@verino/react-native useOTP', () => {
  test('types digits sequentially and fills slots', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    expect(screen.getByTestId('code').textContent).toBe('123')
    expect(screen.getByTestId('slot-2').textContent).toBe('3')
    expect(screen.getByTestId('complete').textContent).toBe('false')
  })

  test('fills all slots and fires onComplete', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={4} autoFocus={false} onComplete={onComplete} />)
    typeFullValue('1234')
    expect(screen.getByTestId('code').textContent).toBe('1234')
    expect(screen.getByTestId('complete').textContent).toBe('true')
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  test('SMS-autofill-style full-value drop fills all slots in one onChangeText call', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={6} autoFocus={false} onComplete={onComplete} />)
    typeFullValue('654321')
    expect(screen.getByTestId('code').textContent).toBe('654321')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  test('backspace shortens the value via the same onChangeText path', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    typeFullValue('12')
    expect(screen.getByTestId('code').textContent).toBe('12')
  })

  test('clearing the field resets state via empty onChangeText', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    typeFullValue('')
    expect(screen.getByTestId('code').textContent).toBe('')
    expect(screen.getByTestId('active').textContent).toBe('0')
  })

  test('non-numeric characters are filtered out under the default numeric type', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('1a2')
    expect(screen.getByTestId('code').textContent).toBe('12')
  })

  test('onInvalidChar reports rejected characters with their slot index', () => {
    const onInvalidChar = jest.fn()
    render(<OTPFixture length={6} autoFocus={false} onInvalidChar={onInvalidChar} />)
    typeFullValue('1a2')
    expect(onInvalidChar).toHaveBeenCalledWith('a', 1)
  })

  test('pasteTransformer strips formatting before filtering, applied on every change', () => {
    render(<OTPFixture length={6} autoFocus={false} pasteTransformer={(raw) => raw.replace(/[^0-9]/g, '')} />)
    typeFullValue('12-34 56')
    expect(screen.getByTestId('code').textContent).toBe('123456')
  })

  test('a throwing pasteTransformer falls back to the raw text', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    render(<OTPFixture length={6} autoFocus={false} pasteTransformer={() => { throw new Error('boom') }} />)
    typeFullValue('123')
    expect(screen.getByTestId('code').textContent).toBe('123')
    expect(warnSpy).toHaveBeenCalled()
  })

  test('respects a custom pattern over the default type', () => {
    render(<OTPFixture length={6} autoFocus={false} pattern={/^[A-F]$/} />)
    typeFullValue('ABZ')
    expect(screen.getByTestId('code').textContent).toBe('AB')
  })

  test('ArrowLeft/ArrowRight move the active slot without changing the value', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    expect(screen.getByTestId('active').textContent).toBe('3')
    pressKey('ArrowLeft')
    expect(screen.getByTestId('active').textContent).toBe('2')
    pressKey('ArrowRight')
    expect(screen.getByTestId('active').textContent).toBe('3')
    expect(screen.getByTestId('code').textContent).toBe('123')
  })

  test('ArrowLeft/ArrowRight sync the native caret to the new active slot', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    pressKey('ArrowLeft')
    flushRAF()
    expect(getInput().selectionStart).toBe(2)
    expect(getInput().selectionEnd).toBe(2)
  })

  test('ArrowLeft is ignored by onKeyPress while disabled', () => {
    render(<OTPFixture length={6} autoFocus={false} disabled />)
    pressKey('ArrowLeft')
    expect(screen.getByTestId('active').textContent).toBe('0')
  })

  test('invalid chars beyond the field length are not reported', () => {
    const onInvalidChar = jest.fn()
    render(<OTPFixture length={2} autoFocus={false} onInvalidChar={onInvalidChar} />)
    typeFullValue('12a')
    expect(onInvalidChar).not.toHaveBeenCalled()
  })

  test('other keys are ignored by onKeyPress', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    pressKey('Enter')
    expect(screen.getByTestId('active').textContent).toBe('3')
  })

  test('tapping a slot moves the cursor there (onPress)', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    fireEvent.click(screen.getByTestId('slot-0'))
    expect(screen.getByTestId('active').textContent).toBe('0')
    flushRAF()
    expect(document.activeElement).toBe(getInput())
  })

  test('tapping a slot while disabled does not move the cursor', () => {
    render(<OTPFixture length={6} autoFocus={false} disabled />)
    fireEvent.click(screen.getByTestId('slot-2'))
    expect(screen.getByTestId('active').textContent).toBe('0')
  })

  test('tapping a slot syncs the native caret to that slot', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    fireEvent.click(screen.getByTestId('slot-0'))
    flushRAF()
    expect(getInput().selectionStart).toBe(0)
    expect(getInput().selectionEnd).toBe(0)
  })

  test('selectOnFocus selects the existing character at the active slot', () => {
    render(<OTPFixture length={6} autoFocus={false} selectOnFocus />)
    typeFullValue('123')
    fireEvent.click(screen.getByTestId('slot-1'))
    fireEvent.focus(getInput())
    flushRAF()
    expect(getInput().selectionStart).toBe(1)
    expect(getInput().selectionEnd).toBe(2)
  })

  test('selectOnFocus places a plain caret when the active slot is empty', () => {
    render(<OTPFixture length={6} autoFocus={false} selectOnFocus />)
    typeFullValue('123')
    fireEvent.focus(getInput())
    flushRAF()
    expect(getInput().selectionStart).toBe(3)
    expect(getInput().selectionEnd).toBe(3)
  })

  test('without selectOnFocus, focusing a filled slot places a plain caret', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    typeFullValue('123')
    fireEvent.click(screen.getByTestId('slot-1'))
    fireEvent.focus(getInput())
    flushRAF()
    expect(getInput().selectionStart).toBe(1)
    expect(getInput().selectionEnd).toBe(1)
  })

  test('reset clears slots, restarts the timer, and refocuses', () => {
    render(<OTPFixture length={6} autoFocus={false} timer={30} />)
    typeFullValue('123')
    fireEvent.click(screen.getByTestId('reset'))
    expect(screen.getByTestId('code').textContent).toBe('')
    flushRAF()
    expect(document.activeElement).toBe(getInput())
  })

  test('resend clears slots and fires onResend', () => {
    const onResend = jest.fn()
    render(<OTPFixture length={6} autoFocus={false} onResend={onResend} />)
    typeFullValue('123')
    fireEvent.click(screen.getByTestId('resend'))
    expect(screen.getByTestId('code').textContent).toBe('')
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  test('reset does not refocus while disabled', () => {
    render(<OTPFixture length={6} autoFocus={false} disabled />)
    fireEvent.click(screen.getByTestId('reset'))
    flushRAF()
    expect(document.activeElement).not.toBe(getInput())
  })

  test('resend does not refocus while disabled', () => {
    const onResend = jest.fn()
    render(<OTPFixture length={6} autoFocus={false} disabled onResend={onResend} />)
    fireEvent.click(screen.getByTestId('resend'))
    flushRAF()
    expect(document.activeElement).not.toBe(getInput())
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  test('setError and setSuccess are mutually exclusive', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    fireEvent.click(screen.getByTestId('set-error'))
    expect(screen.getByTestId('error').textContent).toBe('true')
    fireEvent.click(screen.getByTestId('set-success'))
    expect(screen.getByTestId('success').textContent).toBe('true')
    expect(screen.getByTestId('error').textContent).toBe('false')
    fireEvent.click(screen.getByTestId('clear-error'))
    expect(screen.getByTestId('error').textContent).toBe('false')
  })

  test('setDisabled blocks onChangeText mutations and reflects in editable', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    fireEvent.click(screen.getByTestId('set-disabled'))
    expect(screen.getByTestId('disabled').textContent).toBe('true')
    expect(getInput().readOnly).toBe(true)
    typeFullValue('123')
    expect(screen.getByTestId('code').textContent).toBe('')
    fireEvent.click(screen.getByTestId('clear-disabled'))
    typeFullValue('123')
    expect(screen.getByTestId('code').textContent).toBe('123')
  })

  test('setReadOnly blocks mutations but keeps the field logically focusable', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    fireEvent.click(screen.getByTestId('set-readonly'))
    expect(screen.getByTestId('readonly').textContent).toBe('true')
    typeFullValue('123')
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  test('readOnly option at mount blocks mutations from the start', () => {
    render(<OTPFixture length={6} autoFocus={false} readOnly />)
    typeFullValue('123')
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  test('a rejected readOnly edit still forces a render, so the native TextInput snaps back', () => {
    // Unlike a real DOM <input>, RN's TextInput only reconciles its native
    // text back to the controlled `value` prop during a commit — there is no
    // browser-level "restore controlled value" safety net. If onChangeText's
    // readOnly guard returned without updating state, a real device could be
    // left visually showing a character the OS just accepted. This can't be
    // observed through the DOM value itself (jsdom/react-dom auto-corrects
    // that regardless), so this test asserts a render actually happened.
    let renderCount = 0
    function CountingFixture() {
      renderCount++
      const otp = useOTP({ length: 6, autoFocus: false, readOnly: true })
      return <FakeTextInput {...otp.hiddenInputProps} />
    }
    render(<CountingFixture />)
    const countBefore = renderCount
    typeFullValue('1')
    expect(renderCount).toBeGreaterThan(countBefore)
  })

  test('isFocused tracks native focus/blur events', () => {
    render(<OTPFixture length={6} autoFocus={false} />)
    fireEvent.focus(getInput())
    expect(screen.getByTestId('focused').textContent).toBe('true')
    fireEvent.blur(getInput())
    expect(screen.getByTestId('focused').textContent).toBe('false')
  })

  test('onFocus/onBlur callbacks fire alongside isFocused', () => {
    const onFocus = jest.fn()
    const onBlur = jest.fn()
    render(<OTPFixture length={6} autoFocus={false} onFocus={onFocus} onBlur={onBlur} />)
    fireEvent.focus(getInput())
    fireEvent.blur(getInput())
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  test('blurOnComplete blurs the hidden input once the field is complete', () => {
    render(<OTPFixture length={4} autoFocus={false} blurOnComplete />)
    fireEvent.focus(getInput())
    typeFullValue('1234')
    flushRAF()
    expect(document.activeElement).not.toBe(getInput())
  })

  test('defaultValue prefills without firing onComplete', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={4} autoFocus={false} defaultValue="1234" onComplete={onComplete} />)
    expect(screen.getByTestId('code').textContent).toBe('1234')
    expect(onComplete).not.toHaveBeenCalled()
  })

  test('a defaultValue that filters down to nothing is a no-op', () => {
    const onComplete = jest.fn()
    render(<OTPFixture length={4} autoFocus={false} defaultValue="abc" onComplete={onComplete} />)
    expect(screen.getByTestId('code').textContent).toBe('')
    expect(onComplete).not.toHaveBeenCalled()
  })

  test('controlled value syncs externally and ignores no-op updates', () => {
    render(<ControlledOTPFixture length={6} />)
    fireEvent.click(screen.getByTestId('set123'))
    expect(screen.getByTestId('code').textContent).toBe('123')
    fireEvent.click(screen.getByTestId('set123'))
    expect(screen.getByTestId('code').textContent).toBe('123')
    fireEvent.click(screen.getByTestId('clear'))
    expect(screen.getByTestId('code').textContent).toBe('')
  })

  test('typing updates controlled onChange and the external value prop stays consistent', () => {
    const onComplete = jest.fn()
    render(<ControlledOTPFixture length={4} onComplete={onComplete} />)
    typeFullValue('1234')
    expect(screen.getByTestId('code').textContent).toBe('1234')
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  test('changing type/pattern at runtime migrates the existing value', () => {
    function MigratingFixture() {
      const [pattern, setPattern] = useState<RegExp | undefined>(undefined)
      return (
        <div>
          <OTPFixture length={6} autoFocus={false} type="alphanumeric" pattern={pattern} />
          <button data-testid="restrict" onClick={() => setPattern(/^[0-9]$/)}>restrict</button>
        </div>
      )
    }
    render(<MigratingFixture />)
    typeFullValue('a1b2')
    expect(screen.getByTestId('code').textContent).toBe('a1b2')
    fireEvent.click(screen.getByTestId('restrict'))
    expect(screen.getByTestId('code').textContent).toBe('12')
  })

  test('masked exposes secureTextEntry and maskChar via getSlotProps', () => {
    function MaskedFixture() {
      const otp = useOTP({ length: 4, autoFocus: false, masked: true, maskChar: '*' })
      const slot0 = otp.getSlotProps(0)
      return (
        <div>
          <FakeTextInput {...otp.hiddenInputProps} />
          <span data-testid="secure">{String(otp.hiddenInputProps.secureTextEntry)}</span>
          <span data-testid="mask-char">{slot0.maskChar}</span>
          <span data-testid="masked-flag">{String(slot0.masked)}</span>
        </div>
      )
    }
    render(<MaskedFixture />)
    expect(screen.getByTestId('secure').textContent).toBe('true')
    expect(screen.getByTestId('mask-char').textContent).toBe('*')
    expect(screen.getByTestId('masked-flag').textContent).toBe('true')
  })

  test('placeholder renders in empty slots', () => {
    render(<OTPFixture length={4} autoFocus={false} placeholder="o" />)
    expect(screen.getByTestId('slot-0').textContent).toBe('o')
  })

  test('separator options pass through from the hook', () => {
    function SeparatorFixture() {
      const otp = useOTP({ length: 6, autoFocus: false, separatorAfter: 3, separator: '*' })
      return (
        <>
          <span data-testid="sep-after">{String(otp.separatorAfter)}</span>
          <span data-testid="sep">{otp.separator}</span>
        </>
      )
    }
    render(<SeparatorFixture />)
    expect(screen.getByTestId('sep-after').textContent).toBe('3')
    expect(screen.getByTestId('sep').textContent).toBe('*')
  })

  test('timer counts down and fires onExpire', () => {
    jest.useFakeTimers()
    const onExpire = jest.fn()
    render(<OTPFixture length={6} autoFocus={false} timer={2} onExpire={onExpire} />)
    expect(screen.getByTestId('timer').textContent).toBe('2')
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.getByTestId('timer').textContent).toBe('1')
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.getByTestId('timer').textContent).toBe('0')
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  test('feedback runtime overrides fire on completion', () => {
    const hapticSpy = jest.fn()
    const soundSpy = jest.fn()
    render(
      <OTPFixture
        length={3}
        autoFocus={false}
        sound
        feedback={{ haptic: hapticSpy, sound: soundSpy }}
      />,
    )
    typeFullValue('123')
    expect(hapticSpy).toHaveBeenCalledTimes(1)
    expect(soundSpy).toHaveBeenCalledTimes(1)
  })

  test('feedback haptic override fires on setError', () => {
    const hapticSpy = jest.fn()
    render(<OTPFixture length={3} autoFocus={false} feedback={{ haptic: hapticSpy }} />)
    fireEvent.click(screen.getByTestId('set-error'))
    expect(hapticSpy).toHaveBeenCalledTimes(1)
  })

  test('haptic/sound disabled means no feedback calls', () => {
    const hapticSpy = jest.fn()
    const soundSpy = jest.fn()
    render(
      <OTPFixture
        length={3}
        autoFocus={false}
        haptic={false}
        sound={false}
        feedback={{ haptic: hapticSpy, sound: soundSpy }}
      />,
    )
    typeFullValue('123')
    expect(hapticSpy).not.toHaveBeenCalled()
    expect(soundSpy).not.toHaveBeenCalled()
  })

  test('focus(index) clamps out-of-range indices into the valid range', () => {
    function OutOfRangeFixture() {
      const otp = useOTP({ length: 4, autoFocus: false })
      return (
        <div>
          <FakeTextInput {...otp.hiddenInputProps} />
          <span data-testid="active">{otp.activeSlot}</span>
          <button data-testid="focus-oob" onClick={() => otp.focus(99)}>focus</button>
        </div>
      )
    }
    render(<OutOfRangeFixture />)
    fireEvent.click(screen.getByTestId('focus-oob'))
    expect(screen.getByTestId('active').textContent).toBe('3')
  })

  test('getCode and getSlots reflect current machine state', () => {
    function ImperativeFixture() {
      const otp = useOTP({ length: 3, autoFocus: false })
      return (
        <div>
          <FakeTextInput {...otp.hiddenInputProps} />
          <span data-testid="getcode">{otp.getCode()}</span>
          <span data-testid="getslots">{otp.getSlots().map((s) => s.value || '_').join(',')}</span>
        </div>
      )
    }
    render(<ImperativeFixture />)
    typeFullValue('12')
    expect(screen.getByTestId('getcode').textContent).toBe('12')
    expect(screen.getByTestId('getslots').textContent).toBe('1,2,_')
  })

  test('unmount tears down subscriptions without throwing', () => {
    const { unmount } = render(<OTPFixture length={4} autoFocus={false} />)
    expect(() => unmount()).not.toThrow()
  })
})
