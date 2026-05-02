// Grow My Civilization — survival roguelike with AI-generated decision tree
// Goal: how long can your civilization last? Each choice helps or hurts now or later.
// Questions are AI-generated and cached by choice-path so every player walking the
// same path sees the same prompts (deterministic tree).

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

// Stats. All bounded 0..100 unless noted; pop and tech unbounded; treasury -50..100 (debt allowed).
// Death conditions: pop<=0, food<=0, order<=0, health<=0, treasury<=-50, or military<=0 once pop>100.
let stats = {
  population: 1,
  food: 55,        // feeds the people; drains with pop
  order: 55,       // internal cohesion; erodes with crowding, debt, low health
  health: 65,      // disease/sanitation; drops in plague, drains with low food/order
  military: 25,    // defends against raids; small upkeep drains treasury
  treasury: 15,    // wealth/debt; military upkeep drains it, prosperity refills it
  tech: 0,         // unbounded; gates eras
  culture: 50      // soft stat; affects verdict tone, no hard fail
};
let peakPopulation = 1;
let peakTech = 0;

let turnNumber = 0; // how many decisions resolved
let pathKey = '';   // string of choice indices joined, e.g. "0,1,2,0"
let chronicle = []; // [{ event, choice, flavor, era, turn }]
let pendingEffects = []; // [{ triggerTurn, effect, label }]

let pendingDecision = null; // { event, choices: [{ label, effect, longTermEffect, longTermDelay, flavor }] }
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
const CACHE_KEY = 'gmc_question_cache_v2';
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
  const recent = chronicleSnapshot.slice(-3).map(c => `[${c.era}] ${c.choice}`).join(' | ') || 'none yet';

  const sys = `You generate dilemmas for a HARSH civilization-survival game. The player leads "${civName}". Output ONLY valid JSON. Survival is hard — most civilizations die. Each dilemma is era-appropriate, dramatic, and forces a real cross-system tradeoff: gaining one stat almost always costs others. Choices have IMMEDIATE effects and a LONG-TERM effect that fires later (3-6 turns). Effects are integers on these stats: food, order, health, military, treasury, tech, culture, population (treasury can go negative — debt). Each immediate effect MUST touch at least 2 stats (typically one positive, one negative). "Safe" / "do nothing" choices should still bleed something — there is no costless option. Hidden long-term costs are encouraged: a tempting boost now should often have a brutal echo later.`;

  const user = `Current era: ${era}. Stats: pop=${statsSnapshot.population}, food=${Math.round(statsSnapshot.food)}, order=${Math.round(statsSnapshot.order)}, health=${Math.round(statsSnapshot.health)}, military=${Math.round(statsSnapshot.military)}, treasury=${Math.round(statsSnapshot.treasury)}, tech=${Math.round(statsSnapshot.tech)}, culture=${Math.round(statsSnapshot.culture)}. Turn ${turnNumber + 1}. Recent decisions: ${recent}. Path key: ${cacheKey}.

Respond with JSON exactly matching this schema:
{
  "event": "1-2 sentence dilemma description (reference current weak stats when relevant — e.g. famine pressure if food is low)",
  "choices": [
    {
      "label": "SHORT IMPERATIVE LABEL (2-5 words, all caps)",
      "flavor": "One short evocative sentence after picking (do NOT narrate the numbers)",
      "effect": { "food": 0, "order": 0, "health": 0, "military": 0, "treasury": 0, "tech": 0, "culture": 0, "population": 0 },
      "longTermDelay": 4,
      "longTermEffect": { "food": 0, "order": 0, "health": 0, "military": 0, "treasury": 0, "tech": 0, "culture": 0, "population": 0 },
      "longTermFlavor": "What unfolds when delayed effect fires (one short sentence)"
    }
  ]
}
Include 2-4 choices. Omit any stat keys that don't change. Numbers: most ±5 to ±15, max ±30 for catastrophic decisions. Each immediate effect must contain at least 2 nonzero stats. Long-term effects may be empty for genuinely small choices, but most should land hard.`;

  const body = {
    slug: SLUG,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ],
    model: 'gpt-5.4-mini',
    max_tokens: 600,
    temperature: 0.9,
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
  parsed.choices = parsed.choices.slice(0, 4).map(c => ({
    label: String(c.label || 'PROCEED').toUpperCase().slice(0, 40),
    flavor: String(c.flavor || ''),
    effect: clampEffect(c.effect),
    longTermDelay: clampInt(c.longTermDelay, 3, 6, 4),
    longTermEffect: clampEffect(c.longTermEffect),
    longTermFlavor: String(c.longTermFlavor || '')
  }));
  parsed.event = String(parsed.event || 'A choice is upon you.');
  parsed._t = Date.now();

  questionCache[cacheKey] = parsed;
  persistCache();
  return parsed;
}

