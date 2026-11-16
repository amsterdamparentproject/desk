'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useState that survives a page refresh (localStorage). It starts with the
 * default so server and client render the same HTML, then restores the saved
 * value right after mount. A saved value is only used if `isValid` accepts it,
 * so a stale choice (a renamed tab, say) falls back to the default.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial)
  const restored = useRef(false)
  const validRef = useRef(isValid)

  useEffect(() => {
    validRef.current = isValid
  })

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(key)
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw)
          if (validRef.current(parsed)) setValue(parsed)
        }
      } catch {
        // Storage unavailable or corrupt: keep the default.
      }
      restored.current = true
    }, 0)
    return () => clearTimeout(t)
  }, [key])

  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Ignore: persistence is a convenience.
      }
    },
    [key]
  )

  return [value, set]
}

export const oneOf =
  <T extends string>(options: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (options as readonly string[]).includes(value)

export const isBool = (value: unknown): value is boolean =>
  typeof value === 'boolean'
