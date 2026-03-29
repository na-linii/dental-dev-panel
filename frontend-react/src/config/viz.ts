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

// --- 3D graph shared parameters ---

export const GRAPH_BG = '#0a0a1a'
export const CHARGE_STRENGTH = -400
export const LINK_DISTANCE = 55

export function nodeRadius(val: number): number {
  return Math.cbrt(val || 5) * 4.5
}

/**
 * Build geometry from shape name. Single source of truth for both pages.
 */
export function buildGeometry(shape: string, r: number, THREE: {
  TetrahedronGeometry: new (r: number) => unknown
  OctahedronGeometry: new (r: number) => unknown
  BoxGeometry: new (w: number, h: number, d: number) => unknown
  DodecahedronGeometry: new (r: number) => unknown
  IcosahedronGeometry: new (r: number, detail?: number) => unknown
}): unknown {
  switch (shape) {
    case 'tetrahedron': return new THREE.TetrahedronGeometry(r * 0.9)
    case 'octahedron': return new THREE.OctahedronGeometry(r * 0.8)
    case 'box': return new THREE.BoxGeometry(r * 1.1, r * 1.1, r * 1.1)
    case 'dodecahedron': return new THREE.DodecahedronGeometry(r)
    case 'icosahedron': return new THREE.IcosahedronGeometry(r)
    case 'sphere': return new THREE.IcosahedronGeometry(r * 1.2, 2)
    default: return new THREE.IcosahedronGeometry(r, 0)
  }
}
