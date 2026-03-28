/* arch-viz.js — Architecture visualization with done/wip/planned nodes */
import * as THREE from "https://esm.sh/three";
import SpriteText from "https://esm.sh/three-spritetext";

// Type colors (for shape fill)
var TYPE_C = {
  router:'#7dd3fc', agent:'#10b981', tool:'#f59e0b',
  gateway:'#3b82f6', plugin:'#8b5cf6', storage:'#ec4899',
};

// Status outline colors
var STATUS_C = {done:'#10b981', wip:'#eab308', planned:null};
var STATUS_OPACITY = {done:0.9, wip:0.7, planned:0.25};
var LABEL_OPACITY = {done:1, wip:0.8, planned:0.3};

window.initArchViz = function() {
  if (window._archGraph) return;
  var el = document.getElementById('arch-graph');
  if (!el || el.clientWidth < 50) return;

  var N = [
    // DONE
    {id:'router', name:'Dental Router', type:'router', group:'done', val:16, shape:'dodecahedron'},
    {id:'faq', name:'FAQ Agent', type:'agent', group:'done', val:12, shape:'icosahedron'},
    {id:'booking', name:'Booking Agent', type:'agent', group:'done', val:12, shape:'icosahedron'},
    {id:'tier1', name:'Tier 1: YAML', type:'tool', group:'done', val:5, shape:'octahedron'},
    {id:'tier2', name:'Tier 2: pgvector', type:'tool', group:'done', val:5, shape:'octahedron'},
    {id:'handoff', name:'Handoff', type:'tool', group:'done', val:4, shape:'octahedron'},
    {id:'get_avail', name:'get_availability', type:'tool', group:'done', val:4, shape:'octahedron'},
    {id:'book_appt', name:'book_appointment', type:'tool', group:'done', val:4, shape:'octahedron'},
    {id:'cancel_appt', name:'cancel_appointment', type:'tool', group:'done', val:4, shape:'octahedron'},
    {id:'get_bookings', name:'get_bookings', type:'tool', group:'done', val:4, shape:'octahedron'},
    {id:'register_pat', name:'register_patient', type:'tool', group:'done', val:4, shape:'octahedron'},
    {id:'chat_gw', name:'Chat Gateway', type:'gateway', group:'done', val:10, shape:'box'},
    {id:'crm_gw', name:'CRM Gateway', type:'gateway', group:'done', val:10, shape:'box'},
    {id:'telegram', name:'Telegram Bot', type:'plugin', group:'done', val:7, shape:'tetrahedron'},
    {id:'sheets', name:'Google Sheets', type:'plugin', group:'done', val:7, shape:'tetrahedron'},
    // WIP
    {id:'confirm', name:'Confirmation Agent', type:'agent', group:'wip', val:12, shape:'icosahedron'},
    {id:'confirm_tool', name:'confirm_visit', type:'tool', group:'wip', val:4, shape:'octahedron'},
    {id:'tg_biz', name:'Telegram Business', type:'plugin', group:'wip', val:7, shape:'tetrahedron'},
    {id:'postgres', name:'PostgreSQL', type:'storage', group:'done', val:7, shape:'box'},
    // PLANNED
    {id:'ident', name:'IDENT Adapter', type:'plugin', group:'planned', val:7, shape:'tetrahedron'},
    {id:'max_msg', name:'MAX Messenger', type:'plugin', group:'planned', val:7, shape:'tetrahedron'},
    {id:'voice', name:'Voice (LiveKit)', type:'plugin', group:'planned', val:7, shape:'tetrahedron'},
  ];

  var L = [
    {source:'telegram',target:'chat_gw'}, {source:'chat_gw',target:'postgres'},
    {source:'postgres',target:'chat_gw'}, {source:'chat_gw',target:'router'},
    {source:'chat_gw',target:'telegram'},
    {source:'router',target:'faq'}, {source:'router',target:'booking'},
    {source:'faq',target:'tier1'}, {source:'faq',target:'tier2'},
    {source:'tier1',target:'faq'}, {source:'tier2',target:'faq'},
    {source:'faq',target:'handoff'}, {source:'booking',target:'handoff'},
    {source:'faq',target:'chat_gw'}, {source:'booking',target:'chat_gw'},
    {source:'booking',target:'get_avail'}, {source:'booking',target:'book_appt'},
    {source:'booking',target:'cancel_appt'}, {source:'booking',target:'get_bookings'},
    {source:'booking',target:'register_pat'},
    {source:'get_avail',target:'crm_gw'}, {source:'book_appt',target:'crm_gw'},
    {source:'cancel_appt',target:'crm_gw'}, {source:'get_bookings',target:'crm_gw'},
    {source:'register_pat',target:'crm_gw'},
    {source:'crm_gw',target:'sheets'},
    {source:'handoff',target:'chat_gw'},
    // WIP
    {source:'router',target:'confirm'}, {source:'confirm',target:'confirm_tool'},
    {source:'chat_gw',target:'tg_biz'},
    // PLANNED
    {source:'crm_gw',target:'ident'},
    {source:'chat_gw',target:'max_msg'}, {source:'chat_gw',target:'voice'},
  ];

  function getFill(node) {
    if (node.group === 'planned') return '#1e293b';
    return TYPE_C[node.type] || '#888';
  }

  window._archGraph = new ForceGraph3D(el)
    .width(el.clientWidth).height(el.clientHeight)
    .graphData({nodes:N, links:L})
    .backgroundColor('#0a0a1a')
    .nodeVal(function(n) { return Math.max(3, (n.val||5)*0.5); })
    .nodeColor(function(n) { return getFill(n); })
    .nodeOpacity(0.85)
    .linkColor(function(l) {
      var t = typeof l.target==='object' ? l.target : N.find(function(x){return x.id===l.target;});
      if (t && t.group==='planned') return 'rgba(255,255,255,0.04)';
      if (t && t.group==='wip') return 'rgba(234,179,8,0.15)';
      return 'rgba(255,255,255,0.15)';
    })
    .linkWidth(1)
    .nodeThreeObject(function(node) {
      var group = new THREE.Group();
      var r = Math.cbrt(node.val||5) * 4.5;
      var fill = getFill(node);
      var opacity = STATUS_OPACITY[node.group] || 0.5;

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

      // Status wireframe: green=done, yellow=wip, none=planned
      var wireColor = STATUS_C[node.group];
      if (wireColor) {
        var wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({color:wireColor, transparent:true, opacity:0.7})
        );
        wire.scale.setScalar(1.04);
        group.add(wire);
      }

      // Label
      var la = LABEL_OPACITY[node.group] || 0.5;
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
};
