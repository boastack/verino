/** @jest-environment jsdom */

import React, { useState } from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import { createApp, defineComponent, nextTick, ref } from 'vue'
import { writable } from 'svelte/store'

import { useOTP as useReactOTP } from '@verino/react'
import type { ReactOTPOptions } from '@verino/react'
import { useOTP as useVueOTP } from '@verino/vue'
import type { VueOTPOptions } from '@verino/vue'
import { useOTP as useSvelteOTP } from '@verino/svelte'
import type { SvelteOTPOptions } from '@verino/svelte'
import { VerinoAlpine } from '@verino/alpine'
import { initOTP } from '@verino/vanilla'
import { VerinoInput } from '@verino/web-component'
import type { TimerController } from '@verino/core'

let rafQueue: FrameRequestCallback[] = []

beforeEach(() => {
  rafQueue = []
  Object.defineProperty(global, 'requestAnimationFrame', {
    value: (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length },
    writable: true,
    configurable: true,
  })
  Object.defineProperty(global, 'cancelAnimationFrame', {
    value: () => {},
    writable: true,
    configurable: true,
  })
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
  document.getElementById('verino-alpine-styles')?.remove()
  document.getElementById('verino-styles')?.remove()
})

afterEach(() => {
  jest.restoreAllMocks()
})

type ContractHarness = {
  getCode: () => string
  getTimer: () => TimerController
  typeValue: (value: string) => Promise<void>
  cleanup: () => Promise<void> | void
  onComplete: jest.Mock
}

type ControlledHarness = ContractHarness & {
  setExternalValue: (value: string) => Promise<void>
}

function mountReact(options: Partial<ReactOTPOptions> = {}): ContractHarness {
  const onComplete = jest.fn()
  let timer!: TimerController

  function Fixture(props: Partial<ReactOTPOptions>) {
    const otp = useReactOTP({ length: 4, autoFocus: false, ...props, onComplete })
    timer = otp.timer
    return (
      <div>
        <input data-testid="react-input" {...otp.hiddenInputProps} autoFocus={false} />
        <span data-testid="react-code">{otp.getCode()}</span>
      </div>
    )
  }

  const view = render(<Fixture {...options} />)
  const input = view.getByTestId('react-input') as HTMLInputElement
  const code = view.getByTestId('react-code')

  return {
    onComplete,
    getCode: () => code.textContent ?? '',
    getTimer: () => timer,
    async typeValue(value: string) {
      act(() => {
        fireEvent.change(input, { target: { value } })
      })
    },
    cleanup: () => { view.unmount() },
  }
}

function mountControlledReact(initialValue = ''): ControlledHarness {
  const onComplete = jest.fn()
  let setExternalValue!: React.Dispatch<React.SetStateAction<string>>
  let timer!: TimerController

  function Fixture() {
    const [value, setValue] = useState(initialValue)
    setExternalValue = setValue
    const otp = useReactOTP({ length: 4, autoFocus: false, value, onChange: setValue, onComplete })
    timer = otp.timer
    return (
      <div>
        <input data-testid="react-input" {...otp.hiddenInputProps} autoFocus={false} />
        <span data-testid="react-code">{otp.getCode()}</span>
      </div>
    )
  }

  const view = render(<Fixture />)
  const input = view.getByTestId('react-input') as HTMLInputElement
  const code = view.getByTestId('react-code')

  return {
    onComplete,
    getCode: () => code.textContent ?? '',
    getTimer: () => timer,
    async setExternalValue(value: string) {
      act(() => { setExternalValue(value) })
    },
    async typeValue(value: string) {
      act(() => {
        fireEvent.change(input, { target: { value } })
      })
    },
    cleanup: () => { view.unmount() },
  }
}

async function mountVue(options: Partial<VueOTPOptions> = {}): Promise<ContractHarness> {
  const onComplete = jest.fn()
  let otpResult!: ReturnType<typeof useVueOTP>

  const App = defineComponent({
    setup() {
      otpResult = useVueOTP({ length: 4, autoFocus: false, ...options, onComplete })
      return { otp: otpResult }
    },
    template: `<div><input :ref="(el) => { if (el) otp.inputRef.value = el }" /></div>`,
  })

  const div = document.createElement('div')
  document.body.appendChild(div)
  const app = createApp(App)
  app.mount(div)
  await nextTick()

  const input = div.querySelector('input') as HTMLInputElement

  return {
    onComplete,
    getCode: () => otpResult.getCode(),
    getTimer: () => otpResult.timer,
    async typeValue(value: string) {
      input.value = value
      const event = new Event('input')
      Object.defineProperty(event, 'target', { value: input, enumerable: true })
      otpResult.onChange(event)
      await nextTick()
    },
    async cleanup() {
      app.unmount()
      div.remove()
      await nextTick()
    },
  }
}

