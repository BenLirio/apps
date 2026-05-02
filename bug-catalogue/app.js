/* Bug Catalogue — tap-to-pin entomology display case.
 * Daily seeded species pool drifts across a corkboard. Catch up to 6.
 * Resulting "specimen plate" is the share artifact. */

// ====================== CONFIG ======================
const HUNT_SECONDS = 30;
const MAX_CATCHES = 6;
const POOL_SIZE = 14;          // species in today's drift
const ACTIVE_BUGS_TARGET = 8;  // average bugs alive at once
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';
const APP_SLUG = 'bug-catalogue';

// ====================== RARITY ======================
// Each spawn weights by rarity. Pool is curated so at least one rare and
// one legendary species drift today, salting the catch with a chance at
// a real find. Visual treatment escalates with tier.
const RARITY_TIERS = {
  common:    { weight: 60, label: 'common',    score: 1 },
  uncommon:  { weight: 25, label: 'uncommon',  score: 3 },
  rare:      { weight: 12, label: 'rare',      score: 7 },
  legendary: { weight:  3, label: 'legendary', score: 18 },
};

// ====================== SPECIES CATALOG ======================
// Each species: { id, name, kind, rarity, baseSpeed }
// kind = crawler | flyer | drifter | hopper | zigzag — controls trajectory.
// rarity = common | uncommon | rare | legendary — controls spawn weight + visual treatment.
// Visuals are committed PNGs at bugs/{id}.png — Victorian natural-history
// engravings, transparent backgrounds, oriented with the insect facing up.
const SPECIES = [
  { id: 'clockroach',   name: 'Gold-banded clock-roach',     kind: 'crawler', rarity: 'common',    baseSpeed: 1.0 },
  { id: 'stainmoth',    name: 'Stained-glass moth',           kind: 'flyer',   rarity: 'legendary', baseSpeed: 1.6 },
  { id: 'cigwalker',    name: 'Cigarette-bearer',             kind: 'crawler', rarity: 'common',    baseSpeed: 0.7 },
  { id: 'velvetbumble', name: 'Velvet bumble-pretender',      kind: 'flyer',   rarity: 'common',    baseSpeed: 1.2 },
  { id: 'paperwasp',    name: 'Hand-folded paper wasp',       kind: 'flyer',   rarity: 'uncommon',  baseSpeed: 1.8 },
  { id: 'glassbeetle',  name: 'Translucent glass beetle',     kind: 'crawler', rarity: 'rare',      baseSpeed: 0.9 },
  { id: 'inkmite',      name: 'Ink-spilling mite',            kind: 'crawler', rarity: 'common',    baseSpeed: 0.6 },
  { id: 'lampfly',      name: 'Streetlamp lace-fly',          kind: 'flyer',   rarity: 'rare',      baseSpeed: 2.0 },
  { id: 'minerbug',     name: 'Coal-miner ground beetle',     kind: 'crawler', rarity: 'common',    baseSpeed: 0.85 },
  { id: 'ribbonworm',   name: 'Ribbon-worm caterpillar',      kind: 'crawler', rarity: 'common',    baseSpeed: 0.5 },
  { id: 'jewelhopper',  name: 'Velvet-jeweled grasshopper',   kind: 'hopper',  rarity: 'uncommon',  baseSpeed: 1.1 },
  { id: 'mournfly',     name: 'Mourning bottle-fly',          kind: 'zigzag',  rarity: 'uncommon',  baseSpeed: 2.2 },
  { id: 'silkdrifter',  name: 'Silk-thread drifter',          kind: 'drifter', rarity: 'common',    baseSpeed: 0.4 },
  { id: 'amberbee',     name: 'Amber-cased bee-mimic',        kind: 'flyer',   rarity: 'uncommon',  baseSpeed: 1.5 },
  { id: 'ironcricket',  name: 'Iron-shell cricket',           kind: 'hopper',  rarity: 'uncommon',  baseSpeed: 0.95 },
  { id: 'paperghost',   name: 'Paper-ghost moth',             kind: 'flyer',   rarity: 'uncommon',  baseSpeed: 1.3 },
  { id: 'rustbeetle',   name: 'Rusted hinge-beetle',          kind: 'crawler', rarity: 'common',    baseSpeed: 0.8 },
  { id: 'silvermidge',  name: 'Silver tax-collector midge',   kind: 'zigzag',  rarity: 'common',    baseSpeed: 2.4 },
  { id: 'velvetdarner', name: 'Velvet darner',                kind: 'flyer',   rarity: 'rare',      baseSpeed: 1.9 },
  { id: 'bookworm',     name: 'Marginalia bookworm',          kind: 'crawler', rarity: 'common',    baseSpeed: 0.55 },
  { id: 'opalmoth',     name: 'Opal-eyed dusk moth',          kind: 'flyer',   rarity: 'legendary', baseSpeed: 1.4 },
  { id: 'leafmime',     name: 'Polite leaf-mime',             kind: 'crawler', rarity: 'common',    baseSpeed: 0.7 },
  { id: 'bronzebug',    name: 'Bronze-collared sundial bug',  kind: 'crawler', rarity: 'common',    baseSpeed: 1.0 },
  { id: 'foglace',      name: 'Fog-lace darner',              kind: 'zigzag',  rarity: 'rare',      baseSpeed: 1.7 },
  { id: 'porcelainbee', name: 'Porcelain-cup bee',            kind: 'flyer',   rarity: 'rare',      baseSpeed: 1.3 },
  { id: 'spectrebug',   name: 'Spectacled assembly-bug',      kind: 'crawler', rarity: 'common',    baseSpeed: 0.75 },
  { id: 'sootmoth',     name: 'Soot-eating chimney moth',     kind: 'flyer',   rarity: 'common',    baseSpeed: 1.5 },
  { id: 'spiralweevil', name: 'Spiral-shelled weevil',        kind: 'crawler', rarity: 'common',    baseSpeed: 0.65 },
  { id: 'fernhopper',   name: 'Fern-frond hopper',            kind: 'hopper',  rarity: 'common',    baseSpeed: 1.05 },
  { id: 'velvetfly',    name: 'Velvet seamstress fly',        kind: 'flyer',   rarity: 'common',    baseSpeed: 2.1 },
];