function clampEffect(e) {
  const out = {};
  const keys = ['food', 'order', 'health', 'military', 'treasury', 'tech', 'culture', 'population'];
  if (!e || typeof e !== 'object') return out;
  for (const k of keys) {
    if (typeof e[k] === 'number' && e[k] !== 0) {
      out[k] = Math.max(-30, Math.min(30, Math.round(e[k])));
    }
  }
  return out;
}

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

// ── Fallback question (used if AI is unreachable) ─────────────────────────────
function fallbackQuestion() {
  return {
    event: 'The oracles fall silent. Your council must decide blind, and the silence itself carries cost.',
    choices: [
      {
        label: 'PRESS ON',
        flavor: 'You march forward without their counsel.',
        effect: { order: -5, military: +4, treasury: -4, tech: +2 },
        longTermDelay: 4,
        longTermEffect: { culture: +6, health: -5 },
        longTermFlavor: 'Tales of your boldness spread, but the wounded never fully recover.'
      },
      {
        label: 'WAIT IT OUT',
        flavor: 'You hold position, conserving strength.',
        effect: { food: -4, order: +3, treasury: -3 },
        longTermDelay: 4,
        longTermEffect: { tech: -5, military: -4 },
        longTermFlavor: 'Rivals out-pace you while you waited.'
      }
    ]
  };
}

// ── Start Game ────────────────────────────────────────────────────────────────
function startGame() {
  if (!civName) civName = generateCivName();

  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('game-panel').style.display = 'flex';
  document.getElementById('civ-title').textContent = civName;

  // Reset state
  stats = { population: 1, food: 55, order: 55, health: 65, military: 25, treasury: 15, tech: 0, culture: 50 };
  peakPopulation = 1;
  peakTech = 0;
  turnNumber = 0;
  pathKey = '';
  chronicle = [];
  pendingEffects = [];
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

  phase = 'running';
  updateHUD();
  animId = requestAnimationFrame(gameLoop);
  nextTurn();
}

// ── Turn Loop ─────────────────────────────────────────────────────────────────
async function nextTurn() {
  if (gameOver) return;

  // Apply any long-term effects whose trigger turn has come.
  const firing = pendingEffects.filter(p => p.triggerTurn === turnNumber);
  pendingEffects = pendingEffects.filter(p => p.triggerTurn !== turnNumber);
  let echoText = '';
  if (firing.length) {
    firing.forEach(p => {
      applyEffect(p.effect);
      if (p.flavor) echoText += (echoText ? '  ' : '') + `◆ ${p.flavor}`;
    });
  }

  // Check collapse from any cause before posing next dilemma.
  if (checkCollapse()) {
    triggerCollapse();
    return;
  }

  // Show "thinking" while we fetch.
  phase = 'thinking';
  document.getElementById('decision-panel').style.display = 'none';
  document.getElementById('thinking-panel').style.display = 'flex';

  let q;
  try {
    q = await fetchQuestion(pathKey, { ...stats }, chronicle.slice());
  } catch (e) {
    q = fallbackQuestion();
  }
  pendingDecision = q;
  presentDecision(q, echoText);
}

function presentDecision(q, echoText) {
  phase = 'decision';
  document.getElementById('thinking-panel').style.display = 'none';
  document.getElementById('decision-panel').style.display = 'flex';
  document.getElementById('decision-event').textContent = q.event;
  // Show any long-term echo from a past choice in the flavor slot until the
  // user picks something new.
  document.getElementById('decision-flavor').textContent = echoText || '';

  const choicesEl = document.getElementById('decision-choices');
  choicesEl.innerHTML = '';
  // Adapt grid: 1 col when >2 choices to give labels room.
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

  // Apply immediate effect.
  applyEffect(choice.effect);

  // Schedule long-term effect.
  if (choice.longTermEffect && Object.keys(choice.longTermEffect).length) {
    pendingEffects.push({
      triggerTurn: turnNumber + (choice.longTermDelay || 4),
      effect: choice.longTermEffect,
      flavor: choice.longTermFlavor || ''
    });
  }

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
  setTimeout(() => {
    if (gameOver) return;
    document.getElementById('decision-panel').style.display = 'none';
    nextTurn();
  }, 1400);
}

