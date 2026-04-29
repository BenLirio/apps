// Group Chat Energy Audit — deterministic role selection + AI flourish for citations/notes
// One-mechanic: paste messages / pick chips, receive a formal inspection report.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'group-chat-energy-audit';

// --------- Behavior chips (curated, evocative, shareable) ----------
const CHIPS = [
  'always sends memes',
  'leaves on read for 3 days',
  'plans everything',
  'lowercase only',
  'replies at 3am',
  'asks "wait what"',
  'sends voice memos',
  'perfect punctuation',
  'starts every drama',
  'the group mom',
  'posts screenshots of DMs',
  'sends links, no context',
  'only uses emojis',
  'double-texts constantly',
  'peacekeeper',
  'goes silent for weeks',
  'reacts, never replies',
  'tells the same story twice',
  'sends the weather',
  'always "on my way"',
  'corrects grammar',
  'types in all caps'
];

// --------- Eight roles (deterministic, seeded by combined input) -----
const ROLES = [
  {
    name: 'Certified Chaos Engineer',
    tag: 'For generating statistically significant drama at ambient cost.',
    hazard: 5,
    hazLabel: 'CLASS V — UNCONTAINED',
    stamp: 'HAZARDOUS',
    sig: 'M. Fogbottom',
    inspector: 'Insp. Fogbottom',
    keywords: ['drama', 'caps', '3am', 'screenshots', 'double-texts'],
    fallbackNotes: 'Subject repeatedly introduces novel variables into a stable system. Inspector advises the chat to install a fuse. Overall compliance: theatrical.'
  },
  {
    name: 'The Silent Auditor',
    tag: 'Reads everything. Replies to nothing. Knows more than anyone.',
    hazard: 2,
    hazLabel: 'CLASS II — OBSERVATIONAL',
    stamp: 'ON RECORD',
    sig: 'K. Durnsworth',
    inspector: 'Insp. Durnsworth',
    keywords: ['read', 'silent', 'reacts', 'weeks'],
    fallbackNotes: 'Subject maintains full situational awareness without emitting detectable signal. Inspector recommends periodic welfare checks. Compliance: passive but total.'
  },
  {
    name: 'Designated Vibe Supervisor',
    tag: 'Licensed to adjust group morale. Carries a mood clipboard.',
    hazard: 3,
    hazLabel: 'CLASS III — REGULATED',
    stamp: 'APPROVED',
    sig: 'A. Pellerin',
    inspector: 'Insp. Pellerin',
    keywords: ['memes', 'peacekeeper', 'mom', 'emojis'],
    fallbackNotes: 'Subject performs continuous emotional load-balancing. Pay grade unclear but benefits are implied. Compliance: unofficial but load-bearing.'
  },
  {
    name: 'Logistics Deputy, Class B',
    tag: 'Runs the spreadsheet nobody asked for. Still, here you all are.',
    hazard: 2,
    hazLabel: 'CLASS II — CRITICAL INFRASTRUCTURE',
    stamp: 'CERTIFIED',
    sig: 'R. Okonjo',
    inspector: 'Insp. Okonjo',
    keywords: ['plans', 'punctuation', 'on my way', 'weather'],
    fallbackNotes: 'Subject is solely responsible for the fact that plans exist. Inspector recommends a small gift around birthdays. Compliance: exceeds all posted requirements.'
  },
  {
    name: 'Nocturnal Correspondence Officer',
    tag: 'Operates outside standard business hours. Possibly the moon.',
    hazard: 3,
    hazLabel: 'CLASS III — NOCTURNAL',
    stamp: 'LATE FILING',
    sig: 'D. Vermillion',
    inspector: 'Insp. Vermillion',
    keywords: ['3am', 'voice', 'weeks', 'silent'],
    fallbackNotes: 'Subject files communications during hours unfit for court testimony. Inspector recommends a blue-light filter and a hobby. Compliance: timestamped anomalies.'
  },
  {
    name: 'Unsolicited Content Specialist',
    tag: 'Delivers links, videos, and hot takes to markets that did not ask.',
    hazard: 4,
    hazLabel: 'CLASS IV — HIGH VOLUME',
    stamp: 'FORWARDED',
    sig: 'L. Marquette',
    inspector: 'Insp. Marquette',
    keywords: ['links', 'memes', 'screenshots', 'story twice'],
    fallbackNotes: 'Subject operates a one-person distribution pipeline. Inspector requests a content advisory. Compliance: high throughput, questionable curation.'
  },
  {
    name: 'The Group Archivist',
    tag: 'Can cite every in-joke. Will. Unprompted. With timestamps.',
    hazard: 1,
    hazLabel: 'CLASS I — ADVISORY',
    stamp: 'ON RECORD',
    sig: 'S. Ravencroft',
    inspector: 'Insp. Ravencroft',
    keywords: ['story twice', 'reacts', 'screenshots'],
    fallbackNotes: 'Subject holds the institutional memory of this chat and refuses to let anyone escape a callback. Compliance: excessive but cherished.'
  },
  {
    name: 'Emergency Glue',
    tag: 'Without this person the chat quietly collapses in 72 hours.',
    hazard: 2,
    hazLabel: 'CLASS II — STRUCTURAL',
    stamp: 'LOAD BEARING',
    sig: 'H. Aldenbrook',
    inspector: 'Insp. Aldenbrook',
    keywords: ['mom', 'peacekeeper', 'plans', 'reacts'],
    fallbackNotes: 'Subject performs structural duty without title or compensation. Inspector recommends the chat be renamed in their honor. Compliance: exemplary under duress.'
  }
];

