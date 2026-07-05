import { useActivityLog } from '../../hooks/useTaskDetail'
import { cn, fmtDateTime } from '../../lib/utils'
import type { ActivityType } from '../../types'
import { cardCls } from '../ui'

/* Chấm màu theo loại sự kiện trên timeline */
const DOT: Record<ActivityType, string> = {
  created: 'bg-brand-500 ring-blue-50',
  progress: 'bg-amber-400 ring-amber-50',
  completed: 'bg-emerald-500 ring-emerald-50',
}

/** Activity log dạng timeline: [04/07/2026 08:30] Task được tạo */
export default function ActivityLogView({ taskId }: { taskId: string }) {
  const { data: rows } = useActivityLog(taskId)
  return (
    <section className={`${cardCls} p-4`}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Activity Log</h3>
      {(rows ?? []).length === 0 ? (
        <p className="text-xs italic text-slate-400">Chưa có sự kiện.</p>
      ) : (
        <div className="relative ml-1.5 space-y-3 border-l border-slate-100 py-1 pl-4">
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
      )}
    </section>
  )
}
