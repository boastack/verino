/**
 * verino/core/filter
 * ─────────────────────────────────────────────────────────────────────────────
 * Character filtering utilities — exported for use by all adapters.
 */

import type { InputType } from './types.js'

export const INPUT_TYPES = ['numeric', 'alphabet', 'alphanumeric', 'any'] as const
const INPUT_TYPE_SET = new Set<string>(INPUT_TYPES)

function parseInteger(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN

  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

/** Runtime guard for external values that claim to be an InputType. */
export function isInputType(value: unknown): value is InputType {
  return typeof value === 'string' && INPUT_TYPE_SET.has(value)
}

/** Parse a runtime value into a supported InputType, falling back safely. */
export function parseInputType(value: unknown, fallback: InputType = 'numeric'): InputType {
  return isInputType(value) ? value : fallback
}

/** Parse a boolean-ish runtime value safely, preserving an explicit fallback. */
export function parseBooleanish(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '' || normalized === 'true') return true
    if (normalized === 'false') return false
  }
  if (typeof value === 'number') return value !== 0
  return fallback
}

/**
 * Parse `separatorAfter` values from numbers, arrays, or comma-separated strings.
 * Returns a single number for single-position inputs and an array for multi-position inputs.
 */
export function parseSeparatorAfter(
  value: unknown,
  fallback: number | number[] = 0,
): number | number[] {
  if (value === null || value === undefined || value === '') return fallback

  if (Array.isArray(value)) {
    const parsed = value
      .map((entry) => parseInteger(entry, Number.NaN, 1))
      .filter((entry) => !Number.isNaN(entry))
    return parsed.length > 0 ? parsed : fallback
  }

  if (typeof value === 'string' && value.includes(',')) {
    const parsed = value
      .split(',')
      .map((entry) => parseInteger(entry.trim(), Number.NaN, 1))
      .filter((entry) => !Number.isNaN(entry))
    return parsed.length > 0 ? parsed : fallback
  }

  const n = parseInteger(value, Number.NaN)
  if (Number.isNaN(n) || n < 1) return fallback
  return n
}

/**
 * Returns `char` unchanged if it is valid for `type` (and optional `pattern`),
 * or `''` if the character should be rejected.
 *
 * Single-character strings only — multi-character strings always return `''`
 * to prevent surrogate-pair or multi-codepoint sequences from slipping through.
 *
 * When `pattern` is provided it takes precedence over `type` for character
 * validation. `type` still controls `inputMode` and ARIA labels on the hidden input.
 *
 * @param char    - Single character to validate. Returns `''` if `char.length !== 1`.
 * @param type    - Accepted character class when no `pattern` is given.
 * @param pattern - Optional per-character regex that overrides `type`.
 * @returns The original `char` if valid, otherwise `''`.
 *
 * @example filterChar('5', 'numeric')           // → '5'
 * @example filterChar('A', 'numeric')           // → ''
 * @example filterChar('A', 'alphabet')          // → 'A'
 * @example filterChar('A', 'numeric', /^[A-F]$/) // → 'A'  (pattern overrides type)
 */
export function filterChar(char: string, type: InputType, pattern?: RegExp): string {
  if (!char || char.length !== 1) return ''
  if (pattern !== undefined) {
    // A pattern with the /g flag has stateful lastIndex. Reset it before every
    // test so the same pattern can be reused safely across multiple characters
    // without alternating between matches.
    if (pattern.global) pattern.lastIndex = 0
    return pattern.test(char) ? char : ''
  }
  switch (type) {
    case 'numeric':      return /^[0-9]$/.test(char)       ? char : ''
    case 'alphabet':     return /^[a-zA-Z]$/.test(char)    ? char : ''
    case 'alphanumeric': return /^[a-zA-Z0-9]$/.test(char) ? char : ''
    case 'any':          return char
    default:             return ''
  }
}

/**
 * Filters every character in `str` through `filterChar` and returns only the
 * characters that pass validation, joined into a new string.
 *
 * Used to sanitize pasted text and controlled-value inputs before they are
 * distributed into slots.
 *
 * When `pattern` is provided it takes precedence over `type` for each character.
 *
 * @param str     - The raw string to filter (e.g. clipboard text or a controlled value).
 * @param type    - Accepted character class when no `pattern` is given.
 * @param pattern - Optional per-character regex that overrides `type`.
 * @returns A new string containing only the valid characters from `str`.
 *
 * @example filterString('a1b2', 'numeric')  // → '12'
 * @example filterString('ABC123', 'alphabet') // → 'ABC'
 */
export function filterString(str: string, type: InputType, pattern?: RegExp): string {
  // Array.from iterates over Unicode code points, not UTF-16 code units.
  // str.split('') would split emoji and other supplementary-plane characters
  // into surrogate pairs (two strings of length 1 each), causing filterChar
  // to accept broken half-surrogates into slots for type:'any'.
  return Array.from(str).filter(c => filterChar(c, type, pattern) !== '').join('')
}
