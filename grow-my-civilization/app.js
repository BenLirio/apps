// Grow My Civilization — turn-based saga with Eurogame mechanics:
// (M1) Two-resource economy: every choice trades Stability ↔ Ambition.
// (M2) Three-crisis draft per chapter: pick one to engage; the others age and
//      auto-consume into a stability hit if left festering.
// (M5) Player-chosen Legacy Goal at start: Long Dynasty / Pinnacle / Glorious Pyre.
//      Verdict is judged against the chosen goal, not generic "how long".

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'grow-my-civilization';

// ── RNG ────────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let visualRng = mulberry32(Date.now() & 0xFFFFFFFF);

// ── Eras (descriptive; advance via cumulative ambition spent) ─────────────────
const ERAS = [
  { name: 'STONE AGE',   color: '#5a4a3a', bgGrad: ['#0d0d2a','#1a1a3a'] },
  { name: 'COPPER AGE',  color: '#8b6a3a', bgGrad: ['#0d0d2a','#1a1a3a'] },
  { name: 'BRONZE AGE',  color: '#a07830', bgGrad: ['#1a1430','#2a1a40'] },
  { name: 'IRON AGE',    color: '#6a7a8a', bgGrad: ['#2a1830','#3a2840'] },
  { name: 'CLASSICAL',   color: '#c8a84a', bgGrad: ['#2a2040','#4a3050'] },
  { name: 'MEDIEVAL',    color: '#5a8a5a', bgGrad: ['#3a2840','#5a3858'] },
  { name: 'RENAISSANCE', color: '#a05a78', bgGrad: ['#2a2848','#3a3858'] },
  { name: 'INDUSTRIAL',  color: '#888888', bgGrad: ['#1a1840','#2a2848'] },
  { name: 'ATOMIC',      color: '#5a9aaa', bgGrad: ['#1a1838','#1a1838'] },
  { name: 'DIGITAL',     color: '#6a5aaa', bgGrad: ['#0d0d20','#0d0d20'] },
  { name: 'STELLAR',     color: '#aaaaff', bgGrad: ['#000010','#101030'] },
];

// Spent-ambition thresholds for entering each era. Index 0 = Stone Age (free).
const ERA_THRESHOLDS = [0, 14, 30, 48, 68, 90, 114, 140, 168, 198, 230];

function eraFromSpent(spent) {
  let idx = 0;
  for (let i = 0; i < ERA_THRESHOLDS.length; i++) {
    if (spent >= ERA_THRESHOLDS[i]) idx = i;
  }
  return idx;
}

const BUILDING_PALETTES_BY_ERA = [
  ['#5a4a3a','#3a2a2a'], ['#8b6030','#5a3820'], ['#a07028','#6a4818'],
  ['#707888','#484e58'], ['#c8a040','#888030'], ['#507848','#305830'],
  ['#903870','#601848'], ['#787878','#484848'], ['#4888a0','#285878'],
  ['#584898','#382868'], ['#a8a8ff','#5050a0']
];

// ── Legacy Goals ──────────────────────────────────────────────────────────────
const LEGACY_GOALS = {
  long_dynasty: {
    key: 'long_dynasty',
    name: 'The Long Dynasty',
    short: 'Long Dynasty',
    icon: '⌛',
    blurb: 'Survive 20 chapters.',
    progress: () => `${Math.min(chapter, 20)} / 20 chapters`,
    isMet: () => chapter >= 20,
    verdict: (met) => met
      ? 'A dynasty that outlasted its own legends.'
      : 'A line that broke before its twentieth winter.'
  },
  pinnacle: {
    key: 'pinnacle',
    name: 'The Pinnacle',
    short: 'Pinnacle',
    icon: '◭',
    blurb: 'Reach the Atomic Age.',
    progress: () => `${ERAS[stats.era].name} → ATOMIC`,
    isMet: () => stats.era >= 8,
    verdict: (met) => met
      ? 'They reached the heights and looked down on what they had been.'
      : 'They climbed, but the summit was farther than the climbing.'
  },
  glorious_pyre: {
    key: 'glorious_pyre',
    name: 'The Glorious Pyre',
    short: 'Glorious Pyre',
    icon: '✶',
    blurb: 'Burn bright. Die young. Be remembered.',
    progress: () => `Ch ${chapter} / 12 · burn ${stats.peakAmbitionBurn} / 22`,
    isMet: () => gameOver && chapter <= 12 && stats.era >= 3 && stats.peakAmbitionBurn >= 22,
    verdict: (met) => met
      ? 'A brief, brilliant fire — the kind history sings about.'
      : 'Neither slow enough for grandeur nor fast enough for legend.'
  }
};

