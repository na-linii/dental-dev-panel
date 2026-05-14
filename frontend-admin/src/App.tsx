import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminChatsPage } from './pages/admin/AdminChatsPage'
import { AdminChatDetailPage } from './pages/admin/AdminChatDetailPage'
import { AdminCallsPage } from './pages/admin/AdminCallsPage'
import { AdminCallDetailPage } from './pages/admin/AdminCallDetailPage'
import { AdminActionsPage } from './pages/admin/AdminActionsPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminConfirmationsPage } from './pages/admin/AdminConfirmationsPage'
import { AdminGuidePage } from './pages/admin/AdminGuidePage'
import { ThemeProvider } from './contexts/ThemeContext'

function SuperadminGuard({ children }: { children: React.ReactNode }) {
  try {
    const user = JSON.parse(localStorage.getItem('admin_user') || '{}')
    if (user.role === 'superadmin') return <>{children}</>
  } catch {}
  return <Navigate to="/dashboard" replace />
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<AdminLoginPage />} />
            <Route path="/" element={<AdminLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="chats" element={<AdminChatsPage />} />
              <Route path="chats/:sessionId" element={<AdminChatDetailPage />} />
              <Route path="calls" element={<SuperadminGuard><AdminCallsPage /></SuperadminGuard>} />
              <Route path="calls/:sessionId" element={<SuperadminGuard><AdminCallDetailPage /></SuperadminGuard>} />
              <Route path="confirmations" element={<SuperadminGuard><AdminConfirmationsPage /></SuperadminGuard>} />
              <Route path="actions" element={<AdminActionsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="guide" element={<AdminGuidePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
