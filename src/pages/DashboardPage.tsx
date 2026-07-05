import { useMemo } from 'react'
import { Loading } from '../components/ui'
import { useAllTasks } from '../hooks/useTasks'
import { useUsers } from '../hooks/useUsers'
import { useStorageUsage } from '../hooks/useStorage'
import { useCurrentUser } from '../context/AuthContext'
import { canManageStorage } from '../lib/permissions'
import { cn, fmtBytes, isOverdue } from '../lib/utils'
import { ROLE_LABEL, STORAGE_QUOTA } from '../types'

/** Dashboard toàn phòng — Trưởng phòng & Phó phòng. */
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
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-3 text-base font-bold">Dashboard toàn phòng</h2>

      {/* 4 ô thống kê */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="Tổng task" value={stats.total} cls="text-gray-800" />
        <Stat label="Đang thực hiện" value={stats.inProgress} cls="text-brand-600" />
        <Stat label="Hoàn thành" value={stats.completed} cls="text-green-600" />
        <Stat label="Quá hạn" value={stats.overdue} cls="text-red-600" />
      </div>

      {/* Dung lượng kho file (chỉ trưởng phòng) */}
      {canManageStorage(user) && usage != null && (
        <div className="mb-4 border border-gray-300 bg-white p-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold">Dung lượng kho file</span>
            <span className={cn(usagePct >= 80 ? 'font-bold text-red-600' : 'text-gray-500')}>
              {fmtBytes(usage)} / 1 GB ({usagePct}%)
            </span>
          </div>
          <div className="h-3 w-full bg-gray-200">
            <div
              className={cn('h-full', usagePct >= 80 ? 'bg-red-600' : 'bg-brand-500')}
              style={{ width: `${Math.min(100, usagePct)}%` }}
            />
          </div>
          {usagePct >= 80 && (
            <p className="mt-1 text-xs font-semibold text-red-600">
              ⚠ Cảnh báo: kho file sắp đầy. Vào "Quản lý dung lượng" để xóa bớt file cũ.
            </p>
          )}
        </div>
      )}

      {/* Theo từng nhân sự */}
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold uppercase text-gray-500">
          Theo từng nhân sự
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-semibold">Họ tên</th>
              <th className="px-3 py-2 font-semibold">Chức vụ</th>
              <th className="px-3 py-2 text-center font-semibold">Đang thực hiện</th>
              <th className="px-3 py-2 text-center font-semibold">Hoàn thành</th>
              <th className="px-3 py-2 text-center font-semibold">Quá hạn</th>
            </tr>
          </thead>
          <tbody>
            {perUser.map((r) => (
              <tr key={r.user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.user.full_name}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{ROLE_LABEL[r.user.role]}</td>
                <td className="px-3 py-2 text-center">{r.inProgress}</td>
                <td className="px-3 py-2 text-center text-green-700">{r.completed}</td>
                <td className={cn('px-3 py-2 text-center', r.overdue > 0 && 'font-bold text-red-600')}>
                  {r.overdue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="border border-gray-300 bg-white p-3 text-center">
      <div className={cn('text-2xl font-bold', cls)}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
