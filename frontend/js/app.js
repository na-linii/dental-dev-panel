/* app.js — Pages, clinics, routing, health checks. Plain JS, no imports. */

var CLINICS = [
  { id:'zubatka', name:'Зубатка', env:'yandex', url:'http://158.160.240.47:8080',
    config:{ CLINIC_ID:'zubatka', CRM:'Google Sheets', MODEL:'gpt-5.4-mini', STREAMING:'true' }},
];

window._activeClinic = null;

/* =================== PAGES =================== */
window.showPage = function(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  var page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  var tab = document.querySelector('.tab[data-page="' + id + '"]');
  if (tab) tab.classList.add('active');
};

/* =================== CLINICS =================== */
function renderClinics() {
  var grid = document.getElementById('clinics-grid');
  grid.innerHTML = '';
  CLINICS.forEach(function(c) {
    var card = document.createElement('div');
    card.className = 'card';
    card.innerHTML =
      '<h3><div class="dot" style="background:var(--green)"></div>' + c.name + ' <span style="font-weight:400;color:var(--muted);font-size:.7rem">(' + c.env + ')</span></h3>' +
      '<table>' +
        '<tr><td style="color:var(--muted)">URL</td><td style="font-size:.75rem">' + c.url + '</td></tr>' +
        Object.keys(c.config).map(function(k) {
          return '<tr><td style="color:var(--muted)">' + k + '</td><td style="font-size:.75rem">' + c.config[k] + '</td></tr>';
        }).join('') +
      '</table>' +
      '<div style="margin-top:.6rem;display:flex;gap:.4rem">' +
        '<button class="btn" onclick="healthCheck(\'' + c.id + '\')">Health</button>' +
        '<button class="btn primary" onclick="openViz(\'' + c.id + '\')">Chat + Визуализатор</button>' +
      '</div>';
    grid.appendChild(card);
  });
}

window.healthCheck = async function(clinicId) {
  try {
    var r = await fetch('/api/clinics/' + clinicId + '/health', { headers: window.authHeaders() });
    var d = await r.json();
    alert('Health: ' + JSON.stringify(d));
  } catch(e) { alert('Unreachable: ' + e.message); }
};

/* =================== OPEN VISUALIZER =================== */
window.openViz = function(clinicId) {
  var clinic = CLINICS.find(function(c) { return c.id === clinicId; });
  if (!clinic) return;
  window._activeClinic = clinic;

  document.getElementById('viz-clinic-name').textContent = clinic.name;
  document.getElementById('viz-server').textContent = clinic.env + ' (' + clinic.url + ')';
  document.getElementById('viz-crm').textContent = clinic.config.CRM || '—';
  document.getElementById('viz-chat-header').textContent = 'Chat — ' + clinic.name;
  document.getElementById('viz-msgs').innerHTML = '<div class="vm s">Напиши сообщение для ' + clinic.name + '</div>';

  /* Reset graph if switching clinics */
  if (window._vizGraph) {
    window._vizGraph._destructor && window._vizGraph._destructor();
    window._vizGraph = null;
    document.getElementById('viz-graph').innerHTML = '';
  }
  showPage('viz');

  /* Retry polling for initViz (CDN/module may still be loading) */
  (function tryInit(n) {
    if (window.initViz) window.initViz();
    else if (n > 0) setTimeout(function() { tryInit(n - 1); }, 300);
  })(30);
};

/* =================== INIT APP =================== */
function initApp(user) {
  document.getElementById('login').classList.add('hidden');
  document.getElementById('main-nav').style.display = 'flex';
  document.getElementById('user-name').textContent = user.login;
  document.getElementById('user-avatar').src = user.avatar;
  renderClinics();
  showPage('clinics');
}

/* Check saved session on load */
(function() {
  var saved = localStorage.getItem('dp_user');
  var savedToken = localStorage.getItem('dp_token');
  if (saved && savedToken) {
    try {
      var user = JSON.parse(saved);
      /* Quick init from cache, then verify in background */
      initApp(user);
      fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + atob(savedToken) } })
        .then(function(r) {
          if (!r.ok) throw new Error('bad token');
          return r.json();
        })
        .then(function(u) {
          return fetch('https://api.github.com/orgs/na-linii/members/' + u.login, {
            headers: { Authorization: 'Bearer ' + atob(savedToken) }
          });
        })
        .then(function(r2) {
          if (r2.status !== 204) throw new Error('not member');
        })
        .catch(function() { localStorage.clear(); location.reload(); });
    } catch(e) { localStorage.clear(); location.reload(); }
  }
})();
