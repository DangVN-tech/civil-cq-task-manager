import { AlertTriangle, Clock, MessageSquareText, Paperclip, Undo2 } from 'lucide-react'
import { useCurrentUser } from '../../context/AuthContext'
import { useActivityFeed, updatePriorityRank, UPDATE_TYPE_LABEL } from '../../hooks/useUpdates'
import { cn, fmtDateTime } from '../../lib/utils'
import type { ActivityFeedItem } from '../../types'
import { Button, cardCls } from '../ui'

const TYPE_ICON: Record<string, typeof Clock> = {
  returned: Undo2,
  deadline_changed: AlertTriangle,
  comment: MessageSquareText,
  file_uploaded: Paperclip,
}

const TYPE_ICON_CLS: Record<string, string> = {
  returned: 'bg-rose-50 text-rose-500',
  deadline_changed: 'bg-amber-50 text-amber-500',
  comment: 'bg-brand-50 text-brand-500',
  file_uploaded: 'bg-slate-100 text-slate-500',
}

/** Khu vực "CẬP NHẬT CHƯA ĐỌC" — tổng hợp nhật ký/deadline/trả về/upload file
 *  của mọi task đang thực hiện mà user hiện tại chưa xem, ưu tiên loại quan trọng lên trên. */
export default function UnreadUpdatesPanel({ onSelectTask }: { onSelectTask: (taskId: string) => void }) {
  const user = useCurrentUser()
  const { data } = useActivityFeed(user.id)

  const unread = (data ?? [])
    .filter((it) => !it.is_read && it.actor_id !== user.id)
    .sort((a, b) => {
      const r = updatePriorityRank(a) - updatePriorityRank(b)
      return r !== 0 ? r : b.created_at.localeCompare(a.created_at)
    })

  if (unread.length === 0) return null

  return (
    <div className={`${cardCls} mx-3 mt-3 overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-slate-100 bg-rose-50/60 px-3.5 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
          <AlertTriangle size={12} /> Cập nhật chưa đọc
        </span>
        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread.length}</span>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto p-2">
        {unread.slice(0, 30).map((it) => (
          <UpdateRow key={it.id} item={it} onSelectTask={onSelectTask} />
        ))}
      </div>
    </div>
  )
}

function UpdateRow({ item, onSelectTask }: { item: ActivityFeedItem; onSelectTask: (taskId: string) => void }) {
  const Icon = TYPE_ICON[item.event_type] ?? Clock
  const actorLabel = item.actor_name ?? (item.event_type === 'deadline_changed' || item.event_type === 'returned' ? 'Trưởng phòng' : '—')

  return (
    <div className="flex items-start gap-2.5 rounded-xl p-2 transition-colors hover:bg-slate-50">
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', TYPE_ICON_CLS[item.event_type])}>
        <Icon size={13} />
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[10px] font-bold text-slate-400">[{fmtDateTime(item.created_at).slice(-5)}]</span>
          <span className="truncate font-bold text-slate-800">{item.task_title}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {UPDATE_TYPE_LABEL[item.event_type] ?? item.event_type}
          </span>
        </div>
        <p className="mt-0.5 text-slate-600">
          <span className="font-semibold text-slate-700">{actorLabel}:</span>{' '}
          {item.detail.length > 140 ? `${item.detail.slice(0, 140)}…` : item.detail}
        </p>
      </div>
      <Button variant="ghost" className="shrink-0 px-2 py-1 text-[11px]" onClick={() => onSelectTask(item.task_id)}>
        Xem Task
      </Button>
    </div>
  )
}
