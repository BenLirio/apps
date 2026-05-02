// Grow My Civilization — saga roguelike with AI-generated story beats
// Goal: how long can your civilization last? Each chapter is a short, simple
// dilemma that continues directly from the previous one — read it as a story.
// Questions are AI-generated and cached by choice-path so every player walking
// the same path sees the same chapters (deterministic tree).

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

// ── Eras (descriptive, advance with tech) ─────────────────────────────────────
const ERAS = [
  { name: 'STONE AGE',   minTech: 0,   color: '#5a4a3a', bgGrad: ['#0d0d2a','#1a1a3a'] },
  { name: 'COPPER AGE',  minTech: 15,  color: '#8b6a3a', bgGrad: ['#0d0d2a','#1a1a3a'] },
  { name: 'BRONZE AGE',  minTech: 28,  color: '#a07830', bgGrad: ['#1a1430','#2a1a40'] },
  { name: 'IRON AGE',    minTech: 40,  color: '#6a7a8a', bgGrad: ['#2a1830','#3a2840'] },
  { name: 'CLASSICAL',   minTech: 52,  color: '#c8a84a', bgGrad: ['#2a2040','#4a3050'] },
  { name: 'MEDIEVAL',    minTech: 64,  color: '#5a8a5a', bgGrad: ['#3a2840','#5a3858'] },
  { name: 'RENAISSANCE', minTech: 75,  color: '#a05a78', bgGrad: ['#2a2848','#3a3858'] },
  { name: 'INDUSTRIAL',  minTech: 85,  color: '#888888', bgGrad: ['#1a1840','#2a2848'] },
  { name: 'ATOMIC',      minTech: 95,  color: '#5a9aaa', bgGrad: ['#1a1838','#1a1838'] },
  { name: 'DIGITAL',     minTech: 105, color: '#6a5aaa', bgGrad: ['#0d0d20','#0d0d20'] },
  { name: 'STELLAR',     minTech: 120, color: '#aaaaff', bgGrad: ['#000010','#101030'] },
];

const BUILDING_PALETTES_BY_ERA = [
  ['#5a4a3a','#3a2a2a'], // stone
  ['#8b6030','#5a3820'], // copper
  ['#a07028','#6a4818'], // bronze
  ['#707888','#484e58'], // iron
  ['#c8a040','#888030'], // classical
  ['#507848','#305830'], // medieval
  ['#903870','#601848'], // renaissance
  ['#787878','#484848'], // industrial
  ['#4888a0','#285878'], // atomic
  ['#584898','#382868'], // digital
  ['#a8a8ff','#5050a0'], // stellar
];

function eraIndexFromTech(tech) {
  let idx = 0;
  for (let i = 0; i < ERAS.length; i++) {
    if (tech >= ERAS[i].minTech) idx = i;
  }
  return idx;
}

// ── Name Generator ────────────────────────────────────────────────────────────
const NAME_ADJECTIVES = [
  'Iron', 'Hollow', 'Bronze', 'Salt', 'Glass', 'Cinder', 'Velvet', 'Storm',
  'Pale', 'Crimson', 'Quiet', 'Wandering', 'Marble', 'Last', 'First', 'Hidden',
  'Verdant', 'Distant', 'Bone', 'River', 'Spire', 'Ember', 'Briar', 'Crooked',
  'Whispering', 'Twilight', 'Open', 'Shrouded', 'Auric', 'Granite', 'Lantern',
  'Silken', 'Drowsy', 'Northern', 'Southern', 'Forgotten'
];
const NAME_NOUNS = [
  'Shore', 'Empire', 'Council', 'Republic', 'Hold', 'Reach', 'Vale', 'Spires',
  'Hollows', 'Folk', 'Hearth', 'Coast', 'Crown', 'Gate', 'Wardens', 'Tide',
  'Banner', 'Wake', 'Clan', 'Dominion', 'Concordat', 'Court', 'Choir',
  'Cartographers', 'Stewards', 'Magistracy', 'Wayfarers', 'Glassblowers',
  'Almanac', 'Beacon', 'Garrison', 'Hearthstones', 'Lighthouse', 'Mariners',
  'Saltmakers', 'Threshold'
];

