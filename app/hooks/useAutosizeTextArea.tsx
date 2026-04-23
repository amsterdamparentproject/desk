// hooks/useAutosizeTextArea.ts
import { useState, useCallback, useLayoutEffect } from 'react'

export const useAutosizeTextArea = (value: string) => {
  const [el, setEl] = useState<HTMLTextAreaElement | null>(null)

  // Callback ref: called by React with the DOM node immediately on mount
  const ref = useCallback((node: HTMLTextAreaElement | null) => {
    setEl(node)
  }, [])

  useLayoutEffect(() => {
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
  }, [el, value])

  return ref
}
