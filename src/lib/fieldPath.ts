/**
 * Reads a value at a dot-separated path.
 * Numeric segments are treated as array indices.
 */
export function getAtPath(obj: unknown, path: string): unknown {
  const keys = path.split(".")
  let current: unknown = obj
  for (const key of keys) {
    if (current == null) return undefined
    const index = Number(key)
    if (Array.isArray(current) && Number.isFinite(index)) {
      current = current[index]
    } else {
      current = (current as Record<string, unknown>)[key]
    }
  }
  return current
}

/**
 * Returns an immutable clone of `obj` with the value at `path` replaced.
 * Each level is cloned (spread for objects, [...arr] for arrays).
 */
export function setAtPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".")
  if (keys.length === 0) return obj

  function recurse(current: unknown, depth: number): unknown {
    const key = keys[depth]
    const index = Number(key)
    const isArrayIndex = Array.isArray(current) && Number.isFinite(index)

    if (depth === keys.length - 1) {
      // Base case: set the value
      if (isArrayIndex) {
        const arr = [...(current as unknown[])]
        arr[index] = value
        return arr
      }
      return { ...(current as Record<string, unknown>), [key]: value }
    }

    // Recursive case: clone this level and recurse into the next
    if (isArrayIndex) {
      const arr = [...(current as unknown[])]
      arr[index] = recurse(arr[index], depth + 1)
      return arr
    }
    const rec = current as Record<string, unknown>
    return { ...rec, [key]: recurse(rec[key], depth + 1) }
  }

  return recurse(obj, 0) as T
}
