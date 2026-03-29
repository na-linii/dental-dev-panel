/* arch-viz.js — Architecture visualization with sidebar + orbit animation */
import * as THREE from "https://esm.sh/three";
import SpriteText from "https://esm.sh/three-spritetext";
import { COLORS, WIREFRAME, LABELS, getColor, getOpacity, getLabelOpacity, getLinkColor } from "./viz-config.js";

var _allNodes = [];
var _allLinks = [];
var _selectedId = 'router'; // default selection
var _orbitActive = true;
var _orbitAngle = 0;
var _orbitDist = 300;
var _orbitCenter = {x:0, y:0, z:0}; // center of orbit (selected node position)

window.initArchViz = function() {
  if (window._archGraph) return;
  var wrap = document.getElementById('arch-graph-wrap');
  var el = document.getElementById('arch-graph');
  if (!el || !wrap || wrap.clientWidth < 50) return;

  var clinics = window.CLINICS || [{id:'zubatka'}];
  var clinicId = clinics[0].id;

  fetch('/api/clinics/' + clinicId + '/graph?include_planned=true', { headers: window.authHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _allNodes = (data.nodes || []).map(function(n) {
        n.type = n.group || 'tool';
        n.shape = n.shape || 'octahedron';
        return n;
      });
      _allLinks = data.links || [];
      renderArch(el, wrap, _allNodes, _allLinks);
      // Select Router by default
      var router = _allNodes.find(function(n) { return n.id === 'router'; });
      if (router) selectNode(router);
    })
    .catch(function(e) { console.error('Failed to load arch graph:', e); });
};

function renderArch(el, wrap, N, L) {
  window._archGraph = new ForceGraph3D(el)
    .width(wrap.clientWidth).height(wrap.clientHeight)
    .graphData({nodes:N, links:L})
    .backgroundColor('#0a0a1a')
    .nodeVal(function(n) { return Math.max(3, (n.val||5)*0.5); })
    .nodeColor(function(n) { return getColor(n.type, n.planned); })
    .nodeOpacity(0.85)
    .linkColor(function(l) {
      var t = typeof l.target==='object' ? l.target : N.find(function(x){return x.id===l.target;});
      return getLinkColor(t);
    })
    .linkWidth(1)
    .onNodeClick(function(node) { selectNode(node); })
    .onNodeDoubleClick(function(node) { selectNode(node); startOrbit(); })
    .onBackgroundClick(function() { deselectNode(); startOrbit(); })
    .nodeThreeObject(function(node) {
      var group = new THREE.Group();
      var r = Math.cbrt(node.val||5) * 4.5;
      var fill = getColor(node.type, node.planned);
      var opacity = getOpacity(node.planned);
      var isActive = node.id === _selectedId;

      var geo;
      switch(node.shape) {
        case 'dodecahedron': geo = new THREE.IcosahedronGeometry(r*1.3, 2); break;
        case 'icosahedron':  geo = new THREE.IcosahedronGeometry(r, 1); break;
        case 'box':          geo = new THREE.IcosahedronGeometry(r, 0); break;
        case 'octahedron':   geo = new THREE.DodecahedronGeometry(r*0.8, 0); break;
        case 'tetrahedron':  geo = new THREE.OctahedronGeometry(r*0.9, 0); break;
        default:             geo = new THREE.IcosahedronGeometry(r, 0);
      }
      group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:fill, transparent:true, opacity:opacity})));

      // Wireframe — colored + bright when selected, white otherwise
      var wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({
          color: isActive ? fill : WIREFRAME,
          transparent: true,
          opacity: node.planned ? 0.25 : (isActive ? 0.9 : 0.5),
        })
      );
      wire.scale.setScalar(1.04);
      group.add(wire);

      // Glow sphere for selected node
      if (isActive) {
        var glowGeo = new THREE.IcosahedronGeometry(r * 1.8, 1);
        group.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
          color: fill, transparent: true, opacity: 0.12,
        })));
      }

      // Label
      var la = getLabelOpacity(node.planned);
      var s = new SpriteText(node.name);
      s.color = 'rgba(255,255,255,' + (isActive ? 1 : la) + ')';
      s.textHeight = 4;
      s.backgroundColor = 'rgba(0,0,0,' + (la*0.5) + ')';
      s.padding = 1;
      s.borderRadius = 1.5;
      s.material.depthWrite = false;
      s.material.depthTest = false;
      s.renderOrder = 999;
      s.center.set(-0.3, 0.5);
      group.add(s);

      return group;
    }).nodeThreeObjectExtend(false);

  window._archGraph.d3Force('charge').strength(-400);
  window._archGraph.d3Force('link').distance(80);

  // Start orbit animation
  startOrbit();

  // Stop orbit on manual mouse drag (not on node click which we handle separately)
  var _mouseDownForDrag = false;
  el.addEventListener('mousedown', function(e) {
    _mouseDownForDrag = true;
    setTimeout(function() {
      // If mouse is still down after 150ms, it's a drag — stop orbit
      if (_mouseDownForDrag) _orbitActive = false;
    }, 150);
  });
  el.addEventListener('mouseup', function() { _mouseDownForDrag = false; });
  el.addEventListener('contextmenu', function() { _orbitActive = false; });

  window.addEventListener('resize', function() {
    if (window._archGraph && wrap.clientWidth > 50) {
      window._archGraph.width(wrap.clientWidth).height(wrap.clientHeight);
    }
  });
}

