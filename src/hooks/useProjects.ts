import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Lỗi FK khi xóa nhóm/dự án còn task (on delete restrict) */
const FK_MSG = 'Không thể xóa: vẫn còn task bên trong. Hãy chuyển hoặc xóa hết task trước.'

export function useProjectMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const addProject = useMutation({
    mutationFn: async (input: ProjectInput) => {
      const { error } = await supabase.from('projects').insert(input)
      if (error) throw error
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

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw new Error(error.code === '23503' ? FK_MSG : error.message)
    },
    onSuccess: invalidate,
  })

  const addGroup = useMutation({
    mutationFn: async ({ projectId, name }: { projectId: string; name: string }) => {
      const { error } = await supabase.from('task_groups').insert({ project_id: projectId, name })
      if (error) throw error
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

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_groups').delete().eq('id', id)
      if (error) throw new Error(error.code === '23503' ? FK_MSG : error.message)
    },
    onSuccess: invalidate,
  })

  return { addProject, updateProject, deleteProject, addGroup, renameGroup, deleteGroup }
}
