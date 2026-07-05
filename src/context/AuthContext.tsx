import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { clearSession, restoreSession } from '../lib/auth'
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
    restoreSession()
      .then(setUser)
      .finally(() => setLoading(false))
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
