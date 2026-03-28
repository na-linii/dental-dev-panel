/* viz.js — 3D visualizer, ES module (imports THREE + SpriteText) */
import * as THREE from "https://esm.sh/three";
import SpriteText from "https://esm.sh/three-spritetext";

var C = {
  router:  '#7dd3fc',  // Core router — bright cyan
  agent:   '#10b981',  // Sub-agents — green
  tool:    '#f59e0b',  // Tools — amber
  gateway: '#3b82f6',  // CRM Gateway / Chat Gateway — blue
  connector:'#8b5cf6', // Telegram, Google Sheets, Admin — purple
};

window._vizGraph = null;

window.initViz = async function() {
  if (window._vizGraph) return;

  var N = [], L = [];
  try {
    var r = await fetch('/api/clinics/' + window._activeClinic.id + '/graph', { headers: window.authHeaders() });
    var data = await r.json();
    N = data.nodes || [];
    L = data.links || [];
  } catch(e) {
    console.error('Failed to fetch graph:', e);
    N = [{id:'error', name:'Could not load graph', group:'system', val:15}];
  }

  var graphEl = document.getElementById('viz-graph');
  var gw = graphEl.clientWidth;
  var gh = graphEl.clientHeight;

  window._vizGraph = new ForceGraph3D(graphEl)
    .width(gw)
    .height(gh)
    .graphData({nodes:N, links:L})
    .backgroundColor('#0a0a1a')
    .nodeVal(function(n) { return Math.max(4, (n.val || 5) * 0.6); })
    .nodeColor(function(n) { return C[n.group] || '#888'; }).nodeOpacity(0.85)
    .linkColor(function() { return 'rgba(255,255,255,0.35)'; }).linkWidth(1.5)
    .linkDirectionalParticles(0).linkDirectionalParticleWidth(3)
    .linkDirectionalParticleColor(function() { return '#7dd3fc'; }).linkDirectionalParticleSpeed(0.012)
    .nodeThreeObject(function(node) {
      var group = new THREE.Group();
      var r = Math.cbrt(node.val || 5) * 5;
      var color = C[node.group] || '#888';

      var geo;
      switch(node.shape) {
        case 'dodecahedron': geo = new THREE.IcosahedronGeometry(r*1.3, 2); break;
        case 'icosahedron':  geo = new THREE.IcosahedronGeometry(r, 1); break;
        case 'box':          geo = new THREE.IcosahedronGeometry(r, 0); break;
        case 'octahedron':   geo = new THREE.DodecahedronGeometry(r*0.8, 0); break;
        case 'tetrahedron':  geo = new THREE.OctahedronGeometry(r*0.9, 0); break;
        default:             geo = new THREE.IcosahedronGeometry(r, 0);
      }

      var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        color: color, transparent: true, opacity: 0.85
      }));
      group.add(mesh);

      var s = new SpriteText(node.name);
      s.color = '#ffffff';
      s.textHeight = 5;
      s.backgroundColor = 'rgba(0,0,0,0.55)';
      s.padding = 1.2;
      s.borderRadius = 2;
      s.material.depthWrite = false;
      s.material.depthTest = false;
      s.renderOrder = 999;
      s.center.set(-0.3, 0.5);
      group.add(s);

      return group;
    }).nodeThreeObjectExtend(false);

  window._vizGraph.d3Force('charge').strength(-500);
  window._vizGraph.d3Force('link').distance(120);

  window.addEventListener('resize', function() {
    if (window._vizGraph && graphEl.clientWidth > 0) {
      window._vizGraph.width(graphEl.clientWidth).height(graphEl.clientHeight);
    }
  });
};

/* =================== FLOW ANIMATION =================== */
window.animateFlow = function(path, color) {
  if (!window._vizGraph) return;
  var data = window._vizGraph.graphData();

  data.links.forEach(function(l) { l._p = 0; });
  window._vizGraph.linkDirectionalParticles(function(l) { return l._p || 0; });

  path.forEach(function(pair, i) {
    setTimeout(function() {
      if (!window._vizGraph) return;
      var lk = data.links.find(function(l) {
        var s = typeof l.source === 'object' ? l.source.id : l.source;
        var t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === pair[0] && t === pair[1]) || (s === pair[1] && t === pair[0]);
      });
      if (lk) {
        lk._p = 8; lk._c = color;
        window._vizGraph.linkDirectionalParticles(function(l) { return l._p || 0; });
        window._vizGraph.linkDirectionalParticleColor(function(l) { return l._c || '#7dd3fc'; });
        setTimeout(function() {
          if (!window._vizGraph) return;
          lk._p = 0;
          window._vizGraph.linkDirectionalParticles(function(l) { return l._p || 0; });
        }, 1200);
      }
    }, i * 800);
  });
};
