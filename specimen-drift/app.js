// Specimen Drift — abyssal aquarium + Victorian field-plate generator
// Pure client-side. No external APIs. Deterministic binomials per creature,
// reseeded swarm per visit. Tap a creature to freeze it as a Card N plate.

// ---------- CONFIG ----------
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';
const TARGET_PLATES = 6;
const CREATURE_COUNT = 30;

// ---------- SEED / RNG ----------
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}
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

// One swarm-seed per visit. Determines which 30 creatures appear.
const SESSION_SEED = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
const sessionRand = mulberry32(SESSION_SEED);

// ---------- BINOMIAL DICTIONARIES ----------
// Roots chosen so they read as plausibly Latinate / Greek-derived bio jargon.
// 24*24 = 576 genus combos and 24*24 = 576 species combos -> ~330k pairs
// before behaviour-fingerprint quantization narrows it.
const GENUS_PREFIX = [
  'Abyss', 'Bathy', 'Crypt', 'Dys', 'Eury', 'Pyro', 'Lampro', 'Melano',
  'Noct', 'Pelag', 'Photo', 'Stygo', 'Tenebr', 'Umbra', 'Vesper', 'Xeno',
  'Phosph', 'Ichthy', 'Cten', 'Thauma', 'Acantha', 'Glauc', 'Necto', 'Phant'
];
const GENUS_SUFFIX = [
  'opsis', 'oides', 'ura', 'ella', 'oma', 'ix', 'enia', 'ara',
  'eus', 'osa', 'ion', 'opa', 'osmus', 'ander', 'iphes', 'odes',
  'idion', 'imera', 'usca', 'astra', 'ynia', 'erion', 'amna', 'orix'
];
const SPECIES_PREFIX = [
  'gracil', 'humil', 'spectr', 'fulg', 'taenat', 'longimar', 'pall', 'serpent',
  'cinerar', 'velat', 'tenebr', 'pruin', 'corun', 'vitre', 'argent', 'nigric',
  'caligin', 'lumin', 'translucid', 'volat', 'undul', 'silen', 'profund', 'sublim'
];
const SPECIES_SUFFIX = [
  'is', 'a', 'us', 'ata', 'osa', 'ica', 'ans', 'or',
  'ifer', 'ipennis', 'ola', 'ina', 'icans', 'aris', 'osus', 'ifera',
  'idae', 'orum', 'ia', 'inum', 'ata', 'ulus', 'eum', 'arum'
];

// 30 noble noun roots for the kind / form.
const KIND_DEFS = [
  { name: 'jellyfish', form: 'jelly' },
  { name: 'siphonophore', form: 'siphonophore' },
  { name: 'glass octopus', form: 'octopus' },
  { name: 'bristle worm', form: 'worm' },
  { name: 'comb jelly', form: 'ctenophore' },
  { name: 'gulper eel', form: 'eel' },
  { name: 'angler', form: 'angler' },
  { name: 'lanternfish', form: 'lanternfish' },
  { name: 'salp chain', form: 'salp' },
  { name: 'vampire squid', form: 'squid' },
];

// Depth bands map fingerprint → naturalist label.
const DEPTH_BANDS = [
  { code: 'mes', name: 'mesopelagic',  range: '200–1,000 m' },
  { code: 'bat', name: 'bathypelagic', range: '1,000–4,000 m' },
  { code: 'aby', name: 'abyssopelagic', range: '4,000–6,000 m' },
  { code: 'had', name: 'hadalpelagic', range: '6,000–11,000 m' },
];

// Pulse rhythms (visual + naturalist note phrasing).
const PULSE_NAMES = ['steady', 'arrhythmic', 'metronomic', 'asynchronous', 'periodic', 'flickering'];

// Naturalist-note adjective/verb banks — light Victorian register.
const NOTE_VERBS = [
  'drifts', 'pulses', 'undulates', 'idles', 'spirals',
  'glides', 'unfurls', 'descends', 'hovers', 'oscillates'
];
const NOTE_QUALITIES = [
  'with grave deliberation',
  'as though listening',
  'in silver coils',
  'against the current',
  'by some private metronome',
  'in the manner of a lantern',
  'with the gait of an old ribbon',
  'as if the dark were a low ceiling',
  'in long temperate arcs',
  'with the patience of clockwork'
];
const NOTE_HABITS = [
  'Will not feed in lamplight.',
  'Observed only after the second hour of stillness.',
  'Recoils from the iron of the sounding line.',
  'Said, in the older books, to be the ghost of a smaller cousin.',
  'Stains the collecting net the colour of weak tea.',
  'Survives the surface for less than a half-bell.',
  'Never the same shape twice in the lantern, yet always the same creature.',
  'Believed by the cook to bring fair winds.',
  'Glows brighter when sung to. Probably coincidence.',
  'Has no Latin name in the older registers; we propose the present.'
];
const NOTE_REGIONS = [
  'Off the Cape of Pernicious Calm',
  'Sounding 1438 fathoms, west of the Bell',
  'Drawn from the throat of the Great Trench',
  'Beneath the lid of the Sargasso',
  'Below the Storm Reef, near Latitude 8',
  'Off the unnamed seamount, third bell',
  'Within the cold tongue of the southern current',
  'At the Mouth of the Drowned River',
  'Pelagic station 17, after a long calm',
  'Beneath the Iron Reef, second night'
];