function generateCivName() {
  const a = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const n = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `The ${a} ${n}`;
}

// ── Game State ────────────────────────────────────────────────────────────────
let civName = '';
let phase = 'setup'; // setup | running | thinking | decision | verdict

// Single visible axis: `fortune` ranges -100..+100 and drives whether the
// civilization grows, holds, or crumbles. `population` and `tech` are tracked
// for visuals + era progression but never asked of the player as a number.
//
// Death conditions: pop<=0 OR fortune<=-95.
let stats = {
  population: 1,
  tech: 0,
  fortune: 20    // start cautiously hopeful
};
let peakPopulation = 1;
let peakTech = 0;
let peakFortune = 20;

let turnNumber = 0; // how many decisions resolved
let pathKey = '';   // string of choice indices joined, e.g. "0,1,2,0"
let chronicle = []; // [{ event, choice, flavor, era, turn }]

let pendingDecision = null; // { event, choices: [{ label, effect, flavor }] }
let gameOver = false;
let collapsed = false;
let collapseReason = '';

// Visual entities
let buildings = [];
let people = [];
let fires = [];
let explosions = [];
let stars = [];
let triumphs = [];
let animId = null;
let lastTs = null;

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 360, H = 300;

// ── Stars / Setup canvas ──────────────────────────────────────────────────────
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

  // Lone campfire
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

// ── Cache ─────────────────────────────────────────────────────────────────────
// Questions are keyed by path so the same sequence of choices always yields
// the same next question — for any browser that's already walked there. We
// also persist across reloads via localStorage so one player's exploration
// helps the next.
// v3 — saga rewrite: simpler chapter/continuation prompt, single-axis effects.
// v2 cache entries used the old multi-stat schema and would break the new
// rendering, so bump the key to start fresh.
const CACHE_KEY = 'gmc_question_cache_v3';
let questionCache = {};
try {
  questionCache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
} catch (e) { questionCache = {}; }

function persistCache() {
  try {
    // Don't let the cache grow forever — soft cap.
    const keys = Object.keys(questionCache);
    if (keys.length > 400) {
      // Drop the oldest by insertion order (we stored _t).
      keys.sort((a, b) => (questionCache[a]._t || 0) - (questionCache[b]._t || 0));
      for (let i = 0; i < keys.length - 300; i++) delete questionCache[keys[i]];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(questionCache));
  } catch (e) { /* ignore */ }
}

