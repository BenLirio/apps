// Grow My Civilization — player-driven pixel civilization builder
// Players name their civ, pick a trait, and make decisions at each era to shape their fate

// ── RNG ────────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(Date.now() & 0xFFFFFFFF);

// ── Civilization Traits ───────────────────────────────────────────────────────
const TRAITS = [
  {
    id: 'militarist',
    label: 'MILITARIST',
    icon: '⚔',
    desc: 'Conquer first, questions later.',
    color: '#ff4444',
    bonus: { growth: 1.3, stability: 0.7, culture: 0.8 }
  },
  {
    id: 'scientist',
    label: 'SCIENTIST',
    icon: '⚗',
    desc: 'Knowledge outlasts empires.',
    color: '#33aaff',
    bonus: { growth: 1.0, stability: 1.2, culture: 1.1 }
  },
  {
    id: 'trader',
    label: 'TRADER',
    icon: '◈',
    desc: 'Wealth buys more than swords.',
    color: '#ffb300',
    bonus: { growth: 1.2, stability: 1.0, culture: 0.9 }
  },
  {
    id: 'cultural',
    label: 'CULTURAL',
    icon: '♪',
    desc: 'Stories survive where walls crumble.',
    color: '#aa66ff',
    bonus: { growth: 0.9, stability: 1.1, culture: 1.5 }
  }
];

// ── Era Decisions ─────────────────────────────────────────────────────────────
// Each era has an event + two choices with different consequences
const ERA_EVENTS = [
  {
    era: 'STONE AGE',
    event: 'A harsh winter. Tribes dispute the last hearth.',
    choices: [
      { label: 'SHARE THE FIRE', effect: { stability: +0.15, growth: +0.1 }, flavor: 'Unity forged in cold.' },
      { label: 'CLAIM IT ALL',   effect: { stability: -0.1, growth: +0.2 }, flavor: 'Strength above kindness.' }
    ]
  },
  {
    era: 'COPPER AGE',
    event: 'Strange shiny ore discovered. The priests call it cursed.',
    choices: [
      { label: 'SMELT IT ANYWAY', effect: { growth: +0.2, culture: -0.1 }, flavor: 'Progress offends tradition.' },
      { label: 'LEAVE IT BURIED', effect: { stability: +0.1, growth: -0.1 }, flavor: 'The gods approve. Barely.' }
    ]
  },
  {
    era: 'BRONZE AGE',
    event: 'A rival tribe requests a trade summit.',
    choices: [
      { label: 'ACCEPT THE TALKS', effect: { stability: +0.2, growth: +0.1 }, flavor: 'Diplomacy is slower than war.' },
      { label: 'RAID THEIR CAMP',  effect: { growth: +0.3, stability: -0.2 }, flavor: 'Faster. Messier.' }
    ]
  },
  {
    era: 'IRON AGE',
    event: 'Drought threatens the grain stores.',
    choices: [
      { label: 'RATION EQUALLY',  effect: { stability: +0.2, growth: -0.1 }, flavor: 'Slow decline, shared fairly.' },
      { label: 'HOARD FOR ELITE', effect: { stability: -0.25, growth: 0   }, flavor: 'Efficiency. At a cost.' }
    ]
  },
  {
    era: 'CLASSICAL',
    event: 'Philosophers demand a say in governance.',
    choices: [
      { label: 'GRANT A COUNCIL', effect: { culture: +0.2, stability: +0.1 }, flavor: 'Wisdom dilutes power.' },
      { label: 'EXILE THEM',      effect: { culture: -0.2, growth: +0.1   }, flavor: 'Quieter. For now.' }
    ]
  },
  {
    era: 'MEDIEVAL',
    event: 'The Church wants a cathedral. It will cost a decade of labour.',
    choices: [
      { label: 'BUILD THE SPIRE', effect: { culture: +0.3, growth: -0.1 }, flavor: 'Faith reaches heaven.' },
      { label: 'BUILD WALLS',     effect: { stability: +0.2, culture: -0.1 }, flavor: 'Heaven waits. Enemies don\'t.' }
    ]
  },
  {
    era: 'RENAISSANCE',
    event: 'A painter proposes obscene art for the palace.',
    choices: [
      { label: 'COMMISSION IT',  effect: { culture: +0.25, stability: -0.05 }, flavor: 'Scandal and beauty, indistinguishable.' },
      { label: 'BURN THE DRAFT', effect: { culture: -0.1, stability: +0.1  }, flavor: 'Order preserved. Boring.' }
    ]
  },
  {
    era: 'INDUSTRIAL',
    event: 'The river runs black with factory runoff.',
    choices: [
      { label: 'CLEAN IT UP',    effect: { stability: +0.15, growth: -0.15 }, flavor: 'Conscience is expensive.' },
      { label: 'KEEP PRODUCING', effect: { growth: +0.25, stability: -0.15 }, flavor: 'Profits first, regrets later.' }
    ]
  },
  {
    era: 'ATOMIC',
    event: 'Scientists unlock fission. Military wants it weaponised.',
    choices: [
      { label: 'POWER CITIES',   effect: { growth: +0.2, stability: +0.1  }, flavor: 'Light instead of fire.' },
      { label: 'BUILD THE BOMB', effect: { growth: +0.1, stability: -0.2  }, flavor: 'Deterrence is a gamble.' }
    ]
  },
  {
    era: 'DIGITAL',
    event: 'An algorithm predicts which citizens will cause trouble.',
    choices: [
      { label: 'DISMANTLE IT',   effect: { culture: +0.2, stability: +0.05 }, flavor: 'Freedom is inefficient. Worth it.' },
      { label: 'DEPLOY IT',      effect: { stability: +0.2, culture: -0.3  }, flavor: 'Order achieved. Humanity optional.' }
    ]
  }
];