// --------- URL fragment state (shareable permalink) ----------
// Encode the inputs (not the output) into location.hash so a shared link
// reproduces the whole report for the recipient. The AI flourish may vary,
// but the role/hazard/case# are deterministic from the inputs.
function b64urlEncode(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  try {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (_) {
    return null;
  }
}
function encodeFragment(name, chips, messages) {
  return '#a=' + b64urlEncode({ n: name, c: chips, m: messages });
}
function decodeFragment() {
  const frag = location.hash || '';
  const m = frag.match(/^#a=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const val = b64urlDecode(m[1]);
  if (!val || typeof val !== 'object') return null;
  const name = typeof val.n === 'string' ? val.n : '';
  const chips = Array.isArray(val.c) ? val.c.filter(x => typeof x === 'string') : [];
  const messages = Array.isArray(val.m) ? val.m.filter(x => typeof x === 'string') : [];
  if (!name) return null;
  if (chips.length === 0 && messages.length === 0) return null;
  return { name, chips, messages };
}
function stripFragment() {
  history.replaceState(null, '', location.pathname + location.search);
}

// --------- Helpers ----------
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// mulberry32 seeded RNG
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pickRole(name, chips, messages) {
  // Score roles by keyword overlap with chips + messages text; tiebreak by seeded RNG.
  const text = (chips.join(' ') + ' ' + messages).toLowerCase();
  const seed = hashStr(name + '|' + chips.join(',') + '|' + messages);
  const r = rng(seed);
  let best = ROLES[0];
  let bestScore = -1;
  for (const role of ROLES) {
    let score = 0;
    for (const kw of role.keywords) {
      if (text.includes(kw)) score += 3;
    }
    score += r(); // tiebreak
    if (score > bestScore) { bestScore = score; best = role; }
  }
  // If no keyword hit at all, fall back to deterministic seeded index
  const anyKw = ROLES.some(R => R.keywords.some(k => text.includes(k)));
  if (!anyKw) {
    best = ROLES[seed % ROLES.length];
  }
  return best;
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(d) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function caseNumberFor(seed) {
  // Deterministic pseudo-case number
  const a = (seed % 9000) + 1000;
  const b = ((seed >> 13) % 9000) + 1000;
  return `GC-${a}-${b}`;
}

function parseMessages(raw) {
  return raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function pickCitationSources(chips, messages, seed) {
  // Build a pool: prefer verbatim messages; fall back to chips. Want exactly 3.
  const msgs = messages.slice();
  const r = rng(seed ^ 0x9e3779b1);
  const out = [];
  const pool = msgs.length ? msgs : chips.slice();
  // shuffle deterministically
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  while (out.length < 3) {
    if (pool.length) out.push(pool.shift());
    else if (chips.length) out.push('(chip) ' + chips[out.length % chips.length]);
    else out.push('(no evidence on file)');
  }
  return out;
}

// --------- DOM wiring ----------
const $ = (s) => document.querySelector(s);

function renderChips() {
  const box = $('#chips');
  CHIPS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = c;
    btn.dataset.chip = c;
    btn.addEventListener('click', () => {
      const selected = box.querySelectorAll('.chip.on');
      if (btn.classList.contains('on')) {
        btn.classList.remove('on');
      } else if (selected.length < 6) {
        btn.classList.add('on');
      } else {
        // brief shake
        btn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 200 });
      }
    });
    box.appendChild(btn);
  });
}

function getSelectedChips() {
  return Array.from(document.querySelectorAll('.chip.on')).map(b => b.dataset.chip);
}

