import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Realtime toàn cục: 1 channel duy nhất sau khi đăng nhập.
 * Bảng nào đổi thì invalidate cache tương ứng -> UI tự cập nhật.
 */
export function useRealtime(userId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('ccq-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
        qc.invalidateQueries({ queryKey: ['storage-usage'] })
        qc.invalidateQueries({ queryKey: ['all-files'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        const row = (payload.new ?? payload.old) as { task_id?: string }
        qc.invalidateQueries({ queryKey: ['comments', row?.task_id] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, (payload) => {
        const row = (payload.new ?? payload.old) as { task_id?: string }
        qc.invalidateQueries({ queryKey: ['activity', row?.task_id] })
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, qc])
}
