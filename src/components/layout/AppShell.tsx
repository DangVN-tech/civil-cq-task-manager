import { useState, type FormEvent, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell, CheckCircle2, ChevronsLeft, ChevronsRight, FolderTree,
  HardDrive, KeyRound, Layers, LogOut, PieChart, Search, Users, Loader2,
} from 'lucide-react'
import { useAuth, useCurrentUser } from '../../context/AuthContext'
import { useBrowserNotifications } from '../../hooks/useBrowserNotifications'
import { ResizeHandle, useColumnResize } from '../../hooks/useColumnResize'
import { useRealtime } from '../../hooks/useRealtime'
import { useTasks } from '../../hooks/useTasks'
import { canChangeOwnPin, canManageProjects, canManageStaff, canManageStorage, canViewDashboard, isParticipant } from '../../lib/permissions'
import { cn, initials } from '../../lib/utils'
import { displayRole } from '../../types'
import { Button, Input } from '../ui'
import ToastStack from '../notify/ToastStack'
import ChangePinDialog from './ChangePinDialog'

const SIDEBAR_COLLAPSED_KEY = 'ccq-sidebar-collapsed'

export default function AppShell() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [pinOpen, setPinOpen] = useState(false)
  const sidebar = useColumnResize('ccq-w-sidebar', 224, 150, 340)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
  const { supported: notifSupported, permission: notifPermission, requestPermission } = useBrowserNotifications()

  useRealtime(user.id)

  const { data: inProgress } = useTasks('dang_thuc_hien')
  const myTaskCount = (inProgress ?? []).filter((t) => isParticipant(t, user)).length

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '0' : '1')
      return !v
    })
  }

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/tim-kiem?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* ===== Thanh trên cùng ===== */}
      <header className="z-10 flex items-center gap-4 border-b border-slate-200/80 bg-white px-5 py-2.5 shadow-sm">
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-md shadow-indigo-100">
            <Layers size={18} />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900">
              Civil<span className="text-brand-500">&</span>CQ
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Task Manager</p>
          </div>
        </div>

        <form onSubmit={submitSearch} className="relative mx-auto w-full max-w-md">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm kiếm: task, đầu mục, dự án, tên file, người tham gia..."
            className="rounded-xl bg-slate-100/80 pl-8 focus:bg-white"
          />
        </form>

        {/* Góc phải trên: thông tin người dùng */}
        <div className="flex items-center gap-2.5 whitespace-nowrap border-r border-slate-200 pr-3 text-right text-xs leading-tight">
          <div>
            <div className="text-sm font-bold text-slate-900">{user.full_name}</div>
            {(user.role !== 'nhan_vien' || user.is_admin) && (
              <div className="mt-0.5 text-slate-500">({displayRole(user)})</div>
            )}
            <div className="mt-0.5 font-bold text-brand-500">Task của tôi: {myTaskCount}</div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-500 to-purple-500 text-xs font-bold text-white shadow-md shadow-indigo-100">
            {initials(user.full_name)}
          </div>
        </div>
        {notifSupported && notifPermission === 'default' && (
          <Button variant="ghost" onClick={requestPermission} title="Nhận thông báo ngoài màn hình khi tab chạy nền">
            <Bell size={14} /> Bật thông báo
          </Button>
        )}
        {canChangeOwnPin(user) && (
          <Button variant="ghost" onClick={() => setPinOpen(true)} title="Đổi PIN đăng nhập">
            <KeyRound size={14} /> Đổi PIN
          </Button>
        )}
        <Button variant="ghost" onClick={logout} title="Đăng xuất"
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
          <LogOut size={14} /> Đăng xuất
        </Button>
      </header>

      {/* ===== Thân: sidebar + nội dung ===== */}
      <div className="flex min-h-0 flex-1">
        <nav
          className="flex shrink-0 flex-col justify-between border-r border-slate-200 bg-slate-100 p-3 transition-[width] duration-200"
          style={{ width: collapsed ? 72 : sidebar.width }}
        >
          <div className="space-y-4">
            <button
              onClick={toggleCollapsed}
              className="ml-auto flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              title="Thu gọn / Mở rộng"
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
            <div className="space-y-1.5">
              <NavItem to="/dang-thuc-hien" icon={Loader2} iconColor="text-amber-500" collapsed={collapsed}>Đang thực hiện</NavItem>
              <NavItem to="/hoan-thanh" icon={CheckCircle2} iconColor="text-emerald-500" collapsed={collapsed}>Hoàn thành</NavItem>
              {canViewDashboard(user) && (
                <NavItem to="/dashboard" icon={PieChart} iconColor="text-brand-500" collapsed={collapsed}>Dashboard</NavItem>
              )}
              {canManageProjects(user) && (
                <NavItem to="/du-an" icon={FolderTree} iconColor="text-blue-500" collapsed={collapsed}>Quản lý dự án</NavItem>
              )}
              {canManageStaff(user) && (
                <NavItem to="/nhan-su" icon={Users} iconColor="text-purple-500" collapsed={collapsed}>Quản lý nhân sự</NavItem>
              )}
              {canManageStorage(user) && (
                <NavItem to="/dung-luong" icon={HardDrive} iconColor="text-pink-500" collapsed={collapsed}>Quản lý dung lượng</NavItem>
              )}
            </div>
          </div>
        </nav>

        {/* Thanh nắm kéo chỉnh độ rộng sidebar (chỉ khi mở rộng) */}
        {!collapsed && <ResizeHandle onMouseDown={sidebar.startDrag} />}

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

function NavItem({
  to, icon: Icon, iconColor, collapsed, children,
}: {
  to: string
  icon: typeof PieChart
  iconColor: string
  collapsed: boolean
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? String(children) : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all',
          collapsed && 'justify-center px-2',
          isActive
            ? 'border border-slate-200 bg-white text-brand-600 shadow-sm'
            : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900',
        )
      }
    >
      <Icon size={16} className={cn('shrink-0', iconColor)} />
      {!collapsed && <span className="truncate">{children}</span>}
    </NavLink>
  )
}
