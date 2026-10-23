// hooks/useAutosizeTextArea.ts
import { useState, useCallback, useLayoutEffect, useRef } from 'react'

export const useAutosizeTextArea = (value: string) => {
  const nodeRef = useRef<HTMLTextAreaElement | null>(null)
  // Bumped whenever a node attaches, so the effect re-runs for a new element.
  const [nodeVersion, setNodeVersion] = useState(0)

  // Callback ref: called by React with the DOM node immediately on mount
  const ref = useCallback((node: HTMLTextAreaElement | null) => {
    nodeRef.current = node
    if (node) setNodeVersion((v) => v + 1)
  }, [])

  useLayoutEffect(() => {
    const el = nodeRef.current
    if (!el) return

    const resize = () => {
      if (el.offsetWidth === 0) return
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    }

    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    return () => ro.disconnect()
  }, [nodeVersion, value])

  return ref
}
