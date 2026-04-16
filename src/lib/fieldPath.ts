/**
 * Utilities for reading and writing deeply nested values via dot-separated
 * paths (e.g. "investment.packages.0.label"). Numeric segments are treated
 * as array indices when the current level is an array, or when the current
 * level is missing and needs to be created.
 */

function isNumericKey(key: string): boolean {
  // Strict: "0", "1", "42" — rejects "00", " 0", "0.5", ""
  if (key === "") return false
  const n = Number(key)
  return Number.isInteger(n) && n >= 0 && String(n) === key
}

/**
 * Reads a value at a dot-separated path. Returns undefined if any
 * intermediate segment is null/undefined or otherwise unreachable.
 */
export function getAtPath(obj: unknown, path: string): unknown {
  const keys = path.split(".")
  let current: unknown = obj
  for (const key of keys) {
    if (current == null) return undefined
    if (Array.isArray(current) && isNumericKey(key)) {
      current = current[Number(key)]
    } else {
      current = (current as Record<string, unknown>)[key]
    }
  }
  return current
}

/**
 * Returns an immutable clone of `obj` with the value at `path` set to
 * `value`. Each level is cloned (spread for objects, [...arr] for arrays).
 *
 * Growth semantics for arrays:
 *   - Setting at an existing index replaces that element.
 *   - Setting at index === length appends one element.
 *   - Setting at index > length is a silent no-op (catches typos).
 *   - Intermediate missing containers are materialized based on the next
 *     path segment: numeric → `[]`, non-numeric → `{}`. This lets callers
 *     write `scope.outcomes.0` even when `scope` or `outcomes` was missing.
 *
 * If the path can't be applied (out-of-bounds array index, traversing into
 * a primitive), the function logs a dev-time warning and returns the input
 * unchanged. We prefer loud failure over silent drift, but without throwing
 * so a single bad edit doesn't crash the whole batch.
 */
export function setAtPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".")
  if (keys.length === 0) return obj

  let reportedFailure = false
  function warn(reason: string) {
    if (reportedFailure) return
    reportedFailure = true
    if (typeof console !== "undefined") {
      console.warn(`setAtPath: "${path}" — ${reason}`)
    }
  }

  function recurse(current: unknown, depth: number): unknown {
    const key = keys[depth]
    const isIdx = isNumericKey(key)
    const index = isIdx ? Number(key) : -1
    const isLastKey = depth === keys.length - 1

    // Materialize missing containers based on whether THIS key is numeric.
    if (current == null) {
      current = isIdx ? [] : {}
    }

    if (isLastKey) {
      if (Array.isArray(current) && isIdx) {
        if (index < 0 || index > current.length) {
          warn(`array index ${index} out of bounds (length ${current.length})`)
          return current
        }
        const arr = [...current]
        arr[index] = value
        return arr
      }
      if (typeof current === "object") {
        return { ...(current as Record<string, unknown>), [key]: value }
      }
      warn(`cannot set "${key}" on primitive value`)
      return current
    }

    // Recursive step: figure out what container the NEXT level needs.
    const nextKey = keys[depth + 1]
    const placeholder: unknown = isNumericKey(nextKey) ? [] : {}

    if (Array.isArray(current) && isIdx) {
      if (index < 0 || index > current.length) {
        warn(`array index ${index} out of bounds (length ${current.length})`)
        return current
      }
      const arr = [...current]
      const existing = index < arr.length ? arr[index] : placeholder
      arr[index] = recurse(existing ?? placeholder, depth + 1)
      return arr
    }

    if (typeof current === "object") {
      const rec = current as Record<string, unknown>
      const existing = rec[key] ?? placeholder
      return { ...rec, [key]: recurse(existing, depth + 1) }
    }

    warn(`cannot traverse "${key}" on primitive value`)
    return current
  }

  return recurse(obj, 0) as T
}
