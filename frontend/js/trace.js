/* trace.js — Trace log + animation from Langfuse data */

var NAME_TO_NODE = {
  'Telegram': 'telegram',
  'Chat Gateway': 'chat_gateway',
  'Dental Router': 'router',
  'FAQ Agent': 'faq:agent',
  'Booking Agent': 'booking:agent',
  'Tier 1+2 Search': 'tool:tier1',
  'Handoff': 'tool:handoff',
  'CRM Gateway': 'crm_gateway',
  'Google Sheets': 'google_sheets',
  'get_availability': 'tool:get_availability',
  'book_appointment': 'tool:book_appointment',
  'cancel_appointment': 'tool:cancel_appointment',
  'get_existing_bookings': 'tool:get_existing_bookings',
  'register_patient': 'tool:register_patient',
};

// Cache: traceId → { steps, animPath }
var _traceCache = {};

/* Fetch trace, render log, animate. Called once per message. */
window.animateFromTrace = async function(traceId) {
  // If cached — just replay animation, don't fetch or render log again
  if (_traceCache[traceId]) {
    if (window.animateFlow && _traceCache[traceId].animPath.length) {
      window.animateFlow(_traceCache[traceId].animPath, '#7dd3fc');
    }
    return;
  }

  try {
    var r = await fetch('/api/trace/' + traceId, { headers: window.authHeaders() });
    var data = await r.json();
    if (!data.flow || !data.flow.length) return;

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
    var log = document.getElementById('viz-trace-log');
    var sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #334155;margin:6px 0 4px;padding-top:3px;color:#7dd3fc;font-size:.65rem';
    sep.textContent = 'Trace: ' + traceId.substring(0,12) + '...';
    log.appendChild(sep);

    steps.forEach(function(step) {
      var dur = (step.obs && step.obs.startTime && step.obs.endTime)
        ? Math.round(new Date(step.obs.endTime) - new Date(step.obs.startTime)) + 'ms' : '';

      var wrapper = document.createElement('div');
      var row = document.createElement('div');
      row.className = 'te-row';
      row.innerHTML = '<span class="te-from">' + step.from + '</span><span class="te-arrow">\u2192</span><span class="te-to">' + step.to + '</span>' + (dur ? '<span class="te-dur">' + dur + '</span>' : '');

      var details = document.createElement('div');
      details.className = 'te-details';

      // Input + Output shown together on click, no separate buttons
      var pre = document.createElement('pre');
      pre.style.display = 'none';
      var inputStr = step.obs && step.obs.input ? JSON.stringify(step.obs.input, null, 2) : null;
      var outputStr = step.obs && step.obs.output ? JSON.stringify(step.obs.output, null, 2) : null;
      var parts = [];
      if (inputStr) parts.push('INPUT:\n' + inputStr);
      if (outputStr) parts.push('OUTPUT:\n' + outputStr);
      pre.textContent = parts.join('\n\n') || '\u2014';

      details.appendChild(pre);
      row.onclick = function() {
        var isOpen = details.classList.contains('open');
        details.classList.toggle('open');
        pre.style.display = isOpen ? 'none' : 'block';
      };
      wrapper.appendChild(row);
      wrapper.appendChild(details);
      log.appendChild(wrapper);
    });
    log.scrollTop = log.scrollHeight;

    /* Build animation path with real durations */
    var animPath = [];
    steps.forEach(function(step) {
      var fromId = NAME_TO_NODE[step.from];
      var toId = NAME_TO_NODE[step.to];
      // Calculate duration from trace
      var dur = 500; // default
      if (step.obs && step.obs.startTime && step.obs.endTime) {
        dur = Math.max(200, Math.round(new Date(step.obs.endTime) - new Date(step.obs.startTime)));
      }
      if (fromId && toId) {
        if (toId === 'tool:tier1') {
          animPath.push({ links: [[fromId, 'tool:tier1'], [fromId, 'tool:tier2']], dur: dur });
        } else if (step.from === 'Tier 1+2 Search') {
          animPath.push({ links: [['tool:tier1', toId], ['tool:tier2', toId]], dur: dur });
        } else {
          animPath.push({ links: [[fromId, toId]], dur: dur });
        }
      }
    });

    // Cache for replay
    _traceCache[traceId] = { steps: steps, animPath: animPath };

    // Animate
    if (animPath.length > 0 && window.animateFlow) {
      window.animateFlow(animPath, '#7dd3fc');
    }
  } catch(e) {
    console.error('Trace animation failed:', e);
  }
};
