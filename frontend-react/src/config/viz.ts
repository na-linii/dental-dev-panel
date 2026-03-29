/* viz.ts — Single source of truth for 3D visualization styles.
 * Ported from frontend/js/viz-config.js
 */

export const HUB_VERSION = '0.1.0'

export const COLORS: Record<string, string> = {
  router: '#22d3ee',
  agent: '#facc15',
  tool: '#a855f7',
  gateway: '#22c55e',
  plugin: '#f97316',
  storage: '#ec4899',
}

export const WIREFRAME = '#ffffff'

export const SHAPES: Record<string, string> = {
  tool: 'tetrahedron',      // 4 грани — самый простой
  plugin: 'octahedron',     // 5-8 граней — ромбик
  storage: 'box',           // 6 граней — куб
  gateway: 'dodecahedron',  // 8-12 граней
  router: 'icosahedron',    // 10-20 граней
  agent: 'sphere',          // 16+ граней — почти сфера
}

export const LABELS: Record<string, string> = {
  router: 'Router',
  agent: 'Agent',
  tool: 'Tool',
  gateway: 'Gateway',
  plugin: 'Plugin',
  storage: 'Storage',
}

export function getColor(group: string, planned?: boolean): string {
  if (planned) return 'rgba(255,255,255,0.06)'
  return COLORS[group] || '#888'
}

export function getOpacity(planned?: boolean): number {
  return planned ? 0.15 : 0.85
}

export function getLabelOpacity(planned?: boolean): number {
  return planned ? 0.3 : 1
}

export function getLinkColor(targetPlanned?: boolean): string {
  if (targetPlanned) return 'rgba(255,255,255,0.04)'
  return 'rgba(255,255,255,0.15)'
}
