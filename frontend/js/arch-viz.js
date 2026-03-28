/* arch-viz.js — Architecture visualization with clickable nodes + detail panel */
import * as THREE from "https://esm.sh/three";
import SpriteText from "https://esm.sh/three-spritetext";

var C = {
  router:'#7dd3fc', agent:'#10b981', tool:'#f59e0b',
  gateway:'#3b82f6', connector:'#8b5cf6',
};
var WIRE = {
  router:'#ffffff', agent:'#a7f3d0', tool:'#fef3c7',
  gateway:'#bfdbfe', connector:'#e9d5ff',
};

// Node metadata — comments, links, status, description
// Saved to localStorage so it persists between sessions
var STORAGE_KEY = 'dental_arch_meta';

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch(e) { return {}; }
}
function saveMeta(meta) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

// Default descriptions
var DEFAULTS = {
  'router': {desc:'Dental Router — классифицирует intent (faq/booking) через keywords + LLM fallback. 2 LLM-вызова на запрос.', status:'done'},
  'faq:agent': {desc:'FAQ Agent — отвечает на вопросы о клинике. Tier 1 (YAML) + Tier 2 (pgvector) knowledge injection.', status:'done'},
  'booking:agent': {desc:'Booking Agent — запись, отмена, перенос. 5 CRM tools + handoff.', status:'done'},
  'tool:tier1': {desc:'Tier 1: структурированные данные из YAML конфига клиники (адрес, цены, врачи).', status:'done'},
  'tool:tier2': {desc:'Tier 2: семантический поиск по pgvector базе знаний.', status:'done'},
  'tool:handoff': {desc:'Handoff — передаёт разговор администратору клиники.', status:'done'},
  'tool:get_availability': {desc:'Получить свободные слоты из CRM по service_key и дате.', status:'done'},
  'tool:book_appointment': {desc:'Забронировать слот в CRM. Создаёт запись в Google Sheets.', status:'done'},
  'tool:cancel_appointment': {desc:'Отменить запись в CRM.', status:'done'},
  'tool:get_existing_bookings': {desc:'Показать активные записи пациента из CRM.', status:'done'},
  'tool:register_patient': {desc:'Зарегистрировать нового пациента в CRM.', status:'done'},
  'crm_gateway': {desc:'CRM Gateway — Protocol абстракция. Адаптеры: Google Sheets (сейчас), IDENT (будущее).', status:'done'},
  'google_sheets': {desc:'Google Sheets plugin — read/write врачи, слоты, записи, пациенты, история.', status:'done'},
  'chat_gateway': {desc:'Chat Gateway — входящие/исходящие сообщения, SSE streaming, webhook/polling.', status:'done'},
  'telegram': {desc:'Telegram Bot plugin — webhook parsing, send/edit message, polling mode.', status:'done'},
};

window.initArchViz = function() {
  if (window._archGraph) return;
  var el = document.getElementById('arch-graph');
  if (!el || el.clientWidth < 50) return;

  // Same nodes as clinic /graph endpoint but static
  var N = [
    {id:'router', name:'Dental Router', group:'router', val:16, shape:'dodecahedron'},
    {id:'faq:agent', name:'FAQ Agent', group:'agent', val:12, shape:'icosahedron'},
    {id:'booking:agent', name:'Booking Agent', group:'agent', val:12, shape:'icosahedron'},
    {id:'tool:tier1', name:'Tier 1: YAML', group:'tool', val:5, shape:'octahedron'},
    {id:'tool:tier2', name:'Tier 2: pgvector', group:'tool', val:5, shape:'octahedron'},
    {id:'tool:handoff', name:'Handoff', group:'tool', val:4, shape:'octahedron'},
    {id:'tool:get_availability', name:'get_availability', group:'tool', val:4, shape:'octahedron'},
    {id:'tool:book_appointment', name:'book_appointment', group:'tool', val:4, shape:'octahedron'},
    {id:'tool:cancel_appointment', name:'cancel_appointment', group:'tool', val:4, shape:'octahedron'},
    {id:'tool:get_existing_bookings', name:'get_bookings', group:'tool', val:4, shape:'octahedron'},
    {id:'tool:register_patient', name:'register_patient', group:'tool', val:4, shape:'octahedron'},
    {id:'crm_gateway', name:'CRM Gateway', group:'gateway', val:10, shape:'box'},
    {id:'google_sheets', name:'Google Sheets', group:'connector', val:7, shape:'tetrahedron'},
    {id:'chat_gateway', name:'Chat Gateway', group:'gateway', val:10, shape:'box'},
    {id:'telegram', name:'Telegram Bot', group:'connector', val:7, shape:'tetrahedron'},
  ];

  var L = [
    {source:'telegram',target:'chat_gateway'}, {source:'chat_gateway',target:'router'},
    {source:'chat_gateway',target:'telegram'},
    {source:'router',target:'faq:agent'}, {source:'router',target:'booking:agent'},
    {source:'faq:agent',target:'tool:tier1'}, {source:'faq:agent',target:'tool:tier2'},
    {source:'tool:tier1',target:'faq:agent'}, {source:'tool:tier2',target:'faq:agent'},
    {source:'faq:agent',target:'tool:handoff'}, {source:'booking:agent',target:'tool:handoff'},
    {source:'faq:agent',target:'chat_gateway'}, {source:'booking:agent',target:'chat_gateway'},
    {source:'booking:agent',target:'tool:get_availability'}, {source:'booking:agent',target:'tool:book_appointment'},
    {source:'booking:agent',target:'tool:cancel_appointment'}, {source:'booking:agent',target:'tool:get_existing_bookings'},
    {source:'booking:agent',target:'tool:register_patient'},
    {source:'tool:get_availability',target:'crm_gateway'}, {source:'tool:book_appointment',target:'crm_gateway'},
    {source:'tool:cancel_appointment',target:'crm_gateway'}, {source:'tool:get_existing_bookings',target:'crm_gateway'},
    {source:'tool:register_patient',target:'crm_gateway'},
    {source:'crm_gateway',target:'google_sheets'},
    {source:'tool:handoff',target:'chat_gateway'},
  ];

  window._archGraph = new ForceGraph3D(el)
    .width(el.clientWidth).height(el.clientHeight)
    .graphData({nodes:N, links:L})
    .backgroundColor('#0a0a1a')
    .nodeVal(function(n) { return Math.max(3, (n.val||5)*0.5); })
    .nodeColor(function(n) { return C[n.group]||'#888'; })
    .nodeOpacity(0.85)
    .linkColor(function() { return 'rgba(255,255,255,0.2)'; })
    .linkWidth(1)
    .onNodeClick(function(node) { showNodeDetail(node); })
    .nodeThreeObject(function(node) {
      var group = new THREE.Group();
      var r = Math.cbrt(node.val||5) * 4.5;
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
      group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:color, transparent:true, opacity:0.85})));

      var wc = WIRE[node.group] || '#ffffff';
      var wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({color:wc, transparent:true, opacity:0.5})
      );
      wire.scale.setScalar(1.03);
      group.add(wire);

      var s = new SpriteText(node.name);
      s.color = '#ffffff';
      s.textHeight = 4;
      s.backgroundColor = 'rgba(0,0,0,0.55)';
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

