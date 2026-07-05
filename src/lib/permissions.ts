import type { Task, User } from '../types'

/* Toàn bộ phân quyền tập trung tại đây */

export const isTruongPhong = (u: User) => u.role === 'truong_phong'

export const canCreateTask = isTruongPhong
export const canEditTask = isTruongPhong        // sửa nội dung, deadline, ưu tiên, người thực hiện
export const canDeleteTask = isTruongPhong
export const canReturnTask = isTruongPhong      // trả task về làm lại
export const canManageStaff = isTruongPhong
export const canManageStorage = isTruongPhong

export const canViewDashboard = (u: User) =>
  u.role === 'truong_phong' || u.role === 'pho_phong'

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

/** Upload file: người tham gia task (hoặc trưởng phòng), chỉ khi đang thực hiện */
export function canUploadFile(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && (isParticipant(task, u) || isTruongPhong(u))
}

/** Comment: người tham gia; trưởng phòng được phản hồi. Chỉ khi đang thực hiện */
export function canComment(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && (isParticipant(task, u) || isTruongPhong(u))
}
