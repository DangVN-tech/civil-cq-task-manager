export type Role = 'truong_phong' | 'pho_phong' | 'nhan_vien'
export type Priority = 'khan' | 'gap' | 'thuong'
export type Status = 'dang_thuc_hien' | 'hoan_thanh'
export type MarkColor = 'vang' | 'xanh_la' | 'tim'
export type AssignRole = 'chu_tri' | 'phoi_hop'
export type NotifType =
  | 'assigned' | 'deadline_24h' | 'deadline_8h' | 'deadline_2h'
  | 'deadline_changed' | 'returned' | 'comment'
export type ActivityType = 'created' | 'progress' | 'completed'
export type ProjectStatus = 'dang_thuc_hien' | 'hoan_thanh' | 'luu_tru'

export interface User {
  id: string
  login_id: string
  full_name: string
  role: Role
  is_admin: boolean
  pin_changed: boolean
  created_at: string
}

/* Cột được phép SELECT trên bảng users (pin_hash bị chặn ở tầng DB) */
export const USER_COLS = 'id,login_id,full_name,role,is_admin,pin_changed,created_at'

/** Dự án / Gói thầu (WBS cấp 1) */
export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  created_at: string
  groups?: TaskGroup[]
}

/** Nhóm công việc (WBS cấp 2, thuộc 1 dự án) */
export interface TaskGroup {
  id: string
  project_id: string
  name: string
  created_at: string
  project?: Project
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  dang_thuc_hien: 'Đang thực hiện',
  hoan_thanh: 'Hoàn thành',
  luu_tru: 'Lưu trữ',
}

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
  /** null = công việc thường xuyên, không có hạn hoàn thành */
  deadline: string | null
  priority: Priority
  status: Status
  progress: number
  created_by: string | null
  completed_at: string | null
  completed_by: string | null
  last_return_reason: string | null
  /** Phối hợp ngoài phòng (tên tự do, không cần tài khoản) */
  external_collabs: string[]
  /** Nhóm công việc chứa task (WBS); undefined khi DB chưa migration */
  group_id?: string
  group?: TaskGroup
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

/** Nhãn chức vụ hiển thị: tài khoản Admin hệ thống hiện là "Admin" */
export function displayRole(u: User): string {
  return u.is_admin ? 'Admin' : ROLE_LABEL[u.role]
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
