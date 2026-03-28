/* roadmap.js — Roadmap page logic + architecture visualization */

window.initRoadmapViz = function() {
  if (window._roadmapGraph) return;
  var el = document.getElementById('roadmap-viz');
  if (!el || el.clientWidth < 10) return;

  // Full architecture: green = done, yellow = WIP, gray = planned
  var N = [
    // DONE (green)
    {id:'router', name:'Dental Router', group:'done', val:20, shape:'dodecahedron'},
    {id:'faq', name:'FAQ Agent', group:'done', val:14, shape:'icosahedron'},
    {id:'booking', name:'Booking Agent', group:'done', val:14, shape:'icosahedron'},
    {id:'tier1', name:'Tier 1: YAML', group:'done', val:6, shape:'octahedron'},
    {id:'tier2', name:'Tier 2: pgvector', group:'done', val:6, shape:'octahedron'},
    {id:'handoff_faq', name:'Handoff', group:'done', val:5, shape:'octahedron'},
    {id:'get_avail', name:'get_availability', group:'done', val:5, shape:'octahedron'},
    {id:'book_appt', name:'book_appointment', group:'done', val:5, shape:'octahedron'},
    {id:'cancel_appt', name:'cancel_appointment', group:'done', val:5, shape:'octahedron'},
    {id:'get_bookings', name:'get_bookings', group:'done', val:5, shape:'octahedron'},
    {id:'register_pat', name:'register_patient', group:'done', val:5, shape:'octahedron'},
    {id:'handoff_book', name:'Handoff', group:'done', val:5, shape:'octahedron'},
    {id:'chat_gw', name:'Chat Gateway', group:'done', val:10, shape:'box'},
    {id:'crm_gw', name:'CRM Gateway', group:'done', val:10, shape:'box'},
    {id:'telegram', name:'Telegram Bot', group:'done', val:8, shape:'tetrahedron'},
    {id:'sheets', name:'Google Sheets', group:'done', val:8, shape:'tetrahedron'},

    // WIP (yellow)
    {id:'confirm', name:'Confirmation Agent', group:'wip', val:14, shape:'icosahedron'},
    {id:'confirm_tool', name:'confirm_visit', group:'wip', val:5, shape:'octahedron'},
    {id:'tg_business', name:'Telegram Business', group:'wip', val:8, shape:'tetrahedron'},

    // PLANNED (gray)
    {id:'reschedule', name:'Reschedule Agent', group:'planned', val:14, shape:'icosahedron'},
    {id:'ident', name:'IDENT Adapter', group:'planned', val:8, shape:'tetrahedron'},
    {id:'whatsapp', name:'WhatsApp', group:'planned', val:8, shape:'tetrahedron'},
    {id:'max', name:'MAX Messenger', group:'planned', val:8, shape:'tetrahedron'},
    {id:'voice', name:'Voice (LiveKit)', group:'planned', val:8, shape:'tetrahedron'},
    {id:'admin_agent', name:'Admin Agent', group:'planned', val:14, shape:'icosahedron'},
    {id:'red_button', name:'Red Button', group:'planned', val:5, shape:'octahedron'},
  ];

  var L = [
    // Core flow
    {source:'router', target:'faq'}, {source:'router', target:'booking'},
    // FAQ tools
    {source:'faq', target:'tier1'}, {source:'faq', target:'tier2'},
    {source:'faq', target:'handoff_faq'},
    // Booking tools
    {source:'booking', target:'get_avail'}, {source:'booking', target:'book_appt'},
    {source:'booking', target:'cancel_appt'}, {source:'booking', target:'get_bookings'},
    {source:'booking', target:'register_pat'}, {source:'booking', target:'handoff_book'},
    // Gateways
    {source:'chat_gw', target:'router'}, {source:'chat_gw', target:'telegram'},
    {source:'crm_gw', target:'sheets'},
    {source:'get_avail', target:'crm_gw'}, {source:'book_appt', target:'crm_gw'},
    {source:'cancel_appt', target:'crm_gw'}, {source:'get_bookings', target:'crm_gw'},
    {source:'register_pat', target:'crm_gw'},
    // WIP
    {source:'router', target:'confirm'}, {source:'confirm', target:'confirm_tool'},
    {source:'chat_gw', target:'tg_business'},
    // Planned
    {source:'router', target:'reschedule'}, {source:'router', target:'admin_agent'},
    {source:'crm_gw', target:'ident'},
    {source:'chat_gw', target:'whatsapp'}, {source:'chat_gw', target:'max'},
    {source:'chat_gw', target:'voice'},
    {source:'admin_agent', target:'red_button'},
  ];

  var C = {done:'#10b981', wip:'#f59e0b', planned:'#334155'};

  window._roadmapGraph = ForceGraph3D()(el)
    .graphData({nodes:N, links:L})
    .backgroundColor('#0a0a1a')
    .nodeVal(function(n) { return Math.max(3, (n.val||5)*0.5); })
    .nodeColor(function(n) { return C[n.group]||'#334155'; })
    .nodeOpacity(function(n) { return n.group==='planned' ? 0.4 : 0.85; })
    .linkColor(function(l) {
      var tgt = typeof l.target==='object' ? l.target : N.find(function(n){return n.id===l.target;});
      if (tgt && tgt.group==='planned') return 'rgba(255,255,255,0.05)';
      if (tgt && tgt.group==='wip') return 'rgba(245,158,11,0.2)';
      return 'rgba(255,255,255,0.15)';
    })
    .linkWidth(1)
    .nodeLabel(function(n) {
      var status = {done:'✓ Готово', wip:'⏳ В работе', planned:'○ Планируется'}[n.group]||'';
      return '<b>'+n.name+'</b><br><small>'+status+'</small>';
    });

  window._roadmapGraph.d3Force('charge').strength(-300);
  window._roadmapGraph.d3Force('link').distance(80);
};