// ====================== LATIN ROOTS for binomials ======================
const GENUS_ROOTS = [
  'Coleoptera','Lepidoptera','Hymenoptera','Diptera','Orthoptera','Hemiptera','Phasmida','Mantodea',
  'Brachycera','Cicindela','Calliphora','Vespoidea','Saturnia','Carabus','Cetonia','Lampyris','Bombus','Stenopogon','Aedes','Lucanus','Cassida','Anomala'
];
const GENUS_SUFFIXES = ['us','a','idae','ina','ella','aria','onta','ipes','opsis','ina','arius','ana'];
const SPECIES_ROOTS = [
  'misericordia','crepuscul','vesper','lucid','obscur','tranquill','agitat','solitud','melanchol','curios','dilig','pallor','vetust','silentium','fervor','memori','reverie','tarditud','candor','lucid','contempl','elegans','severitat','austerit','clandestin','anxietat','quietud','perplex','torpor','reverentia'
];
const SPECIES_SUFFIXES = ['ae','um','i','onis','aris','alis','antis','ensis','ata','osa','icus','ini'];

// ====================== CURATOR FIELD NOTES ======================
// One-line deadpan field notes — chosen deterministically per pinned bug.
const FIELD_NOTES = [
  'known to overshadow conversations about feelings.',
  'feeds primarily on unpaid invoices.',
  'observed only in rooms with one functioning bulb.',
  'mistaken regularly for a spelling error.',
  'reluctant to share its weekend plans.',
  'attracted to the word "perhaps".',
  'mates only after explicit consent and a brief silence.',
  'mimics the cadence of an unanswered question.',
  'considered impolite by neighboring orders.',
  'lives roughly the length of a long apology.',
  'molts whenever someone says "we should talk".',
  'navigates by the smell of warm laundry.',
  'forms small parliaments under porch lights.',
  'survives without sleep but not without grievance.',
  'vibrates audibly when complimented.',
  'unwilling to enter rooms it has not been invited to.',
  'regarded by the curator as "a quietly excellent insect".',
  'last seen near a half-finished crossword.',
  'will not fly through doorways painted blue.',
  'has been observed pretending to be a leaf with conviction.',
  'declines to participate in the spring census.',
  'collects forgotten umbrellas; purpose unknown.',
  'appears more frequently on Tuesdays.',
  'thought, by the elderly, to predict mild weather.',
  'has never been seen in direct sunlight.',
  'communicates entirely in elaborate sighs.',
  'said to be the cause of a single missed appointment in 1873.',
  'avoids any room containing a metronome.',
  'most active during the second cup of tea.',
  'capable of remarkable stillness when accused.',
  'leaves behind a faint odor of damp stationery.',
  'has not been seen since the publication of the relevant volume.',
];

