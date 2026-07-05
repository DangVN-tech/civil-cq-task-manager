import { useActivityLog } from '../../hooks/useTaskDetail'
import { fmtDateTime } from '../../lib/utils'

/** Activity log dạng: [04/07/2026 08:30] Task được tạo */
export default function ActivityLogView({ taskId }: { taskId: string }) {
  const { data: rows } = useActivityLog(taskId)
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-bold uppercase text-gray-500">Activity Log</h3>
      <div className="space-y-1 border border-gray-200 p-2 font-mono text-[11px] text-gray-700">
        {(rows ?? []).length === 0 && <p className="text-gray-400">Chưa có sự kiện.</p>}
        {(rows ?? []).map((r) => (
          <p key={r.id}>[{fmtDateTime(r.created_at)}] {r.detail}</p>
        ))}
      </div>
    </section>
  )
}
