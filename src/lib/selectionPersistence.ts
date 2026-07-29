// src/lib/selectionPersistence.ts

import type { ConfirmedSelection } from "@/types/proposal"

const KEY_PREFIX = "proposl:selection:"

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

export function loadSelection(proposalId: string): ConfirmedSelection | null {
  if (!proposalId || !hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(storageKey(proposalId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.selection) return null
    const selection = parsed.selection as ConfirmedSelection
    // Anything without a package id is not a selection we can restore.
    if (!selection.packageId || !Array.isArray(selection.addOns)) return null
    return selection
  } catch {
    return null
  }
}

export function saveSelection(proposalId: string, selection: ConfirmedSelection): void {
  if (!proposalId || !hasStorage()) return
  try {
    const payload = JSON.stringify({ selection, savedAt: Date.now() })
    window.localStorage.setItem(storageKey(proposalId), payload)
  } catch {
    // Quota exceeded or storage disabled. Fail silently. The in-memory
    // selection still works; we just lose reload resilience.
  }
}

export function clearSelection(proposalId: string): void {
  if (!proposalId || !hasStorage()) return
  try {
    window.localStorage.removeItem(storageKey(proposalId))
  } catch {
    // Ignore.
  }
}
