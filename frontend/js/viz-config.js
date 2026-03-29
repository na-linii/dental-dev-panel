/* viz-config.js — Single source of truth for 3D visualization styles.
 * Both arch-viz.js and viz.js import from here.
 */

export var COLORS = {
  router:  '#facc15',  // yellow — central node
  agent:   '#22d3ee',  // cyan — bright sky
  tool:    '#a855f7',  // vivid purple
  gateway: '#22c55e',  // acid green
  plugin:  '#f97316',  // acid orange
  storage: '#ec4899',  // pink
};

export var WIREFRAME = '#ffffff';

export var SHAPES = {
  router:  'dodecahedron',
  agent:   'icosahedron',
  tool:    'octahedron',
  gateway: 'box',
  plugin:  'octahedron',
  storage: 'dodecahedron',
};

export var LABELS = {
  router:  'Router',
  agent:   'Agent',
  tool:    'Tool',
  gateway: 'Gateway',
  plugin:  'Plugin',
  storage: 'Storage',
};

export function getColor(group, planned) {
  if (planned) return 'rgba(255,255,255,0.06)';
  return COLORS[group] || '#888';
}

export function getOpacity(planned) {
  return planned ? 0.15 : 0.85;
}

export function getLabelOpacity(planned) {
  return planned ? 0.3 : 1;
}

export function getLinkColor(targetNode) {
  if (targetNode && targetNode.planned) return 'rgba(255,255,255,0.04)';
  return 'rgba(255,255,255,0.15)';
}
