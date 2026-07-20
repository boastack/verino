/**
 * Opt-in timer persistence.
 *
 * Only absolute expiry timestamps are serialized. OTP characters, user IDs,
 * delivery addresses, and verification responses are intentionally outside
 * this contract.
 */

import type { TimerController, TimerSnapshot } from '../types.js'

export type KeyValueStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type TimerPersistenceOptions = {
  storage: KeyValueStorage
  key: string
  /** Wall-clock source used for validation. Defaults to `Date.now`. */
  now?: () => number
  /** Reject restored deadlines farther away than this. Defaults to 24 hours. */
  maxAgeMs?: number
}

export type TimerPersistence = {
  loadExpiresAt: () => number | null
  saveExpiresAt: (expiresAt: number) => void
  clear: () => void
  /** Persist running deadlines and clear expired entries. */
  bind: (timer: TimerController) => () => void
}

type StoredTimerDeadline = {
  version: 1
  expiresAt: number
}

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function createTimerPersistence(options: TimerPersistenceOptions): TimerPersistence {
  const { storage, key, now = () => Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS } = options

  if (!key.trim()) throw new TypeError('Timer persistence key must not be empty.')
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    throw new RangeError('Timer persistence maxAgeMs must be a positive finite number.')
  }

  function clear(): void {
    try { storage.removeItem(key) } catch { /* unavailable or denied storage */ }
  }

  function isValidDeadline(expiresAt: number): boolean {
    const currentTime = now()
    return Number.isFinite(expiresAt)
      && expiresAt > currentTime
      && expiresAt - currentTime <= maxAgeMs
  }

  function loadExpiresAt(): number | null {
    try {
      const raw = storage.getItem(key)
      if (raw === null) return null
      const stored = JSON.parse(raw) as Partial<StoredTimerDeadline>
      if (stored.version !== 1 || typeof stored.expiresAt !== 'number'
        || !isValidDeadline(stored.expiresAt)) {
        clear()
        return null
      }
      return stored.expiresAt
    } catch {
      clear()
      return null
    }
  }

  function saveExpiresAt(expiresAt: number): void {
    if (!isValidDeadline(expiresAt)) {
      clear()
      return
    }
    const value: StoredTimerDeadline = { version: 1, expiresAt }
    try { storage.setItem(key, JSON.stringify(value)) } catch { /* unavailable or denied storage */ }
  }

  function persistSnapshot(snapshot: TimerSnapshot): void {
    if (snapshot.isExpired) {
      clear()
    } else if (snapshot.isRunning && snapshot.expiresAt !== null) {
      saveExpiresAt(snapshot.expiresAt)
    }
  }

  function bind(timer: TimerController): () => void {
    persistSnapshot(timer.getSnapshot())
    return timer.subscribe(persistSnapshot)
  }

  return { loadExpiresAt, saveExpiresAt, clear, bind }
}
