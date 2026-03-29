/* edge-cases.js — Edge case viewer & runner.
   Single source of truth: Langfuse dataset "dental-edge-cases".
   Hub API /api/edge-cases returns items from dataset. */

var _edgeCases = [];
var _langfuseUrl = '';

async function loadEdgeCases() {
  var el = document.getElementById('ec-results');
  if (!el) return;
  el.innerHTML = '<div class="ec-loading">Loading from Langfuse dataset...</div>';

  try {
    var [casesResp, lfResp] = await Promise.all([
      fetch('/api/edge-cases', { headers: window.authHeaders() }),
      fetch('/api/langfuse-url', { headers: window.authHeaders() }),
    ]);
    var casesData = await casesResp.json();
    var lfData = await lfResp.json();

    _langfuseUrl = lfData.url || '';
    _edgeCases = casesData.items || [];

    if (casesData.error) {
      el.innerHTML = '<div class="ec-loading">Error: ' + casesData.error + '</div>';
      return;
    }
    if (_edgeCases.length === 0) {
      el.innerHTML = '<div class="ec-loading">Dataset empty. Run: python scripts/run_eval.py --seed-only</div>';
      return;
    }

    renderEdgeCases();
  } catch (e) {
    el.innerHTML = '<div class="ec-loading">Failed to load: ' + e.message + '</div>';
  }
}

function renderEdgeCases() {
  var el = document.getElementById('ec-results');
  if (!el || !_edgeCases.length) return;

  var categories = {};
  _edgeCases.forEach(function(tc) {
    var cat = tc.category || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(tc);
  });

  var html = '';
  Object.keys(categories).forEach(function(cat) {
    html += '<div style="margin-bottom:1.2rem">';
    html += '<h3 style="font-size:.8rem;color:var(--accent);margin-bottom:.5rem">' + cat + '</h3>';
    categories[cat].forEach(function(tc, idx) {
      var uid = cat + '-' + idx;
      html += '<div class="card ec-card" id="ec-' + uid + '">';

      // Header
      html += '<div class="ec-header" onclick="toggleEdgeCase(\'' + uid + '\')">';
      html += '<div>';
      html += '<div class="ec-name">' + (tc.id || cat + ' #' + (idx + 1)) + '</div>';
      html += '<div class="ec-msg">' + tc.message + '</div>';
      html += '</div>';
      html += '<div class="ec-status">▸</div>';
      html += '</div>';

      // Expandable
      html += '<div class="ec-expand">';

      // Patient
      html += '<div class="ec-section"><div class="ec-label">Patient</div>';
      html += '<div class="ec-patient">';
      html += tc.patient_name ? ('👤 ' + tc.patient_name) : '👤 <span class="empty">unknown</span>';
      html += ' &nbsp;|&nbsp; ';
      html += tc.patient_phone ? ('📱 ' + tc.patient_phone) : '📱 <span class="empty">none</span>';
      html += ' &nbsp;|&nbsp; ';
      html += tc.is_identified
        ? '<span class="identified">✓ identified</span>'
        : '<span class="not-identified">✗ not identified</span>';
      html += '</div></div>';

      // History
      if (tc.history && tc.history.length > 0) {
        html += '<div class="ec-section"><div class="ec-label">Previous messages</div>';
        tc.history.forEach(function(msg) {
          var who = msg.role === 'user' ? '🧑 Patient' : '🤖 Bot';
          var cls = msg.role === 'user' ? 'ec-history-user' : 'ec-history-bot';
          html += '<div class="ec-history-msg ' + cls + '">' + who + ': ' + msg.content + '</div>';
        });
        html += '</div>';
      }

      // Input message
      html += '<div class="ec-section"><div class="ec-label">Message</div>';
      html += '<div class="ec-input">' + tc.message + '</div></div>';

      // Expected
      html += '<div class="ec-section"><div class="ec-label">Expected</div>';
      html += '<div class="ec-expected">' + (tc.expected || '—') + '</div></div>';

      // Run button + response
      html += '<button onclick="event.stopPropagation();runEdgeCase(\'' + uid + '\')" class="btn" style="font-size:.65rem;padding:3px 10px;margin-bottom:6px">▶ Run</button>';
      html += '<div class="ec-response"></div>';

      html += '</div>'; // ec-expand
      html += '</div>'; // card
    });
    html += '</div>';
  });

  el.innerHTML = html;
}

function toggleEdgeCase(uid) {
  var card = document.getElementById('ec-' + uid);
  var expand = card.querySelector('.ec-expand');
  var status = card.querySelector('.ec-status');

  if (expand.style.display === 'none' || !expand.style.display) {
    expand.style.display = 'block';
    if (!status.dataset.ran) status.textContent = '▾';
  } else {
    expand.style.display = '';
    if (!status.dataset.ran) status.textContent = '▸';
  }
}

function _findCase(uid) {
  var parts = uid.split('-');
  var idx = parseInt(parts.pop());
  var cat = parts.join('-');
  var categories = {};
  _edgeCases.forEach(function(tc) {
    var c = tc.category || 'other';
    if (!categories[c]) categories[c] = [];
    categories[c].push(tc);
  });
  return (categories[cat] || [])[idx];
}

async function runEdgeCase(uid) {
  var tc = _findCase(uid);
  if (!tc) return;

  var card = document.getElementById('ec-' + uid);
  var statusEl = card.querySelector('.ec-status');
  var responseEl = card.querySelector('.ec-response');

  statusEl.textContent = '⏳';
  statusEl.style.color = 'var(--yellow)';
  statusEl.dataset.ran = '1';

  var clinicId = document.getElementById('ec-clinic').value;
  var threadId = 'ec-' + (tc.id || uid) + '-' + Date.now();

  try {
    var r = await fetch('/api/clinics/' + clinicId + '/chat', {
      method: 'POST',
      headers: { ...window.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: tc.message,
        clinic_id: clinicId,
        channel: 'tg_bot',
        channel_user_id: 'edge-case-tester',
        thread_id: threadId,
        phone: tc.patient_phone || undefined,
        name: tc.patient_name || undefined,
      }),
    });
    var data = await r.json();
    var response = data.response || data.error || 'No response';
    var traceId = data.trace_id || null;

    statusEl.textContent = '✓';
    statusEl.style.color = 'var(--green)';

    var rhtml = '<div class="ec-label">Response</div>';
    rhtml += '<div class="ec-response-text">' + response + '</div>';
    if (traceId && _langfuseUrl) {
      rhtml += '<div class="ec-trace-link"><a href="' + _langfuseUrl + '/trace/' + traceId + '" target="_blank">🔍 Trace in Langfuse</a></div>';
    }

    responseEl.innerHTML = rhtml;
    responseEl.style.display = 'block';
  } catch (e) {
    statusEl.textContent = 'ERR';
    statusEl.style.color = 'var(--red)';
    responseEl.innerHTML = '<div style="font-size:.65rem;color:var(--red)">' + e.message + '</div>';
    responseEl.style.display = 'block';
  }
}

async function runAllEdgeCases() {
  await loadEdgeCases();
  // Expand all
  document.querySelectorAll('.ec-expand').forEach(function(el) { el.style.display = 'block'; });
  document.querySelectorAll('.ec-status').forEach(function(el) { el.textContent = '▾'; });
  // Run sequentially
  var cards = document.querySelectorAll('.ec-card');
  for (var i = 0; i < cards.length; i++) {
    var uid = cards[i].id.replace('ec-', '');
    await runEdgeCase(uid);
    await new Promise(function(r) { setTimeout(r, 500); });
  }
}

window.initEdgeCases = loadEdgeCases;
