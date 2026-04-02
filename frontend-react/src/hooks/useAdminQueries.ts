import { useQuery } from '@tanstack/react-query'
import {
  getAdminDashboardStats,
  getAdminSessions,
  getAdminSession,
  getAdminActions,
} from '../api/adminClient'

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getAdminDashboardStats,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useAdminSessions(params?: {
  controller?: string
  confirmation_status?: string
  search?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['admin', 'sessions', params],
    queryFn: () => getAdminSessions(params),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useAdminSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'session', sessionId],
    queryFn: () => getAdminSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useAdminActions(params?: { status?: string }) {
  return useQuery({
    queryKey: ['admin', 'actions', params],
    queryFn: () => getAdminActions(params),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}
