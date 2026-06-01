import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login } from './components/Login'
import { ClinicsPage } from './pages/ClinicsPage'
import { ClinicCreatePage } from './pages/ClinicCreatePage'
import { ClinicLayout } from './pages/ClinicLayout'
import { ClinicVisualizerTab } from './pages/ClinicVisualizerTab'
import { ClinicConfigTab } from './pages/ClinicConfigTab'
import { ClinicAdminsTab } from './pages/ClinicAdminsTab'
import { SettingsPage } from './pages/SettingsPage'

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
  if (loading) return null
  return isAuthenticated ? <>{children}</> : <Login />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<ClinicsPage />} />
                <Route path="/clinics/new" element={<ClinicCreatePage />} />
                <Route path="/clinic/:clinicId" element={<ClinicLayout />}>
                  <Route index element={<ClinicVisualizerTab />} />
                  <Route path="config" element={<ClinicConfigTab />} />
                  <Route path="admins" element={<ClinicAdminsTab />} />
                </Route>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/visualizer" element={<Navigate to="/" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AuthGate>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
