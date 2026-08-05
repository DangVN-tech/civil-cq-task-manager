import { supabase } from './supabase'
import { USER_COLS, type User } from '../types'

// ── Legacy PIN helpers (kept for reference, no longer used in login flow) ──

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function findUserByLoginId(loginId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLS)
    .eq('login_id', loginId.trim().toLowerCase())
    .maybeSingle()
  if (error) throw error
  return data as User | null
}

export async function verifyPin(loginId: string, pin: string): Promise<boolean> {
  const hash = await sha256Hex(pin)
  const { data, error } = await supabase.rpc('fn_verify_pin', {
    p_login_id: loginId,
    p_pin_hash: hash,
  })
  if (error) throw error
  return data === true
}

export async function changePin(loginId: string, oldPin: string, newPin: string): Promise<boolean> {
  const [oldHash, newHash] = await Promise.all([sha256Hex(oldPin), sha256Hex(newPin)])
  const { data, error } = await supabase.rpc('fn_change_pin', {
    p_login_id: loginId,
    p_old_hash: oldHash,
    p_new_hash: newHash,
  })
  if (error) throw error
  return data === true
}

export function saveSession(userId: string) {
  localStorage.setItem('ccq_session_user_id', userId)
}

// ── Email OTP auth (new login flow) ──

/** Tra email trong users table — kiểm tra whitelist trước khi gửi OTP. */
export async function findUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLS)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (error) throw error
  return data as User | null
}

/** Gửi mã OTP 6 số đến email. Supabase tự tạo auth account lần đầu. */
export async function sendOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

/** Xác thực mã OTP 6 số. Sau khi thành công, onAuthStateChange trong AuthContext tự xử lý session. */
export async function verifyOtpToken(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  })
  if (error) throw error
}

/** Khôi phục phiên từ Supabase Auth JWT. */
export async function restoreSession(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.email) return null
  return findUserByEmail(session.user.email)
}

/** Đăng xuất — xóa Supabase Auth session. */
export async function clearSession(): Promise<void> {
  await supabase.auth.signOut()
}