// Plate-level curator framing notes
const CURATOR_HEADERS = [
  "Curator's note: a moderately satisfying afternoon.",
  "Curator's note: the case fills more readily than expected.",
  "Curator's note: the specimens cooperated, on the whole.",
  "Curator's note: a quiet drift; nothing inflamed.",
  "Curator's note: noted no missing bell-rings.",
  "Curator's note: pinned without ceremony.",
  "Curator's note: an improving morning's haul.",
  "Curator's note: collected, labeled, and shelved.",
  "Curator's note: the board accepts what it accepts.",
];

const PLATE_TITLES = [
  'An assembled museum.',
  'Today, what crossed the board.',
  'Plate the curator approved.',
  'Specimens, in order pinned.',
  'A small, mostly true catalogue.',
  'Of the morning bells.',
  'The pinned and the labeled.',
];

// ====================== SEEDED RNG (mulberry32) ======================
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function seededShuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ====================== TODAY'S POOL ======================
function todayKey() {
  const d = new Date();
  // UTC-based date so two players in different timezones still rhyme
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

function buildDailyPool() {
  const seed = hashStr('bug-catalogue-' + todayKey());
  const rng = mulberry32(seed);
  // Guarantee at least one legendary, two rare, three uncommon — so a
  // hunt always has something special to find. Fill the rest with commons.
  const byTier = {
    legendary: SPECIES.filter(s => s.rarity === 'legendary'),
    rare:      SPECIES.filter(s => s.rarity === 'rare'),
    uncommon:  SPECIES.filter(s => s.rarity === 'uncommon'),
    common:    SPECIES.filter(s => s.rarity === 'common'),
  };
  const pick = (arr, n) => seededShuffle(rng, arr).slice(0, Math.min(n, arr.length));
  const chosen = [
    ...pick(byTier.legendary, 1),
    ...pick(byTier.rare, 2),
    ...pick(byTier.uncommon, 3),
    ...pick(byTier.common, POOL_SIZE - 6),
  ];
  return seededShuffle(rng, chosen).slice(0, POOL_SIZE);
}

// Pick a species from the daily pool weighted by rarity.
function pickSpawnSpecies() {
  let total = 0;
  for (const sp of pool) total += RARITY_TIERS[sp.rarity].weight;
  let r = Math.random() * total;
  for (const sp of pool) {
    r -= RARITY_TIERS[sp.rarity].weight;
    if (r <= 0) return sp;
  }
  return pool[pool.length - 1];
}

// ====================== BINOMIAL GENERATION ======================
function genusFor(speciesId, catchTimeStamp) {
  const h = hashStr(speciesId + ':' + Math.floor(catchTimeStamp / 1000));
  const rng = mulberry32(h);
  const root = seededPick(rng, GENUS_ROOTS);
  // 50% chance to swap suffix to feel less canonical
  if (rng() < 0.45) {
    // strip trailing vowel(s) and append a suffix
    const stripped = root.replace(/(us|a|ae|idae|ina|ella|aria|onta|ipes|opsis|arius|ana|ata|osa)$/i, '');
    const base = stripped.length >= 4 ? stripped : root;
    return capitalize(base + seededPick(rng, GENUS_SUFFIXES));
  }
  return capitalize(root);
}
function epithetFor(speciesId, catchTimeStamp) {
  const h = hashStr(speciesId + '#' + catchTimeStamp);
  const rng = mulberry32(h);
  const root = seededPick(rng, SPECIES_ROOTS);
  return root.toLowerCase() + seededPick(rng, SPECIES_SUFFIXES);
}
function fieldNoteFor(speciesId, catchTimeStamp) {
  const h = hashStr(speciesId + '!' + catchTimeStamp);
  const rng = mulberry32(h);
  return seededPick(rng, FIELD_NOTES);
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
function fmtTime(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ====================== SPECIES IMAGE ======================
// Each species ships as a pre-generated PNG (Victorian engraving style,
// transparent background, oriented facing up). The same asset is used in
// the drift, the slot strip, and the specimen plate.
function speciesImg(species) {
  const safeName = (species.name || '').replace(/"/g, '&quot;');
  return `<img src="bugs/${species.id}.png" alt="${safeName}" draggable="false">`;
}

// ====================== GAME STATE ======================
let pool = [];                 // today's species
let bugs = [];                 // active bug entities on board
let caught = [];               // {speciesId, ts}
let huntStart = 0;
let huntEnd = 0;
let huntActive = false;
let lastSpawnT = 0;
let rafId = null;
let bugIdCounter = 0;

// ====================== BOOT ======================
document.addEventListener('DOMContentLoaded', () => {
  pool = buildDailyPool();
  document.getElementById('title-date').textContent = humanDate();
  document.getElementById('btn-start').addEventListener('click', startHunt);

  // Try to hydrate share link
  hydrateFromShare().then((hydrated) => {
    if (hydrated) showPlate(true);
  });

  document.getElementById('btn-again').addEventListener('click', () => {
    // clear url, go back to title
    history.replaceState(null, '', location.pathname);
    caught = [];
    showScreen('title');
  });
});

function humanDate() {
  const d = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function showScreen(name) {
  ['title', 'hunt', 'plate'].forEach(n => {
    const el = document.getElementById('screen-' + n);
    el.classList.toggle('hidden', n !== name);
  });
}

// ====================== HUNT ======================
function startHunt() {
  caught = [];
  bugs = [];
  bugIdCounter = 0;
  document.getElementById('bug-layer').innerHTML = '';
  resetSlots();
  updateCaughtLabel();
  showScreen('hunt');
  huntStart = performance.now();
  huntEnd = huntStart + HUNT_SECONDS * 1000;
  huntActive = true;
  lastSpawnT = 0;
  // spawn several immediately so the board doesn't feel empty
  for (let i = 0; i < 5; i++) spawnBug();
  rafId = requestAnimationFrame(tick);
}

function resetSlots() {
  document.querySelectorAll('.slot').forEach(s => {
    s.classList.remove('filled', 'rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-legendary');
    s.innerHTML = '';
  });
}

function updateCaughtLabel() {
  document.getElementById('caught-count').textContent = caught.length + '/' + MAX_CATCHES;
}

function tick(now) {
  if (!huntActive) return;
  const remaining = Math.max(0, huntEnd - now);
  document.getElementById('time-left').textContent = Math.ceil(remaining / 1000);
  // update + spawn + render
  updateBugs(now);
  // spawn cadence — keep a target population
  if (now - lastSpawnT > 600 && bugs.length < ACTIVE_BUGS_TARGET + Math.floor(Math.random() * 3)) {
    spawnBug();
    lastSpawnT = now;
  }
  if (remaining <= 0 || caught.length >= MAX_CATCHES) {
    endHunt();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function endHunt() {
  huntActive = false;
  cancelAnimationFrame(rafId);
  // brief delay so any final pin animations resolve, then show plate
  setTimeout(() => buildAndShowPlate(), 450);
}

// ====================== BUG ENTITY ======================
function spawnBug() {
  const board = document.getElementById('board');
  const W = board.clientWidth, H = board.clientHeight - 80; // reserve slot strip
  const species = pickSpawnSpecies();
  const id = ++bugIdCounter;

  // entry edge
  const edge = Math.floor(Math.random() * 4);
  let x, y, dirAngle;
  const margin = 60;
  if (edge === 0) { x = -margin; y = 50 + Math.random() * (H - 100); dirAngle = (-0.4 + Math.random() * 0.8); }
  else if (edge === 1) { x = W + margin; y = 50 + Math.random() * (H - 100); dirAngle = Math.PI + (-0.4 + Math.random() * 0.8); }
  else if (edge === 2) { x = 50 + Math.random() * (W - 100); y = -margin; dirAngle = Math.PI/2 + (-0.4 + Math.random() * 0.8); }
  else { x = 50 + Math.random() * (W - 100); y = H + margin; dirAngle = -Math.PI/2 + (-0.4 + Math.random() * 0.8); }

  const baseSpeed = species.baseSpeed * (0.7 + Math.random() * 0.6); // px per frame at 60fps
  const wobbleAmp = species.kind === 'flyer' ? 1.4 : (species.kind === 'drifter' ? 0.6 : 0.5);
  const wobbleHz = species.kind === 'flyer' ? 0.008 : 0.005;
  const sizePx = (species.kind === 'drifter' ? 44 : species.kind === 'flyer' ? 48 : 52) * (0.9 + Math.random() * 0.3);

  // DOM
  const el = document.createElement('div');
  el.className = 'bug rarity-' + species.rarity;
  el.style.width = sizePx + 'px';
  el.style.height = sizePx + 'px';
  el.style.left = '0';
  el.style.top = '0';
  el.innerHTML = speciesImg(species);
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    pinBug(id);
  });
  document.getElementById('bug-layer').appendChild(el);

  bugs.push({
    id, speciesId: species.id, el,
    x, y,
    vx: Math.cos(dirAngle) * baseSpeed,
    vy: Math.sin(dirAngle) * baseSpeed,
    rot: Math.atan2(Math.sin(dirAngle), Math.cos(dirAngle)),
    sizePx,
    wobbleAmp, wobbleHz,
    born: performance.now(),
    kind: species.kind,
    rarity: species.rarity,
    baseSpeed,
    // hopper bookkeeping: discrete jumps with rests between
    nextHopAt: species.kind === 'hopper' ? performance.now() + 200 + Math.random() * 400 : 0,
    hopUntil: 0,
    // zigzag bookkeeping: scheduled sharp turns
    nextZigAt: species.kind === 'zigzag' ? performance.now() + 250 + Math.random() * 500 : 0,
    // panic from a nearby pin event — temporary speed-multiplier
    panicUntil: 0,
    panicVx: 0,
    panicVy: 0,
  });
}

function updateBugs(now) {
  const board = document.getElementById('board');
  const W = board.clientWidth, H = board.clientHeight - 80;
  for (let i = bugs.length - 1; i >= 0; i--) {
    const b = bugs[i];
    const t = now - b.born;

    // movement-kind tweaks ----------------------------------------------
    if (b.kind === 'hopper') {
      // pulse: rest, then a quick burst, then rest. Velocity is gated.
      if (now >= b.nextHopAt && b.hopUntil === 0) {
        // begin a hop in the current general direction with a tilt
        const a = Math.atan2(b.vy, b.vx) + (Math.random() - 0.5) * 0.5;
        const sp = b.baseSpeed * (3.0 + Math.random() * 1.5);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
        b.rot = a;
        b.hopUntil = now + 160;
        b.el.classList.add('hop');
      }
      if (b.hopUntil > 0 && now >= b.hopUntil) {
        // land — almost stop, schedule next hop
        b.vx *= 0.05;
        b.vy *= 0.05;
        b.hopUntil = 0;
        b.nextHopAt = now + 500 + Math.random() * 500;
        b.el.classList.remove('hop');
      }
    } else if (b.kind === 'zigzag') {
      if (now >= b.nextZigAt) {
        const a = Math.atan2(b.vy, b.vx) + (Math.random() < 0.5 ? -1.1 : 1.1) + (Math.random() - 0.5) * 0.4;
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
        b.rot = a;
        b.nextZigAt = now + 240 + Math.random() * 320;
      }
    } else if (b.kind === 'flyer' && Math.random() < 0.02) {
      // gentle direction drift for flyers (preserved from the original)
      const a = Math.atan2(b.vy, b.vx) + (Math.random() - 0.5) * 0.6;
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(a) * sp;
      b.vy = Math.sin(a) * sp;
      b.rot = a;
    }

    // wobble (perpendicular to travel)
    const perpX = -Math.sin(b.rot);
    const perpY =  Math.cos(b.rot);
    const wob = Math.sin(t * b.wobbleHz) * b.wobbleAmp;

    // panic boost (from a recent pin scatter)
    let panicX = 0, panicY = 0;
    if (b.panicUntil > now) {
      const k = (b.panicUntil - now) / 600; // 1 → 0
      panicX = b.panicVx * k;
      panicY = b.panicVy * k;
    }

    b.x += b.vx + perpX * wob + panicX;
    b.y += b.vy + perpY * wob + panicY;

    // off-screen culling
    if (b.x < -90 || b.x > W + 90 || b.y < -90 || b.y > H + 90) {
      b.el.remove();
      bugs.splice(i, 1);
      continue;
    }

    // render — face direction of travel
    const angle = Math.atan2(b.vy + panicY, b.vx + panicX) + Math.PI / 2; // images face up
    b.el.style.transform = `translate(${b.x - b.sizePx/2}px, ${b.y - b.sizePx/2}px) rotate(${angle}rad)`;
  }
}

// Scatter nearby bugs away from a pin event — gives "interaction" feedback
// when the user catches one and the rest of the board notices.
function scatterFrom(cx, cy) {
  const RADIUS = 130;
  for (const b of bugs) {
    const dx = b.x - cx;
    const dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > RADIUS * RADIUS) continue;
    const d = Math.sqrt(d2) || 1;
    const strength = (1 - d / RADIUS) * 5; // px/frame additive
    b.panicVx = (dx / d) * strength;
    b.panicVy = (dy / d) * strength;
    b.panicUntil = performance.now() + 600;
  }
}

function pinBug(id) {
  if (!huntActive) return;
  const idx = bugs.findIndex(b => b.id === id);
  if (idx < 0) return;
  const b = bugs[idx];
  if (caught.length >= MAX_CATCHES) return;

  // play squelch (juicier for rares)
  squelch(b.rarity);

  // scatter nearby bugs as a reaction to the pin
  scatterFrom(b.x, b.y);

  // record (preserve rarity + the actual species kind for the plate)
  const ts = Date.now();
  caught.push({ speciesId: b.speciesId, ts, rarity: b.rarity });

  // pinned animation
  b.el.classList.add('pinned');
  setTimeout(() => { b.el.remove(); }, 360);
  bugs.splice(idx, 1);

  // fill slot
  const slotIdx = caught.length - 1;
  const slot = document.querySelector('.slot[data-i="' + slotIdx + '"]');
  if (slot) {
    slot.classList.add('filled', 'rarity-' + b.rarity);
    const species = SPECIES.find(s => s.id === b.speciesId);
    slot.innerHTML = speciesImg(species);
  }
  updateCaughtLabel();

  if (caught.length >= MAX_CATCHES) {
    setTimeout(() => endHunt(), 500);
  }
}

// ====================== SOUND (squelch / paper-thump) ======================
let _audioCtx = null;
function squelch(rarity) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // squelch — fast pitch drop on noise
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    const ng = ctx.createGain();
    ng.gain.value = 0.12;
    noise.connect(bp).connect(ng).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.06);

    // paper-thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(og).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);

    // bonus chime for rare/legendary — a quick rising glint
    if (rarity === 'rare' || rarity === 'legendary') {
      const ch = ctx.createOscillator();
      ch.type = 'triangle';
      const f0 = rarity === 'legendary' ? 880 : 660;
      const f1 = rarity === 'legendary' ? 1480 : 990;
      ch.frequency.setValueAtTime(f0, now + 0.04);
      ch.frequency.exponentialRampToValueAtTime(f1, now + 0.32);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, now + 0.04);
      cg.gain.exponentialRampToValueAtTime(rarity === 'legendary' ? 0.13 : 0.09, now + 0.08);
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      ch.connect(cg).connect(ctx.destination);
      ch.start(now + 0.04);
      ch.stop(now + 0.45);
    }
  } catch (e) { /* silent */ }
}

