import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { USER_COLS, type ActivityRow, type Comment } from '../types'

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
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['comments', v.taskId] }),
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