// ── Name Generator ────────────────────────────────────────────────────────────
const NAME_ADJECTIVES = [
  'Iron','Hollow','Bronze','Salt','Glass','Cinder','Velvet','Storm','Pale','Crimson',
  'Quiet','Wandering','Marble','Last','First','Hidden','Verdant','Distant','Bone','River',
  'Spire','Ember','Briar','Crooked','Whispering','Twilight','Open','Shrouded','Auric',
  'Granite','Lantern','Silken','Drowsy','Northern','Southern','Forgotten'
];
const NAME_NOUNS = [
  'Shore','Empire','Council','Republic','Hold','Reach','Vale','Spires','Hollows','Folk',
  'Hearth','Coast','Crown','Gate','Wardens','Tide','Banner','Wake','Clan','Dominion',
  'Concordat','Court','Choir','Cartographers','Stewards','Magistracy','Wayfarers',
  'Glassblowers','Almanac','Beacon','Garrison','Hearthstones','Lighthouse','Mariners',
  'Saltmakers','Threshold'
];

function generateCivName() {
  const a = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const n = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `The ${a} ${n}`;
}

// ── Game State ────────────────────────────────────────────────────────────────
let civName = '';
let phase = 'setup'; // setup | thinking | crisis_select | resolving | verdict
let legacyGoal = 'long_dynasty';

let stats = {
  stability: 60,           // 0..100, death at 0
  ambition: 40,            // 0..100, hoarding too long → stagnation
  era: 0,
  totalAmbitionSpent: 0,   // cumulative ambition burned via choices (drives era)
  peakAmbitionBurn: 0      // largest single-chapter ambition spend (Pyre goal)
};
let peakStability = 60;
let peakAmbition = 40;
let peakEra = 0;

let chapter = 0;
let chronicle = [];                // [{ crisisTitle, crisisDescription, choiceLabel, narrative, chapter, era, engaged, statDelta }]
let activeCrises = [];             // up to 3 face-up crisis objects
let selectedCrisisIdx = null;      // which crisis card is currently expanded

let gameOver = false;
let collapseReason = '';
let goalMetAt = null;              // { chapter, era } the moment goal was first satisfied (for live trophy)

// Visual entities (unchanged from original — driven by derived signals below).
let buildings = [], people = [], fires = [], explosions = [], stars = [], triumphs = [];
let animId = null, lastTs = null;

// Derived visual signals (so we don't have to scrub the visual layer).
function visualPopulation() { return Math.max(1, Math.round(stats.stability * 1.5 + stats.era * 4)); }
function visualTech() { return stats.era * 12 + stats.ambition * 0.1; }

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 360, H = 300;

function initStars() {
  stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({ x: visualRng() * W, y: visualRng() * (H * 0.55), r: visualRng() < 0.3 ? 2 : 1 });
  }
}

function drawSetupCanvas() {
  ctx.clearRect(0, 0, W, H);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  skyGrad.addColorStop(0, '#0d0d2a');
  skyGrad.addColorStop(1, '#1a1a3a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.65);
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  ctx.fillStyle = '#ffffff';
  stars.forEach(s => ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.r, s.r));

  const fx = W / 2, fy = H - 58;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ff8800';
  ctx.beginPath(); ctx.arc(fx, fy, 14, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(Math.floor(fx - 4), Math.floor(fy - 7), 8, 8);
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(Math.floor(fx - 3), Math.floor(fy - 5), 6, 6);
  ctx.fillStyle = '#ffee44';
  ctx.fillRect(Math.floor(fx - 1), Math.floor(fy - 3), 3, 3);
}

function startSetup() {
  phase = 'setup';
  initStars();
  drawSetupCanvas();
  document.getElementById('setup-panel').style.display = 'flex';
  document.getElementById('game-panel').style.display = 'none';
  document.getElementById('verdict-panel').style.display = 'none';
  document.getElementById('share').style.display = 'none';
  document.getElementById('app').className = '';

  rollName();
  renderGoalPicker();
}

function rollName() {
  civName = generateCivName();
  const display = document.getElementById('civ-name-display');
  display.classList.add('rolling');
  setTimeout(() => {
    display.textContent = civName;
    display.classList.remove('rolling');
  }, 110);
}

function renderGoalPicker() {
  const wrap = document.getElementById('goal-picker');
  if (!wrap) return;
  wrap.innerHTML = '';
  Object.values(LEGACY_GOALS).forEach(g => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'goal-card' + (legacyGoal === g.key ? ' picked' : '');
    card.dataset.key = g.key;
    card.innerHTML = `
      <div class="goal-icon">${g.icon}</div>
      <div class="goal-name">${g.name}</div>
      <div class="goal-blurb">${g.blurb}</div>
    `;
    card.addEventListener('click', () => {
      legacyGoal = g.key;
      renderGoalPicker();
    });
    wrap.appendChild(card);
  });
}