// ---------- CREATURE MODEL ----------
// Each creature has a stable behaviour fingerprint that maps deterministically
// to its Latin binomial, depth band, and pulse rhythm. The fingerprint comes
// from quantized properties (drift speed bucket, depth bucket, pulse bucket,
// kind index) so any two instances with the same fingerprint produce the same
// name. Within a session, fingerprints are random; across sessions, swarms
// differ. *Same fingerprint* = *same Latin name* always.

function makeCreature(idx) {
  // randomized properties (seeded by session + idx so they're stable for the session)
  const r = mulberry32(SESSION_SEED ^ (idx * 0x9E3779B1));
  const kindIdx = Math.floor(r() * KIND_DEFS.length);
  // drift speed bucket 0..7
  const speedBucket = Math.floor(r() * 8);
  // depth bucket 0..3 (mes/bat/aby/had)
  const depthBucket = Math.floor(r() * DEPTH_BANDS.length);
  // pulse rhythm bucket 0..5
  const pulseBucket = Math.floor(r() * PULSE_NAMES.length);
  // size bucket 0..4
  const sizeBucket = Math.floor(r() * 5);
  // hue bias bucket 0..6
  const hueBucket = Math.floor(r() * 7);

  const fingerprint = `K${kindIdx}-S${speedBucket}-D${depthBucket}-P${pulseBucket}-Z${sizeBucket}-H${hueBucket}`;

  // Deterministic binomial from fingerprint
  const fp = hash32(fingerprint);
  const fpRand = mulberry32(fp);
  const genus = GENUS_PREFIX[Math.floor(fpRand() * GENUS_PREFIX.length)] +
                GENUS_SUFFIX[Math.floor(fpRand() * GENUS_SUFFIX.length)];
  const species = SPECIES_PREFIX[Math.floor(fpRand() * SPECIES_PREFIX.length)] +
                  SPECIES_SUFFIX[Math.floor(fpRand() * SPECIES_SUFFIX.length)];

  // Note phrasing — also derived from fingerprint so the same fingerprint
  // always produces the same plate.
  const verb = NOTE_VERBS[Math.floor(fpRand() * NOTE_VERBS.length)];
  const quality = NOTE_QUALITIES[Math.floor(fpRand() * NOTE_QUALITIES.length)];
  const habit = NOTE_HABITS[Math.floor(fpRand() * NOTE_HABITS.length)];
  const region = NOTE_REGIONS[Math.floor(fpRand() * NOTE_REGIONS.length)];

  // Visual style values — also session-stable
  const speed = 0.06 + speedBucket * 0.04 + r() * 0.02;
  const depth = depthBucket;
  const pulse = pulseBucket;
  const sizePx = 24 + sizeBucket * 10 + Math.floor(r() * 6);
  const hue = hueBucket; // index into a sepia-friendly bioluminescence palette
  const phase = r() * Math.PI * 2;
  const wob = 0.5 + r() * 1.4;
  const x = r();
  const y = 0.1 + r() * 0.8;
  const dirSign = r() < 0.5 ? -1 : 1;

  return {
    id: idx,
    kind: KIND_DEFS[kindIdx],
    fingerprint,
    fp,
    binomial: { genus, species },
    note: { verb, quality, habit, region },
    speed, depth, pulse, sizePx, hue, phase, wob,
    x, y, dirSign,
    // dynamic state (set every frame)
    px: 0, py: 0, t: 0,
    glow: 0
  };
}

// ---------- MAIN ----------
const state = {
  creatures: [],
  capturedFps: new Set(),
  capturedList: [], // ordered list of frozen creature snapshots (deep copies)
  running: false,
  canvas: null,
  ctx: null,
  W: 0, H: 0,
  startTime: 0,
};

function $(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', () => {
  $('begin-btn').addEventListener('click', startExpedition);
  $('export-btn').addEventListener('click', exportPng);
  $('link-btn').addEventListener('click', shareLink);
  $('restart-btn').addEventListener('click', () => {
    location.reload();
  });
  $('seed-readout').textContent = 'seed ' + SESSION_SEED.toString(16).padStart(8, '0');
  $('vol-num').textContent = romanish((SESSION_SEED >>> 28) % 12 + 1);
  $('exp-num').textContent = String(((SESSION_SEED >>> 8) & 0xfff) % 999 + 1).padStart(3, '0');
  buildEmptyStrip();

  // If a share fragment is present, render the log directly.
  if (location.hash && location.hash.startsWith('#log=')) {
    tryRenderSharedLog(location.hash.slice(5));
  } else if (location.hash && location.hash.startsWith('#case=')) {
    tryRenderCaseStored(location.hash.slice(6));
  }
});

function romanish(n) {
  const r = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  return r[(n - 1) % 12];
}

function buildEmptyStrip() {
  const strip = $('card-strip');
  strip.innerHTML = '';
  for (let i = 0; i < TARGET_PLATES; i++) {
    const slot = document.createElement('div');
    slot.className = 'strip-slot empty';
    slot.dataset.idx = i;
    strip.appendChild(slot);
  }
}

function startExpedition() {
  $('intro').hidden = true;
  $('aquarium').hidden = false;
  state.creatures = [];
  for (let i = 0; i < CREATURE_COUNT; i++) {
    state.creatures.push(makeCreature(i));
  }
  setupCanvas();
  state.running = true;
  state.startTime = performance.now();
  requestAnimationFrame(tick);
}

function setupCanvas() {
  state.canvas = $('sea');
  state.ctx = state.canvas.getContext('2d');
  // Defer sizing one frame so layout settles (avoids first-load stretch race).
  requestAnimationFrame(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    state.canvas.addEventListener('pointerdown', onCanvasTap);
  });
}

