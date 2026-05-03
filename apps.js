// Loads apps.json, renders cards into #grid, wires tabs / search / actions.
// All filtering is in-memory so 1000+ apps stay snappy.

(async function () {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const search = document.getElementById('search');
  const visibleCount = document.getElementById('visible-count');
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const endpoint = document.body.dataset.endpoint;

  // Restore stage from hash (e.g. #archived) or default to "prototype".
  const initialStage = (location.hash || '').replace('#', '') || 'prototype';
  let stage = ['idea','prototype','published','archived'].includes(initialStage) ? initialStage : 'prototype';
  let query = '';
  let apps = [];

  try {
    const resp = await fetch('apps.json', { cache: 'no-store' });
    apps = await resp.json();
  } catch (err) {
    grid.innerHTML = '<p class="warning">failed to load apps.json — try reloading.</p>';
    return;
  }

  // Sort: most-recently-updated first within each filter.
  apps.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  // Stable bucketing for fast filter.
  const inStage = (a, st) => st === 'archived' ? a.archived : (!a.archived && a.stage === st);

  function setStage(s) {
    stage = s;
    history.replaceState(null, '', '#' + s);
    tabs.forEach(t => {
      const active = t.dataset.stage === s;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    render();
  }

  tabs.forEach(t => t.addEventListener('click', () => setStage(t.dataset.stage)));

  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    render();
  });

  // Initial tab styling, then first paint.
  setStage(stage);

  function render() {
    const q = query;
    let shown = 0;
    const frag = document.createDocumentFragment();
    for (const a of apps) {
      if (!inStage(a, stage)) continue;
      if (q && !matchesQuery(a, q)) continue;
      frag.appendChild(buildCard(a));
      shown++;
    }
    grid.replaceChildren(frag);
    empty.hidden = shown !== 0;
    visibleCount.textContent = shown ? `${shown} showing` : '';
  }

  function matchesQuery(a, q) {
    return (a.name || '').toLowerCase().includes(q)
      || (a.category || '').toLowerCase().includes(q)
      || (a.mechanic || '').toLowerCase().includes(q)
      || (a.output_form || '').toLowerCase().includes(q)
      || (a.pitch || '').toLowerCase().includes(q)
      || (a.description || '').toLowerCase().includes(q)
      || (a.slug || '').toLowerCase().includes(q);
  }

  function buildCard(a) {
    const card = document.createElement('article');
    card.className = 'card';
    if (a.archived) card.classList.add('is-archived');
    card.dataset.slug = a.slug;
    card.dataset.stage = a.archived ? 'archived' : a.stage;

    const stagePill = a.archived
      ? `<span class="stage-pill archived">archived${a.archived_from_stage ? ' · ' + escapeHtml(a.archived_from_stage) : ''}</span>`
      : `<span class="stage-pill ${a.stage}">${escapeHtml(a.stage)}</span>`;

    const tags = [a.category, a.mechanic, a.output_form].filter(Boolean).map(escapeHtml).join(' · ');
    const tsRaw = a.archived ? a.archived_at : (a.promoted_to_published_at || a.promoted_to_prototype_at || a.created_at);
    const tsDate = (tsRaw || '').slice(0, 10);

    const titleInner = `<h2>${escapeHtml(a.name)}</h2>`;
    const titleHtml = a.github_pages_url && !a.archived
      ? `<a class="title-link" href="${escapeAttr(a.github_pages_url)}">${titleInner}</a>`
      : titleInner;

    // Body shape varies by stage:
    //   idea       -> full pitch + full rationale, no truncation
    //   prototype  -> logo (if any) + name only, no description
    //   published  -> same as prototype
    //   archived   -> existing behavior: short blurb (description/pitch)
    let body = '';
    const isLive = !a.archived;
    if (isLive && a.stage === 'idea') {
      if (a.pitch) body += `<p class="pitch">${escapeHtml(a.pitch)}</p>`;
      if (a.rationale) {
        body += `<p class="rationale"><span class="rationale-label">RATIONALE</span>${escapeHtml(a.rationale)}</p>`;
      }
    } else if (isLive && (a.stage === 'prototype' || a.stage === 'published')) {
      if (a.logo) {
        card.classList.add('has-logo');
        const img = `<img class="logo" src="${escapeAttr(a.logo)}" alt="${escapeAttr(a.name)} logo" loading="lazy">`;
        body += a.github_pages_url
          ? `<a class="title-link" href="${escapeAttr(a.github_pages_url)}">${img}</a>`
          : img;
      }
      // No description: title alone (or title + logo) is the whole identity here.
    } else {
      // archived
      const blurb = a.description || a.pitch || '';
      if (blurb) body += `<p class="blurb">${escapeHtml(blurb)}</p>`;
    }

    // For prototype/published, render the logo BEFORE the title so it reads
    // top-to-bottom as logo → name. For idea, the title comes first then body.
    let inner;
    if (isLive && (a.stage === 'prototype' || a.stage === 'published')) {
      inner = `${body}${titleHtml}`;
    } else {
      inner = `${titleHtml}${body}`;
    }

    card.innerHTML = `
      ${inner}
      ${tags ? `<p class="tags">${tags}</p>` : ''}
      <p class="meta">${stagePill}${tsDate ? `<time datetime="${escapeAttr(tsRaw || '')}">${escapeHtml(tsDate)}</time>` : ''}</p>
      <div class="actions">${actionButtons(a)}</div>
      <p class="status" aria-live="polite"></p>
    `;
    card.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => onAction(card, a, btn.dataset.action));
    });
    return card;
  }

  function actionButtons(a) {
    if (!endpoint) return '';
    if (a.archived) {
      return `<button class="restore" data-action="restore" type="button">RESTORE</button>`;
    }
    if (a.stage === 'idea') {
      return `<button class="promote" data-action="promote" type="button">PROMOTE</button>` +
             `<button class="reject" data-action="reject" type="button">REJECT</button>`;
    }
    if (a.stage === 'prototype') {
      return `<button class="publish" data-action="publish" type="button">PUBLISH</button>` +
             `<button class="archive" data-action="archive" type="button">ARCHIVE</button>`;
    }
    if (a.stage === 'published') {
      return `<button class="archive" data-action="archive" type="button">ARCHIVE</button>`;
    }
    return '';
  }

  async function onAction(card, a, action) {
    const slug = a.slug;
    let reason = '';
    // Destructive actions get a confirmation modal with a reason field.
    if (action === 'reject' || action === 'archive') {
      const result = await openReasonModal(action, a.name);
      if (!result.confirmed) return;
      reason = result.reason;
    }

    setStatus(card, msgFor(action) + '…');
    card.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action, reason })
      });
      if (!resp.ok) throw new Error('http ' + resp.status);
      setStatus(card, doneMsg(action));
      card.classList.add('fading');
    } catch (err) {
      setStatus(card, 'failed: ' + err.message);
      card.querySelectorAll('button').forEach(b => { b.disabled = false; });
    }
  }

  // In-page modal that returns {confirmed, reason}. Resolves on Confirm/Cancel,
  // Escape key, or backdrop click. Supports a single open modal at a time.
  function openReasonModal(action, name) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const verb = action.charAt(0).toUpperCase() + action.slice(1);
      backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h3 id="modal-title">${escapeHtml(verb)} &ldquo;${escapeHtml(name)}&rdquo;?</h3>
          <label for="modal-reason">Reason (optional)</label>
          <textarea id="modal-reason" placeholder="why are you ${escapeHtml(action)}ing this app?"></textarea>
          <div class="modal-actions">
            <button type="button" class="cancel">CANCEL</button>
            <button type="button" class="confirm">${escapeHtml(verb).toUpperCase()}</button>
          </div>
        </div>
      `;
      const close = (confirmed) => {
        const reason = (backdrop.querySelector('#modal-reason').value || '').trim();
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        resolve({ confirmed, reason: confirmed ? reason : '' });
      };
      const onKey = (e) => {
        if (e.key === 'Escape') close(false);
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) close(true);
      };
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
      backdrop.querySelector('.cancel').addEventListener('click', () => close(false));
      backdrop.querySelector('.confirm').addEventListener('click', () => close(true));
      document.addEventListener('keydown', onKey);
      document.body.appendChild(backdrop);
      backdrop.querySelector('#modal-reason').focus();
    });
  }

  function setStatus(card, m) {
    const s = card.querySelector('.status');
    if (s) s.textContent = m;
  }

  function msgFor(a) {
    return ({
      promote: 'queued for build',
      reject:  'rejecting',
      publish: 'publishing',
      archive: 'archiving',
      restore: 'restoring',
    })[a] || a + 'ing';
  }
  function doneMsg(a) {
    return ({
      promote: 'queued — appears as prototype after build',
      reject:  'rejected',
      publish: 'published',
      archive: 'archived',
      restore: 'restored',
    })[a] || 'done';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
