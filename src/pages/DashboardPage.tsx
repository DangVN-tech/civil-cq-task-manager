import { useMemo } from 'react'
import { cardCls, Loading } from '../components/ui'
import { useAllTasks } from '../hooks/useTasks'
import { useUsers } from '../hooks/useUsers'
import { useStorageUsage } from '../hooks/useStorage'
import { useCurrentUser } from '../context/AuthContext'
import { canManageStorage } from '../lib/permissions'
import { cn, fmtBytes, isOverdue } from '../lib/utils'
import { displayRole, STORAGE_QUOTA } from '../types'

/** Dashboard toàn phòng — Trưởng phòng, Phó phòng & Admin. */
export default function DashboardPage() {
  const user = useCurrentUser()
  const { data: tasks, isLoading } = useAllTasks()
  const { data: users } = useUsers()
  const { data: usage } = useStorageUsage()

  const stats = useMemo(() => {
    const all = tasks ?? []
    return {
      total: all.length,
      inProgress: all.filter((t) => t.status === 'dang_thuc_hien').length,
      completed: all.filter((t) => t.status === 'hoan_thanh').length,
      overdue: all.filter(isOverdue).length,
    }
  }, [tasks])

  const perUser = useMemo(() => {
    return (users ?? []).map((u) => {
      const mine = (tasks ?? []).filter((t) => t.assignees.some((a) => a.user_id === u.id))
      return {
        user: u,
        inProgress: mine.filter((t) => t.status === 'dang_thuc_hien').length,
        completed: mine.filter((t) => t.status === 'hoan_thanh').length,
        overdue: mine.filter(isOverdue).length,
      }
    })
  }, [users, tasks])

  const usagePct = usage != null ? Math.round((usage / STORAGE_QUOTA) * 100) : 0

  if (isLoading) return <Loading />

  return (
    <div className="h-full space-y-5 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-slate-950">Dashboard toàn phòng</h2>

      {/* 4 thẻ thống kê */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Tổng task" value={stats.total} cls="text-slate-900" icon="📋" iconBg="bg-blue-50" />
        <Stat label="Đang thực hiện" value={stats.inProgress} cls="text-brand-500" icon="⏱" iconBg="bg-blue-50" />
        <Stat label="Hoàn thành" value={stats.completed} cls="text-emerald-600" icon="✓" iconBg="bg-emerald-50" />
        <Stat label="Quá hạn" value={stats.overdue} cls="text-rose-600" icon="⚠" iconBg="bg-rose-50" />
      </div>

      {/* Dung lượng kho file (chỉ trưởng phòng / admin) */}
      {canManageStorage(user) && usage != null && (
        <div className={`${cardCls} space-y-2.5 p-5`}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dung lượng kho file</h4>
            <span className={cn('text-xs font-semibold', usagePct >= 80 ? 'text-rose-600' : 'text-slate-500')}>
              {fmtBytes(usage)} / 1 GB ({usagePct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full', usagePct >= 80 ? 'bg-rose-600' : 'bg-brand-500')}
              style={{ width: `${Math.max(1, Math.min(100, usagePct))}%` }}
            />
          </div>
          {usagePct >= 80 && (
            <p className="text-xs font-semibold text-rose-600">
              ⚠ Cảnh báo: kho file sắp đầy. Vào "Quản lý dung lượng" để xóa bớt file cũ.
            </p>
          )}
        </div>
      )}

      {/* Theo từng nhân sự */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 text-xs font-bold uppercase tracking-wider text-slate-500">
          Theo từng nhân sự
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-bold text-slate-400">
              <th className="p-4 font-bold">Họ tên</th>
              <th className="p-4 font-bold">Chức vụ</th>
              <th className="p-4 text-center font-bold">Đang thực hiện</th>
              <th className="p-4 text-center font-bold">Hoàn thành</th>
              <th className="p-4 text-center font-bold">Quá hạn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perUser.map((r) => (
              <tr key={r.user.id} className="transition-colors hover:bg-slate-50/50">
                <td className="p-4 font-bold text-slate-900">{r.user.full_name}</td>
                <td className="p-4 text-xs text-slate-500">{displayRole(r.user)}</td>
                <td className="p-4 text-center"><CountPill value={r.inProgress} cls="bg-blue-50 text-blue-700" /></td>
                <td className="p-4 text-center"><CountPill value={r.completed} cls="bg-emerald-50 text-emerald-700" /></td>
                <td className="p-4 text-center"><CountPill value={r.overdue} cls="bg-rose-50 text-rose-700" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, cls, icon, iconBg }: {
  label: string; value: number; cls: string; icon: string; iconBg: string
}) {
  return (
    <div className={`${cardCls} flex items-center justify-between p-5`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <h3 className={cn('text-3xl font-extrabold', cls)}>{value}</h3>
      </div>
      <div className={cn('rounded-xl p-3 text-lg', iconBg)}>{icon}</div>
    </div>
  )
}

function CountPill({ value, cls }: { value: number; cls: string }) {
  if (value === 0) return <span className="text-slate-400">0</span>
  return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cls)}>{value}</span>
}