const LOADING_MESSAGES = [
  'inspector en route — unfolding clipboard…',
  'cross-referencing your lowercase with federal databases…',
  'dusting the chat for fingerprints…',
  'typing with two fingers, please hold…',
  'stamping things that do not need stamping…',
  'consulting Sub-Chapter 7 of the Groupchat Code…'
];

function showLoading() {
  $('#intake').hidden = true;
  $('#reportWrap').hidden = true;
  const el = $('#loading');
  el.hidden = false;
  const msg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
  $('#loadingMsg').textContent = msg;
}

function hideLoading() { $('#loading').hidden = true; }

function setHazard(level) {
  const fill = $('#hzFill');
  const pct = Math.max(0, Math.min(5, level)) / 5 * 100;
  fill.style.width = pct + '%';
  const color = level >= 4 ? 'var(--hazard-crit)' : level >= 3 ? 'var(--hazard-warn)' : 'var(--hazard-safe)';
  fill.style.background = color;
}

function renderReport({ subject, role, citations, notes, seed, chips, messages }) {
  const now = new Date();
  $('#caseNo').textContent = caseNumberFor(seed);
  $('#filedOn').textContent = formatDate(now);
  $('#inspector').textContent = role.inspector;
  $('#rptSubject').textContent = subject;
  $('#roleName').textContent = role.name;
  $('#roleTagline').textContent = role.tag;
  $('#hazardLabel').textContent = role.hazLabel;
  setHazard(role.hazard);

  const citesEl = $('#citations');
  citesEl.innerHTML = '';
  citations.forEach((c, i) => {
    const li = document.createElement('li');
    const code = document.createElement('div');
    code.className = 'cit-code';
    code.textContent = `§ ${7}.${String(i + 1).padStart(2,'0')} · VIOLATION TYPE ${['A','B','C'][i] || 'D'}`;
    const q = document.createElement('div');
    q.className = 'cit-quote';
    q.textContent = c.quote;
    const finding = document.createElement('div');
    finding.className = 'cit-finding';
    finding.textContent = c.finding;
    li.appendChild(code);
    li.appendChild(q);
    li.appendChild(finding);
    citesEl.appendChild(li);
  });

  $('#inspectorNotes').textContent = notes;
  $('#stampMid').textContent = role.stamp;
  const sig = document.querySelector('.sig');
  sig.setAttribute('data-signature', role.sig);
  $('#sigName').textContent = role.inspector;

  $('#reportWrap').hidden = false;
  // Scroll result into view on mobile
  $('#report').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --------- AI flourish (one call per journey) ----------
async function generateFindings(role, subject, chips, messages, seed) {
  // We ask the model for JSON: 3 findings (one per citation source) + inspector notes paragraph.
  // Deterministic fallback is used on any failure.
  const sources = pickCitationSources(chips, messages, seed);

  const sys = [
    'You are a deadpan government inspector writing a fake OSHA-style report.',
    'Tone: dry, bureaucratic, absurdly specific. No emojis. No hashtags. No quotes around findings.',
    'Output STRICT JSON with keys: findings (array of 3 short strings, each <= 22 words, each a bureaucratic observation about the corresponding quote) and notes (one paragraph, 2-3 sentences, <= 55 words, the inspector\'s concluding remarks).',
    'Do not include the quoted text inside the findings; write ABOUT them.',
    'Never break character. Never mention being an AI.'
  ].join(' ');

  const user = [
    `SUBJECT: ${subject}`,
    `DETERMINED ROLE: ${role.name} — ${role.tag}`,
    `OBSERVED BEHAVIOR CHIPS: ${chips.length ? chips.join('; ') : '(none)'}`,
    `EVIDENCE QUOTES (pair findings[0..2] with these in order):`,
    sources.map((s, i) => `${i+1}. ${s}`).join('\n')
  ].join('\n');

  const messagesApi = [
    { role: 'system', content: sys },
    { role: 'user', content: user }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: messagesApi,
        max_tokens: 280,
        response_format: 'json_object'
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let parsed;
    try { parsed = JSON.parse(data.content); } catch (_) { parsed = null; }
    if (!parsed || !Array.isArray(parsed.findings) || parsed.findings.length < 1) {
      throw new Error('bad_shape');
    }
    const findings = [];
    for (let i = 0; i < 3; i++) {
      findings.push(String(parsed.findings[i] || fallbackFinding(role, sources[i], i)).slice(0, 280));
    }
    const notes = String(parsed.notes || role.fallbackNotes).slice(0, 500);
    return {
      notes,
      citations: sources.map((q, i) => ({ quote: q, finding: findings[i] }))
    };
  } catch (_) {
    return {
      notes: role.fallbackNotes,
      citations: sources.map((q, i) => ({ quote: q, finding: fallbackFinding(role, q, i) }))
    };
  }
}

function fallbackFinding(role, source, i) {
  const pool = [
    `Entered into record per §7.${String(i+1).padStart(2,'0')}. Consistent with determined role.`,
    `Behavior corroborates hazard classification ${role.hazLabel}. No corrective action advised.`,
    `Exhibit logged. Inspector notes pattern is habitual and well within expected range for subject.`,
    `Documented evidence aligns with standing profile. Reviewed and filed.`
  ];
  return pool[i % pool.length];
}

// --------- Flow ----------
async function runAuditWith(name, chips, messages, { updateFragment = true } = {}) {
  const seed = hashStr(name.toLowerCase() + '|' + chips.join(',').toLowerCase() + '|' + messages.join('\n').toLowerCase());
  const role = pickRole(name, chips, messages.join('\n'));

  showLoading();

  // minimum 800ms of loading for drama
  const t0 = Date.now();
  const { notes, citations } = await generateFindings(role, name, chips, messages, seed);
  const elapsed = Date.now() - t0;
  if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

  hideLoading();
  renderReport({ subject: name, role, citations, notes, seed, chips, messages });
  $('#share').style.display = 'flex';

  // Make the result a permalink: share this URL and the recipient sees the same report.
  if (updateFragment) {
    history.replaceState(null, '', location.pathname + location.search + encodeFragment(name, chips, messages));
  }
}

async function runAudit(ev) {
  ev && ev.preventDefault();
  const name = $('#subjectName').value.trim();
  const messages = parseMessages($('#messages').value);
  const chips = getSelectedChips();

  // Validation: need a name AND (messages OR >=2 chips)
  if (!name || (messages.length === 0 && chips.length < 2)) {
    const err = $('#formError');
    err.hidden = false;
    err.textContent = !name
      ? 'hold on — an inspector needs a name on the form.'
      : 'hold on — either paste some messages or tap at least 2 chips.';
    return;
  }

  await runAuditWith(name, chips, messages);
}

function resetAudit() {
  stripFragment();
  $('#reportWrap').hidden = true;
  $('#intake').hidden = false;
  $('#formError').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function downloadPNG() {
  const el = $('#report');
  if (!window.html2canvas) {
    alert('Download not ready — refresh and try again.');
    return;
  }
  // snapshot the report node
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: null,
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true
    });
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'group-chat-audit.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    alert('Could not save the PNG — try a screenshot instead.');
  }
}

