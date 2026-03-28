/* viz.js — 3D Visualizer, ES module (imports THREE + SpriteText from CDN) */
import * as THREE from "https://esm.sh/three";
import SpriteText from "https://esm.sh/three-spritetext";

var C = {
  router:'#7dd3fc',
  agent:'#3b82f6',
  tool:'#8b5cf6',
  gateway:'#10b981',
  connector:'#f59e0b',
  plugin:'#f59e0b',
  storage:'#ec4899',
};

window.initViz = async function() {
  if (window._vizGraph) return;

  var N = [], L = [];
  try {
    var r = await fetch('/api/clinics/' + window._activeClinic.id + '/graph', { headers: window.authHeaders() });
    var data = await r.json();
    N = data.nodes || [];
    L = data.links || [];
  } catch(e) {
    N = [{id:'error', name:'Could not load graph', group:'router', shape:'dodecahedron', val:15}];
  }

  var graphEl = document.getElementById('viz-graph');
  var gw = graphEl.clientWidth;
  var gh = graphEl.clientHeight;

  window._vizGraph = new ForceGraph3D(graphEl)
    .width(gw).height(gh)
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
      var color = node.color || C[node.group] || '#888';

      var geo;
      switch(node.shape) {
        case 'dodecahedron': geo = new THREE.IcosahedronGeometry(r*1.3, 2); break;
        case 'icosahedron':  geo = new THREE.IcosahedronGeometry(r, 1); break;
        case 'box':          geo = new THREE.IcosahedronGeometry(r, 0); break;
        case 'octahedron':   geo = new THREE.DodecahedronGeometry(r*0.8, 0); break;
        case 'tetrahedron':  geo = new THREE.OctahedronGeometry(r*0.9, 0); break;
        default:             geo = new THREE.IcosahedronGeometry(r, 0);
      }
      group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color:color, transparent:true, opacity:0.85 })));

      // Wireframe from node data or fallback to group defaults
      var wc = node.wireframe || {
        router:'#ffffff', agent:'#bfdbfe', tool:'#e9d5ff',
        gateway:'#a7f3d0', connector:'#fef3c7', plugin:'#fef3c7', storage:'#fbcfe8',
      }[node.group] || '#ffffff';
      var wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({color: wc, transparent: true, opacity: 0.5})
      );
      wire.scale.setScalar(1.03);
      group.add(wire);

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
      s._isLabel = true;
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

/* =================== SPEED CONTROL =================== */
window._animSpeed = 1; // 1x = real time, 2x = 2x slower, etc.

window.setSpeed = function(x) {
  window._animSpeed = x;
  document.querySelectorAll('.speed-btn').forEach(function(b) {
    b.classList.toggle('active', parseInt(b.dataset.speed) === x);
  });
};

/* =================== FLOW ANIMATION =================== */
/*
 * path: array of steps. Each step is:
 *   { links: [[from,to], ...], dur: milliseconds }
 *   or legacy format: [from, to] / [[from,to],[from,to]]
 */
window.animateFlow = function(path, color) {
  if (!window._vizGraph) return;
  var data = window._vizGraph.graphData();

  data.links.forEach(function(l) { l._p = 0; });
  window._vizGraph.linkDirectionalParticles(function(l) { return l._p || 0; });

  function findLink(from, to) {
    return data.links.find(function(l) {
      var s = typeof l.source === 'object' ? l.source.id : l.source;
      var t = typeof l.target === 'object' ? l.target.id : l.target;
      return s === from && t === to;
    });
  }

  function lightUp(pairs, duration) {
    pairs.forEach(function(pair) {
      var lk = findLink(pair[0], pair[1]);
      if (lk) { lk._p = 8; lk._c = color; }
    });
    window._vizGraph.linkDirectionalParticles(function(l) { return l._p || 0; });
    window._vizGraph.linkDirectionalParticleColor(function(l) { return l._c || '#7dd3fc'; });

    setTimeout(function() {
      if (!window._vizGraph) return;
      pairs.forEach(function(pair) {
        var lk = findLink(pair[0], pair[1]);
        if (lk) lk._p = 0;
      });
      window._vizGraph.linkDirectionalParticles(function(l) { return l._p || 0; });
    }, duration);
  }

  var cumDelay = 0;
  path.forEach(function(step) {
    var pairs, dur;
    if (step.links) {
      // New format with duration
      pairs = step.links;
      dur = (step.dur || 500) * window._animSpeed;
    } else {
      // Legacy format
      pairs = Array.isArray(step[0]) ? step : [step];
      dur = 800 * window._animSpeed;
    }

    setTimeout(function() {
      if (!window._vizGraph) return;
      lightUp(pairs, dur);
    }, cumDelay);

    cumDelay += dur;
  });
};

/* =================== TOGGLE LABELS =================== */
var _labelsVisible = true;
window.toggleLabels = function() {
  _labelsVisible = !_labelsVisible;
  if (!window._vizGraph) return;
  var scene = window._vizGraph.scene();
  scene.traverse(function(obj) {
    if (obj._isLabel) {
      obj.visible = _labelsVisible;
    }
  });
};
