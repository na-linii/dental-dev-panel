import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAdminDashboardStats,
  getAdminSessions,
  getAdminSession,
  getAdminActions,
  getAdminCalls,
} from '../api/client'
import type { AdminAction, AdminPatientSummary } from '../api/client'
import { isAwaitingOperator, getDisplayConfirmationStatus } from '../config/adminStatuses'
import { useMemo } from 'react'

// ── Single data source: all sessions ──

const ALL_SESSIONS_KEY = ['admin', 'allSessions'] as const

export function useAllSessions() {
  return useQuery({
    queryKey: ALL_SESSIONS_KEY,
    queryFn: () => getAdminSessions({ limit: 2000 }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

/** Derived data from useAllSessions — use on any page that needs sessions */
export function useSessionsData() {
  const { data, isLoading, error, refetch } = useAllSessions()
  const allSessions: AdminPatientSummary[] = data?.items ?? []

  const computed = useMemo(() => {
    const byController = { bot: 0, operator: 0, closed: 0 }
    const byConfirmation: Record<string, number> = {}
    const blocked: AdminPatientSummary[] = []
    const withConfirmation: AdminPatientSummary[] = []

    for (const s of allSessions) {
      if (s.controller in byController) byController[s.controller as keyof typeof byController]++
      // PD-393: bucket by composed (active cycle OR last terminal run), so
      // confirmation counters keep counting "didn't respond" patients after
      // the 24h sweep clears the active-cycle cache.
      const cs = getDisplayConfirmationStatus(s)
      if (cs) {
        byConfirmation[cs] = (byConfirmation[cs] || 0) + 1
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

// ── Voice calls (PD-399) ──

export function useAdminCalls(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['admin', 'calls', params],
    queryFn: () => getAdminCalls(params),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

// ── Unified pending-work feed for /admin/actions ──

export type PendingRow =
  | { kind: 'action'; sortTs: string; data: AdminAction }
  | { kind: 'operator'; sortTs: string; data: AdminPatientSummary }

// actions poll at 30s (PATCH invalidates explicitly — 30s is a safety net),
// sessions poll at 10s (operator-waiting is latency-critical, shares cache with ChatsPage).
export function usePendingAdminWork() {
  const actions = useAdminActions({ status: 'pending' })
  const sessions = useAllSessions()

  const rows = useMemo<PendingRow[]>(() => {
    const actionsList: AdminAction[] = Array.isArray(actions.data) ? actions.data : []
    const sessionsList: AdminPatientSummary[] = sessions.data?.items ?? []

    const actionRows: PendingRow[] = actionsList.map((a) => ({
      kind: 'action',
      sortTs: a.created_at ?? '',
      data: a,
    }))
    const operatorRows: PendingRow[] = sessionsList
      .filter(isAwaitingOperator)
      .map((s) => ({
        kind: 'operator',
        sortTs: s.last_activity_at ?? '',
        data: s,
      }))

    return [...actionRows, ...operatorRows].sort((a, b) => {
      const byTs = (b.sortTs || '').localeCompare(a.sortTs || '')
      if (byTs !== 0) return byTs
      return a.data.id.localeCompare(b.data.id)
    })
  }, [actions.data, sessions.data])

  return {
    rows,
    isLoading: actions.isLoading || sessions.isLoading,
    error: actions.error ?? sessions.error,
    refetch: () => {
      actions.refetch()
      sessions.refetch()
    },
  }
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
