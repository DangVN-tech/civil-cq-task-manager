import { useCallback, useEffect, useState } from 'react'

/** Task bị ẩn tay khỏi cây (chỉ ẩn hiển thị, không đổi dữ liệu) — lưu theo từng user trên máy đó. */
export function useHiddenTasks(userId: string) {
  const key = `ccq-hidden-tasks-${userId}`
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify([...hidden]))
  }, [hidden, key])

  const hide = useCallback((taskId: string) => {
    setHidden((prev) => new Set(prev).add(taskId))
  }, [])

  const unhideAll = useCallback(() => setHidden(new Set()), [])

  return { hidden, hide, unhideAll }
}
