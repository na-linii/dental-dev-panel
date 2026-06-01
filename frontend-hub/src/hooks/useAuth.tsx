import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { clinicsApi } from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (token: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('dp_user')
    const token = localStorage.getItem('dp_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (token: string) => {
    localStorage.setItem('dp_token', btoa(token))
    try {
      await clinicsApi.list()
      const r = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error('Invalid token')
      const gh = await r.json()
      const u: User = {
        login: gh.login,
        avatar: gh.avatar_url,
        name: gh.name || gh.login,
      }
      localStorage.setItem('dp_user', JSON.stringify(u))
      setUser(u)
    } catch (e) {
      localStorage.removeItem('dp_token')
      throw e
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.clear()
    setUser(null)
    // Full reload returns to a clean Login screen and drops any in-memory cache.
    window.location.href = '/'
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