// ── AI Question Generation ────────────────────────────────────────────────────
async function fetchQuestion(path, statsSnapshot, chronicleSnapshot) {
  const cacheKey = path || 'ROOT';
  if (questionCache[cacheKey]) return questionCache[cacheKey];

  const era = ERAS[eraIndexFromTech(statsSnapshot.tech)].name;
  const lastChapter = chronicleSnapshot.length
    ? chronicleSnapshot[chronicleSnapshot.length - 1]
    : null;
  const lastEvent  = lastChapter ? lastChapter.event   : '';
  const lastChoice = lastChapter ? lastChapter.choice  : '';
  const lastFlavor = lastChapter ? lastChapter.flavor  : '';

  // Brief 1-line state string the model uses to color the next chapter without
  // exposing numbers to the player.
  const state = stateLabelForFortune(statsSnapshot.fortune);

  const sys = `You write short, simple chapters of a continuing story about the civilization "${civName}". Output ONLY valid JSON. Each chapter is ONE sentence (max 18 words) describing a single, concrete event the people now face — never abstract dilemmas. Each chapter MUST continue directly from the previous chapter's chosen action and outcome (don't repeat them; build on them). Choices are 2 OR 3 short imperative options (2-4 words each, Title Case, no all-caps). Each choice has a fortune effect in [-25, +25] and ONE evocative short-sentence flavor (max 14 words) describing what unfolds. Stay era-appropriate. Vary the kinds of events: people, weather, neighbors, faith, illness, harvest, strangers — not just battles. The story should feel like a folk-tale or saga, not a strategy game.`;

  const continuation = lastChapter
    ? `Previous chapter: "${lastEvent}" → They chose: "${lastChoice}" → What followed: "${lastFlavor}". Write the next chapter that flows directly from "what followed".`
    : `This is Chapter 1. The civilization is just beginning. Open with a small, grounded first event (a found resource, a stranger, a sign, a season). Do NOT start with "The civilization began…".`;

  const user = `Era: ${era}. State of the people: ${state}. Chapter ${turnNumber + 1}.

${continuation}

Respond with JSON exactly matching this schema:
{
  "event": "ONE sentence, max 18 words, concrete event (no numbers, no stats jargon).",
  "choices": [
    {
      "label": "Two To Four Words",
      "flavor": "One sentence, max 14 words, what unfolds after the choice (no numbers).",
      "effect": { "fortune": 0 }
    }
  ]
}
Include 2 or 3 choices. Each must have a different fortune effect (mix of positive and negative). Typical magnitudes: ±5 to ±15. Reserve ±20 to ±25 for genuinely consequential choices. NEVER include stat names like "food" or "treasury" in the prose. NEVER reference numbers. Keep prose plain and readable.`;

  const body = {
    slug: SLUG,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ],
    model: 'gpt-5.4-mini',
    max_tokens: 500,
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

  // Sanitize.
  if (!parsed || !Array.isArray(parsed.choices) || parsed.choices.length < 2) {
    throw new Error('ai_bad_shape');
  }
  parsed.choices = parsed.choices.slice(0, 3).map(c => ({
    label: titleCaseClip(String(c.label || 'Press On'), 28),
    flavor: clipSentence(String(c.flavor || ''), 110),
    effect: clampSimpleEffect(c.effect)
  }));
  parsed.event = clipSentence(String(parsed.event || 'A choice is upon you.'), 140);
  parsed._t = Date.now();

  questionCache[cacheKey] = parsed;
  persistCache();
  return parsed;
}

function clampSimpleEffect(e) {
  const out = { fortune: 0 };
  if (e && typeof e === 'object' && typeof e.fortune === 'number') {
    out.fortune = Math.max(-25, Math.min(25, Math.round(e.fortune)));
  }
  return out;
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
  // Don't force-titlecase — model already returns Title Case; just clip + strip
  // accidental trailing punctuation.
  s = s.replace(/[.?!:;]+$/, '');
  return s.length > maxLen ? s.slice(0, maxLen).trimEnd() + '…' : s;
}

// Hidden 5-bucket label of fortune — never shown as a number to the player,
// only as a 1-word state on the HUD and as flavor for the AI prompt.
function stateLabelForFortune(f) {
  if (f >=  60) return 'Thriving';
  if (f >=  20) return 'Holding';
  if (f >= -20) return 'Uneasy';
  if (f >= -60) return 'Faltering';
  return 'Crumbling';
}

// ── Fallback question (used if AI is unreachable) ─────────────────────────────
function fallbackQuestion() {
  const beats = [
    {
      event: 'A wandering trader offers grain in exchange for a season of guarded passage.',
      choices: [
        { label: 'Strike The Bargain', flavor: 'The granary fills; warriors march beside the trader.',  effect: { fortune: +8 } },
        { label: 'Refuse The Trade',   flavor: 'They leave, muttering. The villagers go to bed hungry.', effect: { fortune: -6 } }
      ]
    },
    {
      event: 'The first frost arrives a month early and the river skins over.',
      choices: [
        { label: 'Burn The Reserves', flavor: 'Fires roar through the night. Everyone wakes warm.',     effect: { fortune: +6 } },
        { label: 'Ration The Wood',   flavor: 'Some elders do not survive the cold.',                   effect: { fortune: -10 } },
        { label: 'Pray For Mercy',    flavor: 'A wind shifts the air. Whether it heard, no one knows.', effect: { fortune: -2 } }
      ]
    },
    {
      event: 'A child returns from the woods speaking words no one taught her.',
      choices: [
        { label: 'Mark Her A Seer', flavor: 'The people begin to whisper, then to listen.',          effect: { fortune: +4 } },
        { label: 'Send Her Away',   flavor: 'She vanishes by morning. The woods grow louder at night.', effect: { fortune: -8 } }
      ]
    }
  ];
  return beats[Math.floor(Math.random() * beats.length)];
}

