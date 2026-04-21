/** Dental Hub Design System — single source of truth for UI constants */

// Colors
export const COLORS = {
  // Backgrounds
  pageBg: '#0f1729',
  cardBg: '#111127',
  inputBg: '#0a0a1a',

  // Borders
  border: '#1e293b',
  borderHover: '#2a2a4a',
  borderAccent: '#7dd3fc',

  // Text
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textDim: '#475569',

  // Accents
  cyan: '#7dd3fc',
  green: '#4ade80',
  red: '#f87171',
  yellow: '#facc15',
  purple: '#a855f7',
  orange: '#f97316',
  pink: '#ec4899',
  indigo: '#818cf8',

  // Status
  online: '#4ade80',
  offline: '#f87171',
  checking: '#facc15',

  // Badges
  badgeDoneBg: '#052e16',
  badgeDoneText: '#4ade80',
  badgeFailBg: '#450a0a',
  badgeFailText: '#f87171',
  badgeWarnBg: '#422006',
  badgeWarnText: '#fbbf24',
  badgeInfoBg: '#1e1b4b',
  badgeInfoText: '#a5b4fc',
} as const

// Section colors for config sections (consistent across pages)
export const SECTION_COLORS = {
  basicInfo: '#7dd3fc',
  server: '#a855f7',
  modules: '#f97316',
  channels: '#22d3ee',
  booking: '#facc15',
  confirmation: '#4ade80',
  handoff: '#f87171',
  llm: '#818cf8',
  knowledge: '#ec4899',
  importExport: '#64748b',
} as const

// Typography
export const FONT_SIZES = {
  pageTitle: 'text-lg',
  sectionTitle: 'text-sm',
  label: 'text-xs',
  value: 'text-xs',
  badge: 'text-[10px]',
  tiny: 'text-[0.6rem]',
} as const

// Spacing
export const SPACING = {
  page: 'p-6',
  card: 'p-5',
  sectionGap: 'space-y-4',
  fieldGap: 'space-y-2',
} as const