function resizeCanvas() {
  const rect = state.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.canvas.width = Math.floor(rect.width * dpr);
  state.canvas.height = Math.floor(rect.height * dpr);
  state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.W = rect.width;
  state.H = rect.height;
}

function onCanvasTap(ev) {
  if (!state.running) return;
  const rect = state.canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left);
  const y = (ev.clientY - rect.top);

  // Pick the nearest creature within hit-radius.
  let best = null, bestDist = Infinity;
  for (const c of state.creatures) {
    if (state.capturedFps.has(c.fingerprint)) continue;
    const dx = c.px - x;
    const dy = c.py - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const hitR = Math.max(36, c.sizePx * 0.9);
    if (d < hitR && d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  if (!best) return;

  freezeCreature(best);
}

function freezeCreature(c) {
  state.capturedFps.add(c.fingerprint);
  // Snapshot of the creature at moment of capture (frozen pose for the plate)
  const snap = JSON.parse(JSON.stringify(c));
  snap.capturedAtMs = performance.now() - state.startTime;
  snap.capturedPose = { phase: c.phase + c.t * c.speed, glow: c.glow };
  snap.catalogNumber = makeCatalogNumber(c, state.capturedList.length + 1);
  snap.depthMeters = computeDepthMeters(c);
  state.capturedList.push(snap);

  // Flash the canvas
  const flash = $('freeze-flash');
  flash.classList.add('flashing');
  setTimeout(() => flash.classList.remove('flashing'), 220);

  // Render thumbnail into the strip
  const idx = state.capturedList.length - 1;
  const slots = document.querySelectorAll('.strip-slot');
  const slot = slots[idx];
  slot.classList.remove('empty');
  slot.innerHTML = '';
  const thumb = document.createElement('canvas');
  thumb.width = 240; thumb.height = 320;
  slot.appendChild(thumb);
  drawSpecimenCard(thumb.getContext('2d'), 240, 320, snap, idx + 1);

  $('plate-count').textContent = state.capturedList.length;

  if (state.capturedList.length >= TARGET_PLATES) {
    state.running = false;
    setTimeout(showLogbook, 600);
  }
}

function computeDepthMeters(c) {
  const band = DEPTH_BANDS[c.depth];
  const r = mulberry32(c.fp ^ 0xa5a5a5a5);
  if (band.code === 'mes') return 200 + Math.floor(r() * 800);
  if (band.code === 'bat') return 1000 + Math.floor(r() * 3000);
  if (band.code === 'aby') return 4000 + Math.floor(r() * 2000);
  return 6000 + Math.floor(r() * 5000);
}

function makeCatalogNumber(c, plateIdx) {
  const yr = '188' + ((c.fp >>> 4) % 10);
  const exp = String(((SESSION_SEED >>> 8) & 0xfff) % 999 + 1).padStart(3, '0');
  const code = String((c.fp >>> 12) % 9999).padStart(4, '0');
  return `${yr}/${exp}-${code}`;
}

// ---------- ANIMATION LOOP ----------
function tick(now) {
  if (!state.running) return;
  const ctx = state.ctx;
  const W = state.W, H = state.H;
  ctx.clearRect(0, 0, W, H);

  // backdrop — graded depth wash (very dark)
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0c0805');
  grad.addColorStop(0.5, '#060403');
  grad.addColorStop(1, '#020100');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // marine snow — slowly drifting motes (decorative)
  const tt = (now / 1000) % 1000;
  const sn = mulberry32((SESSION_SEED ^ 0x37372121) >>> 0);
  for (let i = 0; i < 60; i++) {
    const sx = (sn() * W + tt * (10 + sn() * 8)) % W;
    const sy = (sn() * H + tt * (4 + sn() * 3)) % H;
    const sa = 0.04 + sn() * 0.06;
    ctx.fillStyle = `rgba(220,200,160,${sa})`;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // Update + draw creatures
  let hudDepth = '— m';
  for (const c of state.creatures) {
    if (state.capturedFps.has(c.fingerprint)) continue;
    c.t = (now - state.startTime) / 1000;
    // drift across X with depth-coupled wobble
    const cycle = c.speed * c.t * c.dirSign;
    c.x = (c.x + c.speed * c.dirSign * 0.0015 + 1) % 1;
    c.px = c.x * W;
    c.py = c.y * H + Math.sin(c.t * 0.5 + c.phase) * (10 * c.wob);
    // pulse glow
    c.glow = pulseValue(c, c.t);
    drawCreature(ctx, c);
  }

  // Hovering depth readout — show the band of the creature nearest the centre
  let nearest = null, ndist = Infinity;
  const cx = W / 2, cy = H / 2;
  for (const c of state.creatures) {
    if (state.capturedFps.has(c.fingerprint)) continue;
    const d = Math.hypot(c.px - cx, c.py - cy);
    if (d < ndist) { ndist = d; nearest = c; }
  }
  if (nearest) hudDepth = computeDepthMeters(nearest) + ' m';
  $('depth-readout').textContent = hudDepth;

  requestAnimationFrame(tick);
}

function pulseValue(c, t) {
  switch (c.pulse) {
    case 0: return 0.5 + 0.5 * Math.sin(t * 1.0 + c.phase); // steady
    case 1: { // arrhythmic
      const a = Math.sin(t * 1.7 + c.phase);
      const b = Math.sin(t * 0.6 + c.phase * 1.3);
      return Math.max(0, 0.5 + 0.5 * (a * 0.6 + b * 0.4));
    }
    case 2: return Math.abs(Math.sin(t * 2.0 + c.phase)); // metronomic
    case 3: { // asynchronous
      return Math.max(0, Math.sin(t * 0.9 + c.phase) - 0.4 * Math.sin(t * 2.3));
    }
    case 4: { // periodic — long bright pulses
      const v = Math.sin(t * 0.6 + c.phase);
      return v > 0.85 ? 1 : 0.15;
    }
    case 5: { // flickering
      return 0.5 + 0.5 * Math.sin(t * 6 + Math.sin(t * 1.3) * 4 + c.phase);
    }
  }
  return 0.5;
}

// ---------- CREATURE RENDERING ----------
// All creatures are drawn from canvas primitives — no images.
// Style: bioluminescent ink-line — bright cyan/amber/violet on near-black.
function creatureColor(c, alpha = 1) {
  // Limited bioluminescent palette
  const palettes = [
    ['#a8e5ff', '#65b8ff'], // cool cyan
    ['#fff0a0', '#e7c060'], // amber-jelly
    ['#d8b6ff', '#9c66ff'], // violet bloom
    ['#a0ffd0', '#3aa37a'], // green spark
    ['#ffc0c8', '#ff7a99'], // rose anemone
    ['#fff7d8', '#cdb46f'], // pale ivory
    ['#a3d6ff', '#3a72b0'], // deep cobalt
  ];
  const p = palettes[c.hue % palettes.length];
  return { bright: hexA(p[0], alpha), mid: hexA(p[1], alpha) };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function drawCreature(ctx, c) {
  const cols = creatureColor(c, 0.95);
  const glow = c.glow;
  ctx.save();
  ctx.translate(c.px, c.py);
  // gentle scale to face direction
  ctx.scale(c.dirSign, 1);

  // outer halo
  ctx.beginPath();
  const rad = c.sizePx * (0.9 + 0.25 * glow);
  const halo = ctx.createRadialGradient(0, 0, c.sizePx * 0.2, 0, 0, rad);
  halo.addColorStop(0, hexA('#ffffff', 0.10 + 0.18 * glow));
  halo.addColorStop(0.4, cols.bright.replace('0.95', String(0.18 + 0.22 * glow)));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();

  // body — shape branches by kind.form
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = cols.bright;
  ctx.fillStyle = cols.mid;
  switch (c.kind.form) {
    case 'jelly':       drawJelly(ctx, c, cols, glow); break;
    case 'siphonophore':drawSiphonophore(ctx, c, cols, glow); break;
    case 'octopus':     drawOctopus(ctx, c, cols, glow); break;
    case 'worm':        drawWorm(ctx, c, cols, glow); break;
    case 'ctenophore':  drawCtenophore(ctx, c, cols, glow); break;
    case 'eel':         drawEel(ctx, c, cols, glow); break;
    case 'angler':      drawAngler(ctx, c, cols, glow); break;
    case 'lanternfish': drawLanternfish(ctx, c, cols, glow); break;
    case 'salp':        drawSalp(ctx, c, cols, glow); break;
    case 'squid':       drawSquid(ctx, c, cols, glow); break;
  }
  ctx.restore();
}

function drawJelly(ctx, c, cols, glow) {
  const s = c.sizePx;
  // bell
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, 0);
  ctx.bezierCurveTo(-s * 0.5, -s * 0.55, s * 0.5, -s * 0.55, s * 0.5, 0);
  ctx.bezierCurveTo(s * 0.4, s * 0.05, -s * 0.4, s * 0.05, -s * 0.5, 0);
  ctx.fill();
  ctx.stroke();
  // bell ribs
  ctx.strokeStyle = cols.bright;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.12, 0);
    ctx.lineTo(i * s * 0.12, -s * 0.45);
    ctx.stroke();
  }
  // tentacles
  ctx.strokeStyle = cols.bright;
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    const x0 = i * s * 0.1;
    ctx.moveTo(x0, s * 0.04);
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const px = x0 + Math.sin(c.t * 1.5 + i + t * 4) * s * 0.06 * t;
      const py = s * 0.04 + t * s * 0.9;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawSiphonophore(ctx, c, cols, glow) {
  const s = c.sizePx;
  // chain of bells
  ctx.strokeStyle = cols.bright;
  ctx.fillStyle = cols.mid;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const y = -s * 0.6 + i * s * 0.22;
    const sz = s * (0.18 + 0.04 * Math.sin(c.t + i));
    ctx.beginPath();
    ctx.ellipse(0, y, sz, sz * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // central nematocyst trail
  ctx.beginPath();
  ctx.moveTo(0, s * 0.55);
  for (let k = 1; k <= 10; k++) {
    const t = k / 10;
    ctx.lineTo(Math.sin(c.t * 2 + t * 6) * s * 0.08 * t, s * 0.55 + t * s * 0.7);
  }
  ctx.stroke();
}

function drawOctopus(ctx, c, cols, glow) {
  const s = c.sizePx;
  // glass mantle (translucent)
  ctx.fillStyle = cols.mid;
  ctx.strokeStyle = cols.bright;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.45, s * 0.55, 0, 0, Math.PI * 2);
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  // eyes
  ctx.fillStyle = cols.bright;
  ctx.beginPath();
  ctx.arc(-s * 0.15, -s * 0.1, s * 0.05, 0, Math.PI * 2);
  ctx.arc(s * 0.15, -s * 0.1, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // arms
  ctx.strokeStyle = cols.bright;
  ctx.lineWidth = 1.2;
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(i * s * 0.07, s * 0.4);
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const px = i * s * 0.07 + Math.sin(c.t * 2 + i + t * 5) * s * 0.12 * t;
      const py = s * 0.4 + t * s * 0.7;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawWorm(ctx, c, cols, glow) {
  const s = c.sizePx;
  // segmented serpent
  ctx.strokeStyle = cols.bright;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const x = -s + t * 2 * s;
    const y = Math.sin(c.t * 1.2 + t * 8 + c.phase) * s * 0.18;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // bristles
  for (let k = 2; k <= 28; k += 2) {
    const t = k / 30;
    const x = -s + t * 2 * s;
    const y = Math.sin(c.t * 1.2 + t * 8 + c.phase) * s * 0.18;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.12);
    ctx.lineTo(x, y + s * 0.12);
    ctx.stroke();
  }
}

function drawCtenophore(ctx, c, cols, glow) {
  const s = c.sizePx;
  ctx.fillStyle = cols.mid;
  ctx.strokeStyle = cols.bright;
  // teardrop body
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.5);
  ctx.bezierCurveTo(s * 0.45, -s * 0.4, s * 0.45, s * 0.4, 0, s * 0.5);
  ctx.bezierCurveTo(-s * 0.45, s * 0.4, -s * 0.45, -s * 0.4, 0, -s * 0.5);
  ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
  ctx.stroke();
  // comb rows — 8 vertical iridescent lines
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.strokeStyle = hexA('#ffffff', 0.2 + 0.6 * glow);
    ctx.moveTo(i * s * 0.1, -s * 0.45);
    ctx.lineTo(i * s * 0.1, s * 0.45);
    ctx.stroke();
  }
}

