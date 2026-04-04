/**
 * Shared controller primitives used by framework adapters and DOM wrappers.
 *
 * This module centralizes input filtering, external-value application, cursor
 * movement, and frame-scheduled DOM work so adapters can stay focused on
 * framework integration instead of duplicating OTP mechanics.
 */

import { filterString } from '../filter.js'
import type { InputType, OTPInstance, OTPStateSnapshot } from '../types.js'

/**
 * Convert a boolean to the CSS attribute string literal `'true'` or `'false'`.
 * Used by all adapters when building `data-*` slot attributes.
 */
export const boolAttr = (v: boolean): 'true' | 'false' => v ? 'true' : 'false'

/**
 * Instance-scoped scheduler used to coordinate deferred DOM work such as focus
 * and selection updates.
 */
export type FrameScheduler = {
  schedule: (callback: () => void) => void
  cancelAll: () => void
}

export type OTPKeyActionResult = {
  handled: boolean
  valueChanged: boolean
  nextSelection: number | null
}

/**
 * Shared filtering parameters for externally controlled values.
 */
export type ExternalValueParams = {
  length: number
  type: InputType
  pattern?: RegExp
}

export type ExternalValueSyncResult = {
  changed: boolean
  value: string
  snapshot: OTPStateSnapshot
}

type InputTarget =
  | HTMLInputElement
  | null
  | undefined
  | (() => HTMLInputElement | null | undefined)

function resolveInputTarget(target: InputTarget): HTMLInputElement | null | undefined {
  return typeof target === 'function' ? target() : target
}

/**
 * Clamp a requested slot index into the valid range for the current field.
 */
export function clampSlotIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length - 1))
}

/**
 * Create a frame scheduler that can cancel all queued callbacks during
 * unmount, destroy, or remount flows.
 */
export function createFrameScheduler(isActive: () => boolean = () => true): FrameScheduler {
  const pendingFrameIds = new Set<number>()

  return {
    schedule(callback: () => void): void {
      const frameId = requestAnimationFrame(() => {
        pendingFrameIds.delete(frameId)
        if (!isActive()) return
        callback()
      })
      pendingFrameIds.add(frameId)
    },
    cancelAll(): void {
      pendingFrameIds.forEach((frameId) => cancelAnimationFrame(frameId))
      pendingFrameIds.clear()
    },
  }
}

/**
 * Mirror the machine's joined code and selection state into the backing input.
 */
export function syncInputValue(
  input: HTMLInputElement | null | undefined,
  value: string,
  selection?: number,
): void {
  if (!input) return
  input.value = value
  if (selection !== undefined) input.setSelectionRange(selection, selection)
}

/**
 * Normalize an externally supplied value using the shared OTP filtering rules.
 */
export function filterExternalValue(
  raw: string,
  length: number,
  type: InputType,
  pattern?: RegExp,
): string {
  return filterString(raw.slice(0, length), type, pattern)
}

/**
 * Normalize direct user input while preserving the field length constraint.
 */
export function filterTypedValue(
  raw: string,
  length: number,
  type: InputType,
  pattern?: RegExp,
): string {
  return filterString(raw, type, pattern).slice(0, length)
}

/**
 * Insert a string sequentially into the machine starting at the given slot.
 */
export function insertCode(otp: OTPInstance, code: string, startSlot = 0): void {
  for (let i = 0; i < code.length; i++) otp.insert(code[i], startSlot + i)
}

/**
 * Replace the current machine value with a filtered external value.
 */
export function applyExternalValue(
  otp: OTPInstance,
  raw: string,
  params: ExternalValueParams,
): { value: string } {
  const value = filterExternalValue(raw, params.length, params.type, params.pattern)
  otp.reset()
  insertCode(otp, value)
  return { value }
}

/**
 * Reconcile an external value against the current machine state without doing
 * redundant resets when nothing actually changed.
 */
export function syncExternalValue(
  otp: OTPInstance,
  raw: string,
  params: ExternalValueParams,
): ExternalValueSyncResult {
  const pre = otp.getSnapshot()
  const value = filterExternalValue(raw, params.length, params.type, params.pattern)
  const current = pre.slotValues.join('')
  if (value === current) {
    return { changed: false, value, snapshot: pre }
  }

  applyExternalValue(otp, raw, params)
  return { changed: true, value, snapshot: otp.getSnapshot() }
}

/**
 * Re-filter the current machine value after a structural config change such as
 * `type` or `pattern`, while preserving the active slot as much as possible.
 */
export function migrateValueForConfigChange(
  otp: OTPInstance,
  params: ExternalValueParams,
): ExternalValueSyncResult {
  const pre = otp.getSnapshot()
  const current = pre.slotValues.join('')
  if (!current) {
    return { changed: false, value: '', snapshot: pre }
  }

  const value = filterExternalValue(current, params.length, params.type, params.pattern)
  if (value === current) {
    return { changed: false, value, snapshot: pre }
  }

  applyExternalValue(otp, current, params)
  otp.move(Math.min(pre.activeSlot, Math.max(value.length - 1, 0)))

  return { changed: true, value, snapshot: otp.getSnapshot() }
}

/**
 * Apply full-text input from the hidden input element to the machine.
 */