// ── Start Game ────────────────────────────────────────────────────────────────
function startGame() {
  if (!civName) civName = generateCivName();

  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('game-panel').style.display = 'flex';
  document.getElementById('civ-title').textContent = civName;

  // Reset state
  stats = { population: 1, tech: 0, fortune: 20 };
  peakPopulation = 1;
  peakTech = 0;
  peakFortune = 20;
  turnNumber = 0;
  pathKey = '';
  chronicle = [];
  pendingDecision = null;
  gameOver = false;
  collapsed = false;
  collapseReason = '';

  buildings = [];
  people = [];
  fires = [{ x: W / 2, y: H - 60, size: 6, age: 0 }];
  explosions = [];
  triumphs = [];
  lastTs = null;

  // Mount the decision panel for the whole game. nextTurn/presentDecision
  // toggle inner state instead of swapping panels, so the page height stays
  // stable across the thinking ↔ ready transitions.
  document.getElementById('decision-panel').style.display = 'flex';

  phase = 'running';
  updateHUD();
  animId = requestAnimationFrame(gameLoop);
  nextTurn();
}

// ── Turn Loop ─────────────────────────────────────────────────────────────────
function setChapterHeader() {
  const chapterTag = document.getElementById('decision-era-tag');
  if (chapterTag) chapterTag.textContent = `Chapter ${turnNumber + 1}`;

  const recapEl = document.getElementById('story-so-far');
  if (recapEl) {
    if (chronicle.length) {
      const last = chronicle[chronicle.length - 1];
      recapEl.textContent = `Last chapter: ${last.flavor}`;
      recapEl.style.display = 'block';
    } else {
      recapEl.textContent = '';
      recapEl.style.display = 'none';
    }
  }
}

async function nextTurn() {
  if (gameOver) return;

  // Check collapse before posing next dilemma.
  if (checkCollapse()) {
    triggerCollapse();
    return;
  }

  // Update header now so the chapter tag is correct while the user waits.
  setChapterHeader();

  // Show "thinking" inside the persistent decision panel — no panel swap.
  phase = 'thinking';
  document.getElementById('decision-ready').style.display = 'none';
  document.getElementById('decision-thinking').style.display = 'flex';

  let q;
  try {
    q = await fetchQuestion(pathKey, { ...stats }, chronicle.slice());
  } catch (e) {
    q = fallbackQuestion();
  }
  pendingDecision = q;
  presentDecision(q);
}

function presentDecision(q) {
  phase = 'decision';
  document.getElementById('decision-thinking').style.display = 'none';
  document.getElementById('decision-ready').style.display = 'flex';

  setChapterHeader();

  document.getElementById('decision-event').textContent = q.event;
  document.getElementById('decision-flavor').textContent = '';

  const choicesEl = document.getElementById('decision-choices');
  choicesEl.innerHTML = '';
  choicesEl.style.gridTemplateColumns = q.choices.length >= 3 ? '1fr' : '1fr 1fr';

  q.choices.forEach((c, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = c.label;
    btn.addEventListener('click', () => resolveDecision(idx));
    choicesEl.appendChild(btn);
  });
}