// ── Effects, Stats Drift, Collapse ────────────────────────────────────────────
function applyEffect(eff) {
  if (!eff) return;
  if (eff.food)       stats.food = clamp(stats.food + eff.food, 0, 100);
  if (eff.order)      stats.order = clamp(stats.order + eff.order, 0, 100);
  if (eff.health)     stats.health = clamp(stats.health + eff.health, 0, 100);
  if (eff.military)   stats.military = clamp(stats.military + eff.military, 0, 100);
  if (eff.treasury)   stats.treasury = clamp(stats.treasury + eff.treasury, -50, 100);
  if (eff.tech)       stats.tech = Math.max(0, stats.tech + eff.tech);
  if (eff.culture)    stats.culture = clamp(stats.culture + eff.culture, 0, 100);
  if (eff.population) stats.population = Math.max(0, stats.population + eff.population);

  peakPopulation = Math.max(peakPopulation, stats.population);
  peakTech = Math.max(peakTech, stats.tech);
}

// Per-turn drift. Interlocking and unforgiving — each system feeds the next:
// pop consumes food, low food/order rots health, military upkeep drains
// treasury, debt rots order, crowding erodes order. Growth is gated by the
// WORST of food/order/health (bottleneck rule) — every system has to be
// healthy to grow, but any one can sink the civ.
function driftAfterTurn() {
  // 1. Food consumption scales with population (log so huge civs don't insta-starve).
  const consumption = 1 + Math.log10(Math.max(10, stats.population)) * 1.2;
  stats.food = clamp(stats.food - consumption, 0, 100);

  // 2. Health drain — baseline trickle, plus penalties when food/order are weak.
  let healthDrain = 0.8;
  if (stats.food < 30)  healthDrain += 2.5;
  if (stats.order < 30) healthDrain += 1.8;
  stats.health = clamp(stats.health - healthDrain, 0, 100);

  // 3. Military upkeep — bigger army costs more coin, AND the army slowly
  //    decays without active investment.
  const upkeep = stats.military / 25; // 0..4 coin/turn
  stats.treasury = clamp(stats.treasury - upkeep, -50, 100);
  stats.military = clamp(stats.military - 0.6, 0, 100);

  // 4. Treasury can refill from a stable, sizable population (taxation).
  if (stats.order > 50 && stats.population > 5) {
    const tax = Math.min(3.5, Math.log10(Math.max(10, stats.population)) * 0.6 * (stats.order / 100));
    stats.treasury = clamp(stats.treasury + tax, -50, 100);
  }

  // 5. Order pressures — crowding hurts; debt hurts; sickness hurts.
  let orderDrain = 0;
  if (stats.population > 100) orderDrain += (Math.log10(stats.population) - 2) * 0.7; // grows with size
  if (stats.treasury < 0)     orderDrain += Math.abs(stats.treasury) / 18;            // debt rots cohesion
  if (stats.health < 40)      orderDrain += (40 - stats.health) / 25;                 // sickness panics
  stats.order = clamp(stats.order - orderDrain, 0, 100);

  // 6. Population growth — bottlenecked by the WEAKEST of food/order/health.
  //    A single failing pillar can collapse the population.
  const minVital = Math.min(stats.food, stats.order, stats.health);
  const vitalPressure = (minVital - 45) / 20; // -2.25..+2.75
  const techBonus = stats.tech / 80;
  const growth = vitalPressure * (0.55 + techBonus * 0.35);
  const delta = Math.round(stats.population * growth * 0.10 + growth);
  stats.population = Math.max(0, stats.population + delta);

  // 7. Tech creeps up only when there's an ordered population to do the work.
  if (stats.population > 0 && stats.order > 25) {
    stats.tech = stats.tech + 0.4 + Math.log10(Math.max(10, stats.population)) * 0.12;
  }

  peakPopulation = Math.max(peakPopulation, stats.population);
  peakTech = Math.max(peakTech, stats.tech);
}

