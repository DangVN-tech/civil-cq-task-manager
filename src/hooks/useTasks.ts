import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { USER_COLS, type MarkColor, type Priority, type Status, type Task } from '../types'

/* pin_hash bị chặn ở DB nên mọi embed users phải liệt kê cột tường minh */
const TASK_SELECT = `*,
  assignees:task_assignees(task_id,user_id,assign_role,user:users(${USER_COLS})),
  marks:task_marks(user_id,task_id,color),
  files(id,task_id,uploader_id,file_name,ext,size_bytes,storage_path,is_reference,uploaded_at,uploader:users(${USER_COLS})),
  completer:users!tasks_completed_by_fkey(${USER_COLS})`

export function useTasks(status: Status) {
  return useQuery({
    queryKey: ['tasks', status],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('status', status)
        .order(status === 'hoan_thanh' ? 'completed_at' : 'deadline', {
          ascending: status !== 'hoan_thanh',
          nullsFirst: false, // task không deadline xếp cuối
        })
      if (error) throw error
      return (data ?? []) as unknown as Task[]
    },
  })
}

export function useAllTasks() {
  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select(TASK_SELECT)
      if (error) throw error
      return (data ?? []) as unknown as Task[]
    },
  })
}

export interface TaskInput {
  title: string
  description: string
  assigned_date: string
  /** null = công việc thường xuyên, không có hạn */
  deadline: string | null
  priority: Priority
  /** Danh sách user id theo thứ tự chọn: người đầu tiên là Chủ trì */
  participantIds: string[]
  /** Phối hợp ngoài phòng (tên tự do) */
  externalCollabs: string[]
}

export function useTaskMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks'] })

  const createTask = useMutation({
    mutationFn: async ({ input, createdBy }: { input: TaskInput; createdBy: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: input.title,
          description: input.description,
          assigned_date: input.assigned_date,
          deadline: input.deadline,
          priority: input.priority,
          external_collabs: input.externalCollabs,
          created_by: createdBy,
        })
        .select('id')
        .single()
      if (error) throw error
      const taskId = data.id as string
      const rows = input.participantIds.map((uid, i) => ({
        task_id: taskId,
        user_id: uid,
        assign_role: i === 0 ? 'chu_tri' : 'phoi_hop',
      }))
      const { error: e2 } = await supabase.from('task_assignees').insert(rows)
      if (e2) throw e2
      return taskId
    },
    onSuccess: invalidate,
  })

  const updateTask = useMutation({
    mutationFn: async ({ taskId, input }: { taskId: string; input: TaskInput }) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: input.title,
          description: input.description,
          assigned_date: input.assigned_date,
          deadline: input.deadline,
          priority: input.priority,
          external_collabs: input.externalCollabs,
        })
        .eq('id', taskId)
      if (error) throw error
      // Đồng bộ người tham gia: xóa hết rồi chèn lại theo thứ tự mới
      const { error: eDel } = await supabase.from('task_assignees').delete().eq('task_id', taskId)
      if (eDel) throw eDel
      const rows = input.participantIds.map((uid, i) => ({
        task_id: taskId,
        user_id: uid,
        assign_role: i === 0 ? 'chu_tri' : 'phoi_hop',
      }))
      const { error: eIns } = await supabase.from('task_assignees').insert(rows)
      if (eIns) throw eIns
    },
    onSuccess: invalidate,
  })

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      // Xóa file trên Storage trước
      const { data: fs } = await supabase.from('files').select('storage_path').eq('task_id', taskId)
      if (fs && fs.length > 0) {
        await supabase.storage.from('task-files').remove(fs.map((f) => f.storage_path))
      }
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const setProgress = useMutation({
    mutationFn: async ({ taskId, progress }: { taskId: string; progress: number }) => {
      const { error } = await supabase.from('tasks').update({ progress }).eq('id', taskId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const completeTask = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'hoan_thanh', completed_by: userId })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Trưởng phòng trả task về làm lại (bắt buộc lý do).
   *  Lý do được tự động lưu thành comment để giữ lại lịch sử trao đổi. */
  const returnTask = useMutation({
    mutationFn: async ({ taskId, reason, userId }: { taskId: string; reason: string; userId: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'dang_thuc_hien', last_return_reason: reason, progress: 0 })
        .eq('id', taskId)
      if (error) throw error
      const { error: eCmt } = await supabase
        .from('comments')
        .insert({ task_id: taskId, user_id: userId, content: `Lý do trả về: ${reason}` })
      if (eCmt) throw eCmt
    },
    onSuccess: (_d, v) => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['comments', v.taskId] })
    },
  })

  /** Chủ trì bấm "Sửa" trong tab Hoàn thành */
  const reopenTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'dang_thuc_hien' })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Màu đánh dấu cá nhân: null = bỏ đánh dấu */
  const setMark = useMutation({
    mutationFn: async ({ taskId, userId, color }: { taskId: string; userId: string; color: MarkColor | null }) => {
      if (color === null) {
        const { error } = await supabase
          .from('task_marks')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('task_marks')
          .upsert({ task_id: taskId, user_id: userId, color })
        if (error) throw error
      }
    },
    onSuccess: invalidate,
  })

  return { createTask, updateTask, deleteTask, setProgress, completeTask, returnTask, reopenTask, setMark }
}
