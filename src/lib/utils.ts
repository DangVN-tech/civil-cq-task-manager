import { differenceInMinutes, format, isToday, isYesterday } from 'date-fns'
import type { Priority, Task, User } from '../types'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const fmtDateTime = (d: string | Date) => format(new Date(d), 'dd/MM/yyyy HH:mm')
export const fmtDate = (d: string | Date) => format(new Date(d), 'dd/MM/yyyy')
export const fmtTime = (d: string | Date) => format(new Date(d), 'HH:mm')

export function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

export function isOverdue(task: Task): boolean {
  // Task không có deadline (công việc thường xuyên) thì không bao giờ quá hạn
  return task.status === 'dang_thuc_hien' && task.deadline != null
    && new Date(task.deadline).getTime() < Date.now()
}

/** Thời gian còn lại đến deadline; null nếu task không có deadline */
export function timeLeftLabel(deadline: string | null): { text: string; overdue: boolean } | null {
  if (!deadline) return null
  const mins = differenceInMinutes(new Date(deadline), new Date())
  const abs = Math.abs(mins)
  const d = Math.floor(abs / 1440)
  const h = Math.floor((abs % 1440) / 60)
  const m = abs % 60
  const span = d > 0 ? `${d} ngày ${h} giờ` : h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
  return mins >= 0 ? { text: `còn ${span}`, overdue: false } : { text: `quá hạn ${span}`, overdue: true }
}

/** Sắp xếp tab Đang thực hiện: Khẩn -> Gấp -> Quá hạn (Thường) -> Thường */
export function sortInProgress(tasks: Task[]): Task[] {
  const group = (t: Task): number => {
    if (t.priority === 'khan') return 0
    if (t.priority === 'gap') return 1
    if (isOverdue(t)) return 2
    return 3
  }
  // Không có deadline -> xếp cuối trong nhóm
  const dl = (t: Task) => (t.deadline ? new Date(t.deadline).getTime() : Infinity)
  return [...tasks].sort((a, b) => {
    const g = group(a) - group(b)
    if (g !== 0) return g
    return dl(a) - dl(b)
  })
}

/** Nhóm ngày kiểu Outlook cho tab Hoàn thành */
export function completedGroupLabel(completedAt: string): string {
  const d = new Date(completedAt)
  if (isToday(d)) return 'Hôm nay'
  if (isYesterday(d)) return 'Hôm qua'
  return format(d, 'dd/MM/yyyy')
}

export const PRIORITY_ORDER: Record<Priority, number> = { khan: 0, gap: 1, thuong: 2 }

/** Chữ cái viết tắt tên: "Lê Quang Hưng" -> "LH" (chữ đầu của từ đầu và từ cuối) */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/)
  if (words.length === 0 || !words[0]) return '?'
  const first = words[0][0] ?? ''
  const last = words.length > 1 ? words[words.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

/** Thứ tự danh sách nhân sự: Trưởng phòng -> Admin -> Phó phòng -> Nhân viên */
export function sortUsers(users: User[]): User[] {
  const rank = (u: User) =>
    u.is_admin ? 1 : u.role === 'truong_phong' ? 0 : u.role === 'pho_phong' ? 2 : 3
  return [...users].sort(
    (a, b) => rank(a) - rank(b) || a.full_name.localeCompare(b.full_name, 'vi'),
  )
}

/** Chuẩn hóa tên file khi lưu Storage (bỏ dấu, ký tự lạ) */
export function slugFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}
