import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

/**
 * Cho phép kéo chuột chỉnh độ rộng một cột. Độ rộng được nhớ trong localStorage.
 */
export function useColumnResize(storageKey: string, initial: number, min: number, max: number) {
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(storageKey))
    return saved >= min && saved <= max ? saved : initial
  })
  const widthRef = useRef(width)
  widthRef.current = width

  const startDrag = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = widthRef.current
      const onMove = (ev: MouseEvent) => {
        setWidth(Math.min(max, Math.max(min, startW + ev.clientX - startX)))
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        localStorage.setItem(storageKey, String(widthRef.current))
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [storageKey, min, max],
  )

  return { width, startDrag }
}

/** Thanh nắm trượt dọc giữa 2 panel — kéo để chỉnh độ rộng. */
export function ResizeHandle({ onMouseDown }: { onMouseDown: (e: ReactMouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      title="Kéo để chỉnh độ rộng"
      className="w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-brand-500/40 active:bg-brand-500/60"
    />
  )
}
