/* chat.js — Chat functionality, plain JS */

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

  try {
    var hdrs = Object.assign({'Content-Type': 'application/json'}, window.authHeaders());
    var r = await fetch('/api/clinics/' + window._activeClinic.id + '/chat', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({message: t, channel_user_id: 'hub-' + Date.now()})
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

    /* Auto-animate trace after delay (Langfuse needs time to ingest) */
    if (d.trace_id) {
      setTimeout(function() { window.animateFromTrace(d.trace_id); }, 3000);
    }
  } catch(e) {
    var d3 = document.createElement('div');
    d3.className = 'vm s';
    d3.textContent = 'Error: ' + e.message;
    msgs.appendChild(d3);
  }
};
