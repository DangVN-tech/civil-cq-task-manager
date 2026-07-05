import { cn, fmtDateTime, timeLeftLabel } from '../../lib/utils'
import type { Task } from '../../types'
import PriorityBadge, { PRIORITY_STRIP } from './PriorityBadge'
import MarkDot from './MarkDot'
import { ProgressBar } from '../ui'

/** Card rút gọn trong danh sách (kiểu Outlook message list). */
export default function TaskCard({
  task,
  selected,
  onClick,
}: {
  task: Task
  selected: boolean
  onClick: () => void
}) {
  const left = timeLeftLabel(task.deadline)
  const completed = task.status === 'hoan_thanh'
  const chuTri = task.assignees.find((a) => a.assign_role === 'chu_tri')

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-stretch gap-0 border-b border-gray-200 text-left',
        selected ? 'bg-brand-50' : 'bg-white hover:bg-gray-50',
      )}
    >
      {/* Dải màu ưu tiên bên trái */}
      <span className={cn('w-1 shrink-0', PRIORITY_STRIP[task.priority])} />
      <span className="min-w-0 flex-1 px-3 py-2">
        <span className="flex items-center gap-2">
          <MarkDot task={task} />
          <span className="truncate text-sm font-semibold">{task.title}</span>
          <PriorityBadge priority={task.priority} />
        </span>

        {completed ? (
          <span className="mt-1 block text-xs text-gray-500">
            Hoàn thành {task.completed_at ? fmtDateTime(task.completed_at) : ''}
            {task.completer ? ` · ${task.completer.full_name}` : chuTri?.user ? ` · ${chuTri.user.full_name}` : ''}
          </span>
        ) : (
          <>
            <span className="mt-1.5 flex items-center gap-2">
              <ProgressBar value={task.progress} className="max-w-32" />
              <span className="text-xs font-semibold text-gray-600">{task.progress}%</span>
              <span className="text-xs text-gray-400">👥 {task.assignees.length}</span>
            </span>
            <span className="mt-1 flex items-center gap-2 text-xs">
              <span className={left.overdue ? 'font-semibold text-red-600' : 'text-gray-500'}>{left.text}</span>
              <span className="text-gray-400">· Deadline: {fmtDateTime(task.deadline)}</span>
            </span>
          </>
        )}
      </span>
    </button>
  )
}