function showNodeDetail(node) {
  var panel = document.getElementById('arch-detail');
  var meta = loadMeta();
  var m = meta[node.id] || {};
  var def = DEFAULTS[node.id] || {};

  var comment = m.comment || '';
  var jiraUrl = m.jira || '';
  var desc = def.desc || '';
  var status = def.status || 'unknown';

  var statusTag = {done:'<span class="tag ok">Готово</span>', wip:'<span class="tag wip">В работе</span>', planned:'<span class="tag no">Планируется</span>'}[status] || '';

  panel.innerHTML = ''
    + '<div style="margin-bottom:10px">'
    + '<div style="font-size:.95rem;font-weight:600;color:var(--text)">' + node.name + '</div>'
    + '<div style="font-size:.65rem;color:var(--muted);margin:2px 0">ID: ' + node.id + ' | ' + statusTag + '</div>'
    + '</div>'
    + '<div style="margin-bottom:10px;font-size:.75rem;color:var(--text);line-height:1.5">' + desc + '</div>'
    + '<div style="margin-bottom:8px">'
    + '<label style="font-size:.65rem;color:var(--muted);display:block;margin-bottom:2px">Jira / ссылка</label>'
    + '<input id="arch-jira" type="text" value="' + jiraUrl.replace(/"/g,'&quot;') + '" placeholder="https://jira.example.com/..." style="width:100%;padding:4px 6px;border-radius:4px;border:1px solid var(--border);background:#1e293b;color:var(--text);font-size:.75rem;outline:none">'
    + '</div>'
    + '<div style="margin-bottom:8px">'
    + '<label style="font-size:.65rem;color:var(--muted);display:block;margin-bottom:2px">Комментарий</label>'
    + '<textarea id="arch-comment" rows="4" placeholder="Заметки по компоненту..." style="width:100%;padding:4px 6px;border-radius:4px;border:1px solid var(--border);background:#1e293b;color:var(--text);font-size:.75rem;outline:none;resize:vertical">' + comment.replace(/</g,'&lt;') + '</textarea>'
    + '</div>'
    + '<button onclick="saveArchMeta(\'' + node.id + '\')" class="btn" style="font-size:.7rem">Сохранить</button>'
    + (jiraUrl ? '<a href="' + jiraUrl + '" target="_blank" style="margin-left:8px;font-size:.7rem;color:var(--accent)">Открыть Jira →</a>' : '');
}

window.saveArchMeta = function(nodeId) {
  var meta = loadMeta();
  meta[nodeId] = {
    comment: document.getElementById('arch-comment').value,
    jira: document.getElementById('arch-jira').value,
  };
  saveMeta(meta);
  var btn = event.target;
  btn.textContent = 'Сохранено ✓';
  setTimeout(function() { btn.textContent = 'Сохранить'; }, 1500);
};
