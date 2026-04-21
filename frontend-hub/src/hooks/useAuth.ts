import { useState, useEffect, useCallback } from 'react'
import { clinicsApi } from '../api/client'
import type { User } from '../types'

export function useAuth() {
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
  }, [])

  return { user, loading, login, logout, isAuthenticated: !!user }
}
