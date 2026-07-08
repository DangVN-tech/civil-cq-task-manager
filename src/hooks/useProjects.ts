import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifyTasksDeleted } from '../lib/deleteNotify'
import { supabase } from '../lib/supabase'
import type { Project, ProjectStatus } from '../types'

const STATUS_ORDER: Record<ProjectStatus, number> = { dang_thuc_hien: 0, hoan_thanh: 1, luu_tru: 2 }

/** Toàn bộ dự án kèm nhóm công việc. Sắp xếp: Đang thực hiện -> Hoàn thành -> Lưu trữ, General lên đầu nhóm. */
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, groups:task_groups(*)')
      if (error) throw error
      const rows = (data ?? []) as Project[]
      for (const p of rows) {
        p.groups = (p.groups ?? []).sort((a, b) =>
          a.name === 'General' ? -1 : b.name === 'General' ? 1 : a.name.localeCompare(b.name, 'vi'),
        )
      }
      return rows.sort((a, b) => {
        const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (s !== 0) return s
        if (a.name === 'General') return -1
        if (b.name === 'General') return 1
        return a.name.localeCompare(b.name, 'vi')
      })
    },
  })
}

export interface ProjectInput {
  name: string
  description: string
  status: ProjectStatus
}

/** Xóa toàn bộ file trên Storage của danh sách task (chia lô 100 file/lần). */
async function removeTaskFiles(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return
  const { data: files, error } = await supabase.from('files').select('storage_path').in('task_id', taskIds)
  if (error) throw error
  const paths = (files ?? []).map((f) => f.storage_path)
  for (let i = 0; i < paths.length; i += 100) {
    const { error: eRemove } = await supabase.storage.from('task-files').remove(paths.slice(i, i + 100))
    if (eRemove) throw eRemove
  }
}

/** Xóa toàn bộ task thuộc các đầu mục cho trước (kể cả đã hoàn thành).
 *  Cascade DB tự dọn assignees/marks/files-row/comments/activity/notifications. */
async function deleteTasksInGroups(groupIds: string[]): Promise<void> {
  if (groupIds.length === 0) return
  const { data: tasksRows, error } = await supabase.from('tasks').select('id').in('group_id', groupIds)
  if (error) throw error
  const taskIds = (tasksRows ?? []).map((t) => t.id as string)
  if (taskIds.length === 0) return
  // Báo Chủ trì/Phối hợp của từng task trước khi xóa (cần đọc task_assignees lúc còn tồn tại)
  await notifyTasksDeleted(taskIds)
  await removeTaskFiles(taskIds)
  const { error: eDel } = await supabase.from('tasks').delete().in('id', taskIds)
  if (eDel) throw eDel
}

export function useProjectMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const addProject = useMutation({
    mutationFn: async (input: ProjectInput): Promise<string> => {
      const { data, error } = await supabase.from('projects').insert(input).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: invalidate,
  })

  const updateProject = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProjectInput }) => {
      const { error } = await supabase.from('projects').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Xóa mạnh tay: xóa toàn bộ đầu mục + task bên trong (kể cả đã hoàn thành) rồi mới xóa dự án. */
  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { data: groups, error: eGroups } = await supabase
        .from('task_groups')
        .select('id')
        .eq('project_id', id)
      if (eGroups) throw eGroups
      await deleteTasksInGroups((groups ?? []).map((g) => g.id as string))
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const addGroup = useMutation({
    mutationFn: async ({ projectId, name }: { projectId: string; name: string }): Promise<string> => {
      const { data, error } = await supabase
        .from('task_groups')
        .insert({ project_id: projectId, name })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: invalidate,
  })

  const renameGroup = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('task_groups').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Xóa mạnh tay: xóa toàn bộ task bên trong đầu mục (kể cả đã hoàn thành) rồi mới xóa đầu mục. */
  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      await deleteTasksInGroups([id])
      const { error } = await supabase.from('task_groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { addProject, updateProject, deleteProject, addGroup, renameGroup, deleteGroup }
}
