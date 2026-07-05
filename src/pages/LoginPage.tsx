import { useState, type FormEvent } from 'react'
import { changePin, findUserByLoginId, saveSession, verifyPin } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { supabaseConfigured } from '../lib/supabase'
import { Button, Field, Input } from '../components/ui'
import type { User } from '../types'

type Step = 'id' | 'pin' | 'change_pin'

export default function LoginPage() {
  const { setUser } = useAuth()
  const [step, setStep] = useState<Step>('id')
  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [pending, setPending] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const finishLogin = (u: User) => {
    saveSession(u.id)
    setUser(u)
  }

  const submitId = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await findUserByLoginId(loginId)
      if (!u) {
        setError('ID không tồn tại. Liên hệ Trưởng phòng để được cấp tài khoản.')
        return
      }
      if (u.role === 'truong_phong') {
        setPending(u)
        setStep('pin')
      } else {
        finishLogin(u)
      }
    } catch {
      setError('Không kết nối được máy chủ. Kiểm tra mạng hoặc cấu hình .env.')
    } finally {
      setBusy(false)
    }
  }

  const submitPin = async (e: FormEvent) => {
    e.preventDefault()
    if (!pending) return
    setError('')
    setBusy(true)
    try {
      const ok = await verifyPin(pending.login_id, pin)
      if (!ok) {
        setError('PIN không đúng.')
        return
      }
      // Lần đầu đăng nhập: bắt buộc đổi PIN.
      // Riêng Admin không tự đổi PIN (PIN do Trưởng phòng cấp - cơ chế chéo).
      if (!pending.pin_changed && !pending.is_admin) {
        setStep('change_pin')
      } else {
        finishLogin(pending)
      }
    } catch {
      setError('Không kết nối được máy chủ.')
    } finally {
      setBusy(false)
    }
  }

  const submitChangePin = async (e: FormEvent) => {
    e.preventDefault()
    if (!pending) return
    setError('')
    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN mới phải gồm đúng 4 chữ số.')
      return
    }
    if (newPin === '0000') {
      setError('PIN mới không được là 0000.')
      return
    }
    if (newPin !== newPin2) {
      setError('PIN nhập lại không khớp.')
      return
    }
    setBusy(true)
    try {
      const ok = await changePin(pending.login_id, pin, newPin)
      if (!ok) {
        setError('Đổi PIN thất bại. Thử lại.')
        return
      }
      finishLogin({ ...pending, pin_changed: true })
    } catch {
      setError('Không kết nối được máy chủ.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white shadow-md shadow-blue-200">
          C
        </div>
        <h1 className="mb-1 text-center text-lg font-bold tracking-tight text-slate-900">
          Civil<span className="text-brand-500">&</span>CQ Task Manager
        </h1>
        <p className="mb-5 text-center text-xs text-slate-400">Hệ thống quản lý công việc nội bộ</p>

        {!supabaseConfigured && (
          <div className="mb-4 border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            Chưa cấu hình Supabase. Sao chép <b>.env.example</b> thành <b>.env</b> và điền URL + anon key.
          </div>
        )}

        {step === 'id' && (
          <form onSubmit={submitId} className="space-y-3">
            <Field label="ID đăng nhập" required>
              <Input
                autoFocus
                value={loginId}
                onChange={(e) => setLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                placeholder="ví dụ: nguyenvana"
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full justify-center" disabled={busy || !loginId}>
              {busy ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </Button>
          </form>
        )}

        {step === 'pin' && pending && (
          <form onSubmit={submitPin} className="space-y-3">
            <p className="text-sm">
              Xin chào <b>{pending.full_name}</b> ({pending.is_admin ? 'Admin' : 'Trưởng phòng'}).
              Nhập PIN để tiếp tục:
            </p>
            <Field label={pending.is_admin ? 'PIN (dùng chung với Trưởng phòng)' : 'PIN (4 số)'} required>
              <Input
                autoFocus
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="text-center tracking-[0.5em]"
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full justify-center" disabled={busy || pin.length !== 4}>
              {busy ? 'Đang xác thực...' : 'Xác nhận'}
            </Button>
            <Button type="button" variant="ghost" className="w-full justify-center" onClick={() => { setStep('id'); setPin(''); setError('') }}>
              ← Quay lại
            </Button>
          </form>
        )}

        {step === 'change_pin' && pending && (
          <form onSubmit={submitChangePin} className="space-y-3">
            <div className="border border-brand-100 bg-brand-50 p-2 text-xs text-brand-700">
              Lần đăng nhập đầu tiên: bắt buộc đổi PIN mặc định.
            </div>
            <Field label="PIN mới (4 số)" required>
              <Input
                autoFocus type="password" inputMode="numeric" maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="text-center tracking-[0.5em]"
              />
            </Field>
            <Field label="Nhập lại PIN mới" required>
              <Input
                type="password" inputMode="numeric" maxLength={4}
                value={newPin2}
                onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ''))}
                className="text-center tracking-[0.5em]"
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full justify-center" disabled={busy}>
              {busy ? 'Đang lưu...' : 'Đổi PIN và đăng nhập'}
            </Button>
          </form>
        )}

        {error && <p className="mt-3 text-center text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
