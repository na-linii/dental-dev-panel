import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAdminDashboardStats,
  getAdminSessions,
  getAdminSession,
  getAdminActions,
} from '../api/adminClient'
import type { AdminSessionSummary } from '../api/adminClient'
import { useMemo } from 'react'

// ── Single data source: all sessions ──

const ALL_SESSIONS_KEY = ['admin', 'allSessions'] as const

export function useAllSessions() {
  return useQuery({
    queryKey: ALL_SESSIONS_KEY,
    queryFn: () => getAdminSessions({ limit: 500 }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

/** Derived data from useAllSessions — use on any page that needs sessions */
export function useSessionsData() {
  const { data, isLoading, error, refetch } = useAllSessions()
  const allSessions: AdminSessionSummary[] = data?.items ?? []

  const computed = useMemo(() => {
    const byController = { bot: 0, operator: 0, closed: 0 }
    const byConfirmation: Record<string, number> = {}
    const blocked: AdminSessionSummary[] = []
    const withConfirmation: AdminSessionSummary[] = []

    for (const s of allSessions) {
      if (s.controller in byController) byController[s.controller as keyof typeof byController]++
      if (s.confirmation_status) {
        byConfirmation[s.confirmation_status] = (byConfirmation[s.confirmation_status] || 0) + 1
        withConfirmation.push(s)
      }
      if (s.is_blocked) blocked.push(s)
    }

    return {
      total: allSessions.length,
      byController,
      byConfirmation,
      confirmationTotal: withConfirmation.length,
      blocked,
      withConfirmation,
    }
  }, [allSessions])

  return { allSessions, computed, isLoading, error, refetch }
}

// ── Dashboard (still separate — has prev_month stats that sessions don't have) ──

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getAdminDashboardStats,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

// ── Keep useAdminSessions for backward compat (confirmations page server filter) ──

export function useAdminSessions(params?: {
  controller?: string
  confirmation_status?: string
  has_confirmation?: boolean
  search?: string
  blocked?: boolean
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

// ── Session detail ──

export function useAdminSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'session', sessionId],
    queryFn: () => getAdminSession(sessionId!, { messages_limit: 50 }),
    enabled: !!sessionId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

// ── Actions ──

export function useAdminActions(params?: { status?: string }) {
  return useQuery({
    queryKey: ['admin', 'actions', params],
    queryFn: () => getAdminActions(params),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

// ── Invalidation helper: call after any session mutation ──

export function useInvalidateSessions() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ALL_SESSIONS_KEY })
    queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }
}
