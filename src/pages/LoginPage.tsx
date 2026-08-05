import { useEffect, useRef, useState, type FormEvent, type ClipboardEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, Layers, Mail, RefreshCw } from 'lucide-react'
import { findUserByEmail, sendOtp, verifyOtpToken } from '../lib/auth'
import { supabaseConfigured } from '../lib/supabase'
import { Button, Field, Input } from '../components/ui'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

type Step = 'email' | 'otp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Đếm ngược cooldown resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // Auto-focus ô đầu tiên khi chuyển sang bước OTP
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 80)
    }
  }, [step])

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await findUserByEmail(email)
      if (!u) {
        setError('Email này chưa được cấp quyền truy cập. Liên hệ Trưởng phòng để được thêm vào hệ thống.')
        return
      }
      await sendOtp(email)
      setOtpValues(Array(OTP_LENGTH).fill(''))
      setResendCooldown(RESEND_COOLDOWN)
      setStep('otp')
    } catch {
      setError('Không gửi được mã. Kiểm tra kết nối mạng và thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const submitOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await verifyOtpToken(email, otpValues.join(''))
      // onAuthStateChange trong AuthContext tự detect session và cập nhật user
    } catch {
      setError('Mã không đúng hoặc đã hết hạn. Kiểm tra lại hoặc gửi mã mới.')
      setBusy(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    setBusy(true)
    try {
      await sendOtp(email)
      setOtpValues(Array(OTP_LENGTH).fill(''))
      setResendCooldown(RESEND_COOLDOWN)
      otpRefs.current[0]?.focus()
    } catch {
      setError('Gửi lại thất bại. Thử lại sau.')
    } finally {
      setBusy(false)
    }
  }

  // OTP box handlers
  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otpValues]
    next[idx] = digit
    setOtpValues(next)
    if (digit && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus()
  }

  const handleOtpKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && idx > 0) otpRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus()
  }

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    const next = Array(OTP_LENGTH).fill('')
    digits.split('').forEach((d, i) => { next[i] = d })
    setOtpValues(next)
    const focusIdx = Math.min(digits.length, OTP_LENGTH - 1)
    otpRefs.current[focusIdx]?.focus()
  }

  const otpFilled = otpValues.every(Boolean)

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
        {/* Logo */}
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white shadow-md shadow-indigo-100">
          <Layers size={20} />
        </div>
        <h1 className="mb-1 text-center text-lg font-bold tracking-tight text-slate-900">
          Civil <span className="text-brand-500">&</span> QA/QC Task Manager
        </h1>
        <p className="mb-5 text-center text-xs text-slate-400">Hệ thống quản lý công việc nội bộ</p>

        {!supabaseConfigured && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            Chưa cấu hình Supabase. Sao chép <b>.env.example</b> thành <b>.env</b> và điền URL + anon key.
          </div>
        )}

        {/* Bước 1: Nhập email */}
        {step === 'email' && (
          <form onSubmit={submitEmail} className="space-y-3">
            <Field label="Email công việc của bạn" required>
              <Input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@email.com"
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              disabled={busy || !email.trim()}
            >
              <Mail size={14} />
              {busy ? 'Đang gửi mã...' : 'Gửi mã đăng nhập'}
            </Button>
          </form>
        )}

        {/* Bước 2: Nhập mã OTP */}
        {step === 'otp' && (
          <form onSubmit={submitOtp} className="space-y-4">
            {/* Email đã gửi */}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã đã gửi đến</p>
                <p className="text-xs font-semibold text-slate-700">{email}</p>
              </div>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setOtpValues(Array(OTP_LENGTH).fill('')) }}
                className="text-[11px] font-semibold text-brand-500 hover:underline"
              >
                Đổi email
              </button>
            </div>

            {/* 6-box OTP */}
            <div>
              <p className="mb-2 text-center text-xs text-slate-500">Nhập mã 6 chữ số từ email của bạn</p>
              <div className="flex justify-center gap-2">
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpValues[i]}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    className="h-12 w-10 rounded-xl border-2 border-slate-200 text-center text-xl font-bold text-slate-900 transition-colors focus:border-brand-500 focus:outline-none"
                  />
                ))}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              disabled={busy || !otpFilled}
            >
              {busy ? 'Đang xác thực...' : 'Đăng nhập'}
            </Button>

            {/* Gửi lại */}
            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-slate-400">
                  Gửi lại sau <span className="font-semibold text-slate-600">{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy}
                  className="flex items-center gap-1 mx-auto text-xs font-semibold text-brand-500 hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={11} /> Gửi lại mã
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); setOtpValues(Array(OTP_LENGTH).fill('')) }}
              className="flex w-full items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            >
              <ArrowLeft size={12} /> Quay lại
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-center text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
