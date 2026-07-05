export type Role = 'truong_phong' | 'pho_phong' | 'nhan_vien'
export type Priority = 'khan' | 'gap' | 'thuong'
export type Status = 'dang_thuc_hien' | 'hoan_thanh'
export type MarkColor = 'vang' | 'xanh_la' | 'tim'
export type AssignRole = 'chu_tri' | 'phoi_hop'
export type NotifType =
  | 'assigned' | 'deadline_24h' | 'deadline_8h' | 'deadline_2h'
  | 'deadline_changed' | 'returned'
export type ActivityType = 'created' | 'progress' | 'completed'

export interface User {
  id: string
  login_id: string
  full_name: string
  role: Role
  pin_changed: boolean
  created_at: string
}

/* Cột được phép SELECT trên bảng users (pin_hash bị chặn ở tầng DB) */
export const USER_COLS = 'id,login_id,full_name,role,pin_changed,created_at'

export interface TaskAssignee {
  task_id: string
  user_id: string
  assign_role: AssignRole
  user?: User
}

export interface TaskMark {
  user_id: string
  task_id: string
  color: MarkColor
}

export interface FileRow {
  id: string
  task_id: string
  uploader_id: string | null
  file_name: string
  ext: string
  size_bytes: number
  storage_path: string
  is_reference: boolean
  uploaded_at: string
  uploader?: User
  task?: { id: string; title: string; status: Status; completed_at: string | null }
}

export interface Comment {
  id: string
  task_id: string
  user_id: string | null
  content: string
  created_at: string
  user?: User
}

export interface ActivityRow {
  id: number
  task_id: string
  event_type: ActivityType
  detail: string
  created_at: string
}

export interface Notification {
  id: number
  user_id: string
  task_id: string | null
  type: NotifType
  message: string
  is_read: boolean
  snoozed_until: string | null
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  assigned_date: string
  deadline: string
  priority: Priority
  status: Status
  progress: number
  created_by: string | null
  completed_at: string | null
  completed_by: string | null
  last_return_reason: string | null
  created_at: string
  updated_at: string
  assignees: TaskAssignee[]
  marks: TaskMark[]
  files: FileRow[]
  completer?: User | null
}

export const ROLE_LABEL: Record<Role, string> = {
  truong_phong: 'Trưởng phòng',
  pho_phong: 'Phó phòng',
  nhan_vien: 'Nhân viên',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  khan: 'Khẩn',
  gap: 'Gấp',
  thuong: 'Thường',
}

export const MARK_LABEL: Record<MarkColor, string> = {
  vang: 'Vàng',
  xanh_la: 'Xanh lá',
  tim: 'Tím',
}

export const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar']
export const BLOCKED_EXTS = ['exe', 'bat', 'msi']
export const MAX_FILES_PER_UPLOAD = 6
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB (giới hạn Supabase Free Tier)
export const STORAGE_QUOTA = 1024 * 1024 * 1024 // 1 GB Free Tier
