/* trace.js — Trace log + animation from Langfuse data */

// Display name → graph node ID mapping
var NAME_TO_NODE = {
  'Telegram': 'telegram',
  'Chat Gateway': 'chat_gateway',
  'Dental Router': 'router',
  'FAQ Agent': 'faq:agent',
  'Booking Agent': 'booking:agent',
  'Tier 1+2 Search': 'tool:tier1',  // animates both tier1 and tier2
  'Handoff': 'tool:handoff',
  'CRM Gateway': 'crm_gateway',
  'Google Sheets': 'google_sheets',
  'get_availability': 'tool:get_availability',
  'book_appointment': 'tool:book_appointment',
  'cancel_appointment': 'tool:cancel_appointment',
  'get_existing_bookings': 'tool:get_existing_bookings',
  'register_patient': 'tool:register_patient',
};

window.animateFromTrace = async function(traceId) {
  try {
    var r = await fetch('/api/trace/' + traceId, { headers: window.authHeaders() });
    var data = await r.json();
    if (!data.flow || !data.flow.length) return;

    var log = document.getElementById('viz-trace-log');
    var sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #334155;margin:6px 0 4px;padding-top:3px;color:#7dd3fc;font-size:.65rem';
    sep.textContent = 'Trace: ' + traceId.substring(0,12) + '...';
    log.appendChild(sep);

    /* Build steps from trace observations */
    var steps = [];
    var root = data.flow.find(function(o) { return !o.parentId; }) || data.flow[0];
    var routerObs = data.flow.find(function(o) { return o.name === 'router'; });
    var faqObs = data.flow.find(function(o) { return o.name === 'faq' && o.type === 'CHAIN'; });
    var bookingObs = data.flow.find(function(o) { return o.name === 'booking' && o.type === 'CHAIN'; });
    var agentName = faqObs ? 'FAQ Agent' : bookingObs ? 'Booking Agent' : null;
    var agentObs = faqObs || bookingObs;
    var hookObs = data.flow.find(function(o) { return o.name === 'pre_model_hook'; });
    var llmObs = data.flow.find(function(o) { return o.name === 'ChatOpenAI'; });
    var toolNames = ['get_availability','book_appointment','cancel_appointment','get_existing_bookings','register_patient'];

    steps.push({ from: 'Telegram', to: 'Chat Gateway', obs: root });
    if (routerObs) steps.push({ from: 'Chat Gateway', to: 'Dental Router', obs: routerObs });
    if (agentName) steps.push({ from: 'Dental Router', to: agentName, obs: agentObs });
    if (hookObs && agentName) {
      steps.push({ from: agentName, to: 'Tier 1+2 Search', obs: hookObs });
      steps.push({ from: 'Tier 1+2 Search', to: agentName, obs: hookObs });
    }
    if (llmObs && agentName) {
      steps.push({ from: agentName, to: 'LLM (' + (llmObs.model || 'gpt-5.4-mini') + ')', obs: llmObs });
    }
    data.flow.forEach(function(obs) {
      if (obs.name && toolNames.indexOf(obs.name) !== -1) {
        steps.push({ from: agentName || 'Booking Agent', to: obs.name, obs: obs });
        steps.push({ from: obs.name, to: 'CRM Gateway', obs: obs });
      }
    });
    var handoffObs = data.flow.find(function(o) { return o.name && o.name.indexOf('handoff') !== -1; });
    if (handoffObs) {
      steps.push({ from: agentName || '?', to: 'Handoff', obs: handoffObs });
      steps.push({ from: 'Handoff', to: 'Chat Gateway', obs: handoffObs });
    }
    if (agentName) steps.push({ from: agentName, to: 'Chat Gateway', obs: agentObs });
    steps.push({ from: 'Chat Gateway', to: 'Telegram', obs: root });

    /* Render trace log */
    steps.forEach(function(step) {
      var dur = (step.obs && step.obs.startTime && step.obs.endTime)
        ? Math.round(new Date(step.obs.endTime) - new Date(step.obs.startTime)) + 'ms' : '';

      var wrapper = document.createElement('div');
      var row = document.createElement('div');
      row.className = 'te-row';
      row.innerHTML = '<span class="te-from">' + step.from + '</span><span class="te-arrow">\u2192</span><span class="te-to">' + step.to + '</span>' + (dur ? '<span class="te-dur">' + dur + '</span>' : '');

      var details = document.createElement('div');
      details.className = 'te-details';
      var btnI = document.createElement('button'); btnI.className = 'te-btn'; btnI.textContent = 'Input';
      var btnO = document.createElement('button'); btnO.className = 'te-btn'; btnO.textContent = 'Output';
      var pre = document.createElement('pre'); pre.style.display = 'none';
      btnI.onclick = function(e) { e.stopPropagation(); pre.textContent = JSON.stringify(step.obs && step.obs.input, null, 2) || '\u2014'; pre.style.display = 'block'; btnI.classList.add('active'); btnO.classList.remove('active'); };
      btnO.onclick = function(e) { e.stopPropagation(); pre.textContent = JSON.stringify(step.obs && step.obs.output, null, 2) || '\u2014'; pre.style.display = 'block'; btnO.classList.add('active'); btnI.classList.remove('active'); };
      details.appendChild(btnI); details.appendChild(btnO); details.appendChild(pre);
      row.onclick = function() { details.classList.toggle('open'); };
      wrapper.appendChild(row); wrapper.appendChild(details);
      log.appendChild(wrapper);
    });
    log.scrollTop = log.scrollHeight;

    /* Animate on map — SAME steps as trace log, mapped to node IDs */
    var animPath = [];
    steps.forEach(function(step) {
      var fromId = NAME_TO_NODE[step.from];
      var toId = NAME_TO_NODE[step.to];
      if (fromId && toId) {
        // Tier 1+2: fire both simultaneously as parallel step
        if (toId === 'tool:tier1') {
          animPath.push([[fromId, 'tool:tier1'], [fromId, 'tool:tier2']]);
        } else if (step.from === 'Tier 1+2 Search') {
          // Return from tier: both return simultaneously
          animPath.push([['tool:tier1', toId], ['tool:tier2', toId]]);
        } else {
          animPath.push([fromId, toId]);
        }
      }
    });

    if (animPath.length > 0 && window.animateFlow) {
      window.animateFlow(animPath, '#7dd3fc');
    }
  } catch(e) {
    console.error('Trace animation failed:', e);
  }
};