// ── AI: Crisis Generation ─────────────────────────────────────────────────────
async function fetchCrises(n) {
  const recent = chronicle.slice(-3).map(c => {
    if (!c.engaged) return `'${c.crisisTitle}' — left untended`;
    const verb = String(c.choiceLabel || '').toLowerCase();
    return `'${c.crisisTitle}' → they ${verb}`;
  }).join('; ') || 'this is the first chapter';

  const pending = activeCrises.length
    ? activeCrises.map(c => `'${c.title}'${c.age ? ' (brewing)' : ''}`).join(', ')
    : 'none';

  const eraName = ERAS[stats.era].name;

  const sys = `You are the chronicler of the civilization "${civName}", currently in the ${eraName}. Output ONLY valid JSON.

You will generate ${n} new crisis card(s) the people now face. Each crisis has:
- title: 3-6 evocative words, Title Case (no all-caps)
- description: ONE sentence, max 22 words, a concrete event (no abstract dilemmas, no numbers, no stat names)
- choices: EXACTLY TWO choices presenting opposing approaches

Each choice has:
- label: 2-4 word imperative, Title Case
- stability: integer in [-25, +25] — how the choice affects social cohesion / safety
- ambition: integer in [-25, +25] — how it affects momentum (NEGATIVE means spending ambition on bold action; POSITIVE means restraint or hope-building)
- narrative: ONE sentence, max 16 words, what unfolds (no numbers, no stat names)

CRITICAL: the two choices for the SAME crisis must present a meaningful TRADE-OFF. Common patterns:
  · Cautious: +stability, -ambition (small spend)  vs  Bold: -stability, -ambition (large spend, transformative)
  · Cautious: +stability, -ambition  vs  Daring: -stability, +ambition (a gambit that risks order to build momentum)
The two choices for a crisis MUST have DIFFERENT trade-off profiles — never both +stability or both -ambition with similar magnitudes.

Magnitudes: typically ±5 to ±15. Reserve ±18 to ±25 for grave, dramatic dilemmas.

Voice: era-appropriate, grounded, folk-saga. Vary subject matter — people, weather, neighbors, faith, illness, harvest, strangers, technology, omens — not just battles.`;

  const user = `Stability: ${stats.stability}/100. Ambition: ${stats.ambition}/100. Era: ${eraName}. Chapter ${chapter + 1}.

Recent chapters: ${recent}.
Crises already brewing on the board (do NOT repeat these — generate fresh ones): ${pending}.

Generate ${n} new crisis(es). Respond with JSON exactly matching:
{
  "crises": [
    {
      "title": "...",
      "description": "...",
      "choices": [
        { "label": "...", "stability": <int -25..25>, "ambition": <int -25..25>, "narrative": "..." },
        { "label": "...", "stability": <int -25..25>, "ambition": <int -25..25>, "narrative": "..." }
      ]
    }
  ]
}`;

  const body = {
    slug: SLUG,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ],
    model: 'gpt-5.4-mini',
    max_tokens: 900,
    temperature: 0.95,
    response_format: 'json_object'
  };

  const resp = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error('ai_http_' + resp.status);
  const data = await resp.json();
  const parsed = JSON.parse(data.content);
  if (!parsed || !Array.isArray(parsed.crises)) throw new Error('ai_bad_shape');

  const sanitized = parsed.crises.map(sanitizeCrisis).filter(Boolean);
  if (sanitized.length === 0) throw new Error('ai_empty');
  return sanitized;
}

function sanitizeCrisis(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const choices = (Array.isArray(raw.choices) ? raw.choices : []).slice(0, 2).map(c => ({
    label: titleCaseClip(String(c.label || 'Press On'), 26),
    stability: clampInt(c.stability, -25, 25),
    ambition: clampInt(c.ambition, -25, 25),
    narrative: clipSentence(String(c.narrative || ''), 110)
  }));
  // Pad if fewer than 2 came back (shouldn't happen if the model obeys).
  while (choices.length < 2) {
    choices.push({ label: 'Hold The Line', stability: -3, ambition: -3, narrative: 'Nothing changes; the unease deepens.' });
  }
  return {
    id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    title: titleCaseClip(String(raw.title || 'A Reckoning'), 50),
    description: clipSentence(String(raw.description || 'A choice is upon you.'), 160),
    age: 0,
    choices
  };
}

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v) || 0);
  return Math.max(lo, Math.min(hi, n));
}