async function mountControlledVue(initialValue = ''): Promise<ControlledHarness> {
  const controlledValue = ref(initialValue)
  const onComplete = jest.fn()
  let otpResult!: ReturnType<typeof useVueOTP>

  const App = defineComponent({
    setup() {
      otpResult = useVueOTP({ length: 4, autoFocus: false, value: controlledValue, onComplete })
      return { otp: otpResult }
    },
    template: `<div><input :ref="(el) => { if (el) otp.inputRef.value = el }" /></div>`,
  })

  const div = document.createElement('div')
  document.body.appendChild(div)
  const app = createApp(App)
  app.mount(div)
  await nextTick()

  const input = div.querySelector('input') as HTMLInputElement

  return {
    onComplete,
    getCode: () => otpResult.getCode(),
    getTimer: () => otpResult.timer,
    async setExternalValue(value: string) {
      controlledValue.value = value
      await nextTick()
    },
    async typeValue(value: string) {
      input.value = value
      const event = new Event('input')
      Object.defineProperty(event, 'target', { value: input, enumerable: true })
      otpResult.onChange(event)
      await nextTick()
    },
    async cleanup() {
      app.unmount()
      div.remove()
      await nextTick()
    },
  }
}

function mountSvelte(options: Partial<SvelteOTPOptions> = {}): ContractHarness {
  const onComplete = jest.fn()
  const otp = useSvelteOTP({ length: 4, autoFocus: false, ...options, onComplete })
  const input = document.createElement('input')
  document.body.appendChild(input)
  const action = otp.action(input)

  return {
    onComplete,
    getCode: () => otp.getCode(),
    getTimer: () => otp.timer,
    async typeValue(value: string) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    cleanup: () => {
      action.destroy()
      input.remove()
    },
  }
}

function mountControlledSvelte(initialValue = ''): ControlledHarness {
  const controlledValue = writable(initialValue)
  const onComplete = jest.fn()
  const otp = useSvelteOTP({ length: 4, autoFocus: false, value: controlledValue, onComplete })
  const input = document.createElement('input')
  document.body.appendChild(input)
  const action = otp.action(input)

  return {
    onComplete,
    getCode: () => otp.getCode(),
    getTimer: () => otp.timer,
    async setExternalValue(value: string) {
      controlledValue.set(value)
    },
    async typeValue(value: string) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    cleanup: () => {
      action.destroy()
      input.remove()
    },
  }
}

function mountAlpine(options: Record<string, unknown> = {}): ContractHarness {
  const onComplete = jest.fn()
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  let handler: ((el: HTMLElement, data: unknown, utils: unknown) => { cleanup(): void }) | null = null

  VerinoAlpine({
    directive: (_name: string, fn: typeof handler) => { handler = fn },
  } as Parameters<typeof VerinoAlpine>[0])

  const result = handler!(
    wrapper,
    { expression: 'opts', value: '', modifiers: [] },
    {
      evaluate: () => ({ autoFocus: false, ...options, onComplete }),
      evaluateLater: () => (callback: (value: unknown) => void) => { callback({ autoFocus: false, ...options, onComplete }) },
      cleanup: () => {},
      effect: (fn: () => void) => { fn() },
    },
  )

  const api = (wrapper as unknown as HTMLElement & { _verino: { getCode(): string; timer: TimerController } })._verino
  const input = wrapper.querySelector('input') as HTMLInputElement

  return {
    onComplete,
    getCode: () => api.getCode(),
    getTimer: () => api.timer,
    async typeValue(value: string) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    cleanup: () => {
      result.cleanup()
      wrapper.remove()
    },
  }
}

function mountVanilla(options: Parameters<typeof initOTP>[1] = {}): ContractHarness {
  const onComplete = jest.fn()
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)
  const [instance] = initOTP(wrapper, { autoFocus: false, ...options, onComplete })
  const input = wrapper.querySelector('.verino-hidden-input') as HTMLInputElement

  return {
    onComplete,
    getCode: () => instance.getCode(),
    getTimer: () => instance.timer,
    async typeValue(value: string) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    cleanup: () => {
      instance.destroy()
      wrapper.remove()
    },
  }
}