// ── Era Definitions ───────────────────────────────────────────────────────────
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
];

const BUILDING_COLORS = [
  ['#5a4a3a','#3a2a2a'],
  ['#8b6030','#5a3820'],
  ['#a07028','#6a4818'],
  ['#707888','#484e58'],
  ['#c8a040','#888030'],
  ['#507848','#305830'],
  ['#903870','#601848'],
  ['#787878','#484848'],
  ['#4888a0','#285878'],
  ['#584898','#382868'],
];

// ── Game State ────────────────────────────────────────────────────────────────
let civName = '';
let chosenTrait = null;

// Runtime sim state
let phase = 'setup'; // setup | running | decision | verdict
let currentEraIdx = 0;
let eraTimer = 0;        // ms within current era
const ERA_DURATION = 9000; // ms per era
let population = 1;
let maxPop = 1;
let stability = 1.0;   // 0..2 range, 1.0 = neutral
let culture = 1.0;
let growthMult = 1.0;
let decisionsChosen = [];
let pendingDecision = null;
let decisionResolved = false;
let decisionFlavorText = '';
let decisionFlavorTimer = 0;
let animId = null;
let lastTs = null;
let gameOver = false;
let collapsed = false;

// Canvas entities
let buildings = [];
let people = [];
let fires = [];
let explosions = [];
let stars = [];
let triumphs = []; // rising particles for triumph

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 360, H = 300;

// ── Setup Screen ──────────────────────────────────────────────────────────────
function initStars() {
  stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({ x: rng() * W, y: rng() * (H * 0.55), r: rng() < 0.3 ? 2 : 1 });
  }
}

function startSetup() {
  phase = 'setup';
  initStars();
  drawSetupCanvas();
  showSetupUI();
}

function showSetupUI() {
  document.getElementById('setup-panel').style.display = 'flex';
  document.getElementById('game-panel').style.display = 'none';
  // decision-panel is inside game-panel, no need to hide separately
  document.getElementById('verdict-panel').style.display = 'none';
  document.getElementById('share').style.display = 'none';

  // Render trait buttons
  const grid = document.getElementById('trait-grid');
  grid.innerHTML = '';
  TRAITS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'trait-btn';
    btn.dataset.id = t.id;
    btn.innerHTML = `<span class="trait-icon">${t.icon}</span><span class="trait-name">${t.label}</span><span class="trait-desc">${t.desc}</span>`;
    btn.style.setProperty('--trait-color', t.color);
    btn.addEventListener('click', () => selectTrait(t.id));
    grid.appendChild(btn);
  });

  document.getElementById('civ-name-input').value = '';
  document.getElementById('start-btn').disabled = true;
  document.getElementById('setup-error').textContent = '';

  document.getElementById('civ-name-input').addEventListener('input', validateSetup);
}

