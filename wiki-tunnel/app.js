// Wiki Tunnel — daily race through Wikipedia. Skim-first: every page is a one-line
// summary + a scannable grid of link chips. No required reading. Optional "Full Article"
// toggle remains for people who want to dig in.
// Fully client-side. Wikipedia REST is the only network call.

(function () {
  'use strict';

  // ---------- Curated daily-pair pool ----------
  const HANDPICKED_PAIRS = [
    ['Banana','Vincent van Gogh'],
    ['Pizza','Mount Everest'],
    ['Coffee','Black hole'],
    ['Sushi','Eiffel Tower'],
    ['Chocolate','Albert Einstein'],
    ['Dog','Galaxy'],
    ['Tiger','Mozart'],
    ['Eagle','Pyramid'],
    ['Tea','Mars'],
    ['Bread','Tokyo'],
    ['Honey','William Shakespeare'],
    ['Cat','Saturn'],
    ['Penguin','Antarctica'],
    ['Apple','Isaac Newton'],
    ['Snake','Cleopatra'],
    ['Dolphin','Sydney'],
    ['Elephant','India'],
    ['Lion','Africa'],
    ['Horse','Genghis Khan'],
    ['Strawberry','Japan'],
    ['Volcano','Iceland'],
    ['Pasta','Italy'],
    ['Hamburger','Internet'],
    ['Tacos','Mexico'],
    ['Wine','France'],
    ['Beer','Germany'],
    ['Curry','India'],
    ['Croissant','Paris'],
    ['Owl','Harry Potter'],
    ['Bee','Honey'],
    ['Butterfly','Mexico'],
    ['Frog','France'],
    ['Spider','Spider-Man'],
    ['Smartphone','Steve Jobs'],
    ['Bicycle','France'],
    ['Camera','Photography'],
    ['Airplane','Wright brothers'],
    ['Television','Internet'],
    ['Sahara','Camel'],
    ['Iceland','Volcano'],
    ['Alps','Switzerland'],
    ['Hawaii','Surfing'],
    ['Niagara Falls','Canada'],
    ['Grand Canyon','Arizona'],
    ['Pacific Ocean','Hawaii'],
    ['Egypt','Pyramid'],
    ['Brazil','Football'],
    ['Stonehenge','Druid'],
    ['Taj Mahal','Mughal Empire'],
    ['Colosseum','Roman Empire'],
    ['Yoga','India'],
    ['Chess','Russia'],
    ['Marathon','Greece'],
    ['Olympic Games','Greece'],
    ['Skateboarding','California'],
    ['Tennis','Wimbledon'],
    ['Basketball','Michael Jordan'],
    ['Football','Pelé'],
    ['Photography','Camera'],
    ['Pablo Picasso','Spain'],
    ['Frida Kahlo','Mexico'],
    ['Bill Gates','Microsoft'],
    ['Elvis Presley','Memphis, Tennessee'],
    ['Michael Jackson','Motown'],
    ['Nelson Mandela','South Africa'],
    ['Mahatma Gandhi','India'],
    ['Marie Curie','Poland'],
    ['Leonardo da Vinci','Mona Lisa'],
    ['Charles Darwin','Galápagos Islands'],
    ['Nikola Tesla','Thomas Edison'],
    ['Beethoven','Germany'],
    ['Mozart','Austria'],
    ['Earth','Moon'],
    ['Mars','NASA'],
    ['Jupiter','Galileo Galilei'],
    ['Saturn','Cassini–Huygens'],
    ['Black hole','Albert Einstein'],
    ['Galaxy','Milky Way'],
    ['Star','Sun'],
    ['Coral reef','Great Barrier Reef'],
    ['Hurricane','Atlantic Ocean'],
    ['Tornado','Kansas'],
    ['Rainbow','Isaac Newton'],
    ['Lightning','Benjamin Franklin'],
    ['Snow','Antarctica'],
    ['Desert','Sahara'],
    ['Forest','Amazon rainforest'],
    ['Architecture','Colosseum'],
    ['Sculpture','Michelangelo'],
    ['Poetry','William Shakespeare'],
    ['Theatre','Greece'],
    ['Dance','Ballet'],
    ['Painting','Vincent van Gogh'],
    ['Music','Beethoven'],
    ['Literature','William Shakespeare']
  ];

  // ---------- Verdicts ----------
  const VERDICTS = [
    { name: 'Synapse Sniper',     min: 1,  max: 3,  tag: 'You saw the line before it existed. Direct, surgical, slightly suspicious.' },
    { name: 'Tunnel Visionary',   min: 4,  max: 6,  tag: 'You read the map by feel. The kind of brain that knows where Pope leads to Vatican leads to Italy.' },
    { name: 'Tangent Tourist',    min: 7,  max: 12, tag: 'You collected a few fascinating wrong turns. The route was scenic. The verdict is fond.' },
    { name: 'Lost Wanderer',      min: 13, max: 999,tag: 'You found yourself on the talk page of a kind of mushroom. We respect the journey.' },
    { name: "The Wanderer Who Knew When to Fold", min: -1, max: -1, tag: 'A small dignity, preserved.' }
  ];

  // ---------- Loading flavor ----------
  const LOADING_LINES = [
    'priming the tunnel...',
    'oiling the link hinges...',
    'sweeping the platform...',
    'warming up the wikipedia...',
    'paging the encyclopedia...',
    'checking signal at junction theta...',
    'route plotted, fetching ink...'
  ];
  function flavorLine() {
    return LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)];
  }

  // ---------- Utility ----------
  function todayISO() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function dateSeed(iso) {
    let h = 0;
    for (let i = 0; i < iso.length; i++) h = (Math.imul(31, h) + iso.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function pairForToday() {
    const iso = todayISO();
    const seed = dateSeed(iso);
    const pair = HANDPICKED_PAIRS[seed % HANDPICKED_PAIRS.length];
    return { iso, seed, start: pair[0], end: pair[1] };
  }
  function normalizeTitle(t) {
    if (!t) return '';
    return decodeURIComponent(t).replace(/_/g, ' ').trim();
  }
  function sameTitle(a, b) {
    return normalizeTitle(a).toLowerCase() === normalizeTitle(b).toLowerCase();
  }
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
  const STOP_WORDS = new Set([
    'the','a','an','of','and','or','in','on','at','to','for','with','by','from','is','are',
    'was','were','be','been','being','as','that','this','these','those','it','its','he','she',
    'they','them','his','her','their','which','who','whom','what','when','where','why','how'
  ]);
  function tokens(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).filter(w => !STOP_WORDS.has(w) && w.length > 1);
  }
  function pickIcon(title) {
    const t = (title || '').toLowerCase();
    const map = [
      [/banana|apple|strawberry|pizza|sushi|bread|honey|chocolate|coffee|tea|hamburger|tacos|curry|wine|beer|croissant|cheese/, '🍌'],
      [/dog/, '🐕'], [/cat/, '🐈'], [/tiger|lion/, '🦁'], [/elephant/, '🐘'], [/giraffe/, '🦒'], [/penguin/, '🐧'],
      [/dolphin|shark|whale|octopus/, '🐬'], [/eagle|owl|bird/, '🦅'], [/bee/, '🐝'], [/butterfly/, '🦋'],
      [/spider/, '🕷️'], [/frog/, '🐸'], [/snake/, '🐍'], [/horse/, '🐴'], [/cow/, '🐄'], [/chicken/, '🐔'],
      [/earth|world/, '🌍'], [/moon/, '🌙'], [/sun/, '☀️'], [/mars/, '🔴'], [/jupiter|saturn|planet/, '🪐'],
      [/black hole/, '🕳️'], [/galaxy|milky/, '🌌'], [/star/, '⭐'], [/comet/, '☄️'],
      [/everest|mountain|alps/, '🏔️'], [/amazon|forest|jungle/, '🌳'], [/sahara|desert/, '🏜️'],
      [/ocean|pacific|sea/, '🌊'], [/niagara|waterfall/, '💧'], [/grand canyon|canyon/, '🏞️'],
      [/antarctica|snow/, '❄️'], [/iceland|volcano/, '🌋'], [/hawaii/, '🌺'],
      [/france|paris/, '🥖'], [/japan|tokyo/, '🗾'], [/brazil|rio/, '🇧🇷'], [/egypt|cairo/, '🐪'],
      [/italy|rome/, '🍝'], [/germany/, '🍺'], [/australia|sydney/, '🦘'], [/canada/, '🍁'],
      [/india/, '🪔'], [/mexico/, '🌮'], [/london|england|britain|uk/, '☂️'], [/moscow|russia/, '🪆'], [/istanbul|turkey/, '🕌'],
      [/einstein|newton|tesla|curie|darwin|scientist/, '🧪'], [/da vinci|picasso|kahlo|van gogh|art/, '🎨'],
      [/shakespeare|poet|literature|book/, '📖'], [/mozart|beethoven|music/, '🎼'],
      [/gandhi|mandela|lincoln|cleopatra|king|queen|emperor/, '👑'],
      [/jobs|gates|microsoft|apple inc|computer|internet|smartphone|tech/, '💻'],
      [/elvis|jackson|singer/, '🎤'],
      [/football|soccer|fifa|pelé/, '⚽'], [/basketball|jordan/, '🏀'], [/tennis|wimbledon/, '🎾'],
      [/chess/, '♟️'], [/olympic|marathon|greece/, '🏛️'], [/surf|skate|yoga/, '🏄'],
      [/film|movie|cinema/, '🎬'], [/theatre|theater/, '🎭'], [/photography|camera/, '📷'],
      [/sculpture|michelangelo/, '🗿'], [/dance|ballet/, '💃'], [/painting/, '🖼️'],
      [/television/, '📺'], [/radio/, '📻'], [/telephone|phone/, '📞'],
      [/bicycle|bike/, '🚲'], [/car|automobile/, '🚗'], [/airplane|wright/, '✈️'],
      [/earthquake/, '⛰️'], [/hurricane|tornado/, '🌪️'], [/rainbow/, '🌈'], [/lightning/, '⚡'],
      [/coral|reef|barrier/, '🪸'],
      [/pyramid|sphinx/, '🔺'], [/eiffel/, '🗼'], [/statue of liberty/, '🗽'], [/great wall/, '🧱'],
      [/colosseum|roman/, '🏟️'], [/stonehenge|druid/, '🪨'], [/taj mahal|mughal/, '🕌'],
      [/machu picchu|inca/, '⛰️']
    ];
    for (const [re, emoji] of map) if (re.test(t)) return emoji;
    return '📄';
  }

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const bootScreen = $('boot');
  const gameScreen = $('game');
  const resultScreen = $('result');
  const incomingScreen = $('incoming');

  // ---------- App state ----------
  const state = {
    iso: null,
    seed: 0,
    start: '',
    end: '',
    current: '',
    trail: [],
    clicks: 0,
    startTime: 0,
    timerInterval: null,
    finished: false,
    folded: false,
    mode: 'skim',           // 'skim' | 'full'
    hintUsed: false,
    pageCache: {}           // title -> { summary, links[], fullHtml }
  };

  // ---------- Wikipedia fetch ----------
  async function resolveRedirect(title) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=${encodeURIComponent(title)}&origin=*`;
      const r = await fetch(url);
      const j = await r.json();
      const pages = j && j.query && j.query.pages;
      if (pages) {
        const k = Object.keys(pages)[0];
        if (k && pages[k].title && !pages[k].missing) return pages[k].title;
      }
    } catch (e) { /* fall through */ }
    return title;
  }

  async function fetchSummary(finalTitle) {
    // REST summary gives us a clean lead extract quickly.
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(finalTitle.replace(/ /g, '_'))}?redirect=true`;
    try {
      const r = await fetch(url);
      if (!r.ok) return '';
      const j = await r.json();
      return (j && (j.extract || j.description)) || '';
    } catch (e) { return ''; }
  }

  async function fetchArticleHtml(finalTitle) {
    const restUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(finalTitle.replace(/ /g, '_'))}`;
    const resp = await fetch(restUrl, { headers: { 'Accept': 'text/html' } });
    if (!resp.ok) throw new Error(`Wikipedia returned ${resp.status} for "${finalTitle}"`);
    return resp.text();
  }

  async function fetchPage(rawTitle) {
    const title = normalizeTitle(rawTitle);
    if (state.pageCache[title.toLowerCase()]) {
      const c = state.pageCache[title.toLowerCase()];
      return { finalTitle: c.finalTitle, summary: c.summary, links: c.links, fullHtml: c.fullHtml };
    }
    const finalTitle = await resolveRedirect(title);
    const [rawHtml, summary] = await Promise.all([
      fetchArticleHtml(finalTitle),
      fetchSummary(finalTitle)
    ]);
    const parsed = parseArticle(rawHtml, finalTitle);
    const entry = { finalTitle, summary: summary || parsed.leadText, links: parsed.links, fullHtml: parsed.fullHtml };
    state.pageCache[title.toLowerCase()] = entry;
    state.pageCache[finalTitle.toLowerCase()] = entry;
    return entry;
  }

  // Parse the article: extract a lead paragraph, an ordered+deduped list of internal
  // article links (with the first sentence of surrounding context), and a sanitized
  // full-article HTML blob for the optional read view.
  function parseArticle(rawHtml, articleTitle) {
    let stripped = rawHtml
      .replace(/<base[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '');

    const parser = new DOMParser();
    const doc = parser.parseFromString('<div id="x">' + stripped + '</div>', 'text/html');
    const root = doc.getElementById('x') || doc.body;

    const killSelectors = [
      'figure','table','img','audio','video',
      '.infobox','.navbox','.sidebar','.metadata','.reference','.references','.reflist',
      '.mw-editsection','.hatnote','.ambox','.gallery','.toc','#toc','.thumb','.noprint',
      'sup.reference','.mw-cite-backlink','style','link','meta','script','figcaption',
      'div[role="navigation"]','.shortdescription','.mw-empty-elt'
    ];
    killSelectors.forEach(sel => root.querySelectorAll(sel).forEach(n => n.remove()));

    // Build a list of internal links in document order.
    const seen = new Set();
    const links = [];
    const anchors = root.querySelectorAll('a');
    anchors.forEach(a => {
      const href = a.getAttribute('href') || '';
      const rel = a.getAttribute('rel') || '';
      let target = '';
      let internal = false;
      if (rel.includes('mw:WikiLink') || /^\.\//.test(href)) {
        internal = true;
        target = href.replace(/^\.\//, '').split('#')[0];
      } else if (/^\/wiki\//.test(href)) {
        internal = true;
        target = href.replace(/^\/wiki\//, '').split('#')[0];
      }

      if (!internal || !target) {
        a.classList.add('wt-dead');
        a.removeAttribute('href');
        a.setAttribute('tabindex', '-1');
        return;
      }

      if (/^(File|Image|Help|Wikipedia|WP|Special|Category|Talk|User|Portal|Template|Module):/.test(target)) {
        a.classList.add('wt-dead');
        a.removeAttribute('href');
        a.setAttribute('tabindex', '-1');
        return;
      }

      const decoded = normalizeTitle(target);
      const label = (a.textContent || decoded).trim();
      a.classList.add('wt-link');
      a.setAttribute('data-wt-target', decoded);
      a.setAttribute('href', '#');
      a.setAttribute('rel', 'noopener');

      const key = decoded.toLowerCase();
      if (!seen.has(key) && decoded && decoded !== articleTitle) {
        seen.add(key);
        links.push({ title: decoded, label });
      }
    });

    // First paragraph text for fallback summary.
    let leadText = '';
    const firstP = root.querySelector('p');
    if (firstP) leadText = (firstP.textContent || '').trim();

    // Prepend a header for the full-article view.
    const header = doc.createElement('h1');
    header.textContent = articleTitle;
    root.insertBefore(header, root.firstChild);

    return { leadText, links, fullHtml: root.innerHTML };
  }

  // ---------- Hint: rank links by semantic closeness to the goal ----------
  function rankLinksForHint(links, goal) {
    const goalTokens = new Set(tokens(goal));
    const goalLower = goal.toLowerCase();
    return links.map(l => {
      const lt = l.title.toLowerCase();
      if (lt === goalLower) return { link: l, score: 9999 };
      let score = 0;
      for (const t of tokens(l.title)) if (goalTokens.has(t)) score += 10;
      if (lt.includes(goalLower) || goalLower.includes(lt)) score += 5;
      // Hub bonuses — country, person, domain pages often shorten the path.
      if (/\b(country|empire|continent|ocean|language|religion)\b/.test(lt)) score += 1;
      return { link: l, score };
    }).sort((a, b) => b.score - a.score);
  }

  // ---------- Render: skim view or full-article view ----------
  function renderPage(entry) {
    const articleEl = $('article');
    articleEl.classList.toggle('mode-skim', state.mode === 'skim');
    articleEl.classList.toggle('mode-full', state.mode === 'full');
    if (state.mode === 'skim') {
      renderSkim(entry);
    } else {
      renderFull(entry);
    }
  }

  function renderSkim(entry) {
    const articleEl = $('article');
    const goalLower = state.end.toLowerCase();
    const summary = entry.summary || '';
    const shortSummary = summary.length > 260 ? summary.slice(0, 257).replace(/\s+\S*$/, '') + '…' : summary;

    // Split links into goal-matching (shown first, highlighted) and the rest.
    const goalMatches = [];
    const rest = [];
    entry.links.forEach(l => {
      if (l.title.toLowerCase() === goalLower) goalMatches.push(l);
      else rest.push(l);
    });

    const limit = 60; // show up to 60 link chips — the rest collapses.
    const shown = rest.slice(0, limit);
    const hidden = rest.slice(limit);

    const html = [];
    html.push('<div class="skim">');
    html.push(`<h1 class="skim-title">${escapeHtml(entry.finalTitle)}</h1>`);
    if (shortSummary) html.push(`<p class="skim-summary">${escapeHtml(shortSummary)}</p>`);

    if (goalMatches.length) {
      html.push('<div class="skim-goal-band">');
      html.push('<div class="skim-goal-lbl">GOAL LINK ON THIS PAGE</div>');
      html.push('<div class="chip-grid">');
      goalMatches.forEach(l => {
        html.push(`<button type="button" class="chip chip-goal" data-wt-target="${escapeAttr(l.title)}">${escapeHtml(l.label || l.title)} <span class="chip-arrow">→</span></button>`);
      });
      html.push('</div></div>');
    }

    html.push('<div class="skim-linklbl">TUNNEL DOORS ON THIS PAGE</div>');
    html.push('<div class="chip-grid">');
    shown.forEach(l => {
      const goalClass = l.title.toLowerCase() === goalLower ? ' chip-goal' : '';
      html.push(`<button type="button" class="chip${goalClass}" data-wt-target="${escapeAttr(l.title)}">${escapeHtml(l.label || l.title)}</button>`);
    });
    html.push('</div>');

    if (hidden.length) {
      html.push(`<button type="button" class="op-btn skim-more" id="skim-more">SHOW ${hidden.length} MORE DOORS</button>`);
      html.push('<div class="chip-grid hidden" id="skim-more-grid">');
      hidden.forEach(l => {
        const goalClass = l.title.toLowerCase() === goalLower ? ' chip-goal' : '';
        html.push(`<button type="button" class="chip${goalClass}" data-wt-target="${escapeAttr(l.title)}">${escapeHtml(l.label || l.title)}</button>`);
      });
      html.push('</div>');
    }
    html.push('</div>');
    articleEl.innerHTML = html.join('');

    const more = $('skim-more');
    if (more) {
      more.addEventListener('click', () => {
        const grid = $('skim-more-grid');
        if (grid) grid.classList.remove('hidden');
        more.remove();
      });
    }
    hookChipLinks();
  }

  function renderFull(entry) {
    const articleEl = $('article');
    articleEl.innerHTML = entry.fullHtml;
    // Mark goal links in the prose.
    articleEl.querySelectorAll('a.wt-link').forEach(a => {
      const t = a.getAttribute('data-wt-target');
      if (sameTitle(t, state.end)) a.classList.add('is-goal');
    });
    hookArticleLinks();
  }

  function hookChipLinks() {
    document.querySelectorAll('#article .chip').forEach(b => {
      b.addEventListener('click', onChipClick);
    });
  }
  function onChipClick(e) {
    e.preventDefault();
    if (state.finished) return;
    const target = e.currentTarget.getAttribute('data-wt-target');
    if (!target) return;
    navigateTo(target, false);
  }

  function hookArticleLinks() {
    document.querySelectorAll('#article a.wt-link').forEach(a => {
      a.addEventListener('click', onLinkClick);
    });
  }
  function onLinkClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (state.finished) return;
    const target = e.currentTarget.getAttribute('data-wt-target');
    if (!target) return;
    navigateTo(target, false);
  }

  // ---------- Navigation ----------
  async function navigateTo(title, isInitial) {
    const articleEl = $('article');
    articleEl.innerHTML = `
      <div class="loader">
        <span class="loader-dot"></span><span class="loader-dot"></span><span class="loader-dot"></span>
        <div class="loader-text">${flavorLine()}</div>
      </div>`;
    $('tunnel-title').textContent = title;
    try {
      const entry = await fetchPage(title);
      state.current = normalizeTitle(entry.finalTitle);
      state.trail.push(state.current);
      if (!isInitial) state.clicks += 1;
      renderTrail();
      $('click-count').textContent = state.clicks;
      $('tunnel-title').textContent = entry.finalTitle;
      renderPage(entry);
      articleEl.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      if (sameTitle(state.current, state.end)) {
        finishWin();
      }
    } catch (e) {
      articleEl.innerHTML = `
        <div class="loader">
          <div class="loader-text">tunnel collapsed at "${escapeHtml(title)}". try a different door.</div>
          <div style="margin-top:14px"><button class="op-btn" id="recover-back">&larr; BACK ONE STOP</button></div>
        </div>`;
      const rb = $('recover-back');
      if (rb) rb.addEventListener('click', goBack);
    }
  }

  function renderTrail() {
    const trailEl = $('trail');
    trailEl.innerHTML = '';
    state.trail.forEach((title, i) => {
      if (i > 0) {
        const conn = document.createElement('span');
        conn.className = 'conn';
        conn.textContent = '›';
        trailEl.appendChild(conn);
      }
      const stop = document.createElement('span');
      stop.className = 'stop';
      if (i === 0) stop.classList.add('start');
      if (i === state.trail.length - 1) stop.classList.add('cur');
      if (sameTitle(title, state.end)) stop.classList.add('end');
      stop.textContent = title;
      trailEl.appendChild(stop);
    });
  }

  function goBack() {
    if (state.finished) return;
    if (state.trail.length <= 1) return;
    state.trail.pop();
    state.clicks = Math.max(0, state.clicks - 1);
    const prev = state.trail.pop();
    navigateTo(prev, false);
  }

  function restartRun() {
    if (!confirm('Restart this run? Your jumps reset.')) return;
    clearInterval(state.timerInterval);
    state.trail = [];
    state.clicks = 0;
    state.finished = false;
    state.folded = false;
    state.hintUsed = false;
    state.startTime = Date.now();
    startTimer();
    navigateTo(state.start, true);
  }

  function fold() {
    if (!confirm('Fold and end this run? You can still share what you did.')) return;
    state.folded = true;
    finishGame(true);
  }

  function toggleMode() {
    state.mode = state.mode === 'skim' ? 'full' : 'skim';
    $('op-mode').textContent = state.mode === 'skim' ? 'FULL ARTICLE' : 'SKIM VIEW';
    const key = (state.current || '').toLowerCase();
    const entry = state.pageCache[key];
    if (entry) renderPage(entry);
  }

  function useHint() {
    if (state.finished) return;
    const key = (state.current || '').toLowerCase();
    const entry = state.pageCache[key];
    if (!entry) return;
    const ranked = rankLinksForHint(entry.links, state.end);
    const top = ranked.filter(r => r.score > 0).slice(0, 3);
    const targets = new Set(top.map(r => r.link.title.toLowerCase()));
    // Highlight matching chips / article links.
    let highlighted = 0;
    document.querySelectorAll('#article .chip').forEach(b => {
      const t = (b.getAttribute('data-wt-target') || '').toLowerCase();
      if (targets.has(t)) { b.classList.add('chip-hint'); highlighted++; }
    });
    document.querySelectorAll('#article a.wt-link').forEach(a => {
      const t = (a.getAttribute('data-wt-target') || '').toLowerCase();
      if (targets.has(t)) { a.classList.add('is-hint'); highlighted++; }
    });
    state.hintUsed = true;
    const btn = $('op-hint');
    if (btn) {
      if (highlighted === 0) {
        btn.textContent = 'NO HINT';
        btn.disabled = true;
      } else {
        btn.textContent = `HINT (${highlighted})`;
      }
    }
  }

  function startTimer() {
    const t = $('timer');
    state.timerInterval = setInterval(() => {
      t.textContent = fmtTime(Date.now() - state.startTime);
    }, 500);
  }

  function finishWin() {
    finishGame(false);
    const f = document.createElement('div');
    f.className = 'win-flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  function finishGame(folded) {
    state.finished = true;
    clearInterval(state.timerInterval);
    const elapsed = Date.now() - state.startTime;

    let verdict;
    if (folded) verdict = VERDICTS[4];
    else verdict = VERDICTS.find(v => state.clicks >= v.min && state.clicks <= v.max) || VERDICTS[3];

    $('result-name').textContent = verdict.name;
    $('result-tag').textContent = verdict.tag;
    $('r-clicks').textContent = state.clicks;
    $('r-time').textContent = fmtTime(elapsed);
    $('r-seed').textContent = String(state.seed).slice(-5);
    $('result-stamp').textContent = folded ? 'FOLDED' : 'ARRIVED';

    const trail = state.trail.slice();
    if (trail.length === 0) trail.push(state.start);
    const ends = [trail[0], trail[trail.length - 1]];
    let mids = [];
    if (trail.length >= 4) {
      const a = Math.floor(trail.length / 3);
      const b = Math.floor((2 * trail.length) / 3);
      mids = [trail[a], trail[b]];
    } else if (trail.length === 3) {
      mids = [trail[1], trail[1]];
    } else if (trail.length === 2) {
      mids = [trail[0], trail[1]];
    } else {
      mids = [trail[0], trail[0]];
    }
    const fourIcons = [ends[0], mids[0], mids[1], ends[1]];

    const trailEl = $('result-trail');
    trailEl.innerHTML = '';
    fourIcons.forEach((t, i) => {
      if (i > 0) {
        const arr = document.createElement('span');
        arr.className = 'arr';
        arr.textContent = '→';
        trailEl.appendChild(arr);
      }
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = pickIcon(t);
      icon.title = t;
      trailEl.appendChild(icon);
      const lbl = document.createElement('span');
      lbl.style.fontSize = '11px';
      lbl.style.color = 'var(--ink-mute)';
      lbl.textContent = t.length > 18 ? t.slice(0, 17) + '…' : t;
      trailEl.appendChild(lbl);
    });

    const cap = `${state.start} → ${state.end} in ${state.clicks}. I'm a ${verdict.name}. Today's Wiki Tunnel:`;
    $('result-cap').textContent = `"${cap}"`;

    const payload = {
      d: state.iso,
      r: state.trail,
      c: state.clicks,
      v: verdict.name,
      f: folded ? 1 : 0
    };
    const frag = encodeShare(payload);
    history.replaceState(null, '', '#' + frag);

    bootScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    incomingScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
  }

  function encodeShare(obj) {
    try {
      const json = JSON.stringify(obj);
      const b64 = btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return 'r=' + b64;
    } catch (e) {
      return '';
    }
  }
  function decodeShare(frag) {
    if (!frag || frag.indexOf('r=') !== 0) return null;
    try {
      let b64 = frag.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------- Bootstrapping ----------
  function setupBootScreen(p) {
    $('boot-date').textContent = p.iso;
    $('boot-seed').textContent = String(p.seed).slice(-5);
    $('boot-start').textContent = p.start;
    $('boot-end').textContent = p.end;
    $('boot-foot').textContent = flavorLine();
    $('hud-seed').textContent = String(p.seed).slice(-5);
    $('hud-start').textContent = p.start;
    $('hud-end').textContent = p.end;
  }

  function setupIncoming(payload, p) {
    const trail = (payload.r && payload.r.length) ? payload.r : [p.start, p.end];
    const ends = [trail[0], trail[trail.length - 1]];
    let mids;
    if (trail.length >= 4) {
      const a = Math.floor(trail.length / 3);
      const b = Math.floor((2 * trail.length) / 3);
      mids = [trail[a], trail[b]];
    } else if (trail.length === 3) {
      mids = [trail[1], trail[1]];
    } else {
      mids = [ends[0], ends[1]];
    }
    const four = [ends[0], mids[0], mids[1], ends[1]];
    const incTrail = $('inc-trail');
    incTrail.innerHTML = '';
    four.forEach((t, i) => {
      if (i > 0) {
        const arr = document.createElement('span');
        arr.className = 'arr';
        arr.textContent = '→';
        incTrail.appendChild(arr);
      }
      const span = document.createElement('span');
      span.textContent = pickIcon(t);
      span.title = t;
      incTrail.appendChild(span);
    });
    $('inc-clicks').textContent = payload.c != null ? payload.c : '?';
    $('inc-verdict').textContent = payload.v || '—';
    $('inc-pair').textContent = `${p.start} → ${p.end}`;
  }

  function startGame(p) {
    state.iso = p.iso;
    state.seed = p.seed;
    state.start = p.start;
    state.end = p.end;
    state.trail = [];
    state.clicks = 0;
    state.finished = false;
    state.folded = false;
    state.mode = 'skim';
    state.hintUsed = false;
    state.startTime = Date.now();
    $('op-mode').textContent = 'FULL ARTICLE';
    const hintBtn = $('op-hint');
    if (hintBtn) { hintBtn.textContent = 'HINT'; hintBtn.disabled = false; }
    startTimer();
    bootScreen.classList.add('hidden');
    incomingScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    navigateTo(p.start, true);
  }

  function init() {
    const p = pairForToday();
    setupBootScreen(p);

    $('boot-go').addEventListener('click', () => startGame(p));
    $('op-back').addEventListener('click', goBack);
    $('op-restart').addEventListener('click', restartRun);
    $('op-fold').addEventListener('click', fold);
    $('op-mode').addEventListener('click', toggleMode);
    $('op-hint').addEventListener('click', useHint);
    $('result-replay').addEventListener('click', () => {
      history.replaceState(null, '', location.pathname);
      startGame(p);
    });

    const frag = location.hash.replace(/^#/, '');
    const payload = decodeShare(frag);
    if (payload) {
      setupIncoming(payload, p);
      bootScreen.classList.add('hidden');
      incomingScreen.classList.remove('hidden');
      $('inc-go').addEventListener('click', () => {
        history.replaceState(null, '', location.pathname);
        startGame(p);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // ---------- Share ----------
  window.share = function () {
    const cap = $('result-cap').textContent.replace(/^"|"$/g, '');
    const text = cap + ' ' + location.href;
    if (navigator.share) {
      navigator.share({ title: document.title, text: cap, url: location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => { try { alert('Run copied to clipboard.'); } catch (e) {} },
        () => { try { alert(text); } catch (e) {} }
      );
    } else {
      try { alert(text); } catch (e) {}
    }
  };
})();
