import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { USER_COLS, type ActivityRow, type Comment, type Status } from '../types'

/** 1 dòng trong khung "Hoạt động gần đây" trên Dashboard */
export interface RecentComment {
  id: number
  task_id: string
  content: string
  created_at: string
  user: { full_name: string } | null
  task: { id: string; title: string; status: Status } | null
}

/** Nhật ký xử lý mới nhất toàn phòng (mọi task) cho Dashboard. */
export function useRecentComments(limit = 15) {
  return useQuery({
    queryKey: ['recent-comments', limit],
    queryFn: async (): Promise<RecentComment[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('id,task_id,content,created_at,user:users(full_name),task:tasks(id,title,status)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as RecentComment[]
    },
  })
}

export function useComments(taskId: string | null) {
  return useQuery({
    queryKey: ['comments', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select(`id,task_id,user_id,content,created_at,user:users(${USER_COLS})`)
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Comment[]
    },
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, userId, content }: { taskId: string; userId: string; content: string }) => {
      const { error } = await supabase
        .from('comments')
        .insert({ task_id: taskId, user_id: userId, content })
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['comments', v.taskId] })
      qc.invalidateQueries({ queryKey: ['recent-comments'] })
    },
  })
}

export function useActivityLog(taskId: string | null) {
  return useQuery({
    queryKey: ['activity', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as ActivityRow[]
    },
  })
}
