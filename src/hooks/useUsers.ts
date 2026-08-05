import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sortUsers } from '../lib/utils'
import { USER_COLS, type Role, type User } from '../types'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('users').select(USER_COLS)
      if (error) throw error
      // Thứ tự: Trưởng phòng -> Admin -> Phó phòng -> Nhân viên
      return sortUsers((data ?? []) as User[])
    },
  })
}

export interface StaffInput {
  login_id: string
  full_name: string
  role: Role
  email?: string
}

export function useStaffMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const addStaff = useMutation({
    mutationFn: async (input: StaffInput) => {
      const payload = { ...input, email: input.email?.trim().toLowerCase() || null }
      const { error } = await supabase.from('users').insert(payload)
      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('email')) throw new Error(`Email "${input.email}" đã được dùng cho tài khoản khác.`)
          throw new Error(`ID "${input.login_id}" đã tồn tại.`)
        }
        if (error.code === '23514') throw new Error('ID chỉ được chứa chữ thường không dấu và số.')
        throw error
      }
    },
    onSuccess: invalidate,
  })

  const updateStaff = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: StaffInput }) => {
      const payload = { ...input, email: input.email?.trim().toLowerCase() || null }
      const { error } = await supabase.from('users').update(payload).eq('id', id)
      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('email')) throw new Error(`Email "${input.email}" đã được dùng cho tài khoản khác.`)
          throw new Error(`ID "${input.login_id}" đã tồn tại.`)
        }
        if (error.code === '23514') throw new Error('ID chỉ được chứa chữ thường không dấu và số.')
        throw error
      }
    },
    onSuccess: invalidate,
  })

  const deleteStaff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { addStaff, updateStaff, deleteStaff }
}
