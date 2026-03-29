import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login } from './components/Login'
import { ClinicsPage } from './pages/ClinicsPage'
import { EdgeCasesPage } from './pages/EdgeCasesPage'
import { ClinicLayout } from './pages/ClinicLayout'
import { ClinicVisualizerTab } from './pages/ClinicVisualizerTab'
import { ClinicConfigTab } from './pages/ClinicConfigTab'
import { ClinicAdminsTab } from './pages/ClinicAdminsTab'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { RoadmapPage } from './pages/RoadmapPage'
import { TestAnimPage } from './pages/TestAnimPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
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
        <AuthGate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<ClinicsPage />} />
              <Route path="/clinic/:clinicId" element={<ClinicLayout />}>
                <Route index element={<ClinicVisualizerTab />} />
                <Route path="config" element={<ClinicConfigTab />} />
                <Route path="admins" element={<ClinicAdminsTab />} />
              </Route>
              <Route path="/architecture" element={<ArchitecturePage />} />
              <Route path="/edge-cases" element={<EdgeCasesPage />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/test-anim" element={<TestAnimPage />} />
              <Route path="/visualizer" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
