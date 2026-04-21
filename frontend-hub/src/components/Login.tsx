import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const { login } = useAuth()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError('Вставь токен')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(token.trim())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Auth failed'
      if (msg.includes('403')) setError('Not a member of the org')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a1a] flex items-center justify-center flex-col gap-4">
      <h1 className="text-[#7dd3fc] text-2xl font-bold">Dental Hub</h1>
      <p className="text-[#64748b] text-sm max-w-md text-center">
        Вставь GitHub Personal Access Token с доступом к организации
      </p>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="ghp_..."
        className="w-96 px-3 py-2 rounded-md border border-[#1e293b] bg-[#111127] text-white text-sm outline-none focus:border-[#7dd3fc] text-center"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="px-6 py-2 rounded-lg bg-[#7dd3fc] text-[#0a0a1a] font-semibold text-sm cursor-pointer disabled:opacity-50"
      >
        {loading ? 'Проверяю...' : 'Войти'}
      </button>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <a
        href="https://github.com/settings/tokens"
        target="_blank"
        rel="noreferrer"
        className="text-[#7dd3fc] text-xs"
      >
        Создать токен на GitHub
      </a>
    </div>
  )
}
