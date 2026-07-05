import { useEffect, useState } from 'react'
import { Button, ConfirmDialog, Dialog, Field, Input, Loading, Select } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { useStaffMutations, useUsers, type StaffInput } from '../hooks/useUsers'
import { setAdminPin } from '../lib/auth'
import { canSetAdminPin } from '../lib/permissions'
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
  const [adminPinOpen, setAdminPinOpen] = useState(false)

  if (isLoading) return <Loading />

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Quản lý nhân sự phòng</h2>
        <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }}>
          + Thêm nhân sự
        </Button>
      </div>

      <div className="border border-gray-300 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-semibold">Họ tên</th>
              <th className="px-3 py-2 font-semibold">ID đăng nhập</th>
              <th className="px-3 py-2 font-semibold">Chức vụ</th>
              <th className="px-3 py-2 font-semibold">Ngày tạo</th>
              <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">
                  {u.full_name} {u.id === me.id && <span className="text-xs text-gray-400">(bạn)</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{u.login_id}</td>
                <td className="px-3 py-2 text-xs">{displayRole(u)}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(u.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  {u.is_admin ? (
                    // Tài khoản Admin hệ thống: chỉ Trưởng phòng thật được cấp/đổi PIN (cơ chế chéo)
                    canSetAdminPin(me) && (
                      <Button variant="ghost" className="px-2 py-0.5 text-xs"
                        onClick={() => setAdminPinOpen(true)}>
                        Đặt PIN Admin
                      </Button>
                    )
                  ) : (
                    <>
                      <Button variant="ghost" className="px-2 py-0.5 text-xs"
                        onClick={() => { setEditing(u); setFormOpen(true) }}>
                        Sửa
                      </Button>
                      {u.id !== me.id && (
                        <Button variant="ghost" className="px-2 py-0.5 text-xs text-red-600"
                          onClick={() => setDeleting(u)}>
                          Xóa
                        </Button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">
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

      <AdminPinDialog open={adminPinOpen} onClose={() => setAdminPinOpen(false)} />
    </div>
  )
}

/** Trưởng phòng cấp PIN mới cho tài khoản Admin (Admin không tự đổi được). */
function AdminPinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setPin(''); setPin2(''); setError(''); setDone(false) }
  }, [open])

  const submit = async () => {
    setError('')
    if (!/^\d{4}$/.test(pin)) return setError('PIN phải gồm đúng 4 chữ số.')
    if (pin !== pin2) return setError('PIN nhập lại không khớp.')
    setBusy(true)
    try {
      const ok = await setAdminPin(pin)
      if (!ok) return setError('Không tìm thấy tài khoản Admin.')
      setDone(true)
    } catch {
      setError('Không kết nối được máy chủ.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Đặt PIN cho Admin" width="max-w-sm">
      {done ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-green-700">
            ✓ Đã đặt PIN mới cho Admin. Hãy chuyển PIN này cho quản trị viên khi cần hỗ trợ.
          </p>
          <Button variant="primary" onClick={onClose}>Đóng</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Admin không tự đổi được PIN — chỉ Trưởng phòng cấp (cơ chế kiểm soát chéo).
          </p>
          <Field label="PIN mới cho Admin (4 số)" required>
            <Input autoFocus type="password" inputMode="numeric" maxLength={4}
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="text-center tracking-[0.5em]" />
          </Field>
          <Field label="Nhập lại PIN" required>
            <Input type="password" inputMode="numeric" maxLength={4}
              value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
              className="text-center tracking-[0.5em]" />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <Button onClick={onClose}>Hủy</Button>
            <Button variant="primary" onClick={submit} disabled={busy || pin.length !== 4 || pin2.length !== 4}>
              {busy ? 'Đang lưu...' : 'Đặt PIN'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
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
