/* trace.js — Trace animation, ES module (needs viz.js loaded first for animateFlow) */

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

    /* Build sequential path from trace observations */
    var realSteps = [];

    var root = data.flow.find(function(o) { return !o.parentId; }) || data.flow[0];
    realSteps.push({ from: 'Telegram', to: 'Chat Gateway', obs: root });

    var routerObs = data.flow.find(function(o) { return o.name === 'router'; });
    if (routerObs) {
      realSteps.push({ from: 'Chat Gateway', to: 'Dental Router', obs: routerObs });
    }

    var faqObs = data.flow.find(function(o) { return o.name === 'faq' && o.type === 'CHAIN'; });
    var bookingObs = data.flow.find(function(o) { return o.name === 'booking' && o.type === 'CHAIN'; });
    var agentName = faqObs ? 'FAQ Agent' : bookingObs ? 'Booking Agent' : null;
    var agentObs = faqObs || bookingObs;

    if (agentName && agentObs) {
      realSteps.push({ from: 'Dental Router', to: agentName, obs: agentObs });
    }

    var hookObs = data.flow.find(function(o) { return o.name === 'pre_model_hook'; });
    if (hookObs && agentName) {
      realSteps.push({ from: agentName, to: 'Tier 1+2 Search', obs: hookObs });
      realSteps.push({ from: 'Tier 1+2 \u2192 ' + agentName, to: agentName, obs: hookObs });
    }

    var llmObs = data.flow.find(function(o) { return o.name === 'ChatOpenAI'; });
    if (llmObs && agentName) {
      realSteps.push({ from: agentName, to: 'LLM (' + (llmObs.model || 'gpt-5.4-mini') + ')', obs: llmObs });
    }

    var toolNames = ['get_availability','book_appointment','cancel_appointment','get_existing_bookings','register_patient'];
    data.flow.forEach(function(obs) {
      if (obs.name && toolNames.indexOf(obs.name) !== -1) {
        realSteps.push({ from: 'Booking Agent', to: obs.name, obs: obs });
        realSteps.push({ from: obs.name, to: 'CRM Gateway', obs: obs });
      }
    });

    var handoffObs = data.flow.find(function(o) { return o.name && o.name.indexOf('handoff') !== -1; });
    if (handoffObs) {
      realSteps.push({ from: agentName || '?', to: 'Handoff', obs: handoffObs });
      realSteps.push({ from: 'Handoff', to: 'Chat Gateway', obs: handoffObs });
    }

    if (agentName) {
      realSteps.push({ from: agentName, to: 'Chat Gateway', obs: agentObs });
    }
    realSteps.push({ from: 'Chat Gateway', to: 'Telegram', obs: root });

    /* Render trace steps in log panel */
    realSteps.forEach(function(step) {
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
      btnI.onclick = function(e) {
        e.stopPropagation();
        pre.textContent = JSON.stringify(step.obs && step.obs.input, null, 2) || '\u2014';
        pre.style.display = 'block';
        btnI.classList.add('active');
        btnO.classList.remove('active');
      };
      btnO.onclick = function(e) {
        e.stopPropagation();
        pre.textContent = JSON.stringify(step.obs && step.obs.output, null, 2) || '\u2014';
        pre.style.display = 'block';
        btnO.classList.add('active');
        btnI.classList.remove('active');
      };
      details.appendChild(btnI);
      details.appendChild(btnO);
      details.appendChild(pre);
      row.onclick = function() { details.classList.toggle('open'); };
      wrapper.appendChild(row);
      wrapper.appendChild(details);
      log.appendChild(wrapper);
    });
    log.scrollTop = log.scrollHeight;

    /* Build animation from real trace -- 3 phases */
    var hasFaq = data.flow.some(function(o) { return o.name === 'faq'; });
    var hasBooking = data.flow.some(function(o) { return o.name === 'booking'; });
    var agentId = hasFaq ? 'faq:agent' : hasBooking ? 'booking:agent' : null;

    /* Phase 1: INBOUND */
    var inbound = [
      ['telegram', 'chat_gateway'],
      ['chat_gateway', 'router'],
    ];
    if (agentId) inbound.push(['router', agentId]);

    /* Phase 2: PROCESSING */
    var processing = [];
    if (agentId === 'faq:agent') {
      processing.push(['faq:agent', 'tool:tier1']);
      processing.push(['faq:agent', 'tool:tier2']);
    }
    data.flow.forEach(function(obs) {
      if (obs.name && toolNames.indexOf(obs.name) !== -1) {
        processing.push([agentId, 'tool:' + obs.name]);
        processing.push(['tool:' + obs.name, 'crm_gateway']);
        processing.push(['crm_gateway', 'google_sheets']);
      }
    });
    if (data.flow.some(function(o) { return o.name && o.name.indexOf('handoff') !== -1; })) {
      processing.push([agentId, 'tool:handoff']);
      processing.push(['tool:handoff', 'chat_gateway']);
    }

    /* Phase 3: OUTBOUND */
    var outbound = [];
    if (agentId) {
      outbound.push(['chat_gateway', 'telegram']);
    }

    /* Animate sequentially */
    window.animateFlow(inbound, '#7dd3fc');

    var p2delay = inbound.length * 800 + 400;
    if (processing.length) {
      setTimeout(function() { if (window._vizGraph) window.animateFlow(processing, '#f59e0b'); }, p2delay);
    }

    var p3delay = p2delay + Math.max(processing.length, 1) * 800 + 400;
    setTimeout(function() { if (window._vizGraph) window.animateFlow(outbound, '#10b981'); }, p3delay);
  } catch(e) {
    console.error('Trace animation failed:', e);
  }
};
