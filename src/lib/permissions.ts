import type { Task, User } from '../types'

/* Toàn bộ phân quyền tập trung tại đây.
   Admin hệ thống (is_admin): CHỈ xem task, quản lý nhân sự, quản lý dung lượng.
   Không tạo/sửa/xóa/trả task, không comment, không upload. */

export const isAdmin = (u: User) => u.is_admin

/** Trưởng phòng THẬT của phòng (không tính tài khoản Admin hệ thống) */
export const isTruongPhong = (u: User) => u.role === 'truong_phong' && !u.is_admin

export const canCreateTask = isTruongPhong
export const canEditTask = isTruongPhong        // sửa nội dung, deadline, ưu tiên, người thực hiện
export const canDeleteTask = isTruongPhong
export const canReturnTask = isTruongPhong      // trả task về làm lại

export const canManageStaff = (u: User) => isTruongPhong(u) || isAdmin(u)
export const canManageStorage = (u: User) => isTruongPhong(u) || isAdmin(u)

/** Chỉ Trưởng phòng thật tự đổi PIN; PIN của Admin do Trưởng phòng cấp (cơ chế chéo) */
export const canChangeOwnPin = isTruongPhong
export const canSetAdminPin = isTruongPhong

export const canViewDashboard = (u: User) =>
  isTruongPhong(u) || u.role === 'pho_phong' || isAdmin(u)

export function isParticipant(task: Task, u: User): boolean {
  return task.assignees.some((a) => a.user_id === u.id)
}

export function isChuTri(task: Task, u: User): boolean {
  return task.assignees.some((a) => a.user_id === u.id && a.assign_role === 'chu_tri')
}

/** Chỉ Chủ trì cập nhật tiến độ và xác nhận hoàn thành */
export function canUpdateProgress(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && isChuTri(task, u)
}

export function canComplete(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && isChuTri(task, u)
}

/** Chủ trì bấm "Sửa" trong tab Hoàn thành -> task quay lại Đang thực hiện */
export function canReopenCompleted(task: Task, u: User): boolean {
  return task.status === 'hoan_thanh' && isChuTri(task, u)
}

/** Upload file: người tham gia task (hoặc trưởng phòng thật), chỉ khi đang thực hiện */
export function canUploadFile(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && (isParticipant(task, u) || isTruongPhong(u))
}

/** Comment: người tham gia; trưởng phòng thật được phản hồi. Chỉ khi đang thực hiện */
export function canComment(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && (isParticipant(task, u) || isTruongPhong(u))
}
