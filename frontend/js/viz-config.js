/* viz-config.js — Single source of truth for 3D visualization styles.
 * Both arch-viz.js and viz.js import from here.
 */

export var COLORS = {
  router:  '#f472b6',  // pink — central node
  agent:   '#38bdf8',  // sky blue
  tool:    '#c084fc',  // purple
  gateway: '#4ade80',  // lime green
  plugin:  '#fb923c',  // orange
  storage: '#facc15',  // yellow
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