function clipSentence(s, maxLen) {
  s = s.trim().replace(/\s+/g, ' ');
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

function titleCaseClip(s, maxLen) {
  s = s.trim().replace(/\s+/g, ' ');
  s = s.replace(/[.?!:;]+$/, '');
  return s.length > maxLen ? s.slice(0, maxLen).trimEnd() + '…' : s;
}

// ── Fallback (used if AI is unreachable) ──────────────────────────────────────
const FALLBACK_POOL = [
  {
    title: 'The Salt Caravan Arrives',
    description: 'Foreign traders offer salt and iron in exchange for a season of guarded passage.',
    choices: [
      { label: 'Strike The Bargain', stability: +8,  ambition: -6,  narrative: 'The granary fills; warriors march beside the trader.' },
      { label: 'Refuse And Tax Them', stability: -10, ambition: +12, narrative: 'They leave swearing oaths; a fortune is held but enemies are made.' }
    ]
  },
  {
    title: 'An Early Frost',
    description: 'Frost arrives a month early and the river skins over.',
    choices: [
      { label: 'Burn The Reserves',  stability: +10, ambition: -8,  narrative: 'Fires roar through the night. Everyone wakes warm.' },
      { label: 'March Out Hunting',  stability: -12, ambition: +10, narrative: 'Half return with meat. Half do not return at all.' }
    ]
  },
  {
    title: 'A Child Speaks Strangely',
    description: 'A child returns from the woods speaking words no one taught her.',
    choices: [
      { label: 'Mark Her A Seer',    stability: +6,  ambition: +6,  narrative: 'The people begin to whisper, then to listen.' },
      { label: 'Banish The Family',  stability: -8,  ambition: -10, narrative: 'They vanish by morning. The woods grow louder at night.' }
    ]
  },
  {
    title: 'The Ambition Of A General',
    description: 'A celebrated general begins to keep his own court in the south.',
    choices: [
      { label: 'Recall Him Home',    stability: +12, ambition: -14, narrative: 'He returns sullen but bowed. The southern roads grow quiet.' },
      { label: 'Crown Him Vassal',   stability: -8,  ambition: +14, narrative: 'A second banner rises. Two banners flutter, sometimes together.' }
    ]
  },
  {
    title: 'An Eclipse At Noon',
    description: 'The sun goes black at noon and the priests demand answers.',
    choices: [
      { label: 'Sacrifice In Silence', stability: +9,  ambition: -7,  narrative: 'The sun returns. Whether it heard, no one says.' },
      { label: 'Forbid The Old Rites', stability: -14, ambition: +16, narrative: 'A schism is born. Some priests sharpen knives.' }
    ]
  },
  {
    title: 'A Forge Burns Hotter',
    description: 'A smith claims to have melted a stone the gods placed in the river.',
    choices: [
      { label: 'Lock Up The Method',   stability: +8,  ambition: -10, narrative: 'The smith dies quietly. The secret stays in the temple.' },
      { label: 'Build Many More',      stability: -10, ambition: -16, narrative: 'A hundred forges roar. Whole villages choke on the smoke.' }
    ]
  },
  {
    title: 'Pestilence In The Quarter',
    description: 'A wasting sickness empties three neighborhoods near the docks.',
    choices: [
      { label: 'Quarantine The Quarter', stability: +10, ambition: -12, narrative: 'The sickness fades. So does trust between districts.' },
      { label: 'Open The Granaries',     stability: -6,  ambition: +8,  narrative: 'The poor are fed; the rich grow restless. Hope flickers.' }
    ]
  },
  {
    title: 'The Old Tongue Is Forgotten',
    description: 'A scholar reports that no one under thirty speaks the old tongue cleanly.',
    choices: [
      { label: 'Compel The Schools',   stability: +6,  ambition: -8,  narrative: 'Children chant verbs by rote. Their teachers age.' },
      { label: 'Let The Tongue Pass',  stability: -8,  ambition: +12, narrative: 'A new dialect blooms in the markets. The elders mourn.' }
    ]
  }
];

function fallbackCrises(n) {
  const out = [];
  const pool = FALLBACK_POOL.slice();
  for (let i = 0; i < n; i++) {
    const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (!pick) break;
    out.push({
      id: 'fc' + Date.now().toString(36) + i,
      title: pick.title,
      description: pick.description,
      age: 0,
      choices: pick.choices.map(c => ({ ...c }))
    });
  }
  return out;
}

// ── Start Game ────────────────────────────────────────────────────────────────
function startGame() {
  if (!civName) civName = generateCivName();
  if (!legacyGoal) legacyGoal = 'long_dynasty';

  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('game-panel').style.display = 'flex';
  document.getElementById('civ-title').textContent = civName;

  stats = { stability: 60, ambition: 40, era: 0, totalAmbitionSpent: 0, peakAmbitionBurn: 0 };
  peakStability = 60; peakAmbition = 40; peakEra = 0;
  chapter = 0;
  chronicle = [];
  activeCrises = [];
  selectedCrisisIdx = null;
  gameOver = false;
  collapseReason = '';
  goalMetAt = null;

  buildings = []; people = [];
  fires = [{ x: W / 2, y: H - 60, size: 6, age: 0 }];
  explosions = []; triumphs = [];
  lastTs = null;

  document.getElementById('decision-panel').style.display = 'flex';
  document.getElementById('verdict-panel').style.display = 'none';
  document.getElementById('share').style.display = 'none';

  phase = 'thinking';
  updateHUD();
  animId = requestAnimationFrame(gameLoop);
  nextChapter();
}

// ── Chapter Loop ──────────────────────────────────────────────────────────────
function setHeader() {
  const chapterTag = document.getElementById('decision-era-tag');
  if (chapterTag) chapterTag.textContent = `Chapter ${chapter + 1}`;

  const recapEl = document.getElementById('story-so-far');
  if (recapEl) {
    const lastEngaged = [...chronicle].reverse().find(c => c.engaged);
    if (lastEngaged) {
      recapEl.textContent = lastEngaged.narrative;
      recapEl.style.display = 'block';
    } else {
      recapEl.textContent = '';
      recapEl.style.display = 'none';
    }
  }
}

async function nextChapter() {
  if (gameOver) return;

  if (checkCollapse()) {
    triggerCollapse();
    return;
  }

  setHeader();
  showThinking();

  // Refill activeCrises to 3.
  const need = 3 - activeCrises.length;
  if (need > 0) {
    let fresh;
    try {
      fresh = await fetchCrises(need);
    } catch (e) {
      fresh = fallbackCrises(need);
    }
    activeCrises.push(...fresh);
  }

  presentCrises();
}

function showThinking() {
  phase = 'thinking';
  document.getElementById('decision-ready').style.display = 'none';
  document.getElementById('decision-thinking').style.display = 'flex';
}

function presentCrises() {
  phase = 'crisis_select';
  selectedCrisisIdx = null;
  document.getElementById('decision-thinking').style.display = 'none';
  document.getElementById('decision-ready').style.display = 'flex';
  setHeader();
  renderCrisesList();
  renderResolutionLine('');
}

function renderCrisesList() {
  const wrap = document.getElementById('crises-list');
  wrap.innerHTML = '';
  activeCrises.forEach((c, idx) => {
    const card = document.createElement('div');
    const isSelected = selectedCrisisIdx === idx;
    const isFaded = selectedCrisisIdx !== null && !isSelected;
    card.className = 'crisis-card' +
      (isSelected ? ' selected' : '') +
      (isFaded ? ' faded' : '') +
      (c.age >= 1 ? ' brewing' : '');
    card.dataset.idx = String(idx);

    const ageBadge = c.age >= 1 ? `<div class="crisis-age-badge">${c.age >= 2 ? 'DIRE' : 'BREWING'}</div>` : '';

    card.innerHTML = `
      ${ageBadge}
      <div class="crisis-title">${escapeHtml(c.title)}</div>
      <div class="crisis-description">${escapeHtml(c.description)}</div>
      <div class="crisis-choices" ${isSelected ? '' : 'style="display:none"'}></div>
    `;

    if (selectedCrisisIdx === null) {
      card.addEventListener('click', () => {
        if (phase !== 'crisis_select') return;
        selectedCrisisIdx = idx;
        renderCrisesList();
      });
    }

    if (isSelected) {
      const cwrap = card.querySelector('.crisis-choices');
      c.choices.forEach((ch, ci) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `
          <div class="choice-label">${escapeHtml(ch.label)}</div>
          <div class="choice-cost">
            <div class="cost-row"><span class="${ch.stability >= 0 ? 'pos' : 'neg'}">${signed(ch.stability)}</span> Stability</div>
            <div class="cost-row"><span class="${ch.ambition >= 0 ? 'pos' : 'neg'}">${signed(ch.ambition)}</span> Ambition</div>
          </div>
        `;
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (phase !== 'crisis_select') return;
          resolveChoice(idx, ci);
        });
        cwrap.appendChild(btn);
      });

      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'crisis-back-btn';
      back.textContent = '← Choose a different crisis';
      back.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (phase !== 'crisis_select') return;
        selectedCrisisIdx = null;
        renderCrisesList();
      });
      cwrap.appendChild(back);
    }

    wrap.appendChild(card);
  });
}