export function applyTypedInput(
  otp: OTPInstance,
  raw: string,
  params: { length: number; type: InputType; pattern?: RegExp },
): { value: string; nextSelection: number; isComplete: boolean } {
  if (!raw) {
    otp.reset()
    return { value: '', nextSelection: 0, isComplete: false }
  }

  const value = filterTypedValue(raw, params.length, params.type, params.pattern)
  otp.reset()
  insertCode(otp, value)

  const nextSelection = Math.min(value.length, params.length - 1)
  otp.move(nextSelection)

  return { value, nextSelection, isComplete: otp.getSnapshot().isComplete }
}

/**
 * Apply pasted text at the current cursor slot and return the resulting input
 * value plus the next selection position.
 */
export function applyPastedInput(
  otp: OTPInstance,
  text: string,
  position: number,
): { value: string; nextSelection: number; isComplete: boolean } {
  const pre = otp.getSnapshot()
  otp.paste(text, clampSlotIndex(position, pre.slotValues.length))
  const post = otp.getSnapshot()
  return {
    value: post.slotValues.join(''),
    nextSelection: post.activeSlot,
    isComplete: post.isComplete,
  }
}

/**
 * Interpret navigation and deletion keys against the OTP machine.
 */
export function handleOTPKeyAction(
  otp: OTPInstance,
  params: {
    key: string
    position: number
    length: number
    readOnly: boolean
    shiftKey?: boolean
  },
): OTPKeyActionResult {
  const { key, length, readOnly, shiftKey = false } = params
  const position = clampSlotIndex(params.position, length)

  switch (key) {
    case 'Backspace':
      if (readOnly) return { handled: true, valueChanged: false, nextSelection: null }
      return { handled: true, valueChanged: true, nextSelection: otp.delete(position).activeSlot }

    case 'Delete':
      if (readOnly) return { handled: true, valueChanged: false, nextSelection: null }
      otp.clear(position)
      return { handled: true, valueChanged: true, nextSelection: position }

    case 'ArrowLeft':
      return { handled: true, valueChanged: false, nextSelection: otp.move(position - 1).activeSlot }

    case 'ArrowRight':
      return { handled: true, valueChanged: false, nextSelection: otp.move(position + 1).activeSlot }

    case 'Tab': {
      if (shiftKey) {
        if (position === 0) return { handled: false, valueChanged: false, nextSelection: null }
        return { handled: true, valueChanged: false, nextSelection: otp.move(position - 1).activeSlot }
      }

      const pre = otp.getSnapshot()
      if (!pre.slotValues[position]) return { handled: false, valueChanged: false, nextSelection: null }
      if (position >= length - 1) return { handled: false, valueChanged: false, nextSelection: null }
      return { handled: true, valueChanged: false, nextSelection: otp.move(position + 1).activeSlot }
    }

    default:
      return { handled: false, valueChanged: false, nextSelection: null }
  }
}

/**
 * Synchronize the browser input selection with the machine's active slot.
 */
export function syncFocusSelection(
  otp: OTPInstance,
  input: HTMLInputElement | null | undefined,
  selectOnFocus: boolean,
): number {
  const snapshot = otp.getSnapshot()
  const position = snapshot.activeSlot
  const char = snapshot.slotValues[position]

  if (input) {
    if (selectOnFocus && char) input.setSelectionRange(position, position + 1)
    else input.setSelectionRange(position, position)
  }

  return position
}

/**
 * Queue a selection update on the backing input.
 */
export function scheduleInputSelection(
  scheduler: FrameScheduler,
  input: InputTarget,
  selection: number,
): void {
  scheduler.schedule(() => {
    const resolvedInput = resolveInputTarget(input)
    resolvedInput?.setSelectionRange(selection, selection)
  })
}

/**
 * Queue a blur on the backing input, typically after completion.
 */
export function scheduleInputBlur(
  scheduler: FrameScheduler,
  input: InputTarget,
  enabled = true,
): void {
  if (!enabled) return
  scheduler.schedule(() => {
    resolveInputTarget(input)?.blur()
  })
}

/**
 * Queue focus/selection synchronization after the DOM has committed.
 */
export function scheduleFocusSync(
  scheduler: FrameScheduler,
  otp: OTPInstance,
  input: InputTarget,
  selectOnFocus: boolean,
  afterSync?: () => void,
): void {
  scheduler.schedule(() => {
    syncFocusSelection(otp, resolveInputTarget(input), selectOnFocus)
    afterSync?.()
  })
}

/**
 * Queue focus on the backing input, optionally restoring a specific selection.
 */
export function scheduleInputFocus(
  scheduler: FrameScheduler,
  input: InputTarget,
  selection?: number,
): void {
  scheduler.schedule(() => {
    const resolvedInput = resolveInputTarget(input)
    if (!resolvedInput) return
    resolvedInput.focus()
    if (selection !== undefined) {
      resolvedInput.setSelectionRange(selection, selection)
    }
  })
}

/**
 * Reset the machine and clear the backing input in one shared helper.
 */
export function clearOTPInput(
  otp: OTPInstance,
  input: HTMLInputElement | null | undefined,
  options: { focus?: boolean; disabled?: boolean } = {},
): void {
  otp.reset()
  if (!input) return

  if (options.focus && !options.disabled) input.focus()
  syncInputValue(input, '', 0)
}

/**
 * Move the machine cursor, focus the backing input, and reflect the final
 * selection position back to the caller.
 */
export function focusOTPInput(
  otp: OTPInstance,
  input: HTMLInputElement | null | undefined,
  slotIndex: number,
): number {
  otp.move(slotIndex)
  const nextSelection = otp.getSnapshot().activeSlot
  if (input) {
    input.focus()
    input.setSelectionRange(nextSelection, nextSelection)
  }
  return nextSelection
}