function resolveDecision(idx) {
  if (phase !== 'decision' || !pendingDecision) return;
  const choice = pendingDecision.choices[idx];

  // Lock buttons + highlight the one the user picked. Stays highlighted into
  // the next question, addressing user feedback that the picked choice should
  // visibly persist between dilemmas.
  const btns = document.querySelectorAll('#decision-choices .choice-btn');
  btns.forEach((b, i) => {
    b.disabled = true;
    if (i === idx) b.classList.add('picked');
  });

  // Apply effect (single fortune axis).
  applyEffect(choice.effect);

  const era = ERAS[eraIndexFromTech(stats.tech)].name;
  chronicle.push({
    event: pendingDecision.event,
    choice: choice.label,
    flavor: choice.flavor,
    era,
    turn: turnNumber + 1
  });

  document.getElementById('decision-flavor').textContent = choice.flavor;

  turnNumber++;
  pathKey = pathKey ? `${pathKey},${idx}` : `${idx}`;

  // Per-turn organic drift from food/order/tech.
  driftAfterTurn();
  updateHUD();

  // Brief pause to read flavor + see the highlighted button, then advance.
  // Panel stays mounted; nextTurn just toggles its inner state.
  setTimeout(() => {
    if (gameOver) return;
    nextTurn();
  }, 1400);
}

// ── Effects, Drift, Collapse ──────────────────────────────────────────────────
function applyEffect(eff) {
  if (!eff) return;
  if (typeof eff.fortune === 'number' && eff.fortune !== 0) {
    stats.fortune = clamp(stats.fortune + eff.fortune, -100, 100);
  }
  peakFortune = Math.max(peakFortune, stats.fortune);
}

// Per-turn drift. Single axis, simple feedback:
//   - fortune slowly bleeds toward zero (entropy)
//   - population grows when fortune is positive, shrinks when negative
//   - tech advances when fortune > 0 and there are people
function driftAfterTurn() {
  // Mild entropy — fortune drifts toward 0 each turn.
  if (stats.fortune > 0) stats.fortune = Math.max(0, stats.fortune - 1.5);
  else if (stats.fortune < 0) stats.fortune = Math.min(0, stats.fortune + 1.0);

  // Population: grows quickly with positive fortune, dies off quickly with very
  // negative fortune. The curve is intentionally forgiving early so a fledgling
  // civ has a chance to find its feet.
  const growthFactor = stats.fortune / 100; // -1..+1
  if (growthFactor > 0) {
    const grown = Math.max(1, Math.round(stats.population * (0.18 + growthFactor * 0.22)));
    stats.population = stats.population + grown;
  } else if (growthFactor < -0.2) {
    const lost = Math.max(1, Math.round(stats.population * Math.abs(growthFactor) * 0.30));
    stats.population = Math.max(0, stats.population - lost);
  }

  // Tech: creeps up when fortune is non-negative and there's a community to do the work.
  if (stats.population > 0 && stats.fortune > -10) {
    const ramp = 0.6 + Math.max(0, stats.fortune) / 80;
    stats.tech = stats.tech + ramp + Math.log10(Math.max(10, stats.population)) * 0.10;
  }

  peakPopulation = Math.max(peakPopulation, stats.population);
  peakTech = Math.max(peakTech, stats.tech);
  peakFortune = Math.max(peakFortune, stats.fortune);
}