function mountWebComponent(options: { defaultValue?: string; readOnly?: boolean; timer?: number } = {}): ContractHarness {
  const onComplete = jest.fn()
  const el = new VerinoInput()
  el.setAttribute('length', '4')
  el.setAttribute('auto-focus', 'false')
  if (options.defaultValue) el.setAttribute('default-value', options.defaultValue)
  if (options.readOnly) el.setAttribute('readonly', '')
  if (options.timer !== undefined) el.setAttribute('timer', String(options.timer))
  el.onComplete = onComplete
  document.body.appendChild(el)
  const input = el.shadowRoot!.querySelector('.verino-wc-hidden') as HTMLInputElement

  return {
    onComplete,
    getCode: () => el.getCode(),
    getTimer: () => el.timer,
    async typeValue(value: string) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    cleanup: () => {
      el.remove()
    },
  }
}

const defaultValueCases: Array<[string, () => Promise<ContractHarness> | ContractHarness]> = [
  ['React', () => mountReact({ defaultValue: '1234' })],
  ['Vue', () => mountVue({ defaultValue: '1234' })],
  ['Svelte', () => mountSvelte({ defaultValue: '1234' })],
  ['Alpine', () => mountAlpine({ defaultValue: '1234' })],
  ['Vanilla', () => mountVanilla({ defaultValue: '1234' })],
  ['Web Component', () => mountWebComponent({ defaultValue: '1234' })],
]

const readOnlyCases: Array<[string, () => Promise<ContractHarness> | ContractHarness]> = [
  ['React', () => mountReact({ readOnly: true })],
  ['Vue', () => mountVue({ readOnly: true })],
  ['Svelte', () => mountSvelte({ readOnly: true })],
  ['Alpine', () => mountAlpine({ readOnly: true })],
  ['Vanilla', () => mountVanilla({ readOnly: true })],
  ['Web Component', () => mountWebComponent({ readOnly: true })],
]

const controlledCases: Array<[string, () => Promise<ControlledHarness> | ControlledHarness]> = [
  ['React', () => mountControlledReact('')],
  ['Vue', () => mountControlledVue('')],
  ['Svelte', () => mountControlledSvelte('')],
]

const timerCases: Array<[string, () => Promise<ContractHarness> | ContractHarness]> = [
  ['React', () => mountReact({ timer: 30 })],
  ['Vue', () => mountVue({ timer: 30 })],
  ['Svelte', () => mountSvelte({ timer: 30 })],
  ['Alpine', () => mountAlpine({ timer: 30 })],
  ['Vanilla', () => mountVanilla({ timer: 30 })],
  ['Web Component', () => mountWebComponent({ timer: 30 })],
]

describe('shared adapter contract — defaultValue', () => {
  it.each(defaultValueCases)('%s pre-fills without triggering onComplete', async (_name, mount) => {
    const harness = await mount()
    try {
      expect(harness.getCode()).toBe('1234')
      expect(harness.onComplete).not.toHaveBeenCalled()
    } finally {
      await harness.cleanup()
    }
  })
})

describe('shared adapter contract — readOnly', () => {
  it.each(readOnlyCases)('%s blocks user typing when readOnly=true', async (_name, mount) => {
    const harness = await mount()
    try {
      await harness.typeValue('1234')
      expect(harness.getCode()).toBe('')
      expect(harness.onComplete).not.toHaveBeenCalled()
    } finally {
      await harness.cleanup()
    }
  })
})

describe('shared adapter contract — live external value control', () => {
  it.each(controlledCases)('%s applies external value updates without triggering onComplete', async (_name, mount) => {
    const harness = await mount()
    try {
      await harness.setExternalValue('1234')
      expect(harness.getCode()).toBe('1234')
      expect(harness.onComplete).not.toHaveBeenCalled()
    } finally {
      await harness.cleanup()
    }
  })
})

describe('shared adapter contract — timer controller', () => {
  it.each(timerCases)('%s exposes the live countdown controller', async (_name, mount) => {
    const harness = await mount()
    try {
      const timer = harness.getTimer()
      expect(timer.getRemaining()).toBe(30)

      const listener = jest.fn()
      const unsubscribe = timer.subscribe(listener)
      act(() => { timer.pause() })
      expect(timer.getSnapshot().isRunning).toBe(false)
      expect(listener).toHaveBeenCalled()

      act(() => { timer.resume() })
      expect(timer.getSnapshot().isRunning).toBe(true)
      act(() => { timer.stop() })
      unsubscribe()
    } finally {
      await harness.cleanup()
    }
  })
})
