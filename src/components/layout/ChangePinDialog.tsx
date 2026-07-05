import { useEffect, useState } from 'react'
import { changePin } from '../../lib/auth'
import { useCurrentUser } from '../../context/AuthContext'
import { Button, Dialog, Field, Input } from '../ui'

/** Trưởng phòng chủ động đổi PIN của mình bất cứ lúc nào. */
export default function ChangePinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setOldPin(''); setNewPin(''); setNewPin2(''); setError(''); setDone(false)
    }
  }, [open])

  const submit = async () => {
    setError('')
    if (!/^\d{4}$/.test(newPin)) return setError('PIN mới phải gồm đúng 4 chữ số.')
    if (newPin === '0000') return setError('PIN mới không được là 0000.')
    if (newPin !== newPin2) return setError('PIN nhập lại không khớp.')
    setBusy(true)
    try {
      const ok = await changePin(user.login_id, oldPin, newPin)
      if (!ok) {
        setError('PIN hiện tại không đúng.')
        return
      }
      setDone(true)
    } catch {
      setError('Không kết nối được máy chủ.')
    } finally {
      setBusy(false)
    }
  }

  const pinInput = (value: string, set: (v: string) => void, autoFocus = false) => (
    <Input
      autoFocus={autoFocus} type="password" inputMode="numeric" maxLength={4}
      value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
      className="text-center tracking-[0.5em]"
    />
  )

  return (
    <Dialog open={open} onClose={onClose} title="Đổi PIN" width="max-w-sm">
      {done ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-green-700">✓ Đổi PIN thành công. Dùng PIN mới từ lần đăng nhập sau.</p>
          <Button variant="primary" onClick={onClose}>Đóng</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="PIN hiện tại" required>{pinInput(oldPin, setOldPin, true)}</Field>
          <Field label="PIN mới (4 số)" required>{pinInput(newPin, setNewPin)}</Field>
          <Field label="Nhập lại PIN mới" required>{pinInput(newPin2, setNewPin2)}</Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <Button onClick={onClose}>Hủy</Button>
            <Button variant="primary" onClick={submit}
              disabled={busy || oldPin.length !== 4 || newPin.length !== 4 || newPin2.length !== 4}>
              {busy ? 'Đang lưu...' : 'Đổi PIN'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
