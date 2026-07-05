import { useCurrentUser } from '../../context/AuthContext'
import { useTaskMutations } from '../../hooks/useTasks'
import { cn } from '../../lib/utils'
import type { MarkColor, Task } from '../../types'

const COLOR_CLS: Record<MarkColor, string> = {
  vang: 'bg-yellow-400 border-yellow-500',
  xanh_la: 'bg-green-500 border-green-600',
  tim: 'bg-purple-500 border-purple-600',
}

const CYCLE: Array<MarkColor | null> = [null, 'vang', 'xanh_la', 'tim']

/** Chấm màu đánh dấu cá nhân: click để xoay vòng Vàng -> Xanh lá -> Tím -> bỏ. */
export default function MarkDot({ task }: { task: Task }) {
  const user = useCurrentUser()
  const { setMark } = useTaskMutations()
  const current = task.marks.find((m) => m.user_id === user.id)?.color ?? null

  const next = () => {
    const i = CYCLE.indexOf(current)
    const color = CYCLE[(i + 1) % CYCLE.length]
    setMark.mutate({ taskId: task.id, userId: user.id, color })
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); next() }}
      title="Đánh dấu cá nhân (Vàng / Xanh lá / Tím)"
      className={cn(
        'h-3.5 w-3.5 shrink-0 rounded-full border',
        current ? COLOR_CLS[current] : 'border-gray-300 bg-white hover:border-gray-500',
      )}
    />
  )
}
