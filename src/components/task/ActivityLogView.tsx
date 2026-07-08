import { useState } from 'react'
import { ChevronDown, Receipt } from 'lucide-react'
import { useActivityLog } from '../../hooks/useTaskDetail'
import { cn, fmtDateTime } from '../../lib/utils'
import type { ActivityType } from '../../types'
import { cardCls } from '../ui'

/* Chấm màu theo loại sự kiện trên timeline */
const DOT: Record<ActivityType, string> = {
  created: 'bg-brand-500 ring-blue-50',
  progress: 'bg-amber-400 ring-amber-50',
  completed: 'bg-emerald-500 ring-emerald-50',
  comment: 'bg-indigo-400 ring-indigo-50',
  deadline_changed: 'bg-amber-500 ring-amber-50',
  returned: 'bg-rose-500 ring-rose-50',
  file_uploaded: 'bg-slate-400 ring-slate-100',
}

/** Activity log dạng timeline, thu gọn mặc định: [04/07/2026 08:30] Task được tạo */
export default function ActivityLogView({ taskId }: { taskId: string }) {
  const { data: rows } = useActivityLog(taskId)
  const [open, setOpen] = useState(false)
  return (
    <section className={`${cardCls} p-4`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400"
      >
        <span className="flex items-center gap-2">
          <Receipt size={14} className="text-slate-400" /> Activity Log (Lịch sử hệ thống)
        </span>
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        (rows ?? []).length === 0 ? (
          <p className="mt-3 text-xs italic text-slate-400">Chưa có sự kiện.</p>
        ) : (
          <div className="relative ml-1.5 mt-3 space-y-3 border-l border-slate-100 py-1 pl-4">
            {(rows ?? []).map((r) => (
              <div key={r.id} className="relative text-xs">
                <span className={cn(
                  'absolute -left-[21.5px] top-0.5 h-3 w-3 rounded-full border-2 border-white ring-2',
                  DOT[r.event_type],
                )} />
                <span className="font-bold text-slate-700">[{fmtDateTime(r.created_at)}]</span>{' '}
                <span className="text-slate-600">{r.detail}</span>
              </div>
            ))}
          </div>
        )
      )}
    </section>
  )
}
