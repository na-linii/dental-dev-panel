/* roadmap.js — Roadmap 3D architecture visualization (plain JS, uses global ForceGraph3D) */

window.initRoadmapViz = function() {
  if (window._roadmapGraph) return;
  var el = document.getElementById('roadmap-viz');
  if (!el || el.clientWidth < 50) return;

  var N = [
    // DONE
    {id:'router', name:'Dental Router', group:'done', val:16},
    {id:'faq', name:'FAQ Agent', group:'done', val:12},
    {id:'booking', name:'Booking Agent', group:'done', val:12},
    {id:'tier1', name:'Tier 1: YAML', group:'done', val:5},
    {id:'tier2', name:'Tier 2: pgvector', group:'done', val:5},
    {id:'handoff', name:'Handoff', group:'done', val:4},
    {id:'get_avail', name:'get_availability', group:'done', val:4},
    {id:'book_appt', name:'book_appointment', group:'done', val:4},
    {id:'cancel_appt', name:'cancel_appointment', group:'done', val:4},
    {id:'get_bookings', name:'get_bookings', group:'done', val:4},
    {id:'register_pat', name:'register_patient', group:'done', val:4},
    {id:'chat_gw', name:'Chat Gateway', group:'done', val:10},
    {id:'crm_gw', name:'CRM Gateway', group:'done', val:10},
    {id:'telegram', name:'Telegram Bot', group:'done', val:7},
    {id:'sheets', name:'Google Sheets', group:'done', val:7},
    // WIP
    {id:'confirm', name:'Confirmation Agent', group:'wip', val:12},
    {id:'tg_biz', name:'Telegram Business', group:'wip', val:7},
    // PLANNED
    {id:'reschedule', name:'Reschedule Agent', group:'planned', val:12},
    {id:'admin_agent', name:'Admin Agent', group:'planned', val:12},
    {id:'ident', name:'IDENT Adapter', group:'planned', val:7},
    {id:'whatsapp', name:'WhatsApp', group:'planned', val:7},
    {id:'max_msg', name:'MAX Messenger', group:'planned', val:7},
    {id:'voice', name:'Voice (LiveKit)', group:'planned', val:7},
    {id:'red_btn', name:'Red Button', group:'planned', val:4},
  ];

  var L = [
    {source:'chat_gw',target:'router'}, {source:'chat_gw',target:'telegram'},
    {source:'router',target:'faq'}, {source:'router',target:'booking'},
    {source:'faq',target:'tier1'}, {source:'faq',target:'tier2'}, {source:'faq',target:'handoff'},
    {source:'booking',target:'get_avail'}, {source:'booking',target:'book_appt'},
    {source:'booking',target:'cancel_appt'}, {source:'booking',target:'get_bookings'},
    {source:'booking',target:'register_pat'}, {source:'booking',target:'handoff'},
    {source:'crm_gw',target:'sheets'},
    {source:'get_avail',target:'crm_gw'}, {source:'book_appt',target:'crm_gw'},
    {source:'cancel_appt',target:'crm_gw'}, {source:'get_bookings',target:'crm_gw'},
    {source:'register_pat',target:'crm_gw'},
    // WIP
    {source:'router',target:'confirm'}, {source:'chat_gw',target:'tg_biz'},
    // Planned
    {source:'router',target:'reschedule'}, {source:'router',target:'admin_agent'},
    {source:'admin_agent',target:'red_btn'},
    {source:'crm_gw',target:'ident'},
    {source:'chat_gw',target:'whatsapp'}, {source:'chat_gw',target:'max_msg'},
    {source:'chat_gw',target:'voice'},
  ];

  var C = {done:'#10b981', wip:'#f59e0b', planned:'#334155'};

  var w = el.clientWidth;
  var h = el.clientHeight;

  window._roadmapGraph = new ForceGraph3D(el)
    .width(w).height(h)
    .graphData({nodes:N, links:L})
    .backgroundColor('#0a0a1a')
    .nodeVal(function(n) { return Math.max(3, (n.val||5)*0.5); })
    .nodeColor(function(n) { return C[n.group]||'#334155'; })
    .nodeOpacity(0.85)
    .linkColor(function(l) {
      var t = typeof l.target==='object' ? l.target : N.find(function(n){return n.id===l.target;});
      if (t && t.group==='planned') return 'rgba(255,255,255,0.06)';
      if (t && t.group==='wip') return 'rgba(245,158,11,0.25)';
      return 'rgba(255,255,255,0.2)';
    })
    .linkWidth(1)
    .nodeLabel(function(n) {
      var s = {done:'Готово', wip:'В работе', planned:'Планируется'}[n.group]||'';
      return '<b>'+n.name+'</b><br><small>'+s+'</small>';
    });

  window._roadmapGraph.d3Force('charge').strength(-300);
  window._roadmapGraph.d3Force('link').distance(70);

  window.addEventListener('resize', function() {
    if (window._roadmapGraph && el.clientWidth > 50) {
      window._roadmapGraph.width(el.clientWidth).height(el.clientHeight);
    }
  });
};