function drawEel(ctx, c, cols, glow) {
  const s = c.sizePx;
  ctx.strokeStyle = cols.bright;
  ctx.fillStyle = cols.mid;
  ctx.lineWidth = 1.3;
  // gulper — fat head, long whip tail
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, -s * 0.2);
  ctx.bezierCurveTo(-s * 0.3, -s * 0.5, s * 0.0, -s * 0.45, s * 0.1, -s * 0.05);
  ctx.lineTo(s * 0.95, Math.sin(c.t * 1.5) * s * 0.4);
  ctx.lineTo(s * 0.1, s * 0.05);
  ctx.bezierCurveTo(s * 0.0, s * 0.45, -s * 0.3, s * 0.5, -s * 0.6, s * 0.2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // luminous tail-tip
  ctx.fillStyle = hexA('#ffffff', 0.4 + 0.6 * glow);
  ctx.beginPath();
  ctx.arc(s * 0.95, Math.sin(c.t * 1.5) * s * 0.4, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawAngler(ctx, c, cols, glow) {
  const s = c.sizePx;
  ctx.fillStyle = cols.mid;
  ctx.strokeStyle = cols.bright;
  // round body
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.55, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // tooth maw
  ctx.beginPath();
  ctx.moveTo(s * 0.05, s * 0.05);
  for (let k = 0; k <= 7; k++) {
    ctx.lineTo(s * 0.05 + k * s * 0.06, s * 0.05 + (k % 2 === 0 ? -s * 0.04 : s * 0.04));
  }
  ctx.lineTo(s * 0.05 + 7 * s * 0.06, s * 0.05);
  ctx.stroke();
  // illicium / lure
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.4);
  ctx.lineTo(0, -s * 0.7);
  ctx.lineTo(s * 0.18 + Math.sin(c.t * 2) * s * 0.05, -s * 0.85);
  ctx.stroke();
  ctx.fillStyle = hexA('#ffffff', 0.5 + 0.5 * glow);
  ctx.beginPath();
  ctx.arc(s * 0.18 + Math.sin(c.t * 2) * s * 0.05, -s * 0.85, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawLanternfish(ctx, c, cols, glow) {
  const s = c.sizePx;
  ctx.fillStyle = cols.mid;
  ctx.strokeStyle = cols.bright;
  // narrow oval body
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.55, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // tail fork
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, 0);
  ctx.lineTo(-s * 0.85, -s * 0.18);
  ctx.lineTo(-s * 0.7, 0);
  ctx.lineTo(-s * 0.85, s * 0.18);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // photophores — bright spots along belly
  ctx.fillStyle = hexA('#ffffff', 0.5 + 0.5 * glow);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(i * s * 0.13, s * 0.16, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSalp(ctx, c, cols, glow) {
  const s = c.sizePx;
  // chain of translucent barrels
  ctx.strokeStyle = cols.bright;
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 7; i++) {
    const y = -s * 0.7 + i * s * 0.22;
    const off = Math.sin(c.t * 1.0 + i) * s * 0.05;
    ctx.beginPath();
    ctx.ellipse(off, y, s * 0.18, s * 0.12, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = cols.mid;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
}

function drawSquid(ctx, c, cols, glow) {
  const s = c.sizePx;
  ctx.fillStyle = cols.mid;
  ctx.strokeStyle = cols.bright;
  // mantle
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.6);
  ctx.lineTo(s * 0.3, 0);
  ctx.lineTo(0, s * 0.2);
  ctx.lineTo(-s * 0.3, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // fins
  ctx.beginPath();
  ctx.moveTo(s * 0.3, -s * 0.05);
  ctx.lineTo(s * 0.5, -s * 0.2);
  ctx.lineTo(s * 0.3, -s * 0.25);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.05);
  ctx.lineTo(-s * 0.5, -s * 0.2);
  ctx.lineTo(-s * 0.3, -s * 0.25);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // tentacles
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.06, s * 0.18);
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      ctx.lineTo(i * s * 0.06 + Math.sin(c.t * 2 + i + t * 3) * s * 0.06 * t, s * 0.18 + t * s * 0.6);
    }
    ctx.stroke();
  }
}

// ---------- SPECIMEN CARD RENDERING (sepia engraved field plate) ----------
// Card layout — 3:4 aspect. Rendered into any 2D context at any size.
function drawSpecimenCard(ctx, w, h, snap, plateNum) {
  // paper background
  ctx.fillStyle = '#f4ecd5';
  ctx.fillRect(0, 0, w, h);
  // subtle paper texture (deterministic from fp)
  const tex = mulberry32(snap.fp ^ 0xdeadbeef);
  for (let i = 0; i < (w * h) / 60; i++) {
    ctx.fillStyle = `rgba(110,58,22,${0.04 + tex() * 0.05})`;
    ctx.fillRect(tex() * w, tex() * h, 1, 1);
  }
  // outer engraved border
  const pad = w * 0.045;
  ctx.strokeStyle = '#1f1408';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
  ctx.lineWidth = 0.6;
  ctx.strokeRect(pad + 4, pad + 4, w - 2 * (pad + 4), h - 2 * (pad + 4));

  // Title strip
  const titleY = pad + 16;
  ctx.fillStyle = '#1f1408';
  ctx.font = `${Math.floor(w * 0.045)}px "IM Fell English SC", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`PLATE ${romanish(plateNum)}`, w / 2, titleY);

  // Specimen window — small dark sea panel
  const winX = pad + 12;
  const winY = titleY + 10;
  const winW = w - 2 * (pad + 12);
  const winH = h * 0.46;
  // dark sea
  const seaGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
  seaGrad.addColorStop(0, '#10090a');
  seaGrad.addColorStop(1, '#020100');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(winX, winY, winW, winH);
  ctx.strokeStyle = '#1f1408';
  ctx.lineWidth = 1.0;
  ctx.strokeRect(winX, winY, winW, winH);

  // Render the creature centred in the window. Save / translate / scale so the
  // existing creature draw functions can be reused at the right size.
  ctx.save();
  ctx.beginPath();
  ctx.rect(winX, winY, winW, winH);
  ctx.clip();
  const targetSize = Math.min(winW, winH) * 0.35;
  const scale = targetSize / Math.max(snap.sizePx, 1);
  ctx.translate(winX + winW / 2, winY + winH / 2);
  ctx.scale(scale, scale);
  // Use a frozen pose for the plate (capturedPose) — drawCreature expects a
  // creature object, so we build a stand-in with t = 0 and the captured phase.
  const frozen = Object.assign({}, snap, {
    t: snap.capturedPose ? snap.capturedPose.phase / Math.max(snap.speed, 0.001) : 0,
    glow: snap.capturedPose ? snap.capturedPose.glow : 0.5,
    px: 0, py: 0, dirSign: 1
  });
  // override draw to render at origin
  const origDraw = drawCreature;
  drawCreatureAtOrigin(ctx, frozen);
  ctx.restore();

  // Below-window: binomial in italic, vernacular, depth band
  const textX = w / 2;
  let cursor = winY + winH + 20;
  ctx.fillStyle = '#1f1408';
  ctx.font = `italic ${Math.floor(w * 0.055)}px "IM Fell English", Georgia, serif`;
  ctx.fillText(`${snap.binomial.genus} ${snap.binomial.species}`, textX, cursor);
  cursor += Math.floor(w * 0.05);
  ctx.font = `${Math.floor(w * 0.04)}px "IM Fell English SC", serif`;
  ctx.fillStyle = '#4a2206';
  ctx.fillText(snap.kind.name.toUpperCase(), textX, cursor);
  cursor += Math.floor(w * 0.045);

  // Naturalist note (4 lines)
  ctx.font = `${Math.floor(w * 0.034)}px "IM Fell English", Georgia, serif`;
  ctx.fillStyle = '#3d2912';
  const lines = [
    `${cap(snap.note.region)},`,
    `where it ${snap.note.verb} ${snap.note.quality}.`,
    `Pulse: ${PULSE_NAMES[snap.pulse]}, depth ${snap.depthMeters} m.`,
    snap.note.habit
  ];
  for (const ln of lines) {
    cursor += Math.floor(w * 0.04);
    fillWrapped(ctx, ln, textX, cursor, w - 2 * (pad + 16), Math.floor(w * 0.04));
  }

  // Catalog number — small, lower-right
  ctx.textAlign = 'right';
  ctx.font = `${Math.floor(w * 0.028)}px "IM Fell English SC", serif`;
  ctx.fillStyle = '#6e3a16';
  ctx.fillText(`№ ${snap.catalogNumber}`, w - pad - 6, h - pad - 6);
  ctx.textAlign = 'left';
  ctx.fillText(`band: ${DEPTH_BANDS[snap.depth].name}`, pad + 6, h - pad - 6);
  ctx.textAlign = 'center';
}

function fillWrapped(ctx, text, cx, cy, maxW, lineH) {
  // Single-line truncation with ellipsis (lines are pre-shaped short).
  if (ctx.measureText(text).width <= maxW) {
    ctx.fillText(text, cx, cy);
    return;
  }
  let s = text;
  while (s.length > 4 && ctx.measureText(s + '…').width > maxW) {
    s = s.slice(0, -1);
  }
  ctx.fillText(s + '…', cx, cy);
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// drawCreature variant that ignores px/py and renders at origin.
function drawCreatureAtOrigin(ctx, c) {
  const cols = creatureColor(c, 0.95);
  ctx.save();
  // halo
  ctx.beginPath();
  const rad = c.sizePx * (0.9 + 0.25 * (c.glow || 0.5));
  const halo = ctx.createRadialGradient(0, 0, c.sizePx * 0.2, 0, 0, rad);
  halo.addColorStop(0, hexA('#ffffff', 0.18));
  halo.addColorStop(0.4, cols.bright.replace('0.95', '0.30'));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = cols.bright;
  ctx.fillStyle = cols.mid;
  switch (c.kind.form) {
    case 'jelly':       drawJelly(ctx, c, cols, c.glow || 0.5); break;
    case 'siphonophore':drawSiphonophore(ctx, c, cols, c.glow || 0.5); break;
    case 'octopus':     drawOctopus(ctx, c, cols, c.glow || 0.5); break;
    case 'worm':        drawWorm(ctx, c, cols, c.glow || 0.5); break;
    case 'ctenophore':  drawCtenophore(ctx, c, cols, c.glow || 0.5); break;
    case 'eel':         drawEel(ctx, c, cols, c.glow || 0.5); break;
    case 'angler':      drawAngler(ctx, c, cols, c.glow || 0.5); break;
    case 'lanternfish': drawLanternfish(ctx, c, cols, c.glow || 0.5); break;
    case 'salp':        drawSalp(ctx, c, cols, c.glow || 0.5); break;
    case 'squid':       drawSquid(ctx, c, cols, c.glow || 0.5); break;
  }
  ctx.restore();
}

// ---------- LOGBOOK PAGE (the share artifact) ----------
function showLogbook() {
  $('aquarium').hidden = true;
  $('logbook').hidden = false;
  drawLogPage();
}

let LOG_PAGE_CANVAS = null;

function drawLogPage() {
  const W = 1200, H = 1500; // 6 cards, 2x3 grid, riso-sepia poster
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // paper
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(0, 0, W, H);
  // texture
  const tex = mulberry32((SESSION_SEED ^ 0x70a17075) >>> 0);
  for (let i = 0; i < (W * H) / 200; i++) {
    ctx.fillStyle = `rgba(74,34,6,${0.025 + tex() * 0.04})`;
    ctx.fillRect(tex() * W, tex() * H, 1, 1);
  }
  // border
  ctx.strokeStyle = '#1f1408';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.lineWidth = 1;
  ctx.strokeRect(34, 34, W - 68, H - 68);

  // Masthead
  ctx.fillStyle = '#1f1408';
  ctx.textAlign = 'center';
  ctx.font = `64px "IM Fell English SC", Georgia, serif`;
  ctx.fillText('SPECIMEN DRIFT', W / 2, 100);
  ctx.font = `italic 26px "IM Fell English", Georgia, serif`;
  ctx.fillStyle = '#4a2206';
  ctx.fillText(`Field log of the Abyssal Survey, exped. ${$('exp-num').textContent} — ${(new Date()).toISOString().slice(0,10)}`, W / 2, 138);

  // Grid: 2 columns, 3 rows of cards
  const cols = 2, rows = 3;
  const gridLeft = 60, gridTop = 180, gridRight = W - 60, gridBottom = H - 110;
  const gw = (gridRight - gridLeft) / cols;
  const gh = (gridBottom - gridTop) / rows;
  const cardPad = 18;

  for (let i = 0; i < TARGET_PLATES; i++) {
    if (i >= state.capturedList.length) break;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridLeft + col * gw + cardPad;
    const y = gridTop + row * gh + cardPad;
    const cw = gw - cardPad * 2;
    const ch = gh - cardPad * 2;

    // Card on its own — render with off-screen cv first to keep coordinate math simple
    const cv = document.createElement('canvas');
    cv.width = Math.floor(cw); cv.height = Math.floor(ch);
    drawSpecimenCard(cv.getContext('2d'), cv.width, cv.height, state.capturedList[i], i + 1);
    ctx.drawImage(cv, x, y);
  }

  // Footer
  ctx.fillStyle = '#4a2206';
  ctx.textAlign = 'center';
  ctx.font = `italic 22px "IM Fell English", Georgia, serif`;
  ctx.fillText(`Pressed in sepia ink · seed ${SESSION_SEED.toString(16).padStart(8,'0')} · benlirio.com/apps/specimen-drift/`, W / 2, H - 50);

  // Place page canvas into DOM
  const wrap = $('log-page');
  wrap.innerHTML = '';
  // CSS-shrink the big canvas to fit the column; export uses native resolution.
  c.style.width = '100%';
  c.style.height = 'auto';
  wrap.appendChild(c);
  LOG_PAGE_CANVAS = c;
}

// ---------- EXPORT & SHARE ----------
async function exportPng() {
  if (!LOG_PAGE_CANVAS) return;
  LOG_PAGE_CANVAS.toBlob((blob) => {
    if (!blob) {
      $('share-status').textContent = 'Export failed — try again.';
      return;
    }
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'specimen-drift.png', { type: 'image/png' })] })) {
      const file = new File([blob], 'specimen-drift.png', { type: 'image/png' });
      navigator.share({ files: [file], title: 'Specimen Drift', text: 'My expedition log from Specimen Drift.' })
        .catch(() => downloadBlob(blob));
    } else {
      downloadBlob(blob);
    }
  }, 'image/png');
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'specimen-drift-log.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('share-status').textContent = 'PNG saved to your downloads.';
}

async function shareLink() {
  // Compact representation of the log: store fingerprints and order so the
  // recipient can reconstruct the same plates by re-seeding the makeCreature
  // logic with the original SESSION_SEED + creature indices.
  const payload = {
    s: SESSION_SEED,
    p: state.capturedList.map(c => c.id) // creature indices in capture order
  };
  const compact = JSON.stringify(payload);

  // If short enough, use a fragment.
  const b64 = btoa(unescape(encodeURIComponent(compact)));
  const fragmentUrl = `${location.origin}${location.pathname}#log=${b64}`;
  if (b64.length <= 80) {
    await copyAndAnnounce(fragmentUrl);
    return;
  }

  // Otherwise use the case-store service for a short ID.
  try {
    const res = await fetch(`${CASE_STORE_BASE}/case`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: compact })
    });
    if (!res.ok) throw new Error('case-store http ' + res.status);
    const obj = await res.json();
    const id = obj.id || obj.caseId || obj.case_id;
    if (!id) throw new Error('case-store no id');
    const shortUrl = `${location.origin}${location.pathname}#case=${id}`;
    await copyAndAnnounce(shortUrl);
  } catch (e) {
    // graceful fallback to fragment
    await copyAndAnnounce(fragmentUrl);
  }
}

