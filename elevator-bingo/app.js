// Elevator Bingo — pixel-art field-research mini-game.
// 60-second deterministic ride: 30 floors, 12 archetypes, daily seed (UTC date).

// ---------- Archetypes ----------
const ARCHETYPES = [
  { id: 'phone',    short: 'Phone-Sigh-er',         full: 'The Phone-Sigh-er',          emoji: '📱', color: '#5a8fd8', body: '#3e6aa8', accent: '#1a1a1a' },
  { id: 'yoga',     short: 'Yoga-Pants Lurker',     full: 'The Yoga-Pants Lurker',      emoji: '🧘', color: '#c98ec0', body: '#2a2a2a', accent: '#9c5e95' },
  { id: 'nodder',   short: 'Aggressive Nodder',     full: 'The Aggressive Nodder',      emoji: '🙆', color: '#e8b25a', body: '#7a6440', accent: '#5a4a30' },
  { id: 'phantom',  short: 'Phantom Floor-Presser', full: 'The Phantom Floor-Presser',  emoji: '👻', color: '#dcdcdc', body: '#888888', accent: '#444' },
  { id: 'ceo',      short: 'Coffee-Sloshing CEO',   full: 'The Coffee-Sloshing CEO',    emoji: '☕', color: '#9c6638', body: '#1a1a1a', accent: '#3e2818' },
  { id: 'hero',     short: 'Door-Hold Hero',        full: 'The Door-Hold Hero',         emoji: '🦸', color: '#3aa843', body: '#236128', accent: '#c43f3f' },
  { id: 'mirror',   short: 'Mirror-Checker',        full: 'The Mirror-Checker',         emoji: '💄', color: '#e8a8b8', body: '#a85870', accent: '#481830' },
  { id: 'suitcase', short: 'Suitcase Wrangler',     full: 'The Suitcase Wrangler',      emoji: '🧳', color: '#7080a0', body: '#404858', accent: '#964b1c' },
  { id: 'earbud',   short: 'Earbud Hermit',         full: 'The Earbud Hermit',          emoji: '🎧', color: '#444',    body: '#1c1c1c', accent: '#ffd23f' },
  { id: 'apolog',   short: 'Floor-Button Apologist',full: 'The Floor-Button Apologist', emoji: '🙇', color: '#a89878', body: '#605030', accent: '#3a2c18' },
  { id: 'lunch',    short: 'Smelly Lunch',          full: 'The Smelly Lunch',           emoji: '🍱', color: '#d86a3a', body: '#883a1a', accent: '#5e2208' },
  { id: 'whisper',  short: 'Whisperer-on-Phone',    full: 'The Whisperer-on-Phone',     emoji: '🤫', color: '#7a5a8a', body: '#3e2c4a', accent: '#c0a0d0' }
];
const ARCHETYPE_BY_ID = Object.fromEntries(ARCHETYPES.map(a => [a.id, a]));

