// src/lib/intakePersistence.ts

import type { UIMessage } from "ai"

const KEY_PREFIX = "proposl:intake:"

function storageKey(proposalId: string) {
  return `${KEY_PREFIX}${proposalId}`
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage
  } catch {
    return false
  }
}

export function loadIntake(proposalId: string): UIMessage[] | null {
  if (!proposalId || !hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(storageKey(proposalId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.messages)) return null
    return parsed.messages as UIMessage[]
  } catch {
    return null
  }
}

export function saveIntake(proposalId: string, messages: UIMessage[]): void {
  if (!proposalId || !hasStorage()) return
  try {
    const payload = JSON.stringify({ messages, savedAt: Date.now() })
    window.localStorage.setItem(storageKey(proposalId), payload)
  } catch {
    // Quota exceeded or storage disabled. Fail silently. In-memory
    // conversation continues to work; we just lose reload resilience.
  }
}

export function clearIntake(proposalId: string): void {
  if (!proposalId || !hasStorage()) return
  try {
    window.localStorage.removeItem(storageKey(proposalId))
  } catch {
    // Ignore.
  }
}
