import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, useCurrentUser } from '../../context/AuthContext'
import { useRealtime } from '../../hooks/useRealtime'
import { useTasks } from '../../hooks/useTasks'
import { canChangeOwnPin, canManageStaff, canManageStorage, canViewDashboard, isParticipant } from '../../lib/permissions'
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

  useRealtime(user.id)

  const { data: inProgress } = useTasks('dang_thuc_hien')
  const myTaskCount = (inProgress ?? []).filter((t) => isParticipant(t, user)).length

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/tim-kiem?q=${encodeURIComponent(q.trim())}`)
  }

  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block border-l-4 px-4 py-2.5 text-sm',
      isActive
        ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
        : 'border-transparent text-gray-700 hover:bg-gray-200',
    )

  return (
    <div className="flex h-full flex-col">
      {/* ===== Thanh trên cùng ===== */}
      <header className="flex items-center gap-4 border-b border-gray-300 bg-white px-4 py-2">
        <h1 className="whitespace-nowrap text-base font-bold text-brand-700">Civil&CQ Task Manager</h1>

        <form onSubmit={submitSearch} className="mx-auto w-full max-w-md">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Tìm kiếm: đầu mục, mô tả, tên file, người tham gia..."
            className="bg-gray-50"
          />
        </form>

        {/* Góc phải trên: thông tin người dùng */}
        <div className="whitespace-nowrap text-right text-xs leading-tight">
          <div className="text-sm font-semibold">{user.full_name}</div>
          {(user.role !== 'nhan_vien' || user.is_admin) && (
            <div className="text-gray-500">({displayRole(user)})</div>
          )}
          <div className="text-brand-600">Task của tôi: {myTaskCount}</div>
        </div>
        {canChangeOwnPin(user) && (
          <Button variant="ghost" onClick={() => setPinOpen(true)} title="Đổi PIN đăng nhập">Đổi PIN</Button>
        )}
        <Button variant="ghost" onClick={logout} title="Đăng xuất">Đăng xuất</Button>
      </header>

      {/* ===== Thân: sidebar + nội dung ===== */}
      <div className="flex min-h-0 flex-1">
        <nav className="w-44 shrink-0 border-r border-gray-300 bg-gray-50 py-2">
          <NavLink to="/dang-thuc-hien" className={navItem}>Đang thực hiện</NavLink>
          <NavLink to="/hoan-thanh" className={navItem}>Hoàn thành</NavLink>
          {canViewDashboard(user) && <NavLink to="/dashboard" className={navItem}>Dashboard</NavLink>}
          {canManageStaff(user) && <NavLink to="/nhan-su" className={navItem}>Quản lý nhân sự</NavLink>}
          {canManageStorage(user) && <NavLink to="/dung-luong" className={navItem}>Quản lý dung lượng</NavLink>}
        </nav>

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