// ---------- Seed / RNG ----------
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function todaySeedString() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayShortLabel() {
  const d = new Date();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${m}/${day}`;
}

// ---------- Build daily ride ----------
// 30 floors. Each floor: 0, 1, or 2 boarders, drawn from 12 archetypes.
function buildRide(seedStr) {
  const seed = hashStr(seedStr);
  const rng = mulberry32(seed);
  const floors = [];
  let totalBoarders = 0;
  for (let f = 1; f <= 30; f++) {
    const r = rng();
    let count;
    if (r < 0.30) count = 0;
    else if (r < 0.85) count = 1;
    else count = 2;
    if (totalBoarders + count > 22) count = Math.max(0, 22 - totalBoarders);
    const passengers = [];
    for (let i = 0; i < count; i++) {
      passengers.push(ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)].id);
    }
    totalBoarders += count;
    floors.push({ floor: f, passengers });
  }
  // Guarantee a baseline tension: at least 12 boarders across the ride.
  if (totalBoarders < 12) {
    for (let f = 0; f < floors.length && totalBoarders < 12; f++) {
      if (floors[f].passengers.length === 0) {
        floors[f].passengers.push(ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)].id);
        totalBoarders++;
      }
    }
  }
  return floors;
}

// ---------- Game state ----------
const state = {
  seedStr: '',
  floors: [],
  currentFloor: 0,
  doorTimer: 0,
  doorMax: 0,
  totalElapsed: 0,
  pendingSpawnCount: 0, // how many of this floor's passengers haven't spawned yet
  hits: 0,
  misses: 0,
  wrong: 0,
  taggedSet: new Set(),
  perArchetypeStats: {},
  passengerSprites: [],
  rafId: null,
  lastTs: 0,
  running: false,
  cabBob: 0,
  doorsOpen: 0,
  finished: false
};

const els = {};
function $(id) { return document.getElementById(id); }

// ---------- Canvas rendering ----------
const LW = 320, LH = 280; // logical drawing dims; physical canvas is dpr*these.

function drawScene() {
  const c = els.cab;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;

  // shaft background
  cx.fillStyle = '#1a1a1a';
  cx.fillRect(0, 0, LW, LH);
  cx.fillStyle = '#2a2724';
  cx.fillRect(0, 0, 16, LH);
  cx.fillRect(LW - 16, 0, 16, LH);
  cx.fillStyle = '#444';
  const cableOffset = (state.totalElapsed * 80) % 16;
  for (let y = -16 + cableOffset; y < LH; y += 16) {
    cx.fillRect(8, y, 2, 8);
    cx.fillRect(LW - 10, y, 2, 8);
  }

  // top marquee
  cx.fillStyle = '#0d0d0d';
  cx.fillRect(0, 0, LW, 28);
  cx.fillStyle = '#c43f3f';
  cx.fillRect(0, 26, LW, 2);
  cx.fillStyle = '#ffd23f';
  cx.font = '14px "Press Start 2P", monospace';
  cx.textAlign = 'center';
  const fl = state.currentFloor < state.floors.length ? state.floors[state.currentFloor].floor : 30;
  cx.fillText('FL ' + String(fl).padStart(2, '0'), LW / 2, 18);

  // up arrow
  cx.fillStyle = '#6fa84a';
  const ax = LW - 36, ay = 8;
  cx.fillRect(ax + 4, ay, 4, 14);
  cx.fillRect(ax + 2, ay + 2, 8, 2);
  cx.fillRect(ax, ay + 4, 12, 2);

  // CAB
  const cabW = 220, cabH = 200;
  const cabX = (LW - cabW) / 2;
  const cabY = 36 + Math.sin(state.cabBob) * 1.2;

  cx.fillStyle = '#ffd23f';
  cx.fillRect(cabX, cabY, cabW, cabH);
  cx.fillStyle = '#c98e1c';
  cx.fillRect(cabX + 4, cabY + 4, cabW - 8, cabH - 8);
  cx.fillStyle = '#5a4520';
  cx.fillRect(cabX + 4, cabY + cabH - 18, cabW - 8, 14);
  cx.fillStyle = '#fff5cc';
  cx.fillRect(cabX + cabW / 2 - 12, cabY + 6, 24, 4);
  cx.fillStyle = '#ffd23f';
  cx.fillRect(cabX + cabW / 2 - 16, cabY + 10, 32, 2);

  // button panel
  cx.fillStyle = '#161616';
  cx.fillRect(cabX + 8, cabY + 28, 16, 80);
  cx.fillStyle = '#c43f3f';
  for (let i = 0; i < 6; i++) {
    cx.fillRect(cabX + 12, cabY + 32 + i * 12, 8, 8);
  }
  cx.fillStyle = '#ffd23f';
  cx.fillRect(cabX + 10, cabY + 116, 12, 6);

  // doors
  const doorH = cabH - 36;
  const doorY = cabY + 18;
  const doorWmax = (cabW - 8) / 2;
  const openPx = state.doorsOpen * doorWmax;
  cx.fillStyle = '#3a3025';
  cx.fillRect(cabX + 4, doorY, doorWmax - openPx, doorH);
  cx.fillRect(cabX + 4 + doorWmax + openPx, doorY, doorWmax - openPx, doorH);
  cx.fillStyle = '#5a4530';
  cx.fillRect(cabX + 4 + (doorWmax - openPx) - 6, doorY + 8, 4, 24);
  cx.fillRect(cabX + 4 + doorWmax + openPx + 2, doorY + 8, 4, 24);
  cx.fillStyle = '#1c1612';
  cx.fillRect(cabX + 4, doorY, 2, doorH);
  cx.fillRect(cabX + cabW - 6, doorY, 2, doorH);

  // passengers
  drawPassengers(cx, cabX, cabY, cabW, cabH);

  // ground under cab
  const groundY = cabY + cabH + 4;
  cx.fillStyle = '#3a3025';
  cx.fillRect(cabX, groundY, cabW, 8);
  cx.fillStyle = '#1c1612';
  for (let x = cabX; x < cabX + cabW; x += 8) {
    cx.fillRect(x, groundY, 4, 8);
  }
}

function drawPassengers(cx, cabX, cabY, cabW, cabH) {
  const visible = state.passengerSprites.slice(-5);
  if (visible.length === 0) return;
  const startX = cabX + 36;
  const endX = cabX + cabW - 50;
  const span = Math.max(1, endX - startX);
  visible.forEach((p, i) => {
    const x = visible.length <= 1
      ? cabX + cabW / 2 - 10
      : startX + Math.floor(i * span / Math.max(1, visible.length - 1));
    const baseY = cabY + cabH - 70;
    drawPersonPixel(cx, x, baseY, p);
    if (p.justArrived && p.glow > 0) {
      cx.strokeStyle = '#fff5cc';
      cx.lineWidth = 2;
      cx.globalAlpha = p.glow;
      cx.strokeRect(x - 3, baseY - 3, 26, 60);
      cx.globalAlpha = 1;
    }
    if (p.tagged) {
      cx.fillStyle = '#6fa84a';
      cx.fillRect(x + 6, baseY - 9, 10, 7);
      cx.fillStyle = '#0a0a0a';
      cx.font = '7px "Press Start 2P", monospace';
      cx.textAlign = 'center';
      cx.fillText('OK', x + 11, baseY - 3);
    }
  });
}

function drawPersonPixel(cx, x, y, p) {
  const a = ARCHETYPE_BY_ID[p.id];
  if (!a) return;
  // shadow
  cx.fillStyle = 'rgba(0,0,0,.35)';
  cx.fillRect(x, y + 50, 20, 4);
  // legs
  cx.fillStyle = a.body;
  cx.fillRect(x + 4, y + 32, 4, 16);
  cx.fillRect(x + 12, y + 32, 4, 16);
  // shoes
  cx.fillStyle = '#0a0a0a';
  cx.fillRect(x + 3, y + 46, 6, 4);
  cx.fillRect(x + 11, y + 46, 6, 4);
  // torso
  cx.fillStyle = a.color;
  cx.fillRect(x + 2, y + 18, 16, 16);
  cx.fillRect(x, y + 18, 4, 12);
  cx.fillRect(x + 16, y + 18, 4, 12);
  cx.fillStyle = a.accent;
  cx.fillRect(x + 2, y + 26, 16, 2);
  // head
  cx.fillStyle = '#e8c8a0';
  cx.fillRect(x + 4, y + 4, 12, 12);
  cx.fillStyle = a.body;
  cx.fillRect(x + 4, y + 4, 12, 4);
  // eyes
  cx.fillStyle = '#0a0a0a';
  cx.fillRect(x + 7, y + 10, 2, 2);
  cx.fillRect(x + 11, y + 10, 2, 2);

  switch (p.id) {
    case 'phone':
      cx.fillStyle = '#1a1a1a';
      cx.fillRect(x + 16, y + 22, 4, 8);
      cx.fillStyle = '#5af';
      cx.fillRect(x + 17, y + 23, 2, 6);
      cx.fillStyle = '#aac8e0';
      cx.fillRect(x + 18, y + 0, 2, 2);
      cx.fillRect(x + 14, y + 0, 2, 2);
      break;
    case 'yoga':
      cx.fillStyle = '#7a3a70';
      cx.fillRect(x + 4, y + 36, 4, 2);
      cx.fillRect(x + 12, y + 36, 4, 2);
      cx.fillRect(x + 4, y + 42, 4, 2);
      cx.fillRect(x + 12, y + 42, 4, 2);
      break;
    case 'nodder':
      cx.fillStyle = '#ffd23f';
      cx.fillRect(x + 1, y + 7, 2, 2);
      cx.fillRect(x + 17, y + 7, 2, 2);
      cx.fillRect(x + 0, y + 11, 2, 2);
      cx.fillRect(x + 18, y + 11, 2, 2);
      break;
    case 'phantom':
      cx.fillStyle = 'rgba(220,220,220,.45)';
      cx.fillRect(x, y, 20, 50);
      cx.fillStyle = '#c43f3f';
      cx.fillRect(x - 2, y + 22, 4, 4);
      break;
    case 'ceo':
      cx.fillStyle = '#c98e1c';
      cx.fillRect(x - 3, y + 22, 4, 6);
      cx.fillStyle = '#3e2818';
      cx.fillRect(x - 3, y + 22, 4, 2);
      cx.fillStyle = '#5e3a18';
      cx.fillRect(x - 5, y + 24, 2, 2);
      cx.fillRect(x - 4, y + 28, 2, 2);
      cx.fillStyle = '#c43f3f';
      cx.fillRect(x + 9, y + 18, 2, 8);
      break;
    case 'hero':
      cx.fillStyle = a.color;
      cx.fillRect(x - 4, y + 20, 8, 4);
      cx.fillStyle = '#c43f3f';
      cx.fillRect(x + 1, y + 16, 2, 14);
      break;
    case 'mirror':
      cx.fillStyle = '#c0c0c0';
      cx.fillRect(x - 4, y + 16, 6, 6);
      cx.fillStyle = '#fff';
      cx.fillRect(x - 3, y + 17, 4, 2);
      cx.fillStyle = '#c43f3f';
      cx.fillRect(x + 13, y + 12, 2, 1);
      break;
    case 'suitcase':
      cx.fillStyle = '#404858';
      cx.fillRect(x + 18, y + 28, 10, 16);
      cx.fillStyle = '#1a1a1a';
      cx.fillRect(x + 22, y + 24, 2, 6);
      cx.fillStyle = '#964b1c';
      cx.fillRect(x + 18, y + 32, 10, 2);
      break;
    case 'earbud':
      cx.fillStyle = '#fff';
      cx.fillRect(x + 4, y + 9, 2, 3);
      cx.fillRect(x + 14, y + 9, 2, 3);
      cx.fillStyle = '#888';
      cx.fillRect(x + 5, y + 14, 1, 8);
      cx.fillStyle = '#1c1c1c';
      cx.fillRect(x + 2, y + 2, 16, 6);
      break;
    case 'apolog':
      cx.fillStyle = '#0a0a0a';
      cx.fillRect(x + 5, y + 14, 10, 1);
      cx.fillStyle = '#5af';
      cx.fillRect(x + 16, y + 6, 2, 3);
      break;
    case 'lunch':
      cx.fillStyle = '#d86a3a';
      cx.fillRect(x - 3, y + 24, 6, 4);
      cx.fillStyle = '#883a1a';
      cx.fillRect(x - 3, y + 24, 6, 1);
      cx.fillStyle = '#6fa84a';
      cx.fillRect(x - 4, y + 18, 2, 2);
      cx.fillRect(x - 6, y + 14, 2, 2);
      cx.fillRect(x - 4, y + 10, 2, 2);
      break;
    case 'whisper':
      cx.fillStyle = '#1a1a1a';
      cx.fillRect(x + 16, y + 12, 3, 6);
      cx.fillStyle = '#fff';
      cx.fillRect(x + 1, y + 4, 2, 1);
      cx.fillRect(x + 1, y + 6, 1, 1);
      cx.fillRect(x + 2, y + 7, 1, 1);
      break;
  }
}

// ---------- Game flow ----------
function newGame() {
  state.seedStr = todaySeedString();
  state.floors = buildRide(state.seedStr);
  state.currentFloor = 0;
  state.totalElapsed = 0;
  state.hits = 0;
  state.misses = 0;
  state.wrong = 0;
  state.taggedSet = new Set();
  state.perArchetypeStats = {};
  ARCHETYPES.forEach(a => state.perArchetypeStats[a.id] = { seen: 0, hit: 0 });
  state.passengerSprites = [];
  state.doorsOpen = 0;
  state.cabBob = 0;
  state.finished = false;
  startFloor();
}

function startFloor() {
  if (state.currentFloor >= state.floors.length) {
    finishGame();
    return;
  }
  const f = state.floors[state.currentFloor];
  state.pendingSpawnCount = f.passengers.length;
  // 30 floors must fit ~60s. Empty floor: 1.0s. Each passenger: ~1.6s.
  const base = f.passengers.length === 0 ? 1.0 : (1.4 + f.passengers.length * 1.4);
  state.doorMax = base;
  state.doorTimer = base;
  els.hudFloor.textContent = String(f.floor).padStart(2, '0');
  els.hudHit.textContent = String(state.hits);
  els.stageStatus.textContent = f.passengers.length === 0
    ? `Floor ${f.floor}. Empty.`
    : `Floor ${f.floor}. ${f.passengers.length} boarding…`;

  state.doorsOpen = 0;

  // Spawn passengers staggered as door swings open.
  f.passengers.forEach((id, i) => {
    setTimeout(() => {
      // Guard against floor change while we were waiting.
      if (state.floors[state.currentFloor] !== f) return;
      state.perArchetypeStats[id].seen += 1;
      state.passengerSprites.push({ id, justArrived: true, glow: 1.0, tagged: false });
      state.pendingSpawnCount = Math.max(0, state.pendingSpawnCount - 1);
    }, 220 + i * 380);
  });
}

function finishFloor() {
  // Anyone still un-tagged who arrived this floor → miss.
  state.passengerSprites.forEach(s => {
    if (s.justArrived && !s.tagged) {
      state.misses += 1;
      s.justArrived = false;
      s.glow = 0;
    }
  });
  while (state.passengerSprites.length > 5) state.passengerSprites.shift();

  state.currentFloor += 1;
  if (state.currentFloor >= state.floors.length) {
    finishGame();
    return;
  }
  els.stageStatus.textContent = 'Doors closing…';
  setTimeout(() => { state.transitioning = false; startFloor(); }, 320);
}

function finishGame() {
  state.running = false;
  state.finished = true;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  showResult();
}

function handleTileTap(archetypeId) {
  // Find the most-recent un-tagged justArrived passenger.
  const candidate = [...state.passengerSprites].reverse().find(s => s.justArrived && !s.tagged);
  if (!candidate) {
    state.wrong += 1;
    flashTile(archetypeId, 'flash-wrong');
    state.doorTimer = Math.max(0, state.doorTimer - 0.4);
    return;
  }
  if (candidate.id === archetypeId) {
    candidate.tagged = true;
    candidate.justArrived = false;
    candidate.glow = 0;
    state.hits += 1;
    state.perArchetypeStats[archetypeId].hit += 1;
    state.taggedSet.add(archetypeId);
    flashTile(archetypeId, 'flash-right');
    els.hudHit.textContent = String(state.hits);
    state.doorTimer = Math.min(state.doorMax, state.doorTimer + 0.3);
    // If no more pending spawns AND no untagged arrivals on this floor, shave timer to advance.
    const stillUntagged = state.passengerSprites.some(s => s.justArrived && !s.tagged);
    if (!stillUntagged && state.pendingSpawnCount === 0) {
      state.doorTimer = Math.min(state.doorTimer, 0.45);
    }
  } else {
    state.wrong += 1;
    flashTile(archetypeId, 'flash-wrong');
    state.doorTimer = Math.max(0, state.doorTimer - 0.6);
  }
}

function flashTile(id, cls) {
  const el = els.bingoCard.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('flash-wrong', 'flash-right');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 320);
  if (cls === 'flash-right') el.classList.add('tagged');
}

// ---------- Render bingo card ----------
function renderCard() {
  els.bingoCard.innerHTML = '';
  const rng = mulberry32(hashStr(state.seedStr + ':card'));
  const order = [...ARCHETYPES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach(a => {
    const el = document.createElement('button');
    el.className = 'bingo-tile';
    el.dataset.id = a.id;
    el.innerHTML = `<span class="tile-emoji">${a.emoji}</span><span class="tile-name">${a.short}</span>`;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.taggedSet.has(a.id)) return;
      handleTileTap(a.id);
    });
    els.bingoCard.appendChild(el);
  });
}

// ---------- Main loop ----------
function loop(ts) {
  if (!state.running) return;
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.1, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  state.totalElapsed += dt;
  state.cabBob += dt * 6;

  // Door open/close: open while floor is "active" (timer alive or still spawning), close near end.
  const stillSpawning = state.pendingSpawnCount > 0;
  const stillUntagged = state.passengerSprites.some(s => s.justArrived && !s.tagged);
  if (stillSpawning || stillUntagged || state.doorTimer > 0.25 * state.doorMax) {
    state.doorsOpen = Math.min(1, state.doorsOpen + dt * 3);
  } else {
    state.doorsOpen = Math.max(0, state.doorsOpen - dt * 3);
  }
  state.doorTimer -= dt;

  state.passengerSprites.forEach(s => {
    if (s.justArrived) s.glow = Math.max(0.3, s.glow - dt * 0.4);
  });

  const ratio = Math.max(0, Math.min(1, state.doorTimer / state.doorMax));
  els.hudTimerFill.style.width = (ratio * 100) + '%';
  els.hudTimerFill.classList.toggle('urgent', ratio < 0.3);

  drawScene();

  if (state.doorTimer <= 0 && !state.transitioning) {
    state.transitioning = true;
    finishFloor();
  }
  state.rafId = requestAnimationFrame(loop);
}

// ---------- Result rendering ----------
function showResult() {
  els.screenGame.classList.remove('active');
  els.screenResult.classList.add('active');

  const distinctHit = state.taggedSet.size;
  const verdict = pickVerdict(distinctHit, state.hits, state.misses, state.wrong);
  els.verdictName.textContent = verdict;

  els.statHit.textContent = String(state.hits);
  els.statMiss.textContent = String(state.misses);
  els.statWrong.textContent = String(state.wrong);
  els.fieldSeed.textContent = todayShortLabel();

  els.fieldMapGrid.innerHTML = '';
  ARCHETYPES.forEach(a => {
    const cell = document.createElement('div');
    cell.className = 'map-cell';
    cell.title = a.full;
    if (state.taggedSet.has(a.id)) {
      cell.classList.add('hit');
      cell.textContent = a.emoji;
    } else if ((state.perArchetypeStats[a.id] || {}).seen > 0) {
      cell.classList.add('miss');
      cell.textContent = a.emoji;
    } else {
      cell.textContent = a.emoji;
      cell.style.opacity = '.25';
    }
    els.fieldMapGrid.appendChild(cell);
  });

  // Hardest catch — most missed (in this session) of the seen-but-not-fully-tagged.
  let hardest = null;
  ARCHETYPES.forEach(a => {
    const s = state.perArchetypeStats[a.id];
    if (s && s.seen > 0 && s.hit < s.seen) {
      if (!hardest) hardest = a;
      else {
        const cur = state.perArchetypeStats[hardest.id];
        if ((s.seen - s.hit) > (cur.seen - cur.hit)) hardest = a;
      }
    }
  });
  if (!hardest) {
    let minSeen = Infinity;
    ARCHETYPES.forEach(a => {
      const s = state.perArchetypeStats[a.id];
      if (s && s.seen > 0 && s.seen < minSeen) { minSeen = s.seen; hardest = a; }
    });
  }
  const hardestText = hardest
    ? `Today's hardest catch: ${hardest.full}.`
    : `Clean ride. You caught the lobby itself.`;
  els.fieldNote.textContent = `${flavorLine(distinctHit)} ${hardestText}`;
}

