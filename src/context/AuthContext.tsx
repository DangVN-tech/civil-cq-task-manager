import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { clearSession, findUserByEmail } from '../lib/auth'
import type { User } from '../types'

interface AuthCtx {
  user: User | null
  loading: boolean
  setUser: (u: User | null) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, setUser: () => {}, logout: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email) {
        const u = await findUserByEmail(session.user.email)
        setUser(u)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const logout = () => {
    clearSession()
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, setUser, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

/** Dùng trong các trang đã đăng nhập (user chắc chắn khác null) */
export function useCurrentUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('Chưa đăng nhập')
  return user
}
