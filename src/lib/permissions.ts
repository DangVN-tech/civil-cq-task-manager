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

/** Quản lý Dự án / Gói thầu + Nhóm công việc (WBS) — chỉ Trưởng phòng thật */
export const canManageProjects = isTruongPhong

export const canManageStaff = (u: User) => isTruongPhong(u) || isAdmin(u)
export const canManageStorage = (u: User) => isTruongPhong(u) || isAdmin(u)

/** Chỉ Trưởng phòng thật đổi được PIN.
 *  Admin dùng chung PIN với Trưởng phòng (cơ chế chéo): Trưởng phòng chia sẻ PIN = cho phép vào. */
export const canChangeOwnPin = isTruongPhong

/** Dashboard toàn phòng — mọi vai trò đều xem được (kể cả Nhân viên). */
export const canViewDashboard = (_u: User) => true

export function isParticipant(task: Task, u: User): boolean {
  return task.assignees.some((a) => a.user_id === u.id)
}

export function isChuTri(task: Task, u: User): boolean {
  return task.assignees.some((a) => a.user_id === u.id && a.assign_role === 'chu_tri')
}

/** Chỉ Chủ trì cập nhật tiến độ (chỉ khi đang thực hiện, chưa gửi duyệt) */
export function canUpdateProgress(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && isChuTri(task, u)
}

/** Chủ trì bấm "Hoàn tất" -> gửi duyệt cho Trưởng phòng (chưa phải hoàn thành thật) */
export function canComplete(task: Task, u: User): boolean {
  return task.status === 'dang_thuc_hien' && isChuTri(task, u)
}

/** Trưởng phòng chốt "Xác nhận hoàn thành" thật khi task đang Chờ duyệt */
export function canApproveCompletion(task: Task, u: User): boolean {
  return task.status === 'cho_duyet' && isTruongPhong(u)
}

/** Chủ trì tự rút lại khi gửi duyệt nhầm/sớm, trước khi Trưởng phòng xử lý */
export function canWithdrawReview(task: Task, u: User): boolean {
  return task.status === 'cho_duyet' && isChuTri(task, u)
}

/** Chủ trì bấm "Sửa" trong tab Hoàn thành -> task quay lại Đang thực hiện */
export function canReopenCompleted(task: Task, u: User): boolean {
  return task.status === 'hoan_thanh' && isChuTri(task, u)
}

/** Upload file: người tham gia task (hoặc trưởng phòng thật), khi đang thực hiện hoặc chờ duyệt */
export function canUploadFile(task: Task, u: User): boolean {
  return (task.status === 'dang_thuc_hien' || task.status === 'cho_duyet')
    && (isParticipant(task, u) || isTruongPhong(u))
}

/** Comment: người tham gia; trưởng phòng thật được phản hồi. Khi đang thực hiện hoặc chờ duyệt */
export function canComment(task: Task, u: User): boolean {
  return (task.status === 'dang_thuc_hien' || task.status === 'cho_duyet')
    && (isParticipant(task, u) || isTruongPhong(u))
}

/** Trưởng phòng, Admin, hoặc người tham gia (chủ trì/phối hợp) mới xem được đầy đủ
 *  chi tiết 1 task (mô tả, % tiến độ, file, nhật ký/bình luận). Người khác chỉ thấy
 *  thông tin chung: tên task, người phụ trách, deadline. */
export function canViewTaskFull(task: Task, u: User): boolean {
  return isTruongPhong(u) || isAdmin(u) || isParticipant(task, u)
}
