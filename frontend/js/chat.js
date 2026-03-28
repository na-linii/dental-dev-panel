/* chat.js — Chat functionality with playground params */

/* Toggle business_connection_id field based on channel */
document.addEventListener('DOMContentLoaded', function() {
  var sel = document.getElementById('pg-channel');
  if (sel) {
    sel.onchange = function() {
      var bizRow = document.getElementById('pg-biz-row');
      if (bizRow) bizRow.style.display = sel.value === 'tg_business' ? 'flex' : 'none';
    };
  }
});

/* Generate default user ID on clinic open */
window.initPlayground = function() {
  var uid = document.getElementById('pg-user-id');
  if (uid && !uid.value) {
    uid.value = 'hub-' + Math.floor(Math.random() * 900000 + 100000);
  }
};

window.vizSend = async function() {
  var inp = document.getElementById('viz-inp');
  var t = inp.value.trim();
  if (!t || !window._activeClinic) return;
  inp.value = '';
  var msgs = document.getElementById('viz-msgs');

  var d1 = document.createElement('div');
  d1.className = 'vm u';
  d1.textContent = t;
  msgs.appendChild(d1);
  msgs.scrollTop = msgs.scrollHeight;

  /* Collect playground params */
  var channel = (document.getElementById('pg-channel') || {}).value || 'tg_bot';
  var userId = (document.getElementById('pg-user-id') || {}).value || ('hub-' + Date.now());
  var bizId = (document.getElementById('pg-biz-id') || {}).value || '';
  var phone = (document.getElementById('pg-phone') || {}).value || '';
  var name = (document.getElementById('pg-name') || {}).value || '';

  var body = {
    message: t,
    channel: channel,
    channel_user_id: userId,
  };
  if (phone) body.phone = phone;
  if (name) body.name = name;
  if (channel === 'tg_business' && bizId) {
    body.channel_username = bizId; /* pass biz connection through username field for now */
  }

  try {
    var hdrs = Object.assign({'Content-Type': 'application/json'}, window.authHeaders());
    var r = await fetch('/api/clinics/' + window._activeClinic.id + '/chat', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify(body)
    });
    var d = await r.json();
    var d2 = document.createElement('div');
    d2.className = 'vm b';
    d2.innerHTML = (d.response || 'No response').replace(/</g, '&lt;');

    if (d.trace_id) {
      var btn = document.createElement('button');
      btn.className = 'replay-btn';
      btn.textContent = '\u25b6 replay';
      btn.onclick = function() { window.animateFromTrace(d.trace_id); };
      d2.appendChild(btn);
    }
    msgs.appendChild(d2);
    msgs.scrollTop = msgs.scrollHeight;

    if (d.trace_id) {
      // Pass identity_ms for trace display
      window._lastIdentityMs = d.identity_ms || 0;
      setTimeout(function() { window.animateFromTrace(d.trace_id); }, 3000);
    }
  } catch(e) {
    var d3 = document.createElement('div');
    d3.className = 'vm s';
    d3.textContent = 'Error: ' + e.message;
    msgs.appendChild(d3);
  }
};
