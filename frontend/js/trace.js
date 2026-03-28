/* trace.js — Trace log + animation from Langfuse data */

var NAME_TO_NODE = {
  'Telegram': 'telegram',
  'Chat Gateway': 'chat_gateway',
  'Identity DB': 'db:identity',
  'Checkpointer': 'db:checkpointer',
  'Knowledge Base': 'db:kb',
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

var _traceCache = {};

window.animateFromTrace = async function(traceId) {
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

    /* Build steps */
    var steps = [];
    var root = data.flow.find(function(o) { return !o.parentId; }) || data.flow[0];
    var routerObs = data.flow.find(function(o) { return o.name === 'router'; });
    var routerParent = routerObs ? routerObs.parentId : null;
    var faqObs = data.flow.find(function(o) { return o.name === 'faq' && o.parentId === routerParent; });
    var bookingObs = data.flow.find(function(o) { return o.name === 'booking' && o.parentId === routerParent; });
    var agentName = faqObs ? 'FAQ Agent' : bookingObs ? 'Booking Agent' : null;
    var agentObs = faqObs || bookingObs;
    var hookObs = data.flow.find(function(o) { return o.name === 'pre_model_hook'; });
    var llmObs = data.flow.find(function(o) {
      return o.name === 'ChatOpenAI' && (!routerObs || o.parentId !== routerObs.id);
    }) || data.flow.find(function(o) { return o.name === 'ChatOpenAI'; });
    var toolNames = ['get_availability','book_appointment','cancel_appointment','get_existing_bookings','register_patient'];

    steps.push({ from: 'Telegram', to: 'Chat Gateway', obs: root });
    // Identity DB lookup
    var idMs = window._lastIdentityMs || 0;
    steps.push({ from: 'Chat Gateway', to: 'Identity DB', obs: {startTime: root.startTime, endTime: root.startTime ? new Date(new Date(root.startTime).getTime() + idMs).toISOString() : null} });
    steps.push({ from: 'Identity DB', to: 'Chat Gateway', obs: {startTime: root.startTime, endTime: root.startTime ? new Date(new Date(root.startTime).getTime() + idMs).toISOString() : null} });
    if (routerObs) steps.push({ from: 'Chat Gateway', to: 'Dental Router', obs: routerObs });
    if (agentName) steps.push({ from: 'Dental Router', to: agentName, obs: agentObs });
    if (hookObs && agentName) {
      steps.push({ from: agentName, to: 'Tier 1+2 Search', obs: hookObs });
      // Tier 2 → Knowledge Base (pgvector)
      steps.push({ from: 'Tier 1+2 Search', to: 'Knowledge Base', obs: hookObs });
      steps.push({ from: 'Knowledge Base', to: agentName, obs: hookObs });
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

    /* Calculate total duration */
    var totalDur = 0;
    if (root.startTime && root.endTime) {
      totalDur = Math.round(new Date(root.endTime) - new Date(root.startTime));
    }

    /* Render: one collapsible row per message, steps inside */
    var log = document.getElementById('viz-trace-log');

    var msgRow = document.createElement('div');
    msgRow.className = 'te-msg-row';
    msgRow.innerHTML = '<span class="te-msg-agent">' + (agentName || 'Router') + '</span>'
      + '<span class="te-msg-arrow">\u2192</span>'
      + '<span class="te-msg-text">' + steps.length + ' шагов</span>'
      + (totalDur ? '<span class="te-dur">' + totalDur + 'ms</span>' : '');

    var stepsContainer = document.createElement('div');
    stepsContainer.className = 'te-steps';
    stepsContainer.style.display = 'none';

    steps.forEach(function(step) {
      var dur = (step.obs && step.obs.startTime && step.obs.endTime)
        ? Math.round(new Date(step.obs.endTime) - new Date(step.obs.startTime)) + 'ms' : '';

      var stepWrapper = document.createElement('div');

      var row = document.createElement('div');
      row.className = 'te-row';
      row.innerHTML = '<span class="te-from">' + step.from + '</span><span class="te-arrow">\u2192</span><span class="te-to">' + step.to + '</span>' + (dur ? '<span class="te-dur">' + dur + '</span>' : '');

      var details = document.createElement('div');
      details.className = 'te-details';
      var preWrap = document.createElement('div');
      preWrap.style.cssText = 'display:flex;gap:6px';
      var preIn = document.createElement('pre');
      preIn.style.display = 'none';
      preIn.textContent = (step.obs && step.obs.input) ? 'INPUT:\n' + JSON.stringify(step.obs.input, null, 2) : '\u2014';
      var preOut = document.createElement('pre');
      preOut.style.display = 'none';
      preOut.textContent = (step.obs && step.obs.output) ? 'OUTPUT:\n' + JSON.stringify(step.obs.output, null, 2) : '\u2014';
      preWrap.appendChild(preIn);
      preWrap.appendChild(preOut);
      details.appendChild(preWrap);

      row.onclick = function(e) {
        e.stopPropagation();
        var isOpen = details.classList.contains('open');
        details.classList.toggle('open');
        preIn.style.display = isOpen ? 'none' : 'block';
        preOut.style.display = isOpen ? 'none' : 'block';
      };

      stepWrapper.appendChild(row);
      stepWrapper.appendChild(details);
      stepsContainer.appendChild(stepWrapper);
    });

    msgRow.onclick = function() {
      var isOpen = stepsContainer.style.display !== 'none';
      stepsContainer.style.display = isOpen ? 'none' : 'block';
    };

    log.appendChild(msgRow);
    log.appendChild(stepsContainer);
    log.scrollTop = log.scrollHeight;

    /* Build animation path */
    var animPath = [];
    steps.forEach(function(step) {
      var fromId = NAME_TO_NODE[step.from];
      var toId = NAME_TO_NODE[step.to];
      if (fromId && toId) {
        if (toId === 'tool:tier1') {
          animPath.push({ links: [[fromId, 'tool:tier1'], [fromId, 'tool:tier2']], dur: 500 });
        } else if (step.from === 'Tier 1+2 Search') {
          animPath.push({ links: [['tool:tier1', toId], ['tool:tier2', toId]], dur: 500 });
        } else {
          var dur = 500;
          if (step.obs && step.obs.startTime && step.obs.endTime) {
            dur = Math.max(200, Math.round(new Date(step.obs.endTime) - new Date(step.obs.startTime)));
          }
          animPath.push({ links: [[fromId, toId]], dur: dur });
        }
      }
    });

    _traceCache[traceId] = { steps: steps, animPath: animPath };

    if (animPath.length > 0 && window.animateFlow) {
      window.animateFlow(animPath, '#7dd3fc');
    }
  } catch(e) {
    console.error('Trace animation failed:', e);
  }
};