// ====================== PLATE ======================
function buildAndShowPlate() {
  renderPlate();
  showScreen('plate');
  // persist to share URL
  persistShare();
}

function renderPlate() {
  // plate-level deterministic title/curator note seeded by date + caught ids
  const seedStr = todayKey() + '|' + caught.map(c => c.speciesId).join(',');
  const rng = mulberry32(hashStr(seedStr));

  // Haul rarity: count tiers, sum scores. The framing changes if you've
  // pulled something rare or legendary.
  const counts = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
  let haulScore = 0;
  for (const c of caught) {
    const tier = c.rarity || (SPECIES.find(s => s.id === c.speciesId) || {}).rarity || 'common';
    counts[tier] = (counts[tier] || 0) + 1;
    haulScore += (RARITY_TIERS[tier] || RARITY_TIERS.common).score;
  }

  const title = seededPick(rng, PLATE_TITLES);
  let curator;
  if (caught.length === 0) {
    curator = "Curator's note: today, the case remained empty. Notable in itself.";
  } else if (counts.legendary > 0) {
    curator = "Curator's note: a legendary specimen filed today. The case has rarely seen better.";
  } else if (counts.rare >= 2) {
    curator = "Curator's note: a remarkable plate — two rares secured.";
  } else if (counts.rare === 1) {
    curator = "Curator's note: a rare among the regulars; the curator approves quietly.";
  } else if (counts.uncommon >= 3) {
    curator = "Curator's note: an uncommonly uncommon afternoon.";
  } else {
    curator = seededPick(rng, CURATOR_HEADERS);
  }

  document.getElementById('plate-title').textContent = title;
  document.getElementById('plate-curator').textContent = curator;
  document.getElementById('plate-date').textContent = humanDate();
  document.getElementById('plate-catno').textContent = catNo();

  // Haul score badge — rendered into the plate grid header
  const grid = document.getElementById('plate-grid');
  grid.innerHTML = '';
  if (caught.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'plate-empty';
    empty.textContent = 'No specimens were pinned. The board accepts that, too.';
    grid.appendChild(empty);
    return;
  }

  const tally = document.createElement('div');
  tally.className = 'haul-tally';
  const parts = [];
  if (counts.legendary) parts.push(`<span class="rk legendary">${counts.legendary} legendary</span>`);
  if (counts.rare)      parts.push(`<span class="rk rare">${counts.rare} rare</span>`);
  if (counts.uncommon)  parts.push(`<span class="rk uncommon">${counts.uncommon} uncommon</span>`);
  if (counts.common)    parts.push(`<span class="rk common">${counts.common} common</span>`);
  tally.innerHTML = `
    <span class="haul-label">Haul</span>
    <span class="haul-counts">${parts.join(' · ')}</span>
    <span class="haul-score">${haulScore} pts</span>
  `;
  grid.appendChild(tally);

  caught.forEach((c, i) => {
    const species = SPECIES.find(s => s.id === c.speciesId);
    if (!species) return;
    const tier = c.rarity || species.rarity || 'common';
    const card = document.createElement('div');
    card.className = 'specimen rarity-' + tier;
    const genus = genusFor(c.speciesId, c.ts);
    const epi = epithetFor(c.speciesId, c.ts);
    const note = fieldNoteFor(c.speciesId, c.ts);
    card.innerHTML = `
      <div class="specimen-art"><div class="specimen-pin"></div>${speciesImg(species)}</div>
      <p class="specimen-num">Specimen ${String(i + 1).padStart(2, '0')} &middot; pinned ${fmtTime(c.ts)}</p>
      <p class="specimen-latin">${genus} ${epi}</p>
      <p class="specimen-rarity">${RARITY_TIERS[tier].label}</p>
      <p class="specimen-note">— ${note}</p>
    `;
    grid.appendChild(card);
  });
}

