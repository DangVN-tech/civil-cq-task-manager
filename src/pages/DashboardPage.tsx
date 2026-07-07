import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle2, ClipboardList, FileSpreadsheet, Loader2, RefreshCw,
} from 'lucide-react'
import { cardCls, Loading } from '../components/ui'
import { useAllTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import { useStorageUsage } from '../hooks/useStorage'
import { useCurrentUser } from '../context/AuthContext'
import { exportActionListExcel } from '../lib/exportExcel'
import { canManageStorage } from '../lib/permissions'
import { cn, fmtBytes, isOverdue } from '../lib/utils'
import { displayRole, PROJECT_STATUS_LABEL, STORAGE_QUOTA } from '../types'

/** Dashboard toàn phòng — Trưởng phòng, Phó phòng & Admin. */
export default function DashboardPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: tasks, isLoading } = useAllTasks()
  const { data: users } = useUsers()
  const { data: projects } = useProjects()
  const { data: usage } = useStorageUsage()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

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

  // Thống kê theo Dự án / Gói thầu (WBS)
  const perProject = useMemo(() => {
    return (projects ?? []).map((p) => {
      const mine = (tasks ?? []).filter((t) => t.group?.project?.id === p.id)
      return {
        project: p,
        total: mine.length,
        inProgress: mine.filter((t) => t.status === 'dang_thuc_hien').length,
        completed: mine.filter((t) => t.status === 'hoan_thanh').length,
        overdue: mine.filter(isOverdue).length,
      }
    })
  }, [projects, tasks])

  const usagePct = usage != null ? Math.round((usage / STORAGE_QUOTA) * 100) : 0

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['storage-usage'] })
  }

  const exportExcel = async () => {
    setExportError('')
    setExporting(true)
    try {
      await exportActionListExcel(projects ?? [], tasks ?? [])
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Xuất báo cáo thất bại.')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="h-full space-y-5 overflow-y-auto p-6">
      {/* Banner tiêu đề + hành động */}
      <div className={`${cardCls} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800">Dashboard Toàn Phòng</h2>
          <p className="mt-1 text-xs text-slate-400">
            Báo cáo hiệu suất công việc, tình trạng dự án và nhân sự của phòng XD&QLCL.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-200/70"
          >
            <RefreshCw size={13} /> Làm mới
          </button>
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-100 transition-all hover:bg-brand-600 disabled:opacity-50"
          >
            <FileSpreadsheet size={13} /> {exporting ? 'Đang xuất...' : 'Xuất báo cáo Excel'}
          </button>
        </div>
      </div>
      {exportError && <p className="text-xs font-semibold text-rose-600">{exportError}</p>}

      {/* 4 thẻ thống kê */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white shadow-lg shadow-indigo-500/10">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Tổng Task Phòng</span>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5"><ClipboardList size={20} /></div>
          </div>
        </div>
        <Stat label="Đang thực hiện" value={stats.inProgress} cls="text-amber-600" iconBg="bg-amber-50 text-amber-500" icon={<Loader2 size={20} />} />
        <Stat label="Đã hoàn thành" value={stats.completed} cls="text-emerald-600" iconBg="bg-emerald-50 text-emerald-500" icon={<CheckCircle2 size={20} />} />
        <Stat label="Quá hạn" value={stats.overdue} cls="text-rose-600" iconBg="bg-rose-50 text-rose-500" icon={<AlertTriangle size={20} />} accent />
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Theo dự án / gói thầu (WBS) — click để xem chi tiết */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Theo dự án / gói thầu</span>
            <span className="text-[10px] italic text-slate-400">Bấm vào dòng để xem chi tiết</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 font-bold text-slate-400">
                <th className="p-3.5 px-4 font-bold">Dự án</th>
                <th className="p-3.5 px-3 font-bold">Trạng thái</th>
                <th className="p-3.5 px-3 text-center font-bold">Tổng</th>
                <th className="p-3.5 px-3 text-center font-bold text-amber-600">Đang làm</th>
                <th className="p-3.5 px-3 text-center font-bold text-emerald-600">Xong</th>
                <th className="p-3.5 px-3 text-center font-bold text-rose-600">Quá hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perProject.map((r) => (
                <tr
                  key={r.project.id}
                  onClick={() => navigate(`/dang-thuc-hien?project=${r.project.id}`)}
                  className="cursor-pointer transition-colors hover:bg-brand-50/50"
                  title="Xem task của dự án này"
                >
                  <td className="p-4 font-bold text-slate-900">{r.project.name}</td>
                  <td className="p-4 text-slate-500">{PROJECT_STATUS_LABEL[r.project.status]}</td>
                  <td className="p-4 text-center font-semibold">{r.total}</td>
                  <td className="p-4 text-center"><CountPill value={r.inProgress} cls="bg-blue-50 text-blue-700" /></td>
                  <td className="p-4 text-center"><CountPill value={r.completed} cls="bg-emerald-50 text-emerald-700" /></td>
                  <td className="p-4 text-center"><CountPill value={r.overdue} cls="bg-rose-50 text-rose-700" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Theo từng nhân sự */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50/50 p-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Theo từng nhân sự</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 font-bold text-slate-400">
                <th className="p-3.5 px-4 font-bold">Họ tên</th>
                <th className="p-3.5 px-3 font-bold">Chức vụ</th>
                <th className="p-3.5 px-3 text-center font-bold text-amber-600">Đang làm</th>
                <th className="p-3.5 px-3 text-center font-bold text-emerald-600">Hoàn thành</th>
                <th className="p-3.5 px-3 text-center font-bold text-rose-600">Quá hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perUser.map((r) => (
                <tr key={r.user.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-slate-900">{r.user.full_name}</td>
                  <td className="p-4 text-slate-500">{displayRole(r.user)}</td>
                  <td className="p-4 text-center"><CountPill value={r.inProgress} cls="bg-blue-50 text-blue-700" /></td>
                  <td className="p-4 text-center"><CountPill value={r.completed} cls="bg-emerald-50 text-emerald-700" /></td>
                  <td className="p-4 text-center"><CountPill value={r.overdue} cls="bg-rose-50 text-rose-700" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, cls, icon, iconBg, accent }: {
  label: string; value: number; cls: string; icon: ReactNode; iconBg: string; accent?: boolean
}) {
  return (
    <div className={cn(cardCls, 'flex items-center justify-between p-5', accent && 'border-l-4 border-l-rose-500')}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <h3 className={cn('text-3xl font-extrabold', cls)}>{value}</h3>
      </div>
      <div className={cn('rounded-xl p-2.5', iconBg)}>{icon}</div>
    </div>
  )
}

function CountPill({ value, cls }: { value: number; cls: string }) {
  if (value === 0) return <span className="text-slate-400">0</span>
  return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cls)}>{value}</span>
}