// --------- Share (required signature) ----------
function share() {
  const title = document.title;
  const roleText = document.querySelector('#roleName')?.textContent?.trim();
  const text = roleText ? `apparently I'm the ${roleText}. (Group Chat Energy Audit)` : title;
  if (navigator.share) {
    navigator.share({ title, text, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'))
      .catch(() => alert(location.href));
  }
}

// --------- SVG filter injection (ink-bleed on stamp) ----------
function injectInkFilter() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <filter id="inky">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
      <feDisplacementMap in="SourceGraphic" scale="2"/>
    </filter>
  `;
  document.body.appendChild(svg);
}

function prefillForm({ name, chips, messages }) {
  $('#subjectName').value = name || '';
  const ta = $('#messages');
  ta.value = (messages || []).join('\n');
  $('#msgCount').textContent = ta.value.length;
  const wanted = new Set(chips || []);
  document.querySelectorAll('.chip').forEach(btn => {
    if (wanted.has(btn.dataset.chip)) btn.classList.add('on');
    else btn.classList.remove('on');
  });
}

// --------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  renderChips();
  injectInkFilter();

  const ta = $('#messages');
  const counter = $('#msgCount');
  ta.addEventListener('input', () => { counter.textContent = ta.value.length; });

  $('#auditForm').addEventListener('submit', runAudit);
  $('#resetBtn').addEventListener('click', resetAudit);
  $('#dlBtn').addEventListener('click', downloadPNG);

  const link = document.getElementById('ctaLink');
  if (link) link.href = location.pathname;

  // Deep-link replay: if the URL has a valid #a=... fragment, pre-fill and re-run.
  const fromFragment = decodeFragment();
  if (fromFragment) {
    prefillForm(fromFragment);
    // Do not overwrite the incoming fragment — it is already correct.
    runAuditWith(fromFragment.name, fromFragment.chips, fromFragment.messages, { updateFragment: false });
  }
});
