/**
 * Shared adapter policy for programmatic value application.
 *
 * Adapters use these helpers to keep `value`, `defaultValue`, and structural
 * config migration behavior aligned across frameworks.
 */
import type { OTPInstance } from '../types.js'
import {
  clampSlotIndex,
  migrateValueForConfigChange,
  syncExternalValue,
  type ExternalValueParams,
  type ExternalValueSyncResult,
} from './controller.js'

/**
 * Selection strategies used after applying a programmatic value.
 */
export type ValueSelectionMode = 'input-end' | 'slot-end' | 'active-slot'

/**
 * Shared result returned when adapters seed, sync, or migrate programmatic
 * values.
 */
export type ProgrammaticValueResult = ExternalValueSyncResult & {
  nextSelection: number
}

type PreserveSelectionMode = {
  preserveActiveSlot: number
}

function resolveNextSelection(
  result: ExternalValueSyncResult,
  params: ExternalValueParams,
  mode: ValueSelectionMode,
): number {
  switch (mode) {
    case 'active-slot':
      return result.snapshot.activeSlot

    case 'slot-end':
      return Math.min(result.value.length, params.length - 1)

    case 'input-end':
    default:
      return result.value.length
  }
}

/**
 * Apply a live externally controlled value and compute the selection policy
 * the adapter should reflect into its hidden input.
 */
export function syncProgrammaticValue(
  otp: OTPInstance,
  raw: string,
  params: ExternalValueParams,
  mode: ValueSelectionMode = 'input-end',
): ProgrammaticValueResult {
  const result = syncExternalValue(otp, raw, params)

  return {
    ...result,
    nextSelection: resolveNextSelection(result, params, mode),
  }
}

/**
 * Seed a one-time value into the machine, optionally preserving a previously
 * active slot during rebuild flows.
 */
export function seedProgrammaticValue(
  otp: OTPInstance,
  raw: string,
  params: ExternalValueParams,
  mode: ValueSelectionMode | PreserveSelectionMode = 'input-end',
): ProgrammaticValueResult {
  const result = syncExternalValue(otp, raw, params)

  if (typeof mode === 'object') {
    const nextSelection = clampSlotIndex(
      Math.min(mode.preserveActiveSlot, Math.max(result.value.length - 1, 0)),
      params.length,
    )

    if (result.changed) {
      otp.move(nextSelection)
      return {
        changed: true,
        value: result.value,
        snapshot: otp.getSnapshot(),
        nextSelection,
      }
    }

    return {
      ...result,
      nextSelection,
    }
  }

  return {
    ...result,
    nextSelection: resolveNextSelection(result, params, mode),
  }
}

/**
 * Reconcile the current machine value after a structural config change while
 * preserving the machine-selected active slot.
 */
export function migrateProgrammaticValue(
  otp: OTPInstance,
  params: ExternalValueParams,
): ProgrammaticValueResult {
  const result = migrateValueForConfigChange(otp, params)

  return {
    ...result,
    nextSelection: result.snapshot.activeSlot,
  }
}
