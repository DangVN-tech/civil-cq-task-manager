import { Users } from 'lucide-react'
import { useCurrentUser } from '../../context/AuthContext'
import { useActivityFeed } from '../../hooks/useUpdates'
import { cn, fmtDateTime, fmtTime, timeLeftLabel } from '../../lib/utils'
import type { Task } from '../../types'
import PriorityBadge, { PRIORITY_STRIP } from './PriorityBadge'
import MarkDot from './MarkDot'
import { ProgressBar, UnreadBadge } from '../ui'

/** Card rút gọn trong danh sách — thẻ trắng bo tròn có dải màu ưu tiên bên trái. */
export default function TaskCard({
  task,
  selected,
  onClick,
}: {
  task: Task
  selected: boolean
  onClick: () => void
}) {
  const user = useCurrentUser()
  const { data: feed } = useActivityFeed(user.id)
  const left = timeLeftLabel(task.deadline) // null = không có deadline
  const completed = task.status === 'hoan_thanh'
  const chuTri = task.assignees.find((a) => a.assign_role === 'chu_tri')
  const peopleCount = task.assignees.length + (task.external_collabs?.length ?? 0)

  const taskUpdates = (feed ?? []).filter((it) => it.task_id === task.id)
  const unreadCount = taskUpdates.filter((it) => !it.is_read && it.actor_id !== user.id).length
  const latest = taskUpdates[0] // fn_activity_feed đã order created_at desc

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      }}
      className={cn(
        'relative block w-full cursor-pointer rounded-xl border bg-white p-3 pl-4 text-left shadow-sm transition-all hover:shadow-md',
        selected ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200',
      )}
    >
      {/* Dải màu ưu tiên bên trái */}
      <span className={cn('absolute bottom-0 left-0 top-0 w-1.5 rounded-l-xl', PRIORITY_STRIP[task.priority])} />

      <span className="flex items-center gap-2">
        <MarkDot task={task} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{task.title}</span>
        <UnreadBadge count={unreadCount} />
        <PriorityBadge priority={task.priority} />
      </span>

      {latest && (
        <p className="mt-1 truncate text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">Cập nhật mới nhất:</span>{' '}
          {latest.actor_name ?? 'Trưởng phòng'} - {fmtTime(latest.created_at)} — {latest.detail}
        </p>
      )}

      {completed ? (
        <span className="mt-1.5 block text-[11px] text-slate-500">
          Hoàn thành {task.completed_at ? fmtDateTime(task.completed_at) : ''}
          {task.completer ? ` · ${task.completer.full_name}` : chuTri?.user ? ` · ${chuTri.user.full_name}` : ''}
        </span>
      ) : (
        <>
          <span className="mt-2 flex items-center gap-2">
            <ProgressBar value={task.progress} className="h-1.5 max-w-36" />
            <span className="text-xs font-semibold text-slate-600">{task.progress}%</span>
            <span className="flex items-center gap-0.5 text-xs text-slate-400"><Users size={11} /> {peopleCount}</span>
          </span>
          <span className="mt-1.5 flex items-center gap-2 text-xs">
            {left ? (
              <>
                <span className={left.overdue ? 'font-semibold text-rose-600' : 'font-medium text-slate-500'}>
                  {left.text}
                </span>
                <span className="text-slate-400">· Deadline: {task.deadline ? fmtDateTime(task.deadline) : ''}</span>
              </>
            ) : (
              <span className="font-medium text-slate-400">Việc thường xuyên · không có deadline</span>
            )}
          </span>
        </>
      )}
    </div>
  )
}