async function copyAndAnnounce(url) {
  try {
    await navigator.clipboard.writeText(url);
    $('share-status').textContent = 'Link copied. The recipient will see your exact log.';
  } catch (e) {
    $('share-status').textContent = url;
  }
}

// ---------- SHARED LOG INGEST (for recipient pages) ----------
function tryRenderSharedLog(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    renderSharedFromPayload(obj);
  } catch (e) {
    // ignore — start fresh
  }
}

async function tryRenderCaseStored(id) {
  try {
    const res = await fetch(`${CASE_STORE_BASE}/case/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('not found');
    const obj = await res.json();
    const data = obj.data || obj.body || obj.payload;
    if (!data) throw new Error('no data');
    const parsed = JSON.parse(data);
    renderSharedFromPayload(parsed);
  } catch (e) {
    // ignore
  }
}

function renderSharedFromPayload(obj) {
  // Hijack: rebuild the swarm from obj.s, then capture obj.p in order.
  if (!obj || typeof obj.s !== 'number' || !Array.isArray(obj.p)) return;
  // Override session seed for reconstruction
  // (We can't reassign const SESSION_SEED, but we can rebuild creatures using obj.s
  //  and bypass the live aquarium.)
  const creatures = [];
  for (let i = 0; i < CREATURE_COUNT; i++) {
    creatures.push(makeCreatureWithSeed(i, obj.s));
  }
  state.capturedList = [];
  for (const idx of obj.p) {
    if (idx < 0 || idx >= creatures.length) continue;
    const c = creatures[idx];
    const snap = JSON.parse(JSON.stringify(c));
    snap.capturedPose = { phase: c.phase, glow: 0.5 };
    snap.catalogNumber = makeCatalogNumber(c, state.capturedList.length + 1);
    snap.depthMeters = computeDepthMeters(c);
    state.capturedList.push(snap);
  }
  if (state.capturedList.length === 0) return;
  $('intro').hidden = true;
  $('aquarium').hidden = true;
  $('logbook').hidden = false;
  // override the seed-readout
  $('seed-readout').textContent = 'seed ' + obj.s.toString(16).padStart(8, '0') + ' (received)';
  drawLogPage();
}

function makeCreatureWithSeed(idx, seed) {
  const r = mulberry32(seed ^ (idx * 0x9E3779B1));
  const kindIdx = Math.floor(r() * KIND_DEFS.length);
  const speedBucket = Math.floor(r() * 8);
  const depthBucket = Math.floor(r() * DEPTH_BANDS.length);
  const pulseBucket = Math.floor(r() * PULSE_NAMES.length);
  const sizeBucket = Math.floor(r() * 5);
  const hueBucket = Math.floor(r() * 7);
  const fingerprint = `K${kindIdx}-S${speedBucket}-D${depthBucket}-P${pulseBucket}-Z${sizeBucket}-H${hueBucket}`;
  const fp = hash32(fingerprint);
  const fpRand = mulberry32(fp);
  const genus = GENUS_PREFIX[Math.floor(fpRand() * GENUS_PREFIX.length)] +
                GENUS_SUFFIX[Math.floor(fpRand() * GENUS_SUFFIX.length)];
  const species = SPECIES_PREFIX[Math.floor(fpRand() * SPECIES_PREFIX.length)] +
                  SPECIES_SUFFIX[Math.floor(fpRand() * SPECIES_SUFFIX.length)];
  const verb = NOTE_VERBS[Math.floor(fpRand() * NOTE_VERBS.length)];
  const quality = NOTE_QUALITIES[Math.floor(fpRand() * NOTE_QUALITIES.length)];
  const habit = NOTE_HABITS[Math.floor(fpRand() * NOTE_HABITS.length)];
  const region = NOTE_REGIONS[Math.floor(fpRand() * NOTE_REGIONS.length)];
  const speed = 0.06 + speedBucket * 0.04 + r() * 0.02;
  const sizePx = 24 + sizeBucket * 10 + Math.floor(r() * 6);
  const phase = r() * Math.PI * 2;
  const wob = 0.5 + r() * 1.4;
  const x = r();
  const y = 0.1 + r() * 0.8;
  const dirSign = r() < 0.5 ? -1 : 1;
  return {
    id: idx, kind: KIND_DEFS[kindIdx], fingerprint, fp,
    binomial: { genus, species }, note: { verb, quality, habit, region },
    speed, depth: depthBucket, pulse: pulseBucket, sizePx, hue: hueBucket,
    phase, wob, x, y, dirSign, px: 0, py: 0, t: 0, glow: 0.5
  };
}

// ---------- share() shim for any auto-injected button ----------
function share() {
  exportPng();
}