function signed(n) { return n > 0 ? `+${n}` : `${n}`; }

function renderResolutionLine(text) {
  const el = document.getElementById('resolution-line');
  if (!el) return;
  el.textContent = text || '';
}

function resolveChoice(crisisIdx, choiceIdx) {
  if (phase !== 'crisis_select') return;
  phase = 'resolving';

  const crisis = activeCrises[crisisIdx];
  const choice = crisis.choices[choiceIdx];

  // Apply the engaged choice's deltas.
  const beforeEra = stats.era;
  applyChoiceDeltas(choice);

  chronicle.push({
    crisisTitle: crisis.title,
    crisisDescription: crisis.description,
    choiceLabel: choice.label,
    narrative: choice.narrative,
    chapter: chapter + 1,
    era: stats.era,
    engaged: true,
    statDelta: { stability: choice.stability, ambition: choice.ambition }
  });

  // Age the unengaged crises; auto-consume any that hit age 2.
  const survivors = [];
  const consumed = [];
  activeCrises.forEach((c, i) => {
    if (i === crisisIdx) return;
    c.age = (c.age || 0) + 1;
    if (c.age >= 2) {
      // Festered too long → fixed stability hit.
      const penalty = 14;
      stats.stability = clamp(stats.stability - penalty, 0, 100);
      consumed.push(c);
      chronicle.push({
        crisisTitle: c.title,
        crisisDescription: c.description,
        choiceLabel: '(left to fester)',
        narrative: `${c.title} festered untended; the people suffered.`,
        chapter: chapter + 1,
        era: stats.era,
        engaged: false,
        statDelta: { stability: -penalty, ambition: 0 }
      });
    } else {
      survivors.push(c);
    }
  });
  activeCrises = survivors;

  chapter++;

  // Era-up trumpet
  if (stats.era > beforeEra) {
    spawnTriumphs();
  }

  updatePeaks();
  checkGoalMet();
  updateHUD();

  // Show resolution narrative briefly inside the panel, then advance.
  let resolutionText = `They ${choice.label.toLowerCase()} — ${choice.narrative}`;
  if (consumed.length) {
    resolutionText += `  Meanwhile, ${consumed.map(c => `'${c.title.toLowerCase()}' festered untended.`).join(' ')}`;
  }
  if (stats.era > beforeEra) {
    resolutionText += `  An age turns: the ${ERAS[stats.era].name} begins.`;
  }
  renderResolutionLine(resolutionText);

  // Let the user read the resolution line before next chapter loads.
  setTimeout(() => {
    if (gameOver) return;
    nextChapter();
  }, 2200);
}

