import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { USER_COLS, type FileRow } from '../types'

/** Tổng dung lượng kho file đã dùng (bytes). */
export function useStorageUsage() {
  return useQuery({
    queryKey: ['storage-usage'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('fn_storage_usage')
      if (error) throw error
      return Number(data ?? 0)
    },
  })
}

/** Toàn bộ file trong hệ thống, cho trang Quản lý dung lượng. */
export function useAllFiles() {
  return useQuery({
    queryKey: ['all-files'],
    queryFn: async (): Promise<FileRow[]> => {
      const { data, error } = await supabase
        .from('files')
        .select(
          `id,task_id,uploader_id,file_name,ext,size_bytes,storage_path,is_reference,uploaded_at,
           uploader:users(${USER_COLS}),
           task:tasks(id,title,status,completed_at)`,
        )
      if (error) throw error
      const rows = (data ?? []) as unknown as FileRow[]
      // Task hoàn thành cũ nhất lên đầu (file ít cần nhất), sau đó file của task đang thực hiện
      return rows.sort((a, b) => {
        const ca = a.task?.completed_at
        const cb = b.task?.completed_at
        if (ca && cb) return new Date(ca).getTime() - new Date(cb).getTime()
        if (ca) return -1
        if (cb) return 1
        return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
      })
    },
  })
}
