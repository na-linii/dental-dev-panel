import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login } from './components/Login'
import { ClinicsPage } from './pages/ClinicsPage'
import { ClinicCreatePage } from './pages/ClinicCreatePage'
import { ClinicLayout } from './pages/ClinicLayout'
import { ClinicVisualizerTab } from './pages/ClinicVisualizerTab'
import { ClinicConfigTab } from './pages/ClinicConfigTab'
import { ClinicAdminsTab } from './pages/ClinicAdminsTab'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { RoadmapPage } from './pages/RoadmapPage'
import { SettingsPage } from './pages/SettingsPage'
import { EdgeCasesPage } from './pages/EdgeCasesPage'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminChatsPage } from './pages/admin/AdminChatsPage'
import { AdminChatDetailPage } from './pages/admin/AdminChatDetailPage'
import { AdminActionsPage } from './pages/admin/AdminActionsPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminConfirmationsPage } from './pages/admin/AdminConfirmationsPage'
import { ThemeProvider } from './contexts/ThemeContext'

function SuperadminGuard({ children }: { children: React.ReactNode }) {
  try {
    const user = JSON.parse(localStorage.getItem('admin_user') || '{}')
    if (user.role === 'superadmin') return <>{children}</>
  } catch {}
  return <Navigate to="/admin/dashboard" replace />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 120_000,
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      refetchOnWindowFocus: true,
    },
  },
})

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  // Admin routes have their own auth — skip Hub auth gate
  if (location.pathname.startsWith('/admin')) {
    return <>{children}</>
  }

  if (loading) return null
  return isAuthenticated ? <>{children}</> : <Login />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            {/* Hub routes */}
            <Route element={<Layout />}>
              <Route path="/" element={<ClinicsPage />} />
              <Route path="/clinics/new" element={<ClinicCreatePage />} />
              <Route path="/clinic/:clinicId" element={<ClinicLayout />}>
                <Route index element={<ClinicVisualizerTab />} />
                <Route path="config" element={<ClinicConfigTab />} />
                <Route path="admins" element={<ClinicAdminsTab />} />
              </Route>
              <Route path="/architecture" element={<ArchitecturePage />} />
              <Route path="/edge-cases" element={<EdgeCasesPage />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/visualizer" element={<Navigate to="/" replace />} />
            </Route>

            {/* Admin Panel routes */}
            <Route path="/admin/login" element={<ThemeProvider><AdminLoginPage /></ThemeProvider>} />
            <Route path="/admin" element={<ThemeProvider><AdminLayout /></ThemeProvider>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="chats" element={<AdminChatsPage />} />
              <Route path="chats/:sessionId" element={<AdminChatDetailPage />} />
              <Route path="confirmations" element={<SuperadminGuard><AdminConfirmationsPage /></SuperadminGuard>} />
              <Route path="actions" element={<AdminActionsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
