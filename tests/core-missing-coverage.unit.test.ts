/**
 * core-missing-coverage.unit.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Targeted tests for branches/statements uncovered by the main core.test.ts and
 * core-toolkit.unit.test.ts suites. Each describe block targets a specific file
 * and the exact uncovered lines reported by Istanbul.
 *
 * Run: pnpm test tests/core-missing-coverage.unit.test.ts
 */

import {
  parseBooleanish,
  parseSeparatorAfter,
  createOTP,
} from '@verino/core'

import {
  seedProgrammaticValue,
  syncProgrammaticValue,
  createResendTimer,
  applyTypedInput,
} from '@verino/core/toolkit'


// ─────────────────────────────────────────────────────────────────────────────
// filter.ts — parseBooleanish number branch (lines 44-46)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseBooleanish — number branch', () => {
  it('returns true for a non-zero number', () => {
    expect(parseBooleanish(1, false)).toBe(true)
    expect(parseBooleanish(42, false)).toBe(true)
    expect(parseBooleanish(-1, false)).toBe(true)
  })

  it('returns false for zero', () => {
    expect(parseBooleanish(0, true)).toBe(false)
  })

  it('number value takes precedence over fallback', () => {
    expect(parseBooleanish(0, false)).toBe(false)
    expect(parseBooleanish(1, true)).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// filter.ts — parseSeparatorAfter fallback branches (lines 64, 72-76)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseSeparatorAfter — fallback branches', () => {
  // Line 64: array where ALL entries are invalid → return fallback
  it('returns fallback when all array entries are non-integer', () => {
    expect(parseSeparatorAfter([{}, 'bad', null], [])).toEqual([])
    expect(parseSeparatorAfter(['x', 'y'], 0)).toBe(0)
  })

  // Lines 72-76: comma-string where all entries are NaN → return fallback
  it('returns fallback when comma-string entries all parse to NaN', () => {
    expect(parseSeparatorAfter('bad,worse', 0)).toBe(0)
    expect(parseSeparatorAfter('abc,def', [])).toEqual([])
  })

  // Line 76: n < 1 → return fallback  (value '0' parses to 0, min is 1)
  it('returns fallback when numeric string is less than 1', () => {
    expect(parseSeparatorAfter('0', 3)).toBe(3)
    expect(parseSeparatorAfter('-5', 0)).toBe(0)
  })

  // filter.ts line 20 (parseInteger): non-string/non-number arg hits the NaN branch
  it('returns fallback when a non-numeric object is the sole array entry', () => {
    // parseInteger({}) → neither string nor number → NaN → filtered out → fallback
    const result = parseSeparatorAfter([{}], 99)
    expect(result).toBe(99)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// machine.ts — duplicate idBase warning (line 114)
// ─────────────────────────────────────────────────────────────────────────────

describe('createOTP — duplicate idBase warning', () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('warns when two live instances share the same idBase', () => {
    const a = createOTP({ idBase: 'test-dup-id-unique-a' })
    const b = createOTP({ idBase: 'test-dup-id-unique-a' })   // triggers duplicate warning
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate instance ID'),
    )
    a.destroy()
    b.destroy()
  })

  it('does not warn when idBase values are different', () => {
    const a = createOTP({ idBase: 'no-dup-id-x' })
    const b = createOTP({ idBase: 'no-dup-id-y' })
    expect(warnSpy).not.toHaveBeenCalled()
    a.destroy()
    b.destroy()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// adapter-policy.ts — 'active-slot' selection mode (line 40)
// ─────────────────────────────────────────────────────────────────────────────

describe('syncProgrammaticValue — active-slot mode (adapter-policy line 40)', () => {
  it("returns the machine's activeSlot as nextSelection when mode='active-slot'", () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    otp.move(2)

    const result = syncProgrammaticValue(otp, '12', { length: 4, type: 'numeric' }, 'active-slot')

    expect(result.changed).toBe(true)
    expect(result.value).toBe('12')
    // 'active-slot' returns snapshot.activeSlot, not value.length
    expect(result.nextSelection).toBe(result.snapshot.activeSlot)
  })

  it("'slot-end' mode clamps to min(value.length, length-1)", () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    const result = syncProgrammaticValue(otp, '12', { length: 4, type: 'numeric' }, 'slot-end')

    expect(result.nextSelection).toBe(Math.min(result.value.length, 4 - 1))
  })

  it("default mode 'input-end' returns value.length as nextSelection", () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    // Call without mode — exercises the default parameter branch
    const result = syncProgrammaticValue(otp, '12', { length: 4, type: 'numeric' })
    expect(result.nextSelection).toBe(result.value.length)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// adapter-policy.ts — seedProgrammaticValue preserveActiveSlot when unchanged (line 97)
// ─────────────────────────────────────────────────────────────────────────────

describe('seedProgrammaticValue — default input-end mode', () => {
  it("default mode 'input-end' returns value.length as nextSelection", () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    // Call without mode — exercises the default parameter branch
    const result = seedProgrammaticValue(otp, '12', { length: 4, type: 'numeric' })
    expect(result.nextSelection).toBe(result.value.length)
  })
})


describe('seedProgrammaticValue — preserveActiveSlot unchanged path (adapter-policy line 97)', () => {
  it('returns unchanged result with clamped nextSelection when value did not change', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    // First seed: apply '12'
    seedProgrammaticValue(otp, '12', { length: 4, type: 'numeric' }, { preserveActiveSlot: 2 })

    // Second seed with the same value → changed=false → hits the !result.changed branch (line 97)
    const result = seedProgrammaticValue(
      otp,
      '12',
      { length: 4, type: 'numeric' },
      { preserveActiveSlot: 1 },
    )

    expect(result.changed).toBe(false)
    expect(result.value).toBe('12')
    // nextSelection is clamped: min(preserveActiveSlot, max(value.length-1, 0)) → min(1, 1) = 1
    expect(result.nextSelection).toBe(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// timer-policy.ts — timerSeconds <= 0 noop branch (lines 52-59)
// ─────────────────────────────────────────────────────────────────────────────

describe('createResendTimer — timerSeconds <= 0 noop path (timer-policy lines 52-59)', () => {
  it('start/stop/restartMain/handleExternalReset are all noops when timerSeconds=0', () => {
    const clearField = jest.fn()
    const onResend   = jest.fn()
    const showTimer  = jest.fn()
    const showResend = jest.fn()

    const timer = createResendTimer({
      timerSeconds:   0,
      resendCooldown: 5,
      showTimer,
      showResend,
      clearField,
      onResend,
    })

    expect(() => timer.start()).not.toThrow()
    expect(() => timer.stop()).not.toThrow()
    expect(() => timer.restartMain()).not.toThrow()
    expect(() => timer.handleExternalReset()).not.toThrow()

    // showTimer/showResend are NOT called by the noop path
    expect(showTimer).not.toHaveBeenCalled()
    expect(showResend).not.toHaveBeenCalled()
  })

  it('resend() calls clearField and onResend even when timerSeconds=0', () => {
    const clearField = jest.fn()
    const onResend   = jest.fn()

    const timer = createResendTimer({
      timerSeconds:   0,
      resendCooldown: 5,
      showTimer:  () => {},
      showResend: () => {},
      clearField,
      onResend,
    })

    timer.resend()

    expect(clearField).toHaveBeenCalledTimes(1)
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('resend() works when onResend is undefined (timerSeconds=0)', () => {
    const clearField = jest.fn()

    const timer = createResendTimer({
      timerSeconds:   0,
      resendCooldown: 5,
      showTimer:  () => {},
      showResend: () => {},
      clearField,
    })

    expect(() => timer.resend()).not.toThrow()
    expect(clearField).toHaveBeenCalledTimes(1)
  })

  it('negative timerSeconds also produces noop timers', () => {
    const clearField = jest.fn()
    const timer = createResendTimer({
      timerSeconds:   -10,
      resendCooldown: 5,
      showTimer:  () => {},
      showResend: () => {},
      clearField,
    })

    expect(() => timer.start()).not.toThrow()
    timer.resend()
    expect(clearField).toHaveBeenCalledTimes(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// filter.ts — parseBooleanish string that's neither '' nor 'true'/'false' (line 44)
// The branch: normalized string that isn't '' or 'true' but also isn't 'false'
// falls through to the final `return fallback`. Covered by a value like ' other '.
// ─────────────────────────────────────────────────────────────────────────────

describe('parseBooleanish — unrecognised string falls back', () => {
  it('returns fallback for strings that are not "true", "false", or ""', () => {
    expect(parseBooleanish('yes', false)).toBe(false)
    expect(parseBooleanish('yes', true)).toBe(true)
    expect(parseBooleanish('1', false)).toBe(false)
    expect(parseBooleanish('no', true)).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// adapter-policy.ts — seedProgrammaticValue preserveActiveSlot changed=true (lines 82-95)
// ─────────────────────────────────────────────────────────────────────────────

describe('seedProgrammaticValue — preserveActiveSlot changed=true path (adapter-policy lines 82-95)', () => {
  it('calls otp.move(nextSelection) and returns changed=true when value changes', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })

    // First call: empty machine + new value → changed=true → hits the result.changed branch
    const result = seedProgrammaticValue(
      otp,
      '1234',
      { length: 4, type: 'numeric' },
      { preserveActiveSlot: 2 },
    )

    expect(result.changed).toBe(true)
    expect(result.value).toBe('1234')
    // nextSelection = clamp(min(2, max(4-1,0)), 4) = clamp(min(2,3),4) = 2
    expect(result.nextSelection).toBe(2)
    expect(result.snapshot.activeSlot).toBe(2)
  })

  it('preserveActiveSlot is clamped when value is shorter than requested slot', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })

    const result = seedProgrammaticValue(
      otp,
      '12',     // only 2 chars → value.length-1 = 1 is the max meaningful slot
      { length: 4, type: 'numeric' },
      { preserveActiveSlot: 3 },  // 3 > value.length-1=1 → clamped to 1
    )

    expect(result.changed).toBe(true)
    expect(result.nextSelection).toBe(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// controller.ts — applyTypedInput empty-string path (lines 198-200)
// ─────────────────────────────────────────────────────────────────────────────

describe('applyTypedInput — empty string path (controller.ts lines 198-200)', () => {
  it('resets the machine and returns empty value when raw is empty', () => {
    const otp = createOTP({ length: 4, type: 'numeric' })
    // Pre-fill some slots
    otp.insert('1', 0)
    otp.insert('2', 1)

    const result = applyTypedInput(otp, '', { length: 4, type: 'numeric' })

    expect(result.value).toBe('')
    expect(result.nextSelection).toBe(0)
    expect(result.isComplete).toBe(false)
    expect(otp.getCode()).toBe('')
  })
})