function pickVerdict(distinctHit, hits, misses, wrong) {
  if (distinctHit >= 12 && wrong <= 1) return 'Elevator Sociologist, Class I — Honorary Doorman';
  if (distinctHit >= 11) return 'Elevator Sociologist, Class II';
  if (distinctHit >= 9) return 'Elevator Sociologist, Class III';
  if (distinctHit >= 7) return 'Lobby Anthropologist, Class IV';
  if (distinctHit >= 5) return 'Floor-22 Witness, Class V';
  if (distinctHit >= 3) return 'Casual Vertical Commuter';
  if (distinctHit >= 1) return 'Distracted on the Way to Floor 14';
  return 'Phantom Floor-Presser (no offense)';
}
function flavorLine(n) {
  const lines = [
    'You logged the cab with the precision of a building manager.',
    'Field notes are admissible in HR proceedings.',
    'Your ride passed peer review.',
    'Findings filed under "vertical commute, mostly nonverbal."',
    'You caught a few. The rest got off on 14.'
  ];
  return lines[(hashStr(state.seedStr) + n) % lines.length];
}

// ---------- Share / copy ----------
function share() {
  const distinctHit = state.taggedSet.size;
  const verdict = pickVerdict(distinctHit, state.hits, state.misses, state.wrong);
  const txt = `🛗 ELEVATOR BINGO · ${todayShortLabel()}\n${verdict}\n${state.hits} caught · ${state.misses} missed · ${state.wrong} mis-IDed\n${location.href}`;
  if (navigator.share) {
    navigator.share({ title: document.title, text: txt, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(txt).then(() => alert('Field card copied!')).catch(() => alert(txt));
  }
}
window.share = share;

function copyVerdict() {
  const distinctHit = state.taggedSet.size;
  const verdict = pickVerdict(distinctHit, state.hits, state.misses, state.wrong);
  const txt = `🛗 ${verdict} · ${state.hits}/${state.hits + state.misses} caught on today's ride. ${location.href}`;
  navigator.clipboard.writeText(txt).then(() => {
    els.btnCopy.textContent = 'COPIED ✓';
    setTimeout(() => els.btnCopy.textContent = 'COPY VERDICT', 1500);
  }).catch(() => alert(txt));
}

// ---------- Boot ----------
function boot() {
  els.cab = $('cab');
  els.bingoCard = $('bingo-card');
  els.hudFloor = $('hud-floor');
  els.hudHit = $('hud-hit');
  els.hudTimerFill = $('hud-timer-fill');
  els.stageStatus = $('stage-status');
  els.screenTitle = $('screen-title');
  els.screenGame = $('screen-game');
  els.screenResult = $('screen-result');
  els.verdictName = $('verdict-name');
  els.statHit = $('stat-hit');
  els.statMiss = $('stat-miss');
  els.statWrong = $('stat-wrong');
  els.fieldMapGrid = $('field-map-grid');
  els.fieldSeed = $('field-seed');
  els.fieldNote = $('field-note');
  els.btnCopy = $('btn-copy');

  $('title-meta').textContent = `Daily Ride · ${todayShortLabel()} (UTC)`;

  // High-DPI canvas: physical buffer = LW*dpr × LH*dpr, but draw in logical LW×LH.
  const c = els.cab;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = LW * dpr;
  c.height = LH * dpr;
  c.style.width = '100%';
  c.style.aspectRatio = `${LW} / ${LH}`;
  c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);

  $('btn-start').addEventListener('click', startGame);
  $('btn-replay').addEventListener('click', () => {
    els.screenResult.classList.remove('active');
    startGame();
  });
  $('btn-copy').addEventListener('click', copyVerdict);

  // Pre-build today's ride so the title screen has the correct "Daily Ride" label.
  state.seedStr = todaySeedString();
  state.floors = buildRide(state.seedStr);
}

function startGame() {
  els.screenTitle.classList.remove('active');
  els.screenResult.classList.remove('active');
  els.screenGame.classList.add('active');
  renderCard();
  newGame();
  state.running = true;
  state.lastTs = 0;
  state.rafId = requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', boot);