function checkCollapse() {
  if (stats.population <= 0) {
    collapseReason = 'The last hearth went cold. The civilization is no more.';
    return true;
  }
  if (stats.fortune <= -95) {
    collapseReason = 'The people lost all hope. By morning, the village was empty.';
    return true;
  }
  return false;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Game Loop (visuals) ───────────────────────────────────────────────────────
function gameLoop(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min(ts - lastTs, 100);
  lastTs = ts;

  // Visual entity counts driven by stats.
  if (!gameOver) {
    const eraIdx = eraIndexFromTech(stats.tech);

    const targetFires = Math.max(1, Math.min(8, Math.floor(stats.population * 0.02)));
    while (fires.length < targetFires) {
      fires.push({ x: 20 + visualRng() * (W - 40), y: H - 55 - visualRng() * 30, size: 3 + visualRng() * 4, age: 0 });
    }
    while (fires.length > targetFires + 1) fires.shift();

    const targetBuildings = Math.min(60, Math.floor(stats.population * 0.5 + stats.tech * 0.4));
    while (buildings.length < targetBuildings) spawnBuilding(eraIdx);
    while (buildings.length > targetBuildings + 4) buildings.shift();

    const targetPeople = Math.min(28, Math.max(0, Math.floor(stats.population * 0.6)));
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
  // Stats influence height/width — order = neat tall buildings, low order = scattered shorter.
  // Buildings grow taller when the people are flourishing (positive fortune).
  const orderProxy = Math.max(0, stats.fortune);
  const h = 8 + Math.floor(visualRng() * (10 + eraIdx * 2.2 + orderProxy * 0.08));
  const w = 8 + Math.floor(visualRng() * (5 + eraIdx * 1.2));
  buildings.push({
    x: 18 + visualRng() * (W - 36),
    y: groundY - h,
    w, h,
    era: eraIdx
  });
}

function spawnPerson(eraIdx) {
  // Color hints from culture: high culture = colorful clothes, low = drab.
  // Colorful crowds when fortune is high; drab when struggling.
  const colorful = stats.fortune > 30;
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
  const eraIdx = eraIndexFromTech(stats.tech);
  document.getElementById('stat-pop').textContent = formatPop(stats.population);
  document.getElementById('stat-status').textContent = stateLabelForFortune(stats.fortune);
  document.getElementById('stat-turns').textContent = turnNumber;
  document.getElementById('age-badge').textContent = ERAS[eraIdx].name;
  document.getElementById('era-label').textContent = `${ERAS[eraIdx].name} · Chapter ${turnNumber}`;

  // Warn-color the State pill when things are getting bleak.
  const warn = stats.fortune < -40;
  document.getElementById('stat-status').classList.toggle('warn', warn);
}

function formatPop(n) {
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k';
  if (n < 1e9) return (n / 1e6).toFixed(1) + 'M';
  return (n / 1e9).toFixed(1) + 'B';
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(dt) {
  ctx.clearRect(0, 0, W, H);

  const ei = eraIndexFromTech(stats.tech);
  const [sky1, sky2] = ERAS[Math.min(ei, ERAS.length - 1)].bgGrad;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  skyGrad.addColorStop(0, sky1);
  skyGrad.addColorStop(1, sky2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.65);

  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // Stars fade as tech climbs (skies brighten with civilization light).
  const starAlpha = Math.max(0, 1 - stats.tech / 100);
  if (starAlpha > 0) {
    ctx.globalAlpha = starAlpha;
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.r, s.r));
    ctx.globalAlpha = 1;
  }

  // Moon/Sun based on era half.
  const celestialY = 20 + Math.min(1, stats.tech / 120) * H * 0.3;
  if (stats.tech < 50) {
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

  // Buildings
  const sorted = [...buildings].sort((a, b) => a.y - b.y);
  sorted.forEach(b => {
    const [bc1, bc2] = BUILDING_PALETTES_BY_ERA[Math.min(b.era, BUILDING_PALETTES_BY_ERA.length - 1)];
    ctx.fillStyle = bc1;
    ctx.fillRect(Math.floor(b.x - b.w / 2), Math.floor(b.y), b.w, b.h);
    ctx.fillStyle = bc2;
    ctx.fillRect(Math.floor(b.x + b.w / 2 - 3), Math.floor(b.y), 3, b.h);
    if (b.h > 18 && b.w > 8) {
      ctx.fillStyle = '#ffee88';
      // Window lights brighten when fortune is positive and tech is climbing.
      const lightLevel = Math.max(0, stats.fortune) / 200 + stats.tech / 200;
      ctx.globalAlpha = Math.min(0.85, 0.3 + lightLevel);
      for (let wy = b.y + 4; wy < b.y + b.h - 4; wy += 6) {
        for (let wx = b.x - b.w / 2 + 2; wx < b.x + b.w / 2 - 4; wx += 6) {
          if (visualRng() < 0.55) ctx.fillRect(Math.floor(wx), Math.floor(wy), 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
  });

  // Fires
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

  // People
  people.forEach(p => {
    ctx.fillStyle = p.color;
    const bobY = Math.floor(p.y + Math.sin(p.animFrame * Math.PI * 2) * 1.5);
    ctx.fillRect(Math.floor(p.x) - 1, bobY - 4, 3, 4);
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(Math.floor(p.x) - 1, bobY - 7, 3, 3);
  });

  // Explosions
  explosions.forEach(e => {
    const a = 1 - e.age / e.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = e.color;
    const s = Math.max(1, Math.floor(3 * a));
    ctx.fillRect(Math.floor(e.x) - s, Math.floor(e.y) - s, s * 2, s * 2);
    ctx.globalAlpha = 1;
  });

  // Triumph particles
  triumphs.forEach(t => {
    const a = 1 - t.age / t.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = t.color;
    ctx.fillRect(Math.floor(t.x), Math.floor(t.y), 3, 3);
    ctx.globalAlpha = 1;
  });

  // Red overlay tint when fortune is critical.
  if (stats.fortune < -50) {
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
  collapsed = true;
  phase = 'verdict';
  spawnExplosions();
  setTimeout(() => showVerdict(false), 1800);
}

// Note: we never auto-trigger triumph — survival is the goal. But if pop and
// tech reach thresholds we mark "STELLAR" once for celebration; the player
// chooses to keep going past that or not. (For now we just keep going.)

function showVerdict(triumph) {
  document.getElementById('decision-panel').style.display = 'none';
  document.getElementById('verdict-panel').style.display = 'flex';
  document.getElementById('share').style.display = 'block';

  const outcome = triumph ? 'A Lasting Legacy' : 'A Civilization Lost';
  document.getElementById('verdict-title').textContent = outcome;
  document.getElementById('verdict-civ-name').textContent = civName;

  // Render the chronicle as a flowing saga paragraph rather than a bullet list.
  // Each chapter contributes one short sentence, joined into a single block.
  const logEl = document.getElementById('verdict-decisions');
  if (chronicle.length === 0) {
    logEl.innerHTML = '<div class="saga-empty">The story ended before it began.</div>';
  } else {
    const sentences = chronicle.map(d => {
      // Strip trailing punctuation from event/flavor before joining so we don't
      // get "X.. They chose Y..".
      const stripDot = s => String(s || '').trim().replace(/[.?!]+$/, '');
      const event  = stripDot(d.event);
      const flavor = stripDot(d.flavor);
      return `${event}. They ${verbForChoice(d.choice)} — ${flavor}.`;
    });
    const closer = collapseReason
      ? ` And so, ${collapseReason.charAt(0).toLowerCase()}${collapseReason.slice(1)}`
      : '';
    logEl.innerHTML = `<p class="saga-paragraph">${escapeHtml(sentences.join(' '))}${escapeHtml(closer)}</p>`;
  }

  const eraIdx = eraIndexFromTech(peakTech);
  const statsEl = document.getElementById('verdict-stats');
  const rows = [
    ['Chapters told',   turnNumber],
    ['Peak population', formatPop(peakPopulation)],
    ['Reached era',     ERAS[eraIdx].name],
  ];
  statsEl.innerHTML = rows.map(([k, v]) =>
    `<div><span class="stat-key">${k}</span>${escapeHtml(String(v))}</div>`
  ).join('');

  document.getElementById('app').className = triumph ? 'verdict-triumph' : 'verdict-collapse';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Convert the imperative choice label ("Strike The Bargain", "Build The Wall")
// into a past-tense verb phrase that flows in the saga paragraph
// ("they struck the bargain", "they built the wall"). We don't try to be
// linguistically perfect — just lowercase it; the leading "They" reads fine.
function verbForChoice(label) {
  const s = String(label || '').trim().toLowerCase();
  return s ? `chose to ${s}` : 'chose';
}

// ── Share ─────────────────────────────────────────────────────────────────────
function share() {
  const eraName = ERAS[eraIndexFromTech(peakTech)].name.toLowerCase();
  const txt = `The saga of ${civName} ran ${turnNumber} chapters, reached the ${eraName}, and ended with ${formatPop(peakPopulation)} souls. — benlirio.com/apps/grow-my-civilization/`;
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
