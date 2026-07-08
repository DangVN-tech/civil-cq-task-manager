import { supabase } from './supabase'

/** Báo cho Chủ trì + Phối hợp khi (các) task của họ bị xóa (trực tiếp, hoặc kéo theo khi
 *  xóa cả Đầu mục/Dự án). Phải gọi TRƯỚC khi thực sự xóa task (để còn đọc được task_assignees).
 *  task_id để null vì task sẽ không còn tồn tại — thông báo tự đứng độc lập, không cần deep-link.
 *  Không bao giờ throw: gửi thông báo là phụ, việc xóa task mới là chính — lỗi ở đây
 *  (vd. migration-06 chưa chạy nên enum 'deleted' chưa tồn tại) không được chặn thao tác xóa. */
export async function notifyTasksDeleted(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return
  try {
    const { data, error } = await supabase
      .from('task_assignees')
      .select('user_id, task:tasks(title)')
      .in('task_id', taskIds)
    if (error) throw error
    const rows = (data ?? [])
      .map((r) => {
        // supabase-js suy luận kiểu là mảng khi thiếu generated types, nhưng PostgREST
        // trả về object cho quan hệ nhiều-1 (task_assignees -> tasks) — xử lý cả 2 dạng cho chắc.
        const t = r.task as unknown as { title: string } | { title: string }[] | null
        const title = Array.isArray(t) ? t[0]?.title : t?.title
        return { user_id: r.user_id, title }
      })
      .filter((r): r is { user_id: string; title: string } => !!r.title)
      .map((r) => ({
        user_id: r.user_id,
        task_id: null,
        type: 'deleted' as const,
        message: `Task "${r.title}" đã bị xóa.`,
      }))
    if (rows.length === 0) return
    const { error: eIns } = await supabase.from('notifications').insert(rows)
    if (eIns) throw eIns
  } catch (e) {
    console.warn('Không gửi được thông báo "task bị xóa" (không ảnh hưởng việc xóa task):', e)
  }
}
