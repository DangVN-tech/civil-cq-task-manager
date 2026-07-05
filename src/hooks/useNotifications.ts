import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Notification } from '../types'

/** Thông báo chưa đọc của user hiện tại (bao gồm cả đang snooze — client tự lọc theo giờ). */
export function useNotifications(userId: string) {
  return useQuery({
    queryKey: ['notifications', userId],
    refetchInterval: 60_000, // kiểm tra lại mỗi phút (hết snooze thì hiện lại)
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
  })
}

export function useNotificationActions(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications', userId] })

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Nhắc tôi sau X phút (mặc định 15). */
  const snooze = useMutation({
    mutationFn: async ({ id, minutes }: { id: number; minutes: number }) => {
      const until = new Date(Date.now() + minutes * 60_000).toISOString()
      const { error } = await supabase
        .from('notifications')
        .update({ snoozed_until: until })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { markRead, snooze }
}