function checkCollapse() {
  if (stats.population <= 0)  { collapseReason = 'Your last hearth went cold. The civilization is no more.'; return true; }
  if (stats.food <= 0)        { collapseReason = 'Famine swept the land. None remained to bury the rest.'; return true; }
  if (stats.order <= 0)       { collapseReason = 'Civil war shattered every institution. Nothing held.'; return true; }
  if (stats.health <= 0)      { collapseReason = 'Plague hollowed the streets. The healers died last.'; return true; }
  if (stats.treasury <= -50)  { collapseReason = 'The treasury defaulted. Creditors descended; nothing remained.'; return true; }
  // Once you're a real civilization, having no army means a single raid ends you.
  if (stats.military <= 0 && stats.population > 100) {
    collapseReason = 'Defenseless, the city was taken in a single night.';
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
  const h = 8 + Math.floor(visualRng() * (10 + eraIdx * 2.2 + stats.order * 0.08));
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
  const colorful = stats.culture > 60;
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
  document.getElementById('stat-food').textContent = Math.round(stats.food);
  document.getElementById('stat-order').textContent = Math.round(stats.order);
  document.getElementById('stat-health').textContent = Math.round(stats.health);
  document.getElementById('stat-military').textContent = Math.round(stats.military);
  document.getElementById('stat-treasury').textContent = Math.round(stats.treasury);
  document.getElementById('stat-tech').textContent = Math.round(stats.tech);
  document.getElementById('stat-turns').textContent = turnNumber;
  document.getElementById('age-badge').textContent = ERAS[eraIdx].name;
  document.getElementById('era-label').textContent = `${ERAS[eraIdx].name} · Turn ${turnNumber}`;

  // Warn-color anything dangerous. Treasury warns when in debt; military warns
  // once the civ is large enough that defenselessness becomes lethal.
  document.getElementById('stat-food').classList.toggle('warn', stats.food < 25);
  document.getElementById('stat-order').classList.toggle('warn', stats.order < 25);
  document.getElementById('stat-health').classList.toggle('warn', stats.health < 25);
  document.getElementById('stat-military').classList.toggle('warn', stats.military < 15 && stats.population > 80);
  document.getElementById('stat-treasury').classList.toggle('warn', stats.treasury < 0);
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
      ctx.globalAlpha = Math.min(0.85, 0.3 + stats.order / 200 + stats.tech / 200);
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

  // Low-stat overlay tint (red flicker when ANY hard-fail stat is critical).
  if (stats.food < 20 || stats.order < 20 || stats.health < 20 || stats.treasury < -25) {
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
  document.getElementById('thinking-panel').style.display = 'none';
  document.getElementById('verdict-panel').style.display = 'flex';
  document.getElementById('share').style.display = 'block';

  const outcome = triumph ? 'A Lasting Legacy' : 'A Civilization Lost';
  document.getElementById('verdict-title').textContent = outcome;
  document.getElementById('verdict-civ-name').textContent = civName;

  const logEl = document.getElementById('verdict-decisions');
  if (chronicle.length === 0) {
    logEl.innerHTML = '<div class="decision-line">No decisions recorded.</div>';
  } else {
    logEl.innerHTML = chronicle.map(d =>
      `<div class="decision-line"><span class="turn-tag">Turn ${d.turn} · ${d.era}</span><br><span class="decision-choice">${escapeHtml(d.choice)}</span><span class="decision-flavor">${escapeHtml(d.flavor)}</span></div>`
    ).join('');
  }

  const eraIdx = eraIndexFromTech(peakTech);
  const statsEl = document.getElementById('verdict-stats');
  const rows = [
    ['Turns survived', turnNumber],
    ['Peak population', formatPop(peakPopulation)],
    ['Peak era', ERAS[eraIdx].name],
    ['Peak tech', Math.round(peakTech)],
  ];
  if (collapseReason) rows.push(['Cause', collapseReason]);
  statsEl.innerHTML = rows.map(([k, v]) =>
    `<div><span class="stat-key">${k}</span>${escapeHtml(String(v))}</div>`
  ).join('');

  document.getElementById('app').className = triumph ? 'verdict-triumph' : 'verdict-collapse';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Share ─────────────────────────────────────────────────────────────────────
function share() {
  const eraName = ERAS[eraIndexFromTech(peakTech)].name.toLowerCase();
  const txt = `${civName} lasted ${turnNumber} turns and reached the ${eraName} before ${collapsed ? 'collapsing' : 'enduring'}. Peak population: ${formatPop(peakPopulation)}. — benlirio.com/apps/grow-my-civilization/`;
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
