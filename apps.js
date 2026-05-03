// Loads apps.json, renders cards into #grid, wires tabs / search / actions.
// All filtering is in-memory so 1000+ apps stay snappy.

(async function () {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const search = document.getElementById('search');
  const visibleCount = document.getElementById('visible-count');
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const endpoint = document.body.dataset.endpoint;
  const spawnEndpoint = document.body.dataset.spawnEndpoint;
  const ideasActions = document.getElementById('ideas-actions');
  const newIdeaBtn = document.getElementById('new-idea-btn');

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

  const inStage = (a, st) => st === 'archived' ? a.archived : (!a.archived && a.stage === st);

  function setStage(s) {
    stage = s;
    history.replaceState(null, '', '#' + s);
    tabs.forEach(t => {
      const active = t.dataset.stage === s;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (ideasActions) ideasActions.hidden = (s !== 'idea');
    render();
  }

  tabs.forEach(t => t.addEventListener('click', () => setStage(t.dataset.stage)));

  if (newIdeaBtn) {
    if (!spawnEndpoint) {
      newIdeaBtn.disabled = true;
      newIdeaBtn.title = 'Spawn endpoint not configured';
    } else {
      newIdeaBtn.addEventListener('click', onNewIdea);
    }
  }

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

    const isLive = !a.archived;
    const showHero = isLive && (a.stage === 'prototype' || a.stage === 'published') && !!a.logo;

    // Hero (only for prototype/published with a logo image)
    let hero = '';
    if (showHero) {
      const img = `<img class="logo" src="${escapeAttr(a.logo)}" alt="${escapeAttr(a.name)} logo" loading="lazy">`;
      hero = a.github_pages_url
        ? `<a class="logo-link" href="${escapeAttr(a.github_pages_url)}"><div class="logo-wrap">${img}</div></a>`
        : `<div class="logo-wrap">${img}</div>`;
    }

    // Title (always linked when there's a github_pages_url and not archived)
    const titleInner = `<h2>${escapeHtml(a.name)}</h2>`;
    const titleHtml = (a.github_pages_url && !a.archived)
      ? `<a class="title-link" href="${escapeAttr(a.github_pages_url)}">${titleInner}</a>`
      : titleInner;

    // Body content varies by stage
    let bodyParts = [titleHtml];
    if (isLive && a.stage === 'idea') {
      if (a.pitch) bodyParts.push(`<p class="pitch">${escapeHtml(a.pitch)}</p>`);
      if (a.rationale) {
        bodyParts.push(`<p class="rationale"><span class="rationale-label">Rationale</span>${escapeHtml(a.rationale)}</p>`);
      }
    } else if (!isLive) {
      const blurb = a.description || a.pitch || '';
      if (blurb) bodyParts.push(`<p class="blurb">${escapeHtml(blurb)}</p>`);
    }
    // prototype/published live: title alone; the hero (above) carries the visual identity.

    // Meta line
    const metaParts = [stagePill];
    if (tags) metaParts.push(`<span class="tags">${tags}</span>`);
    if (tsDate) metaParts.push(`<time datetime="${escapeAttr(tsRaw || '')}">${escapeHtml(tsDate)}</time>`);
    bodyParts.push(`<div class="meta">${metaParts.join('')}</div>`);

    const buttonsHtml = actionButtons(a);

    card.innerHTML = `
      ${hero}
      <div class="body">${bodyParts.join('')}</div>
      ${buttonsHtml ? `<div class="actions">${buttonsHtml}</div>` : ''}
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
      return `<button class="btn btn-neutral" data-action="restore" type="button">Restore</button>`;
    }
    if (a.stage === 'idea') {
      return `<button class="btn btn-success" data-action="promote" type="button">Promote</button>` +
             `<button class="btn btn-danger" data-action="reject" type="button">Reject</button>`;
    }
    if (a.stage === 'prototype') {
      return `<button class="btn btn-success" data-action="publish" type="button">Publish</button>` +
             `<button class="btn btn-danger" data-action="archive" type="button">Archive</button>`;
    }
    if (a.stage === 'published') {
      return `<button class="btn btn-danger" data-action="archive" type="button">Archive</button>`;
    }
    return '';
  }

  async function onAction(card, a, action) {
    const slug = a.slug;
    let reason = '';
    if (action === 'reject' || action === 'archive') {
      const verb = action.charAt(0).toUpperCase() + action.slice(1);
      const result = await openTextModal({
        title: `${verb} “${a.name}”?`,
        label: 'Reason (optional)',
        placeholder: `why are you ${action}ing this app?`,
        confirmLabel: verb,
      });
      if (!result.confirmed) return;
      reason = result.text;
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

  async function onNewIdea() {
    const result = await openTextModal({
      title: 'Generate a new idea',
      label: 'Steering prompt (optional)',
      placeholder: 'Optional: nudge it toward a theme, mechanic, or vibe…',
      confirmLabel: 'Generate',
      confirmKind: 'positive',
      asyncSubmit: async (text) => {
        const resp = await fetch(spawnEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'apps', prompt: text })
        });
        if (!resp.ok) throw new Error('http ' + resp.status);
        return 'Queued — the factory will pick it up.';
      },
    });
    void result;
  }

  // Parameterized in-page modal. If `asyncSubmit` is provided the modal stays
  // open while the request runs and shows status; otherwise it resolves
  // immediately on confirm with {confirmed, text}.
  function openTextModal({ title, label, placeholder, confirmLabel, confirmKind, asyncSubmit }) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const confirmCls = 'confirm' + (confirmKind === 'positive' ? ' is-positive' : '');
      backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h3 id="modal-title">${escapeHtml(title)}</h3>
          <label for="modal-text">${escapeHtml(label)}</label>
          <textarea id="modal-text" placeholder="${escapeAttr(placeholder)}"></textarea>
          <p class="modal-status" aria-live="polite"></p>
          <div class="modal-actions">
            <button type="button" class="cancel">Cancel</button>
            <button type="button" class="${confirmCls}">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      `;
      const ta = backdrop.querySelector('#modal-text');
      const status = backdrop.querySelector('.modal-status');
      const cancelBtn = backdrop.querySelector('.cancel');
      const confirmBtn = backdrop.querySelector('.confirm');

      let busy = false;
      const finish = (confirmed) => {
        if (busy) return;
        const text = (ta.value || '').trim();
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        resolve({ confirmed, text: confirmed ? text : '' });
      };
      const onConfirm = async () => {
        if (busy) return;
        const text = (ta.value || '').trim();
        if (!asyncSubmit) { finish(true); return; }
        busy = true;
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        const origLabel = confirmBtn.textContent;
        confirmBtn.textContent = 'Working…';
        status.textContent = '';
        try {
          const msg = await asyncSubmit(text);
          status.textContent = msg || 'Done.';
          setTimeout(() => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            resolve({ confirmed: true, text });
          }, 1100);
        } catch (err) {
          busy = false;
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
          confirmBtn.textContent = origLabel;
          status.textContent = 'Failed: ' + (err && err.message || 'try again');
        }
      };
      const onKey = (e) => {
        if (e.key === 'Escape') finish(false);
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onConfirm();
      };
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finish(false); });
      cancelBtn.addEventListener('click', () => finish(false));
      confirmBtn.addEventListener('click', onConfirm);
      document.addEventListener('keydown', onKey);
      document.body.appendChild(backdrop);
      ta.focus();
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
