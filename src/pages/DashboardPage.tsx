import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronRight,
  FileSpreadsheet, FolderKanban, Hourglass, Layers, Loader2, RefreshCw, Users,
} from 'lucide-react'
import { Loading } from '../components/ui'
import { useAllTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { useUsers } from '../hooks/useUsers'
import { useStorageUsage } from '../hooks/useStorage'
import { useCurrentUser } from '../context/AuthContext'
import { exportActionListExcel, exportPersonnelExcel } from '../lib/exportExcel'
import { canManageStorage, canViewTaskFull } from '../lib/permissions'
import { cn, fmtBytes, fmtDate, isOverdue } from '../lib/utils'
import { displayRole, STORAGE_QUOTA, type Task } from '../types'

/** Dashboard toàn phòng — mọi vai trò đều xem được. */
export default function DashboardPage() {
  const user = useCurrentUser()
  const qc = useQueryClient()
  const { data: tasks, isLoading } = useAllTasks()
  const { data: users } = useUsers()
  const { data: projects } = useProjects()
  const { data: usage } = useStorageUsage()
  const [exporting, setExporting] = useState(false)
  const [exportingPersonnel, setExportingPersonnel] = useState(false)
  const [exportError, setExportError] = useState('')
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const toggleUser = (id: string) =>
    setExpandedUsers((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleProject = (id: string) =>
    setExpandedProjects((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const stats = useMemo(() => {
    const all = tasks ?? []
    return {
      total: all.length,
      inProgress: all.filter((t) => t.status === 'dang_thuc_hien').length,
      pendingReview: all.filter((t) => t.status === 'cho_duyet').length,
      completed: all.filter((t) => t.status === 'hoan_thanh').length,
      overdue: all.filter(isOverdue).length,
    }
  }, [tasks])

  // Loại bỏ tài khoản admin — admin không tham gia công việc phòng
  const perUser = useMemo(() => {
    return (users ?? []).filter((u) => !u.is_admin).map((u) => {
      const mine = (tasks ?? []).filter((t) => t.assignees.some((a) => a.user_id === u.id))
      return {
        user: u,
        tasks: mine,
        inProgress: mine.filter((t) => t.status === 'dang_thuc_hien').length,
        pendingReview: mine.filter((t) => t.status === 'cho_duyet').length,
        completed: mine.filter((t) => t.status === 'hoan_thanh').length,
        overdue: mine.filter(isOverdue).length,
      }
    })
  }, [users, tasks])

  const perProject = useMemo(() => {
    return (projects ?? []).map((p) => {
      const mine = (tasks ?? []).filter((t) => t.group?.project?.id === p.id)
      return {
        project: p,
        tasks: mine,
        total: mine.length,
        inProgress: mine.filter((t) => t.status === 'dang_thuc_hien').length,
        pendingReview: mine.filter((t) => t.status === 'cho_duyet').length,
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

  const exportPersonnel = async () => {
    setExportError('')
    setExportingPersonnel(true)
    try {
      await exportPersonnelExcel(perUser)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Xuất báo cáo thất bại.')
    } finally {
      setExportingPersonnel(false)
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="h-full space-y-5 overflow-y-auto p-6">

      {/* ── Title + Action Bar ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Dashboard Toàn Phòng</h2>
            <span className="rounded-lg border border-indigo-200 bg-indigo-100/60 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              Cập nhật thời gian thực
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Báo cáo hiệu suất công việc, tình trạng dự án và nhân sự của phòng XD&amp;QLCL.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <FileSpreadsheet size={14} /> {exporting ? 'Đang xuất...' : 'Xuất báo cáo Excel'}
          </button>
        </div>
      </div>
      {exportError && <p className="text-xs font-semibold text-rose-600">{exportError}</p>}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {/* Total — solid indigo */}
        <div className="overflow-hidden rounded-xl bg-indigo-600 p-3 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200">Tổng Task Phòng</p>
              <h3 className="text-2xl font-black tracking-tight">{stats.total}</h3>
              <p className="flex items-center text-[10px] text-indigo-100/80">
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Khớp với thực tế hiện trường
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Layers size={18} className="text-indigo-200" />
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Đang thực hiện</p>
              <h3 className="text-2xl font-black tracking-tight text-amber-500">{stats.inProgress}</h3>
              <span className="inline-flex items-center rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />Chạy dứt điểm
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Chờ duyệt</p>
              <h3 className="text-2xl font-black tracking-tight text-orange-500">{stats.pendingReview}</h3>
              <span className="inline-flex items-center rounded-md border border-orange-100 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                Chờ Trưởng phòng xác nhận
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <Hourglass size={18} />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Đã hoàn thành</p>
              <h3 className="text-2xl font-black tracking-tight text-emerald-500">{stats.completed}</h3>
              <span className="inline-flex items-center rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                Đã ký duyệt và nghiệm thu
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Quá hạn</p>
              <h3 className="text-2xl font-black tracking-tight text-rose-500">{stats.overdue}</h3>
              <span className="inline-flex animate-bounce items-center rounded-md border border-rose-100 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                Đốc thúc kiểm soát chặt
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
              <AlertTriangle size={18} className="animate-bounce" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Storage ── */}
      {canManageStorage(user) && usage != null && (
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="14" width="20" height="8" rx="2" /><path d="M6 18h.01M10 18h.01" /><path d="M2 14l2-10h16l2 10" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Dung lượng kho file hồ sơ</h4>
                <span className={cn('shrink-0 text-[10px] font-extrabold', usagePct >= 80 ? 'text-rose-600' : 'text-slate-600')}>
                  {fmtBytes(usage)} / 1 GB <span className="text-indigo-600">({usagePct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', usagePct >= 80 ? 'bg-rose-600' : 'bg-gradient-to-r from-indigo-500 to-indigo-600')}
                  style={{ width: `${Math.max(0.5, Math.min(100, usagePct))}%` }}
                />
              </div>
            </div>
          </div>
          {usagePct >= 80 && (
            <p className="mt-1.5 text-[10px] font-semibold text-rose-600">
              ⚠ Cảnh báo: kho file sắp đầy. Vào "Quản lý dung lượng" để xóa bớt file cũ.
            </p>
          )}
        </div>
      )}

      {/* ── Main Panels ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* ── PROJECT PANEL — Indigo theme ── */}
        <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-indigo-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-indigo-200 bg-indigo-100/90 p-5 text-indigo-900">
            <div className="flex items-center gap-2.5">
              <FolderKanban size={18} className="text-indigo-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider">Theo dự án / gói thầu</h3>
            </div>
            <span className="rounded-lg border border-indigo-300 bg-indigo-200 px-2.5 py-1 text-[10px] font-extrabold text-indigo-800">
              Có đầu mục công việc
            </span>
          </div>
          <div className="space-y-4 p-4">
            {perProject.map((r) => {
              const expanded = expandedProjects.has(r.project.id)
              const groupMap = new Map<string, { name: string; tasks: Task[] }>()
              for (const t of r.tasks) {
                const gid = t.group?.id ?? '__none__'
                const gname = t.group?.name ?? 'Không có đầu mục'
                if (!groupMap.has(gid)) groupMap.set(gid, { name: gname, tasks: [] })
                groupMap.get(gid)!.tasks.push(t)
              }
              return (
                <div key={r.project.id} className="overflow-hidden rounded-2xl border-2 border-indigo-200 bg-white shadow-sm">
                  <button
                    onClick={() => toggleProject(r.project.id)}
                    className="flex w-full flex-col items-start justify-between bg-indigo-100/90 p-4 text-left transition-colors hover:bg-indigo-200/90 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown size={16} className={cn('shrink-0 text-indigo-600 transition-transform duration-200', !expanded && '-rotate-90')} />
                      <span className="text-sm font-extrabold tracking-tight text-slate-800">{r.project.name}</span>
                      <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold text-indigo-700">CẤU TRÚC PHÂN RÃ</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold sm:mt-0">
                      <span className="rounded bg-slate-200/60 px-2 py-0.5 text-slate-600">Tổng: {r.total}</span>
                      <span className="rounded border border-amber-200 bg-amber-100 px-2 py-0.5 text-amber-700">Làm: {r.inProgress}</span>
                      {r.pendingReview > 0 && <span className="rounded border border-orange-200 bg-orange-100 px-2 py-0.5 text-orange-700">Chờ duyệt: {r.pendingReview}</span>}
                      <span className="rounded border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-emerald-700">Xong: {r.completed}</span>
                      {r.overdue > 0 && <span className="rounded border border-rose-200 bg-rose-100 px-2 py-0.5 text-rose-700">Hạn: {r.overdue}</span>}
                    </div>
                  </button>
                  {expanded && (
                    <div className="space-y-5 p-4">
                      {r.tasks.length === 0 ? (
                        <p className="py-4 text-center text-xs italic text-slate-400">Không có công việc nào.</p>
                      ) : (
                        [...groupMap.entries()].map(([gid, g]) => (
                          <div key={gid} className="space-y-2">
                            <div className="flex items-center justify-between border-b border-dashed border-indigo-200 pb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="h-3.5 w-1.5 rounded-full bg-indigo-600" />
                                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700">{g.name}</span>
                              </div>
                              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">{g.tasks.length} task</span>
                            </div>
                            <div className="space-y-2">
                              {g.tasks.map((t) => <ModernTaskRow key={t.id} task={t} />)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── PERSONNEL PANEL — Emerald theme ── */}
        <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-300 bg-emerald-100/90 p-5 text-emerald-900">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-emerald-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider">Theo từng nhân sự</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-emerald-300 bg-emerald-200 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800">
                Phân tải trách nhiệm
              </span>
              <button
                onClick={exportPersonnel}
                disabled={exportingPersonnel}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-200/60 disabled:opacity-50"
              >
                <FileSpreadsheet size={12} />
                {exportingPersonnel ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            </div>
          </div>
          <div className="space-y-3 p-4">
            {perUser.map((r) => {
              const expanded = expandedUsers.has(r.user.id)
              const total = r.inProgress + r.pendingReview + r.completed + r.overdue
              return (
                <div key={r.user.id} className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white shadow-sm">
                  <button
                    onClick={() => toggleUser(r.user.id)}
                    className={cn(
                      'flex w-full items-center justify-between p-4 transition-colors',
                      expanded ? 'border-b border-emerald-200 bg-emerald-100/90' : 'bg-emerald-50/50 hover:bg-emerald-100/50',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ChevronRight size={14} className={cn('shrink-0 text-emerald-600 transition-transform duration-200', expanded && 'rotate-90')} />
                      <div className="text-left">
                        <div className="text-xs font-black text-emerald-950">{r.user.full_name}</div>
                        <div className="text-[8px] font-bold uppercase tracking-wider text-emerald-700">{displayRole(r.user)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {r.inProgress > 0 && (
                        <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-950">
                          {r.inProgress} đang làm
                        </span>
                      )}
                      {r.pendingReview > 0 && (
                        <span className="rounded border border-orange-300 bg-orange-100 px-2 py-0.5 text-[9px] font-black text-orange-950">
                          {r.pendingReview} chờ duyệt
                        </span>
                      )}
                      {r.overdue > 0 && (
                        <span className="animate-pulse rounded border border-rose-300 bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-950">
                          {r.overdue} quá hạn
                        </span>
                      )}
                      {r.completed > 0 && (
                        <span className="rounded border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-950">
                          {r.completed} hoàn thành
                        </span>
                      )}
                      {total === 0 && (
                        <span className="text-[9px] font-bold text-slate-400">Chưa phân công</span>
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="p-4">
                      {r.tasks.length === 0 ? (
                        <p className="py-2 text-center text-xs italic text-slate-400">Không có công việc nào.</p>
                      ) : (
                        <div className="ml-2.5 space-y-3 border-l-2 border-dashed border-emerald-400 py-1 pl-4">
                          {r.tasks.map((t) => <PersonnelTaskRow key={t.id} task={t} />)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

/* ─── Personnel Task Row — compact, title wraps, badge = đầu mục ─── */
function PersonnelTaskRow({ task }: { task: Task }) {
  const user = useCurrentUser()
  const full = canViewTaskFull(task, user)
  const overdue = isOverdue(task)
  const bar = overdue ? 'bg-rose-500' : task.status === 'hoan_thanh' ? 'bg-emerald-500' : task.status === 'cho_duyet' ? 'bg-orange-400' : 'bg-amber-400'
  return (
    <div className="flex items-stretch gap-2 rounded-lg border border-slate-200/60 bg-white px-3 py-2 shadow-sm">
      <div className={cn('w-1 shrink-0 rounded-full', bar)} />
      <div className="min-w-0 flex-1">
        {/* Row 1: đầu mục badge + title (wraps) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {task.group && (
            <span className="rounded bg-slate-800 px-1.5 py-px text-[9px] font-bold text-white">
              {task.group.name}
            </span>
          )}
          <span className="break-words text-xs font-semibold leading-snug text-slate-800">{task.title}</span>
        </div>
        {/* Row 2: deadline + progress + status */}
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Calendar size={10} />
            {task.deadline ? fmtDate(task.deadline) : '—'}
          </span>
          {full && (
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${task.progress}%` }} />
              </div>
              <span className="text-[10px] font-bold text-indigo-600">{task.progress}%</span>
            </div>
          )}
          {full && <DashTaskStatus task={task} />}
        </div>
      </div>
    </div>
  )
}

/* ─── Modern Task Row — title dòng trên, metadata dòng dưới ─── */
function ModernTaskRow({ task }: { task: Task }) {
  const user = useCurrentUser()
  const full = canViewTaskFull(task, user)
  const overdue = isOverdue(task)
  const leftBar = overdue ? 'bg-rose-500' : task.status === 'hoan_thanh' ? 'bg-emerald-500' : task.status === 'cho_duyet' ? 'bg-orange-400' : 'bg-amber-400'
  const chuTri = task.assignees.find((a) => a.assign_role === 'chu_tri')
  const nameInitials = chuTri?.user?.full_name?.split(' ').slice(-1)[0]?.substring(0, 2).toUpperCase() ?? '?'

  return (
    <div className="group cursor-default rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm transition-colors duration-200 hover:bg-slate-50/70">
      <div className="flex items-stretch gap-2.5">
        {/* left color bar — stretches full height of both rows */}
        <div className={cn('w-1.5 shrink-0 self-stretch rounded-full', leftBar)} />
        <div className="min-w-0 flex-1">
          {/* Dòng 1: title — full width, wrap tự nhiên */}
          <h4 className="mb-1.5 break-words text-xs font-bold leading-snug text-slate-800 transition-colors group-hover:text-indigo-600">
            {task.title}
          </h4>
          {/* Dòng 2: priority · tiến độ · deadline · assignee · status */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PriorityDot priority={task.priority} />
            {full && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                Tiến độ
                <span className="mx-0.5 inline-block h-1 w-14 overflow-hidden rounded-full bg-slate-100 align-middle">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                    style={{ width: `${task.progress}%` }}
                  />
                </span>
                <span className="text-indigo-600">{task.progress}%</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-[9px] text-slate-400">
              <Calendar size={10} className="text-slate-300" />
              <span className="font-mono">{task.deadline ? fmtDate(task.deadline) : '—'}</span>
            </span>
            {chuTri?.user && (
              <span className="flex items-center gap-1">
                <span className="flex h-5 w-5 items-center justify-center rounded border border-indigo-100 bg-indigo-50 font-black text-[9px] text-indigo-700">
                  {nameInitials}
                </span>
                <span className="text-[10px] font-semibold text-slate-600">{chuTri.user.full_name}</span>
              </span>
            )}
            {full && <DashTaskStatus task={task} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const cls = priority === 'khan' ? 'bg-rose-500' : priority === 'gap' ? 'bg-amber-500' : 'bg-slate-300'
  const label = priority === 'khan' ? 'Khẩn' : priority === 'gap' ? 'Gấp' : 'Thường'
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400">
      <span className={cn('h-1.5 w-1.5 rounded-full', cls)} />{label}
    </span>
  )
}

function DashTaskStatus({ task }: { task: Task }) {
  if (isOverdue(task))
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">
        <span className="mr-1.5 h-1.5 w-1.5 animate-bounce rounded-full bg-rose-500" />Quá hạn
      </span>
    )
  if (task.status === 'hoan_thanh')
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />Đã xong
      </span>
    )
  if (task.status === 'cho_duyet')
    return (
      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-700">
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-orange-500" />Chờ duyệt
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
      <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />Đang làm
    </span>
  )
}