function catNo() {
  const seed = hashStr(todayKey() + '#' + caught.map(c => c.speciesId + ':' + c.ts).join(','));
  // format like "MMM-XX-####"
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const d = new Date();
  return months[d.getMonth()] + '-' + String(d.getFullYear()).slice(-2) + '-' + String(seed % 9999).padStart(4, '0');
}

// ====================== SHARE / HYDRATE ======================
function encodeCatch() {
  // compact format: speciesId|ts ; speciesId|ts ; ...
  // ts encoded as base36 of seconds since 2026-01-01 UTC for compactness
  const epoch = Date.UTC(2026, 0, 1) / 1000;
  return caught.map(c => c.speciesId + ':' + (Math.floor(c.ts / 1000) - epoch).toString(36)).join('|');
}
function decodeCatch(str) {
  if (!str) return [];
  const epoch = Date.UTC(2026, 0, 1) / 1000;
  return str.split('|').filter(Boolean).map(seg => {
    const [id, tsB36] = seg.split(':');
    const ts = (parseInt(tsB36, 36) + epoch) * 1000;
    return { speciesId: id, ts };
  }).filter(c => SPECIES.find(s => s.id === c.speciesId));
}

async function persistShare() {
  const blob = encodeCatch();
  if (!blob) return;
  const id = await saveCaseToStore(blob);
  const url = id ? ('?c=' + id) : ('#' + encodeURIComponent(blob));
  history.replaceState(null, '', url);
}