function applyChoiceDeltas(choice) {
  const stabDelta = choice.stability || 0;
  const ambDelta  = choice.ambition  || 0;

  stats.stability = clamp(stats.stability + stabDelta, 0, 100);
  stats.ambition  = clamp(stats.ambition  + ambDelta,  0, 100);

  if (ambDelta < 0) {
    const burned = -ambDelta;
    stats.totalAmbitionSpent += burned;
    stats.peakAmbitionBurn = Math.max(stats.peakAmbitionBurn, burned);
  }

  stats.era = eraFromSpent(stats.totalAmbitionSpent);
}

function updatePeaks() {
  peakStability = Math.max(peakStability, stats.stability);
  peakAmbition  = Math.max(peakAmbition,  stats.ambition);
  peakEra       = Math.max(peakEra,       stats.era);
}

function checkGoalMet() {
  if (goalMetAt) return;
  const goal = LEGACY_GOALS[legacyGoal];
  // Glorious Pyre is only evaluated at game-over (it requires gameOver flag).
  if (legacyGoal === 'glorious_pyre') return;
  if (goal.isMet()) {
    goalMetAt = { chapter, era: stats.era };
  }
}

function checkCollapse() {
  if (stats.stability <= 0) {
    collapseReason = 'The state collapsed. The people scattered to the four winds.';
    return true;
  }
  return false;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Game Loop (visuals — driven by derived signals) ───────────────────────────
function gameLoop(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min(ts - lastTs, 100);
  lastTs = ts;

  if (!gameOver) {
    const eraIdx = stats.era;
    const popVis = visualPopulation();

    const targetFires = Math.max(1, Math.min(8, Math.floor(popVis * 0.02)));
    while (fires.length < targetFires) {
      fires.push({ x: 20 + visualRng() * (W - 40), y: H - 55 - visualRng() * 30, size: 3 + visualRng() * 4, age: 0 });
    }
    while (fires.length > targetFires + 1) fires.shift();

    const targetBuildings = Math.min(60, Math.floor(popVis * 0.5 + eraIdx * 5));
    while (buildings.length < targetBuildings) spawnBuilding(eraIdx);
    while (buildings.length > targetBuildings + 4) buildings.shift();

    const targetPeople = Math.min(28, Math.max(0, Math.floor(popVis * 0.4)));
    while (people.length < targetPeople) spawnPerson(eraIdx);
    while (people.length > targetPeople) people.shift();

    fires.forEach(f => { f.age += dt; f.flicker = Math.sin(f.age * 0.008) * 1.5; });

    people.forEach(p => {
      p.x += p.vx;
      p.y += p.vy * 0.3;
      if (p.x < 5 || p.x > W - 5) p.vx *= -1;
      if (p.y < H - 80 || p.y > H - 18) p.vy *= -1;
      p.animFrame = (p.animFrame + dt * 0.012) % 4;
    });
  }

  explosions = explosions.filter(e => e.age < e.life);
  explosions.forEach(e => { e.age += dt; e.x += e.vx; e.y += e.vy; e.vy += 0.05; });

  triumphs = triumphs.filter(t => t.age < t.life);
  triumphs.forEach(t => { t.age += dt; t.y -= t.speed; t.x += t.vx; });

  draw(dt);
  animId = requestAnimationFrame(gameLoop);
}

function spawnBuilding(eraIdx) {
  const groundY = H - 28;
  const orderProxy = Math.max(0, stats.stability - 30);
  const h = 8 + Math.floor(visualRng() * (10 + eraIdx * 2.2 + orderProxy * 0.15));
  const w = 8 + Math.floor(visualRng() * (5 + eraIdx * 1.2));
  buildings.push({
    x: 18 + visualRng() * (W - 36),
    y: groundY - h,
    w, h,
    era: eraIdx
  });
}

function spawnPerson(eraIdx) {
  const colorful = stats.stability > 60;
  const palette = colorful
    ? ['#ffcc88','#ff88aa','#88ccff','#aaff88','#ffff88']
    : ['#cc8844','#aa7744','#8a6633'];
  people.push({
    x: 20 + visualRng() * (W - 40),
    y: H - 28 - visualRng() * 30,
    vx: (visualRng() - 0.5) * 0.8,
    vy: (visualRng() - 0.5) * 0.4,
    color: palette[Math.floor(visualRng() * palette.length)],
    animFrame: visualRng() * 4,
    era: eraIdx
  });
}

function spawnExplosions() {
  for (let i = 0; i < 28; i++) {
    explosions.push({
      x: 20 + visualRng() * (W - 40),
      y: H - 40 - visualRng() * 60,
      vx: (visualRng() - 0.5) * 2.5,
      vy: -visualRng() * 3.5,
      life: 900 + visualRng() * 500,
      age: 0,
      color: visualRng() < 0.5 ? '#ff6633' : '#ffaa33'
    });
  }
}

function spawnTriumphs() {
  for (let i = 0; i < 30; i++) {
    triumphs.push({
      x: 20 + visualRng() * (W - 40), y: H - 40,
      speed: 0.5 + visualRng() * 1.5, vx: (visualRng() - 0.5) * 0.8,
      color: visualRng() < 0.5 ? '#ffcc00' : '#00ff41',
      life: 2000 + visualRng() * 1000, age: 0
    });
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD() {
  const eraIdx = stats.era;
  document.getElementById('age-badge').textContent = ERAS[eraIdx].name;
  document.getElementById('era-label').textContent = `Chapter ${chapter}`;

  const goal = LEGACY_GOALS[legacyGoal];
  const goalProgress = document.getElementById('goal-progress');
  if (goalProgress && goal) {
    goalProgress.innerHTML = `<span class="goal-progress-icon">${goal.icon}</span><span class="goal-progress-name">${goal.short}</span><span class="goal-progress-detail">${goal.progress()}</span>`;
  }

  // Resource bars
  setBar('stability', stats.stability);
  setBar('ambition',  stats.ambition);

  document.getElementById('stab-value').textContent = String(stats.stability);
  document.getElementById('amb-value').textContent  = String(stats.ambition);

  // Warning glow when stability is low.
  const stabBar = document.getElementById('stability-bar');
  if (stabBar) stabBar.classList.toggle('warn', stats.stability <= 25);

  // Era progress hint — shows the spent-ambition mechanic explicitly.
  const eraHint = document.getElementById('era-progress');
  if (eraHint) {
    const nextIdx = Math.min(eraIdx + 1, ERAS.length - 1);
    if (nextIdx === eraIdx) {
      eraHint.textContent = `Highest era reached. Ambition spent: ${stats.totalAmbitionSpent}`;
    } else {
      const remaining = ERA_THRESHOLDS[nextIdx] - stats.totalAmbitionSpent;
      eraHint.textContent = `Spend ${remaining} more ambition to reach the ${ERAS[nextIdx].name}`;
    }
  }

  // Goal-met laurel
  const laurel = document.getElementById('goal-laurel');
  if (laurel) {
    if (goalMetAt) {
      laurel.style.display = 'inline-block';
      laurel.textContent = `✦ ${goal.short} achieved at Chapter ${goalMetAt.chapter}`;
    } else {
      laurel.style.display = 'none';
    }
  }
}

function setBar(which, val) {
  const fill = document.getElementById(`${which}-fill`);
  if (fill) fill.style.width = `${clamp(val, 0, 100)}%`;
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(dt) {
  ctx.clearRect(0, 0, W, H);

  const ei = stats.era;
  const [sky1, sky2] = ERAS[Math.min(ei, ERAS.length - 1)].bgGrad;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  skyGrad.addColorStop(0, sky1);
  skyGrad.addColorStop(1, sky2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.65);

  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  const tech = visualTech();
  const starAlpha = Math.max(0, 1 - tech / 100);
  if (starAlpha > 0) {
    ctx.globalAlpha = starAlpha;
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.r, s.r));
    ctx.globalAlpha = 1;
  }

  const celestialY = 20 + Math.min(1, tech / 120) * H * 0.3;
  if (tech < 50) {
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath(); ctx.arc(W * 0.8, celestialY, 14, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath(); ctx.arc(W * 0.75, celestialY, 16, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffaa22';
    ctx.beginPath(); ctx.arc(W * 0.75, celestialY, 28, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#2a1a08';
  ctx.fillRect(0, H * 0.65 - 2, W, 4);

  const sorted = [...buildings].sort((a, b) => a.y - b.y);
  sorted.forEach(b => {
    const [bc1, bc2] = BUILDING_PALETTES_BY_ERA[Math.min(b.era, BUILDING_PALETTES_BY_ERA.length - 1)];
    ctx.fillStyle = bc1;
    ctx.fillRect(Math.floor(b.x - b.w / 2), Math.floor(b.y), b.w, b.h);
    ctx.fillStyle = bc2;
    ctx.fillRect(Math.floor(b.x + b.w / 2 - 3), Math.floor(b.y), 3, b.h);
    if (b.h > 18 && b.w > 8) {
      ctx.fillStyle = '#ffee88';
      const lightLevel = Math.max(0, stats.stability - 30) / 200 + tech / 200;
      ctx.globalAlpha = Math.min(0.85, 0.3 + lightLevel);
      for (let wy = b.y + 4; wy < b.y + b.h - 4; wy += 6) {
        for (let wx = b.x - b.w / 2 + 2; wx < b.x + b.w / 2 - 4; wx += 6) {
          if (visualRng() < 0.55) ctx.fillRect(Math.floor(wx), Math.floor(wy), 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
  });

  fires.forEach(f => {
    const fl = f.flicker || 0;
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size * 2.5 + fl, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(Math.floor(f.x - f.size / 2), Math.floor(f.y - f.size + fl), f.size, f.size);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(Math.floor(f.x - f.size / 3), Math.floor(f.y - f.size * 0.7 + fl), f.size * 0.65, f.size * 0.65);
    ctx.fillStyle = '#ffee44';
    ctx.fillRect(Math.floor(f.x - 2), Math.floor(f.y - f.size * 0.4 + fl), 4, 4);
  });

  people.forEach(p => {
    ctx.fillStyle = p.color;
    const bobY = Math.floor(p.y + Math.sin(p.animFrame * Math.PI * 2) * 1.5);
    ctx.fillRect(Math.floor(p.x) - 1, bobY - 4, 3, 4);
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(Math.floor(p.x) - 1, bobY - 7, 3, 3);
  });

  explosions.forEach(e => {
    const a = 1 - e.age / e.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = e.color;
    const s = Math.max(1, Math.floor(3 * a));
    ctx.fillRect(Math.floor(e.x) - s, Math.floor(e.y) - s, s * 2, s * 2);
    ctx.globalAlpha = 1;
  });

  triumphs.forEach(t => {
    const a = 1 - t.age / t.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = t.color;
    ctx.fillRect(Math.floor(t.x), Math.floor(t.y), 3, 3);
    ctx.globalAlpha = 1;
  });

  // Red overlay tint when stability is critical.
  if (stats.stability <= 20) {
    ctx.globalAlpha = 0.08 + Math.sin(performance.now() * 0.003) * 0.04;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ── Collapse / Verdict ────────────────────────────────────────────────────────
function triggerCollapse() {
  if (gameOver) return;
  gameOver = true;
  phase = 'verdict';
  spawnExplosions();
  setTimeout(showVerdict, 1800);
}

function showVerdict() {
  document.getElementById('decision-panel').style.display = 'none';
  document.getElementById('verdict-panel').style.display = 'flex';
  document.getElementById('share').style.display = 'block';

  const goal = LEGACY_GOALS[legacyGoal];
  const goalMet = goal.isMet();

  document.getElementById('verdict-title').textContent = goalMet
    ? `${goal.icon} ${goal.name} — Achieved`
    : `${goal.name} — Unfulfilled`;
  document.getElementById('verdict-civ-name').textContent = civName;

  const goalLine = document.getElementById('verdict-goal-line');
  if (goalLine) goalLine.textContent = goal.verdict(goalMet);

  const logEl = document.getElementById('verdict-decisions');
  if (chronicle.length === 0) {
    logEl.innerHTML = '<div class="saga-empty">The story ended before it began.</div>';
  } else {
    const sentences = chronicle.map(d => {
      const stripDot = s => String(s || '').trim().replace(/[.?!]+$/, '');
      const title = stripDot(d.crisisTitle);
      const flavor = stripDot(d.narrative);
      const verb = d.engaged
        ? `they chose to ${(d.choiceLabel || '').toLowerCase()}`
        : `the people did nothing`;
      return `${title} — ${verb}; ${flavor}.`;
    });
    const closer = collapseReason
      ? ` And so, ${collapseReason.charAt(0).toLowerCase()}${collapseReason.slice(1)}`
      : '';
    logEl.innerHTML = `<p class="saga-paragraph">${escapeHtml(sentences.join(' '))}${escapeHtml(closer)}</p>`;
  }

  const statsEl = document.getElementById('verdict-stats');
  const rows = [
    ['Chapters told',     chapter],
    ['Reached era',       ERAS[stats.era].name],
    ['Peak stability',    peakStability],
    ['Peak ambition',     peakAmbition],
    ['Largest spend',     stats.peakAmbitionBurn],
    ['Goal',              goalMet ? `${goal.short} ✦` : `${goal.short} (unfulfilled)`]
  ];
  statsEl.innerHTML = rows.map(([k, v]) =>
    `<div><span class="stat-key">${k}</span>${escapeHtml(String(v))}</div>`
  ).join('');

  document.getElementById('app').className = goalMet ? 'verdict-triumph' : 'verdict-collapse';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Share ─────────────────────────────────────────────────────────────────────
function share() {
  const goal = LEGACY_GOALS[legacyGoal];
  const goalMet = goal.isMet();
  const eraName = ERAS[stats.era].name.toLowerCase();
  const verdict = goalMet ? `achieved the ${goal.short.toLowerCase()}` : `fell short of the ${goal.short.toLowerCase()}`;
  const txt = `The saga of ${civName}: ${chapter} chapters, the ${eraName}, ${verdict}. — benlirio.com/apps/grow-my-civilization/`;
  if (navigator.share) {
    navigator.share({ title: 'Grow My Civilization', text: txt, url: 'https://benlirio.com/apps/grow-my-civilization/' });
  } else {
    navigator.clipboard.writeText(txt).then(() => alert('Copied to clipboard!'));
  }
}

function playAgain() {
  if (animId) cancelAnimationFrame(animId);
  startSetup();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('play-again-btn').addEventListener('click', playAgain);
  document.getElementById('reroll-btn').addEventListener('click', rollName);
  initStars();
  startSetup();
});
