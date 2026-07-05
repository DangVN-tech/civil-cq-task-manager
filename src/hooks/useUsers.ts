import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { USER_COLS, type Role, type User } from '../types'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<User[]> => {
      const { data, error } = await supabase
        .from('users')
        .select(USER_COLS)
        .order('full_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as User[]
    },
  })
}

export interface StaffInput {
  login_id: string
  full_name: string
  role: Role
}

export function useStaffMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const addStaff = useMutation({
    mutationFn: async (input: StaffInput) => {
      const { error } = await supabase.from('users').insert(input)
      if (error) {
        if (error.code === '23505') throw new Error(`ID "${input.login_id}" đã tồn tại.`)
        if (error.code === '23514') throw new Error('ID chỉ được chứa chữ thường không dấu và số.')
        throw error
      }
    },
    onSuccess: invalidate,
  })

  const updateStaff = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: StaffInput }) => {
      const { error } = await supabase.from('users').update(input).eq('id', id)
      if (error) {
        if (error.code === '23505') throw new Error(`ID "${input.login_id}" đã tồn tại.`)
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
