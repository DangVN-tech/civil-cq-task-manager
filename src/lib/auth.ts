import { supabase } from './supabase'
import { USER_COLS, type User } from '../types'

const SESSION_KEY = 'ccq_session_user_id'

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Bước 1: tra ID. Trả về user nếu tồn tại (chưa xác thực PIN nếu là trưởng phòng). */
export async function findUserByLoginId(loginId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLS)
    .eq('login_id', loginId.trim().toLowerCase())
    .maybeSingle()
  if (error) throw error
  return data as User | null
}

/** Bước 2 (chỉ trưởng phòng): xác thực PIN 4 số. */
export async function verifyPin(loginId: string, pin: string): Promise<boolean> {
  const hash = await sha256Hex(pin)
  const { data, error } = await supabase.rpc('fn_verify_pin', {
    p_login_id: loginId,
    p_pin_hash: hash,
  })
  if (error) throw error
  return data === true
}

/** Đổi PIN (lần đầu bắt buộc, hoặc chủ động đổi). */
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

/** Trưởng phòng đặt / đổi PIN cho tài khoản Admin (cơ chế chéo). */
export async function setAdminPin(newPin: string): Promise<boolean> {
  const newHash = await sha256Hex(newPin)
  const { data, error } = await supabase.rpc('fn_set_admin_pin', { p_new_hash: newHash })
  if (error) throw error
  return data === true
}

export function saveSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

/** Khôi phục phiên: đọc id từ localStorage rồi fetch lại user (lấy role mới nhất). */
export async function restoreSession(): Promise<User | null> {
  const id = localStorage.getItem(SESSION_KEY)
  if (!id) return null
  const { data, error } = await supabase.from('users').select(USER_COLS).eq('id', id).maybeSingle()
  if (error || !data) {
    clearSession()
    return null
  }
  return data as User
}
