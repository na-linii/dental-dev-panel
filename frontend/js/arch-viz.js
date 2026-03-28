/* arch-viz.js — Architecture visualization, dynamic from /graph */
import * as THREE from "https://esm.sh/three";
import SpriteText from "https://esm.sh/three-spritetext";

var TYPE_C = {
  router:'#7dd3fc', agent:'#10b981', tool:'#f59e0b',
  gateway:'#3b82f6', plugin:'#8b5cf6', storage:'#ec4899',
};
var STATUS_C = {done:'#10b981', wip:'#eab308', planned:null};
var STATUS_OPACITY = {done:0.9, wip:0.7, planned:0.25};
var LABEL_OPACITY = {done:1, wip:0.8, planned:0.3};

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

      // Status wireframe
      var wireColor = STATUS_C[node.status];
      if (wireColor) {
        var wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({color:wireColor, transparent:true, opacity:0.7})
        );
        wire.scale.setScalar(1.04);
        group.add(wire);
      }

      // Label
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