function selectTrait(id) {
  chosenTrait = TRAITS.find(t => t.id === id);
  document.querySelectorAll('.trait-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.id === id);
  });
  validateSetup();
}

function validateSetup() {
  const name = document.getElementById('civ-name-input').value.trim();
  const ok = name.length >= 2 && name.length <= 24 && chosenTrait !== null;
  document.getElementById('start-btn').disabled = !ok;
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

// ── Start Game ────────────────────────────────────────────────────────────────
function startGame() {
  civName = document.getElementById('civ-name-input').value.trim();
  if (!civName || !chosenTrait) return;

  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('game-panel').style.display = 'flex';

  document.getElementById('civ-title').textContent = civName.toUpperCase();
  document.getElementById('trait-badge').textContent = chosenTrait.icon + ' ' + chosenTrait.label;
  document.getElementById('trait-badge').style.color = chosenTrait.color;

  // Init sim
  growthMult = chosenTrait.bonus.growth;
  stability = 1.0 + (chosenTrait.bonus.stability - 1.0);
  culture = 1.0 + (chosenTrait.bonus.culture - 1.0);
  population = 1;
  maxPop = 1;
  currentEraIdx = 0;
  eraTimer = 0;
  decisionsChosen = [];
  gameOver = false;
  collapsed = false;
  buildings = [];
  people = [];
  explosions = [];
  triumphs = [];
  fires = [{ x: W / 2, y: H - 60, size: 6, age: 0 }];
  lastTs = null;

  phase = 'running';
  updateHUD();
  animId = requestAnimationFrame(gameLoop);
}

// ── Decision Gate ─────────────────────────────────────────────────────────────
function triggerDecision(eraIdx) {
  phase = 'decision';
  pendingDecision = ERA_EVENTS[eraIdx];
  decisionResolved = false;

  document.getElementById('decision-panel').style.display = 'flex';
  document.getElementById('decision-event').textContent = pendingDecision.event;
  document.getElementById('decision-flavor').textContent = '';

  const btnA = document.getElementById('choice-a');
  const btnB = document.getElementById('choice-b');

  btnA.textContent = pendingDecision.choices[0].label;
  btnB.textContent = pendingDecision.choices[1].label;
  btnA.onclick = () => resolveDecision(0);
  btnB.onclick = () => resolveDecision(1);
  btnA.disabled = false;
  btnB.disabled = false;
}

function resolveDecision(idx) {
  const choice = pendingDecision.choices[idx];
  const eff = choice.effect;

  if (eff.growth)    growthMult   = Math.max(0.3, growthMult   + eff.growth);
  if (eff.stability) stability    = Math.max(0.1, stability    + eff.stability);
  if (eff.culture)   culture      = Math.max(0.1, culture      + eff.culture);

  decisionsChosen.push({ era: pendingDecision.era, choice: choice.label, flavor: choice.flavor });

  document.getElementById('decision-flavor').textContent = choice.flavor;
  document.getElementById('choice-a').disabled = true;
  document.getElementById('choice-b').disabled = true;

  decisionFlavorText = choice.flavor;
  decisionFlavorTimer = 1200;

  setTimeout(() => {
    document.getElementById('decision-panel').style.display = 'none';
    phase = 'running';
  }, 1200);
}

// ── Simulation Tick ───────────────────────────────────────────────────────────
function gameLoop(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min(ts - lastTs, 100);
  lastTs = ts;

  if (phase === 'running') {
    eraTimer += dt;

    if (eraTimer >= ERA_DURATION) {
      eraTimer = 0;
      if (currentEraIdx < ERAS.length - 1) {
        currentEraIdx++;
        // Check collapse threshold (stability below 0.4 = civ can't sustain)
        if (stability < 0.4) {
          triggerCollapse();
          return;
        }
        triggerDecision(currentEraIdx);
        animId = requestAnimationFrame(gameLoop);
        return;
      } else {
        // Reached end — final fate
        triggerVerdict();
        return;
      }
    }

    // Population: base growth curve shaped by trait bonuses and player choices
    const eraFrac = eraTimer / ERA_DURATION;
    const totalProgress = (currentEraIdx + eraFrac) / ERAS.length;
    const baseCurve = Math.sin(totalProgress * Math.PI * 0.7 + 0.3);
    const targetPop = Math.max(1, Math.floor(baseCurve * 120 * growthMult * Math.max(0.1, stability)));
    population = targetPop;
    maxPop = Math.max(maxPop, population);

    // Fires grow with population
    const targetFires = Math.max(1, Math.floor(population * 0.015));
    while (fires.length < targetFires) {
      fires.push({ x: 20 + rng() * (W - 40), y: H - 55 - rng() * 30, size: 3 + rng() * 4, age: 0 });
    }
    while (fires.length > targetFires + 1) fires.shift();

    // Buildings
    const targetBuildings = Math.floor(population * 0.55);
    while (buildings.length < targetBuildings) spawnBuilding();
    while (buildings.length > targetBuildings + 2) buildings.shift();

    // People
    const targetPeople = Math.min(population, 22);
    while (people.length < targetPeople) spawnPerson();
    while (people.length > targetPeople) people.shift();

    // Update fires
    fires.forEach(f => { f.age += dt; f.flicker = Math.sin(f.age * 0.008) * 1.5; });

    // Update people
    people.forEach(p => {
      p.x += p.vx;
      p.y += p.vy * 0.3;
      if (p.x < 5 || p.x > W - 5) p.vx *= -1;
      if (p.y < H - 80 || p.y > H - 18) p.vy *= -1;
      p.animFrame = (p.animFrame + dt * 0.012) % 4;
    });

    explosions = explosions.filter(e => e.age < e.life);
    explosions.forEach(e => { e.age += dt; e.x += e.vx; e.y += e.vy; e.vy += 0.05; });

    triumphs = triumphs.filter(t => t.age < t.life);
    triumphs.forEach(t => { t.age += dt; t.y -= t.speed; t.x += t.vx; });

    updateHUD();
  }

  draw(dt);
  if (!gameOver) animId = requestAnimationFrame(gameLoop);
}

function triggerCollapse() {
  gameOver = true;
  collapsed = true;
  phase = 'verdict';
  spawnExplosions();
  draw(0);
  setTimeout(() => showVerdict(false), 1800);
}

function triggerVerdict() {
  gameOver = true;
  phase = 'verdict';
  // Triumph if stability and growthMult are healthy
  const triumphed = stability >= 0.7 && population > 30;
  collapsed = !triumphed;
  if (triumphed) {
    for (let i = 0; i < 30; i++) {
      triumphs.push({
        x: 20 + rng() * (W - 40), y: H - 40,
        speed: 0.5 + rng() * 1.5, vx: (rng() - 0.5) * 0.8,
        color: rng() < 0.5 ? '#ffcc00' : '#00ff41',
        life: 2000 + rng() * 1000, age: 0
      });
    }
    draw(0);
  }
  setTimeout(() => showVerdict(triumphed), triumphed ? 2000 : 500);
}

// ── Spawn Helpers ─────────────────────────────────────────────────────────────
function spawnBuilding() {
  const e = currentEraIdx;
  const x = 20 + rng() * (W - 40);
  const groundY = H - 28;
  const h = 12 + Math.floor(rng() * (8 + e * 3));
  const w = 10 + Math.floor(rng() * (6 + e * 2));
  buildings.push({ x, y: groundY - h, w, h, era: e });
}

function spawnPerson() {
  people.push({
    x: 20 + rng() * (W - 40),
    y: H - 28 - rng() * 30,
    vx: (rng() - 0.5) * 0.8,
    vy: (rng() - 0.5) * 0.4,
    color: rng() < 0.5 ? '#ffcc88' : '#cc8844',
    animFrame: rng() * 4,
    era: currentEraIdx
  });
}

function spawnExplosions() {
  for (let i = 0; i < 24; i++) {
    explosions.push({
      x: 20 + rng() * (W - 40),
      y: H - 40 - rng() * 60,
      vx: (rng() - 0.5) * 2.5,
      vy: -rng() * 3.5,
      life: 900 + rng() * 500,
      age: 0,
      color: rng() < 0.5 ? '#ff6633' : '#ffaa33'
    });
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('stat-pop').textContent = population.toLocaleString();
  document.getElementById('stat-era').textContent = ERAS[currentEraIdx].name.split(' ')[0];

  const stabPct = Math.round(Math.min(stability * 50, 100));
  document.getElementById('stat-stability').textContent = stabPct + '%';

  const eraFrac = eraTimer / ERA_DURATION;
  const barPct = ((currentEraIdx + eraFrac) / ERAS.length) * 100;
  document.getElementById('era-progress-bar').style.width = barPct + '%';
  document.getElementById('era-label').textContent = ERAS[currentEraIdx].name;
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(dt) {
  ctx.clearRect(0, 0, W, H);

  const ei = Math.min(currentEraIdx, ERAS.length - 1);
  const [sky1, sky2] = ERAS[ei].bgGrad;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  skyGrad.addColorStop(0, sky1);
  skyGrad.addColorStop(1, sky2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.65);

  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  const totalProgress = (currentEraIdx + eraTimer / ERA_DURATION) / ERAS.length;
  const starAlpha = Math.max(0, 1 - totalProgress * 1.2);
  if (starAlpha > 0) {
    ctx.globalAlpha = starAlpha;
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.r, s.r));
    ctx.globalAlpha = 1;
  }

  // Moon / Sun
  const celestialY = 20 + totalProgress * H * 0.35;
  if (totalProgress < 0.5) {
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
    const [bc1, bc2] = BUILDING_COLORS[Math.min(b.era, BUILDING_COLORS.length - 1)];
    ctx.fillStyle = bc1;
    ctx.fillRect(Math.floor(b.x - b.w / 2), Math.floor(b.y), b.w, b.h);
    ctx.fillStyle = bc2;
    ctx.fillRect(Math.floor(b.x + b.w / 2 - 3), Math.floor(b.y), 3, b.h);
    if (b.h > 18 && b.w > 8) {
      ctx.fillStyle = '#ffee88';
      ctx.globalAlpha = 0.6;
      for (let wy = b.y + 4; wy < b.y + b.h - 4; wy += 6) {
        for (let wx = b.x - b.w / 2 + 2; wx < b.x + b.w / 2 - 4; wx += 6) {
          if (rng() < 0.55) ctx.fillRect(Math.floor(wx), Math.floor(wy), 2, 2);
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
}

// ── Verdict ───────────────────────────────────────────────────────────────────
function showVerdict(triumph) {
  document.getElementById('decision-panel').style.display = 'none';
  document.getElementById('verdict-panel').style.display = 'flex';
  document.getElementById('share').style.display = 'block';

  const outcome = triumph ? 'LEGACY SECURED' : 'CIVILIZATION LOST';
  document.getElementById('verdict-title').textContent = outcome;
  document.getElementById('verdict-civ-name').textContent = civName.toUpperCase();

  // Build decision log
  const logEl = document.getElementById('verdict-decisions');
  if (decisionsChosen.length === 0) {
    logEl.innerHTML = '<div class="decision-line">No decisions recorded.</div>';
  } else {
    logEl.innerHTML = decisionsChosen.map(d =>
      `<div class="decision-line">► ${d.era}: <span class="decision-choice">${d.choice}</span><br><span class="decision-flavor">${d.flavor}</span></div>`
    ).join('');
  }

  const statsEl = document.getElementById('verdict-stats');
  statsEl.innerHTML = [
    `► PEAK POPULATION: ${maxPop.toLocaleString()}`,
    `► ERAS REACHED: ${currentEraIdx + 1} / ${ERAS.length}`,
    `► TRAIT: ${chosenTrait.icon} ${chosenTrait.label}`,
    `► STABILITY AT END: ${Math.round(Math.min(stability * 50, 100))}%`,
    `► OUTCOME: ${triumph ? 'EMPIRE' : 'COLLAPSE'}`
  ].join('<br>');

  document.getElementById('app').className = triumph ? 'verdict-triumph' : 'verdict-collapse';
}

// ── Share ─────────────────────────────────────────────────────────────────────
function share() {
  const txt = `I led "${civName}" (${chosenTrait.label}) through ${currentEraIdx + 1} eras and ${collapsed ? 'collapsed into dust' : 'built an empire'}. ${maxPop} peak population. — benlirio.com/apps/grow-my-civilization/`;
  if (navigator.share) {
    navigator.share({ title: 'Grow My Civilization', text: txt, url: 'https://benlirio.com/apps/grow-my-civilization/' });
  } else {
    navigator.clipboard.writeText(txt).then(() => alert('Copied to clipboard!'));
  }
}

function playAgain() {
  if (animId) cancelAnimationFrame(animId);
  chosenTrait = null;
  startSetup();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('play-again-btn').addEventListener('click', playAgain);
  initStars();
  startSetup();
});
