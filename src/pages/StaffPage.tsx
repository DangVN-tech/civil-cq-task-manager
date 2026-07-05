import { useState } from 'react'
import { Button, ConfirmDialog, Dialog, Field, Input, Loading, Select } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { useStaffMutations, useUsers, type StaffInput } from '../hooks/useUsers'
import { fmtDate } from '../lib/utils'
import { displayRole, ROLE_LABEL, type Role, type User } from '../types'

/** Quản lý nhân sự phòng — chỉ Trưởng phòng. */
export default function StaffPage() {
  const me = useCurrentUser()
  const { data: users, isLoading } = useUsers()
  const { addStaff, updateStaff, deleteStaff } = useStaffMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  if (isLoading) return <Loading />

  return (
    <div className="h-full space-y-5 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-950">Quản lý nhân sự phòng</h2>
        <Button variant="primary" className="rounded-xl" onClick={() => { setEditing(null); setFormOpen(true) }}>
          + Thêm nhân sự
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-400">
              <th className="p-4 font-bold">Họ tên</th>
              <th className="p-4 font-bold">ID đăng nhập</th>
              <th className="p-4 font-bold">Chức vụ</th>
              <th className="p-4 font-bold">Ngày tạo</th>
              <th className="p-4 text-right font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(users ?? []).map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-slate-50/50">
                <td className="p-4 font-semibold text-slate-900">
                  {u.full_name} {u.id === me.id && <span className="text-xs font-normal text-slate-400">(bạn)</span>}
                </td>
                <td className="p-4 font-mono text-xs text-slate-500">{u.login_id}</td>
                <td className="p-4"><RoleBadge u={u} /></td>
                <td className="p-4 text-xs text-slate-500">{fmtDate(u.created_at)}</td>
                <td className="p-4 text-right">
                  {u.is_admin ? (
                    // Admin không có PIN riêng: dùng chung PIN với Trưởng phòng (cơ chế chéo)
                    <span className="text-[11px] italic text-slate-400">PIN dùng chung với Trưởng phòng</span>
                  ) : (
                    <span className="space-x-3 text-xs font-medium">
                      <button className="text-brand-500 hover:underline"
                        onClick={() => { setEditing(u); setFormOpen(true) }}>
                        Sửa
                      </button>
                      {u.id !== me.id && (
                        <button className="text-rose-600 hover:underline"
                          onClick={() => setDeleting(u)}>
                          Xóa
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Đổi chức vụ sẽ tự động cập nhật quyền hệ thống. Trưởng phòng mới có PIN mặc định 0000
        (bắt buộc đổi ở lần đăng nhập đầu).
      </p>

      <StaffForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSubmit={async (input) => {
          if (editing) await updateStaff.mutateAsync({ id: editing.id, input })
          else await addStaff.mutateAsync(input)
        }}
      />

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)}
        title="Xóa nhân sự" danger confirmLabel="Xóa"
        message={<>Xóa <b>{deleting?.full_name}</b> ({deleting?.login_id})? Người này sẽ bị gỡ khỏi mọi task đang tham gia.</>}
        onConfirm={() => deleting && deleteStaff.mutate(deleting.id)}
      />

    </div>
  )
}

/** Huy hiệu chức vụ màu theo mockup: Trưởng phòng/Admin tím, Phó phòng chàm, Nhân viên xám */
function RoleBadge({ u }: { u: User }) {
  const cls = u.is_admin || u.role === 'truong_phong'
    ? 'bg-violet-50 text-violet-700 font-semibold'
    : u.role === 'pho_phong'
      ? 'bg-indigo-50 text-indigo-700 font-semibold'
      : 'bg-slate-50 text-slate-600 font-medium'
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{displayRole(u)}</span>
}

function StaffForm({
  open, onClose, editing, onSubmit,
}: {
  open: boolean
  onClose: () => void
  editing: User | null
  onSubmit: (input: StaffInput) => Promise<void>
}) {
  const [fullName, setFullName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [role, setRole] = useState<Role>('nhan_vien')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // đồng bộ khi mở form
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setFullName(editing?.full_name ?? '')
      setLoginId(editing?.login_id ?? '')
      setRole(editing?.role ?? 'nhan_vien')
      setError('')
    }
  }

  const submit = async () => {
    setError('')
    if (!fullName.trim()) return setError('Chưa nhập họ tên.')
    if (!/^[a-z0-9]+$/.test(loginId)) return setError('ID chỉ gồm chữ thường không dấu và số, không khoảng trắng.')
    setBusy(true)
    try {
      await onSubmit({ full_name: fullName.trim(), login_id: loginId, role })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Sửa nhân sự' : 'Thêm nhân sự'} width="max-w-sm">
      <div className="space-y-3">
        <Field label="Họ tên" required>
          <Input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
        </Field>
        <Field label="ID đăng nhập (không dấu, không khoảng trắng, chữ thường)" required>
          <Input
            value={loginId}
            onChange={(e) => setLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            placeholder="nguyenvana"
          />
        </Field>
        <Field label="Chức vụ" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