/* === ORBIT ANIMATION === */

function startOrbit() {
  if (_orbitActive) return; // already running
  _orbitActive = true;
  _orbitAngle = 0;
  // Get current camera distance
  if (window._archGraph) {
    var cam = window._archGraph.cameraPosition();
    var dx = cam.x - _orbitCenter.x;
    var dz = cam.z - _orbitCenter.z;
    _orbitDist = Math.sqrt(dx*dx + dz*dz) || 300;
    _orbitAngle = Math.atan2(dx, dz);
  }
  animateOrbit();
}

function animateOrbit() {
  if (!_orbitActive || !window._archGraph) return;
  _orbitAngle += 0.0015;
  // Read current distance from camera (zoom may have changed)
  var cam = window._archGraph.cameraPosition();
  var dx = cam.x - _orbitCenter.x;
  var dz = cam.z - _orbitCenter.z;
  _orbitDist = Math.sqrt(dx*dx + dz*dz) || _orbitDist;

  window._archGraph.cameraPosition({
    x: _orbitCenter.x + _orbitDist * Math.sin(_orbitAngle),
    y: cam.y,
    z: _orbitCenter.z + _orbitDist * Math.cos(_orbitAngle),
  }, _orbitCenter, 0);

  requestAnimationFrame(animateOrbit);
}

/* === SELECTION === */

function selectNode(node) {
  _selectedId = node.id;
  // Update orbit center to selected node position
  _orbitCenter = {x: node.x || 0, y: node.y || 0, z: node.z || 0};
  refreshNodes();
  showSidebar(node, _allNodes, _allLinks);
}

function deselectNode() {
  _selectedId = null;
  _orbitCenter = {x:0, y:0, z:0};
  refreshNodes();
  clearSidebar();
}

function refreshNodes() {
  if (window._archGraph) {
    window._archGraph.nodeThreeObject(window._archGraph.nodeThreeObject());
  }
}

/* === SIDEBAR === */

function clearSidebar() {
  var sb = document.getElementById('arch-sidebar');
  if (sb) sb.innerHTML = '<div style="color:var(--muted);font-size:.7rem;padding:20px 0;text-align:center">Click a node to see details</div>';
}

