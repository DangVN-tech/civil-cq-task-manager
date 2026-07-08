import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ActivityFeedItem } from '../types'

/** Thứ tự ưu tiên hiển thị (yêu cầu: Trả về > Deadline đổi > Trưởng phòng phản hồi > Comment mới > Upload file). */
export function updatePriorityRank(item: Pick<ActivityFeedItem, 'event_type' | 'actor_is_truong_phong'>): number {
  switch (item.event_type) {
    case 'returned': return 1
    case 'deadline_changed': return 2
    case 'comment': return item.actor_is_truong_phong ? 3 : 4
    case 'file_uploaded': return 5
    default: return 6
  }
}

export const UPDATE_TYPE_LABEL: Record<string, string> = {
  returned: 'Task bị trả về',
  deadline_changed: 'Đổi Deadline',
  comment: 'Nhật ký cập nhật',
  file_uploaded: 'Tải file lên',
}

/** Feed toàn bộ cập nhật (task đang thực hiện) mà user hiện tại có thể quan tâm — đã kèm cờ is_read. */
export function useActivityFeed(userId: string) {
  return useQuery({
    queryKey: ['activity-feed', userId],
    queryFn: async (): Promise<ActivityFeedItem[]> => {
      const { data, error } = await supabase.rpc('fn_activity_feed', { p_user_id: userId })
      if (error) throw error
      return (data ?? []) as ActivityFeedItem[]
    },
  })
}

/** Đánh dấu đã đọc / chưa đọc theo từng activity_id (dùng chung cho 1 dòng hoặc cả 1 task). */
export function useUpdateReadActions(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['activity-feed'] })

  const markRead = useMutation({
    mutationFn: async (activityIds: number[]) => {
      if (activityIds.length === 0) return
      const rows = activityIds.map((id) => ({ activity_id: id, user_id: userId }))
      const { error } = await supabase
        .from('activity_reads')
        .upsert(rows, { onConflict: 'activity_id,user_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const markUnread = useMutation({
    mutationFn: async (activityIds: number[]) => {
      if (activityIds.length === 0) return
      const { error } = await supabase
        .from('activity_reads')
        .delete()
        .eq('user_id', userId)
        .in('activity_id', activityIds)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { markRead, markUnread }
}
