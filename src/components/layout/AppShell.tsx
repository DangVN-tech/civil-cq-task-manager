import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, useCurrentUser } from '../../context/AuthContext'
import { ResizeHandle, useColumnResize } from '../../hooks/useColumnResize'
import { useRealtime } from '../../hooks/useRealtime'
import { useTasks } from '../../hooks/useTasks'
import { canChangeOwnPin, canManageProjects, canManageStaff, canManageStorage, canViewDashboard, isParticipant } from '../../lib/permissions'
import { cn } from '../../lib/utils'
import { displayRole } from '../../types'
import { Button, Input } from '../ui'
import ToastStack from '../notify/ToastStack'
import ChangePinDialog from './ChangePinDialog'

export default function AppShell() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [pinOpen, setPinOpen] = useState(false)
  const sidebar = useColumnResize('ccq-w-sidebar', 208, 150, 340)

  useRealtime(user.id)

  const { data: inProgress } = useTasks('dang_thuc_hien')
  const myTaskCount = (inProgress ?? []).filter((t) => isParticipant(t, user)).length

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/tim-kiem?q=${encodeURIComponent(q.trim())}`)
  }

  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-50 font-semibold text-brand-700'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
    )

  return (
    <div className="flex h-full flex-col">
      {/* ===== Thanh trên cùng ===== */}
      <header className="z-10 flex items-center gap-4 border-b border-slate-100 bg-white px-5 py-2.5 shadow-sm">
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-white shadow-md shadow-blue-200">
            C
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight text-slate-900">
              Civil<span className="text-brand-500">&</span>CQ
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Task Manager</p>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mx-auto w-full max-w-md">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Tìm kiếm: đầu mục, mô tả, tên file, người tham gia..."
            className="rounded-xl bg-slate-50"
          />
        </form>

        {/* Góc phải trên: thông tin người dùng */}
        <div className="whitespace-nowrap border-r border-slate-100 pr-4 text-right text-xs leading-tight">
          <div className="text-sm font-semibold text-slate-900">{user.full_name}</div>
          {(user.role !== 'nhan_vien' || user.is_admin) && (
            <div className="mt-0.5 text-slate-500">({displayRole(user)})</div>
          )}
          <div className="mt-0.5 font-medium text-brand-500">Task của tôi: {myTaskCount}</div>
        </div>
        {canChangeOwnPin(user) && (
          <Button variant="ghost" onClick={() => setPinOpen(true)} title="Đổi PIN đăng nhập">Đổi PIN</Button>
        )}
        <Button variant="ghost" onClick={logout} title="Đăng xuất"
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
          Đăng xuất
        </Button>
      </header>

      {/* ===== Thân: sidebar + nội dung ===== */}
      <div className="flex min-h-0 flex-1">
        <nav className="shrink-0 space-y-1 border-r border-slate-100 bg-white p-3" style={{ width: sidebar.width }}>
          <NavLink to="/dang-thuc-hien" className={navItem}>Đang thực hiện</NavLink>
          <NavLink to="/hoan-thanh" className={navItem}>Hoàn thành</NavLink>
          {canViewDashboard(user) && <NavLink to="/dashboard" className={navItem}>Dashboard</NavLink>}
          {canManageProjects(user) && <NavLink to="/du-an" className={navItem}>Quản lý dự án</NavLink>}
          {canManageStaff(user) && <NavLink to="/nhan-su" className={navItem}>Quản lý nhân sự</NavLink>}
          {canManageStorage(user) && <NavLink to="/dung-luong" className={navItem}>Quản lý dung lượng</NavLink>}
        </nav>

        {/* Thanh nắm kéo chỉnh độ rộng sidebar */}
        <ResizeHandle onMouseDown={sidebar.startDrag} />

        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Thông báo kiểu Outlook: góc phải dưới */}
      <ToastStack />

      <ChangePinDialog open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  )
}