function showSidebar(node, N, L) {
  var sb = document.getElementById('arch-sidebar');
  if (!sb) return;

  var color = COLORS[node.type] || '#888';
  var typeName = LABELS[node.type] || node.type;
  var planned = node.planned ? ' <span style="color:var(--muted);font-style:italic">(planned)</span>' : '';

  var html = '';
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">';
  html += '<div style="width:10px;height:10px;border-radius:50%;background:' + color + '"></div>';
  html += '<span style="font-size:.65rem;color:' + color + '">' + typeName + '</span>' + planned;
  html += '</div>';

  html += '<h3 style="font-size:.9rem;margin:0 0 4px;color:#fff">' + node.name + '</h3>';
  html += '<div style="font-size:.68rem;color:var(--muted);margin-bottom:6px"><code>' + node.id + '</code></div>';

  if (node.description) {
    html += '<p style="font-size:.72rem;color:#cbd5e1;margin:8px 0;line-height:1.5">' + node.description + '</p>';
  }

  if (node.prompt) {
    html += '<div style="margin:8px 0">';
    html += '<div style="font-size:.65rem;color:var(--accent);margin-bottom:3px">Prompt (Langfuse)</div>';
    html += '<code style="font-size:.7rem;color:#f0abfc">' + node.prompt + '</code>';
    html += '</div>';
  }

  if (node.inputs && node.inputs.length) {
    html += '<div style="margin:8px 0">';
    html += '<div style="font-size:.65rem;color:var(--accent);margin-bottom:3px">Inputs</div>';
    node.inputs.forEach(function(inp) {
      var req = inp.required ? '<span style="color:#f87171"> *</span>' : '';
      html += '<div style="font-size:.68rem;color:#94a3b8;padding:2px 0">';
      html += '<code style="color:#7dd3fc">' + inp.name + '</code>' + req;
      html += ' <span style="color:#64748b">' + (inp.type || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (node.outputs && node.outputs.length) {
    html += '<div style="margin:8px 0">';
    html += '<div style="font-size:.65rem;color:var(--accent);margin-bottom:3px">Outputs</div>';
    node.outputs.forEach(function(out) {
      html += '<div style="font-size:.68rem;color:#94a3b8;padding:2px 0">';
      html += '<code style="color:#34d399">' + out.name + '</code>';
      html += ' <span style="color:#64748b">' + (out.type || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  var connsOut = [];
  var connsIn = [];
  L.forEach(function(l) {
    var src = typeof l.source === 'object' ? l.source.id : l.source;
    var tgt = typeof l.target === 'object' ? l.target.id : l.target;
    if (src === node.id) connsOut.push(tgt);
    if (tgt === node.id) connsIn.push(src);
  });

  if (connsOut.length || connsIn.length) {
    html += '<div style="margin:10px 0 0;border-top:1px solid var(--border);padding-top:8px">';
    html += '<div style="font-size:.65rem;color:var(--accent);margin-bottom:4px">Connections</div>';
    if (connsOut.length) {
      html += '<div style="font-size:.65rem;color:#64748b;margin-bottom:2px">Outgoing:</div>';
      connsOut.forEach(function(c) {
        var target = N.find(function(n){return n.id===c;});
        var name = target ? target.name : c;
        var tc = target ? (COLORS[target.type] || '#888') : '#888';
        html += '<div style="font-size:.68rem;padding:1px 0;cursor:pointer" onclick="window._archClickNode(\'' + c + '\')">';
        html += '<span style="color:' + tc + '">&#9654;</span> <span style="color:#cbd5e1">' + name + '</span>';
        html += '</div>';
      });
    }
    if (connsIn.length) {
      html += '<div style="font-size:.65rem;color:#64748b;margin:4px 0 2px">Incoming:</div>';
      connsIn.forEach(function(c) {
        var source = N.find(function(n){return n.id===c;});
        var name = source ? source.name : c;
        var sc = source ? (COLORS[source.type] || '#888') : '#888';
        html += '<div style="font-size:.68rem;padding:1px 0;cursor:pointer" onclick="window._archClickNode(\'' + c + '\')">';
        html += '<span style="color:' + sc + '">&#9664;</span> <span style="color:#cbd5e1">' + name + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';
  }

  sb.innerHTML = html;
}

window._archClickNode = function(nodeId) {
  if (!window._archGraph) return;
  var data = window._archGraph.graphData();
  var node = data.nodes.find(function(n){return n.id===nodeId;});
  if (node) selectNode(node);
};
