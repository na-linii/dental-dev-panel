/* arch-viz.js — Architecture visualization with sidebar detail panel */
import * as THREE from "https://esm.sh/three";
import SpriteText from "https://esm.sh/three-spritetext";

var TYPE_C = {
  router:'#7dd3fc', agent:'#3b82f6', tool:'#8b5cf6',
  gateway:'#10b981', plugin:'#f59e0b', storage:'#ec4899',
};
var TYPE_LABELS = {
  router:'Router', agent:'Agent', tool:'Tool',
  gateway:'Gateway', plugin:'Plugin', storage:'Storage',
};
var STATUS_C = {done:'#10b981', wip:'#eab308', planned:null};
var STATUS_OPACITY = {done:0.9, wip:0.7, planned:0.25};
var LABEL_OPACITY = {done:1, wip:0.8, planned:0.3};

var _allNodes = [];

window.initArchViz = function() {
  if (window._archGraph) return;
  var el = document.getElementById('arch-graph');
  if (!el || el.clientWidth < 50) return;

  var clinics = window.CLINICS || [{id:'zubatka'}];
  var clinicId = clinics[0].id;

  fetch('/api/clinics/' + clinicId + '/graph?include_planned=true', { headers: window.authHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var N = (data.nodes || []).map(function(n) {
        n.type = n.group || 'tool';
        n.shape = n.shape || 'octahedron';
        n.status = n.planned ? 'planned' : 'done';
        return n;
      });
      _allNodes = N;
      var L = data.links || [];
      renderArch(el, N, L);
    })
    .catch(function(e) {
      console.error('Failed to load arch graph:', e);
      renderArch(el, [{id:'error',name:'Failed to load',group:'router',shape:'dodecahedron',val:15,status:'done',type:'router'}], []);
    });
};

function renderArch(el, N, L) {
  function getColor(node) {
    if (node.status === 'planned') return '#1e293b';
    return TYPE_C[node.type] || '#888';
  }

  window._archGraph = new ForceGraph3D(el)
    .width(el.clientWidth).height(el.clientHeight)
    .graphData({nodes:N, links:L})
    .backgroundColor('#0a0a1a')
    .nodeVal(function(n) { return Math.max(3, (n.val||5)*0.5); })
    .nodeColor(function(n) { return getColor(n); })
    .nodeOpacity(0.85)
    .linkColor(function(l) {
      var t = typeof l.target==='object' ? l.target : N.find(function(x){return x.id===l.target;});
      if (t && t.status==='planned') return 'rgba(255,255,255,0.04)';
      if (t && t.status==='wip') return 'rgba(234,179,8,0.15)';
      return 'rgba(255,255,255,0.15)';
    })
    .linkWidth(1)
    .onNodeClick(function(node) { showSidebar(node, N, L); })
    .nodeThreeObject(function(node) {
      var group = new THREE.Group();
      var r = Math.cbrt(node.val||5) * 4.5;
      var fill = getColor(node);
      var opacity = STATUS_OPACITY[node.status] || 0.85;

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

      var wireColor = STATUS_C[node.status];
      if (wireColor) {
        var wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({color:wireColor, transparent:true, opacity:0.7})
        );
        wire.scale.setScalar(1.04);
        group.add(wire);
      }

      var la = LABEL_OPACITY[node.status] || 0.85;
      var s = new SpriteText(node.name);
      s.color = 'rgba(255,255,255,' + la + ')';
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

  window.addEventListener('resize', function() {
    if (window._archGraph && el.clientWidth > 50) {
      window._archGraph.width(el.clientWidth).height(el.clientHeight);
    }
  });
}

/* === SIDEBAR === */

function showSidebar(node, N, L) {
  var sb = document.getElementById('arch-sidebar');
  if (!sb) return;
  sb.style.display = 'flex';

  var color = TYPE_C[node.type] || '#888';
  var typeName = TYPE_LABELS[node.type] || node.type;
  var statusLabel = node.status === 'planned' ? ' (planned)' : '';

  var html = '';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<div style="display:flex;align-items:center;gap:6px">';
  html += '<div style="width:10px;height:10px;border-radius:50%;background:' + color + '"></div>';
  html += '<span style="font-size:.65rem;color:' + color + '">' + typeName + statusLabel + '</span>';
  html += '</div>';
  html += '<button onclick="document.getElementById(\'arch-sidebar\').style.display=\'none\'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem">&times;</button>';
  html += '</div>';

  html += '<h3 style="font-size:.9rem;margin:0 0 6px;color:#fff">' + node.name + '</h3>';
  html += '<div style="font-size:.7rem;color:var(--muted);margin-bottom:2px"><code>' + node.id + '</code></div>';

  if (node.description) {
    html += '<p style="font-size:.72rem;color:#cbd5e1;margin:8px 0;line-height:1.5">' + node.description + '</p>';
  }

  // Prompt
  if (node.prompt) {
    html += '<div style="margin:8px 0">';
    html += '<div style="font-size:.65rem;color:var(--accent);margin-bottom:3px">Prompt (Langfuse)</div>';
    html += '<code style="font-size:.7rem;color:#f0abfc">' + node.prompt + '</code>';
    html += '</div>';
  }

  // Inputs
  if (node.inputs && node.inputs.length) {
    html += '<div style="margin:8px 0">';
    html += '<div style="font-size:.65rem;color:var(--accent);margin-bottom:3px">Inputs</div>';
    node.inputs.forEach(function(inp) {
      var req = inp.required ? '<span style="color:#f87171">*</span>' : '';
      html += '<div style="font-size:.68rem;color:#94a3b8;padding:2px 0">';
      html += '<code style="color:#7dd3fc">' + inp.name + '</code>' + req;
      html += ' <span style="color:#64748b">' + (inp.type || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Outputs
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

  // Connections
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
        var tc = target ? (TYPE_C[target.type] || '#888') : '#888';
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
        var sc = source ? (TYPE_C[source.type] || '#888') : '#888';
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
  if (node) {
    showSidebar(node, data.nodes, data.links);
    window._archGraph.centerAt(node.x, node.y, 500);
    window._archGraph.zoom(3, 500);
  }
};
