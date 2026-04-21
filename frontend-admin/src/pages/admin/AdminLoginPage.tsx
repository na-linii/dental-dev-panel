import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, AlertCircle } from 'lucide-react'
import { adminLogin } from '../../api/client'

export function AdminLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) navigate('/dashboard', { replace: true })
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const result = await adminLogin(username, password)
      localStorage.setItem('admin_token', result.access_token)
      localStorage.setItem('admin_user', JSON.stringify(result.user))
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Неверное имя пользователя или пароль')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-accent/[0.05] dark:bg-brand-green/[0.05] rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-accent/[0.03] dark:bg-brand-green/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-text-primary">Admin Panel</h1>
          <p className="text-text-tertiary text-sm mt-1">Панель управления клиникой</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-white/[0.04] backdrop-blur-xl border border-gray-200 dark:border-white/[0.08] rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-text-primary mb-6">Вход в систему</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Имя пользователя</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/40 focus:bg-white dark:focus:bg-white/[0.06] transition-all duration-200"
                  placeholder="username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-secondary dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/40 focus:bg-white dark:focus:bg-white/[0.06] transition-all duration-200"
                  placeholder="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-2.5 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full bg-accent text-white font-bold py-3 rounded-xl transition-all duration-200 hover:bg-accent/90 dark:hover:shadow-[0_0_24px_rgba(81,255,151,0.2)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Вход...
                </span>
              ) : 'Войти'}
            </button>
          </form>
        </div>

        <div className="text-center text-text-muted text-xs mt-8">
          <p>&copy; 2026 НаЛинии. Все права защищены.</p>
        </div>
      </div>
    </div>
  )
}