async function saveCaseToStore(data) {
  try {
    const r = await fetch(CASE_STORE_BASE + '/case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: APP_SLUG, data }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.id;
  } catch (e) { return null; }
}
async function loadCaseFromStore(id) {
  try {
    const r = await fetch(CASE_STORE_BASE + '/case/' + encodeURIComponent(id));
    if (!r.ok) return null;
    const j = await r.json();
    return (j && j.data) || null;
  } catch (e) { return null; }
}

async function hydrateFromShare() {
  const params = new URLSearchParams(location.search);
  const shortId = params.get('c');
  let blob = null;
  if (shortId) {
    blob = await loadCaseFromStore(shortId);
  }
  if (!blob && location.hash) {
    blob = decodeURIComponent(location.hash.replace(/^#/, ''));
  }
  if (!blob) return false;
  const decoded = decodeCatch(blob);
  if (!decoded.length) return false;
  caught = decoded;
  return true;
}

function showPlate(skipPersist) {
  renderPlate();
  showScreen('plate');
}

// ====================== SHARE BUTTON ======================
function share() {
  const url = location.href;
  const text = "Today's bug catalogue — " + caught.length + " pinned.";
  if (navigator.share) {
    navigator.share({ title: document.title, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(
      () => alert('Link copied — share your plate.'),
      () => alert(url)
    );
  }
}

// expose share for inline onclick
window.share = share;
