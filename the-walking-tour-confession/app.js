// The Walking Tour Confession — procedural pixel-map surveillance walk → stamped report.
// Deterministic: route -> archetype + 8 detective lines. AI is one optional flourish at the end.

const SLUG = 'the-walking-tour-confession';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';

const TOTAL_STOPS = 8;
const WALK_SECONDS = 90;

// ---------- Hashing / RNG ----------

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
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

// Each "case" gets a stable seeded city. The case id IS the seed root.
function newCaseId() {
  // 6-char alphanumeric upper, e.g. K7Q3M2
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// ---------- City generation ----------

const CORNER_TYPES = [
  { key: 'diner',     label: 'Diner',          verb: 'sat for too long at' },
  { key: 'pawn',      label: 'Pawn Shop',      verb: 'cased' },
  { key: 'vape',      label: 'Vape Store',     verb: 'lingered outside' },
  { key: 'park',      label: 'Dog Park',       verb: 'doubled back through' },
  { key: 'atm',       label: 'ATM',            verb: 'pretended not to use' },
  { key: 'laundro',   label: 'Laundromat',     verb: 'avoided eye contact in' },
  { key: 'liquor',    label: 'Liquor Store',   verb: 'detoured past' },
  { key: 'church',    label: 'Old Church',     verb: 'crossed himself near' },
  { key: 'bodega',    label: 'Bodega',         verb: 'tipped the cat at' },
  { key: 'subway',    label: 'Subway Mouth',   verb: 'paused at the top of' },
  { key: 'taqueria',  label: 'Taqueria',       verb: 'studied the menu of' },
  { key: 'barber',    label: '24hr Barber',    verb: 'walked twice past' },
  { key: 'court',     label: 'Court House',    verb: 'speed-walked past' },
  { key: 'fountain',  label: 'Dry Fountain',   verb: 'sat near' },
  { key: 'lot',       label: 'Empty Lot',      verb: 'cut through' },
  { key: 'bus',       label: 'Bus Stop',       verb: 'didn’t board at' },
  { key: 'flower',    label: 'Flower Stand',   verb: 'didn’t buy from' },
  { key: 'pharm',     label: 'Pharmacy',       verb: 'lingered in the aisle of' }
];

const STREETS_NS = ['ASH', 'ELM', 'PINE', 'OAK', 'CEDAR', 'MAPLE', 'BIRCH', 'WALNUT', 'WILLOW', 'POPLAR'];
const STREETS_EW = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH'];

function buildCity(caseId) {
  // Map: 12x12 grid of cells in a 360x360 canvas → cell = 30px.
  // Roads are at every 3rd grid line. We place 10 candidate corners, randomly typed.
  const seed = hash('city|' + caseId);
  const rng = mulberry32(seed);

  const corners = [];
  const used = new Set();
  // place 10 corner candidates on the 4x4 internal road intersections (excluding edges)
  // intersections at cells (3,3), (3,6), (3,9), (6,3) ... etc.
  const interX = [60, 120, 180, 240, 300]; // 5 cols
  const interY = [60, 120, 180, 240, 300]; // 5 rows
  const allInter = [];
  for (const x of interX) for (const y of interY) allInter.push({ x, y });
  // Shuffle and pick 10
  for (let i = allInter.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allInter[i], allInter[j]] = [allInter[j], allInter[i]];
  }
  const picked = allInter.slice(0, 10);

  // Pick types without repeats
  const typesShuffled = CORNER_TYPES.slice();
  for (let i = typesShuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [typesShuffled[i], typesShuffled[j]] = [typesShuffled[j], typesShuffled[i]];
  }
  picked.forEach((p, i) => {
    const t = typesShuffled[i];
    // Street naming: NS street index from x position, EW from y
    const nsName = STREETS_NS[Math.floor(rng() * STREETS_NS.length)];
    const ewName = STREETS_EW[Math.floor(rng() * STREETS_EW.length)];
    corners.push({
      id: i,
      x: p.x, y: p.y,
      type: t,
      streets: nsName + ' & ' + ewName
    });
  });

  // Park rect (decoration, deterministic)
  const parkX = 30 + Math.floor(rng() * 4) * 60;
  const parkY = 30 + Math.floor(rng() * 4) * 60;
  // Water rect (decoration) sometimes
  const hasWater = rng() > 0.4;
  const waterSide = ['top', 'right', 'bottom', 'left'][Math.floor(rng() * 4)];

  // Detective name based on case
  const detectives = ['RUSSO', 'KIRBY', 'NAVARRO', 'OKAFOR', 'HAYES', 'SOLIS', 'BIRCHALL', 'YANG', 'DELANEY', 'PATEL'];
  const detective = detectives[hash('det|' + caseId) % detectives.length];

  return { corners, parkX, parkY, hasWater, waterSide, detective, seed };
}

// ---------- Map rendering ----------

function drawMap(ctx, city, route, opts) {
  opts = opts || {};
  const { corners, parkX, parkY, hasWater, waterSide } = city;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // background
  ctx.fillStyle = '#0a160c';
  ctx.fillRect(0, 0, W, H);

  // grid blocks (subtle)
  ctx.fillStyle = '#101d12';
  for (let gx = 0; gx < W; gx += 60) {
    for (let gy = 0; gy < H; gy += 60) {
      if (((gx / 60) + (gy / 60)) % 2 === 0) ctx.fillRect(gx, gy, 60, 60);
    }
  }

  // park
  ctx.fillStyle = '#14241a';
  ctx.fillRect(parkX, parkY, 60, 60);
  // park trees (3 dots)
  ctx.fillStyle = '#2d4d2f';
  ctx.fillRect(parkX + 12, parkY + 12, 6, 6);
  ctx.fillRect(parkX + 30, parkY + 24, 6, 6);
  ctx.fillRect(parkX + 18, parkY + 40, 6, 6);

  // water strip
  if (hasWater) {
    ctx.fillStyle = '#0a1622';
    if (waterSide === 'top') ctx.fillRect(0, 0, W, 12);
    else if (waterSide === 'bottom') ctx.fillRect(0, H - 12, W, 12);
    else if (waterSide === 'left') ctx.fillRect(0, 0, 12, H);
    else ctx.fillRect(W - 12, 0, 12, H);
    // wave pixels
    ctx.fillStyle = '#1a2c44';
    for (let i = 0; i < W; i += 8) {
      if (waterSide === 'top') ctx.fillRect(i, 4, 4, 2);
      else if (waterSide === 'bottom') ctx.fillRect(i, H - 8, 4, 2);
      else if (waterSide === 'left') ctx.fillRect(4, i, 2, 4);
      else ctx.fillRect(W - 8, i, 2, 4);
    }
  }

  // roads (horizontal at 60,120,180,240,300; vertical same)
  ctx.fillStyle = '#1f3324';
  for (let r = 60; r <= 300; r += 60) {
    ctx.fillRect(0, r - 4, W, 8);
    ctx.fillRect(r - 4, 0, 8, H);
  }
  // road dashes (centerline)
  ctx.fillStyle = '#2a4a30';
  for (let r = 60; r <= 300; r += 60) {
    for (let i = 4; i < W; i += 12) ctx.fillRect(i, r - 1, 6, 2);
    for (let i = 4; i < H; i += 12) ctx.fillRect(r - 1, i, 2, 6);
  }

  // route lines (drawn before corners)
  if (route && route.length > 1) {
    ctx.strokeStyle = '#ff5d3a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (let i = 0; i < route.length; i++) {
      const c = corners[route[i]];
      if (i === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
    // breadcrumb pixels along the route
    ctx.fillStyle = '#ffae3a';
    for (let i = 0; i < route.length - 1; i++) {
      const a = corners[route[i]], b = corners[route[i + 1]];
      const steps = 10;
      for (let s = 1; s < steps; s++) {
        const x = a.x + (b.x - a.x) * (s / steps);
        const y = a.y + (b.y - a.y) * (s / steps);
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
  }

  // surveillance van — sits near the start corner, or at a fixed perch if no route
  if (opts.showVan && route && route.length > 0) {
    const start = corners[route[0]];
    const vx = Math.max(8, Math.min(W - 16, start.x + 14));
    const vy = Math.max(8, Math.min(H - 12, start.y + 14));
    drawVan(ctx, vx, vy);
  }

  // corners
  for (const c of corners) {
    const visited = route && route.indexOf(c.id) !== -1;
    const isCurrent = route && route.length > 0 && route[route.length - 1] === c.id;
    const px = c.x, py = c.y;

    // building footprint pixel sprite per type
    drawBuilding(ctx, px, py, c.type.key);

    // numbered marker if visited
    if (visited) {
      const idx = route.indexOf(c.id) + 1;
      ctx.fillStyle = isCurrent ? '#ffd84a' : '#ffae3a';
      ctx.fillRect(px - 9, py - 9, 18, 18);
      ctx.fillStyle = '#1c1409';
      ctx.font = 'bold 14px "Special Elite", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx), px, py + 1);
    } else if (!opts.staticReport) {
      // selectable corner indicator
      ctx.fillStyle = '#d6c469';
      ctx.fillRect(px - 5, py - 5, 10, 10);
      ctx.fillStyle = '#0a160c';
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
  }
}

function drawBuilding(ctx, x, y, key) {
  // Tiny pixel-art icon offset from the dot, NW of the corner.
  const ox = x - 22, oy = y - 22;
  const palettes = {
    diner:    ['#7a3a3a', '#d96a4a', '#ffd84a'],
    pawn:     ['#3a4a7a', '#7080c0', '#ffd84a'],
    vape:     ['#5a3a7a', '#9070c0', '#7adcff'],
    park:     ['#2d4d2f', '#5a8a4a', '#a0d070'],
    atm:      ['#444444', '#888888', '#cfd6d6'],
    laundro:  ['#3a6a7a', '#7ab0c0', '#dfe8e8'],
    liquor:   ['#5a3a3a', '#8a4a4a', '#d63f33'],
    church:   ['#444466', '#888888', '#ffd84a'],
    bodega:   ['#5a4a2a', '#a07a3a', '#ffae3a'],
    subway:   ['#222222', '#555555', '#76d39a'],
    taqueria: ['#7a5a2a', '#c0903a', '#ffae3a'],
    barber:   ['#4a4a4a', '#a0a0a0', '#d63f33'],
    court:    ['#5a5a4a', '#a0a08a', '#dfd6a0'],
    fountain: ['#3a4a4a', '#7a8a8a', '#7adcff'],
    lot:      ['#2a2a1a', '#4a4a3a', '#7a7a5a'],
    bus:      ['#3a4a3a', '#6a8a6a', '#ffd84a'],
    flower:   ['#3a5a3a', '#a0d070', '#ff7aa0'],
    pharm:    ['#3a5a5a', '#7ab0b0', '#76d39a']
  };
  const p = palettes[key] || palettes.lot;
  // shadow
  ctx.fillStyle = '#000';
  ctx.fillRect(ox + 1, oy + 13, 14, 2);
  // body
  ctx.fillStyle = p[0];
  ctx.fillRect(ox, oy + 4, 14, 10);
  // facade highlight
  ctx.fillStyle = p[1];
  ctx.fillRect(ox, oy + 4, 14, 3);
  // sign / door / accent
  ctx.fillStyle = p[2];
  if (key === 'diner') { ctx.fillRect(ox + 3, oy + 1, 8, 3); }
  else if (key === 'pawn') { ctx.fillRect(ox + 4, oy + 2, 6, 2); ctx.fillStyle = p[2]; ctx.fillRect(ox + 6, oy + 8, 2, 2); }
  else if (key === 'vape') { ctx.fillRect(ox + 5, oy + 1, 4, 3); ctx.fillRect(ox + 6, oy + 9, 2, 1); }
  else if (key === 'church') { ctx.fillRect(ox + 6, oy, 2, 6); ctx.fillRect(ox + 5, oy + 1, 4, 2); }
  else if (key === 'subway') { ctx.fillStyle = '#000'; ctx.fillRect(ox + 3, oy + 7, 8, 6); ctx.fillStyle = p[2]; ctx.fillRect(ox + 5, oy + 9, 4, 1); }
  else if (key === 'liquor') { ctx.fillRect(ox + 3, oy + 2, 8, 2); }
  else if (key === 'fountain') { ctx.fillRect(ox + 5, oy + 7, 4, 4); ctx.fillRect(ox + 6, oy + 5, 2, 2); }
  else if (key === 'park') { ctx.fillRect(ox + 2, oy + 8, 3, 3); ctx.fillRect(ox + 8, oy + 6, 3, 3); }
  else if (key === 'flower') { ctx.fillRect(ox + 2, oy + 8, 2, 2); ctx.fillRect(ox + 6, oy + 7, 2, 2); ctx.fillRect(ox + 10, oy + 9, 2, 2); }
  else if (key === 'lot') { ctx.fillRect(ox + 2, oy + 11, 2, 1); ctx.fillRect(ox + 7, oy + 12, 2, 1); }
  else { ctx.fillRect(ox + 4, oy + 1, 6, 3); }
}

function drawVan(ctx, x, y) {
  // 16x10 van sprite, amber, with antenna + dish
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y + 8, 16, 2);
  ctx.fillStyle = '#ffae3a';
  ctx.fillRect(x, y, 14, 8);
  ctx.fillStyle = '#7a5a1a';
  ctx.fillRect(x, y, 14, 2); // roof shadow
  ctx.fillStyle = '#76d39a';
  ctx.fillRect(x + 2, y + 3, 4, 3); // window
  ctx.fillRect(x + 8, y + 3, 4, 3);
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 1, y + 8, 3, 2); // wheel
  ctx.fillRect(x + 10, y + 8, 3, 2);
  // dish
  ctx.fillStyle = '#cfd6d6';
  ctx.fillRect(x + 6, y - 4, 2, 4);
  ctx.fillRect(x + 4, y - 5, 6, 2);
  // antenna
  ctx.fillStyle = '#d63f33';
  ctx.fillRect(x + 13, y - 5, 1, 5);
  ctx.fillRect(x + 12, y - 6, 3, 1);
}

// ---------- Detective lines ----------

// Pool of grammars; we pick one per stop deterministically from (caseId + stop index + type).
const GRAMMARS = [
  // each grammar: function(corner, prevCorner, stopIndex, totalStops, archetype)
  (c, prev, i) => `Subject ${c.type.verb} the ${c.type.label.toLowerCase()} on ${c.streets}. ${i === 0 ? 'No greeting offered.' : 'No clear reason.'}`,
  (c, prev) => `${c.type.label} on ${c.streets}. Subject ${c.type.verb} it for forty-three seconds. Note the timing.`,
  (c, prev, i) => `Stop ${pad2(i + 1)}: ${c.type.label}. ${prev ? 'Came directly from the ' + prev.type.label.toLowerCase() + '.' : 'No prior stop on record.'} Body language: civilian, but rehearsed.`,
  (c) => `Civilian observed at ${c.type.label}, ${c.streets}. Behavior consistent with someone who has been there before. Many times.`,
  (c, prev) => `${c.streets}. ${c.type.label}. The way they ${c.type.verb} it tells me everything I need to know.`,
  (c, prev, i, total) => `${c.type.label} (${c.streets}). ${i === total - 1 ? 'Final stop. Subject did not look back.' : 'Subject moved on without looking back.'}`,
  (c) => `Note: ${c.type.label} at ${c.streets}. Subject ${c.type.verb} it. We can build a personality from less.`,
  (c, prev) => `Cross-referencing the ${c.type.label} with prior route. Subject ${c.type.verb} it. Pattern is forming.`,
  (c, prev, i) => `${pad2(i + 1)}. ${c.type.label}, ${c.streets}. Body language reads: ${moodFor(c.type.key)}.`,
  (c) => `${c.type.label}. ${c.streets}. Subject ${c.type.verb} it. I have written this exact sentence about this exact person before.`,
  (c) => `Observed: ${c.type.label} on ${c.streets}. Subject ${c.type.verb} it. File under "predictable."`,
  (c, prev) => `Subject is now at the ${c.type.label} on ${c.streets}. Confirmed via passive monitoring. ${prev ? 'Trail clean from the ' + prev.type.label.toLowerCase() + '.' : 'Origin unclear.'}`
];

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function moodFor(key) {
  const m = {
    diner: 'unhurried, post-coffee',
    pawn: 'evaluative, possibly carrying',
    vape: 'avoidant, hands occupied',
    park: 'looping, performative',
    atm: 'shoulder-checked, withdrew nothing',
    laundro: 'killing time on purpose',
    liquor: 'efficient, brand-loyal',
    church: 'quietly negotiating with someone',
    bodega: 'familiar, tipped the cat',
    subway: 'about to commit to something',
    taqueria: 'reading the menu they’ve memorized',
    barber: 'considering a new identity',
    court: 'walking faster than usual',
    fountain: 'sitting like they’ve waited here before',
    lot: 'shortcut-taking, surveillance-aware',
    bus: 'didn’t board, never planned to',
    flower: 'rehearsing an apology',
    pharm: 'pretending the third aisle is interesting'
  };
  return m[key] || 'civilian, non-committal';
}

function detectiveLine(corner, prevCorner, stopIndex, total, caseId) {
  const idx = hash(caseId + '|line|' + stopIndex + '|' + corner.type.key) % GRAMMARS.length;
  return GRAMMARS[idx](corner, prevCorner, stopIndex, total);
}

// ---------- Archetype ----------

const ARCHETYPES = [
  { name: 'The Anxious Errand-Runner', match: ['atm', 'pharm', 'laundro', 'bodega'], flourish: 'Subject runs errands the way other people make confessions. Quietly, in order, with receipts.' },
  { name: 'The Off-Duty Saint',         match: ['church', 'flower', 'park', 'bodega'], flourish: 'Walks like they’re paying off a debt nobody can see. Tips the cat. Apologizes to the fountain.' },
  { name: 'The Soft Recidivist',        match: ['pawn', 'liquor', 'lot', 'subway'], flourish: 'Knows which corners do not have cameras. Doesn’t do anything illegal. Just stays informed.' },
  { name: 'The Loiterer of Note',       match: ['vape', 'bus', 'fountain', 'park'], flourish: 'Has nowhere to be, on purpose. The route is the destination. The destination is the loiter.' },
  { name: 'The Civilian Detective',     match: ['court', 'pharm', 'laundro', 'subway'], flourish: 'Treats the city like a crime scene they’re politely declining to solve.' },
  { name: 'The Gentle Recluse, Out For Once', match: ['flower', 'taqueria', 'church', 'bodega'], flourish: 'Hasn’t left the apartment in eleven days. Today the route is medicinal.' },
  { name: 'The Comeback Kid',           match: ['barber', 'liquor', 'taqueria', 'diner'], flourish: 'Walks like a man who has decided, this week, to become a different man. We’ll see.' },
  { name: 'The Restless Mourner',       match: ['church', 'park', 'fountain', 'lot'], flourish: 'Carrying something invisible. Stops at every place that lets them stand still without explaining why.' },
  { name: 'The Connoisseur of Small Decisions', match: ['diner', 'bodega', 'taqueria', 'flower'], flourish: 'Will spend twenty minutes choosing a soda. Will not regret it. Files a full sensory report.' },
  { name: 'The Quiet Operator',         match: ['pawn', 'atm', 'court', 'subway'], flourish: 'Moves with the calm of someone who has read the manual. Does not flinch when surveilled.' },
  { name: 'The Block Mayor',            match: ['bodega', 'barber', 'diner', 'flower'], flourish: 'Knows everyone by first name. Is known by no one’s last name. Owns nothing. Runs everything.' },
  { name: 'The Soft Catastrophe',       match: ['vape', 'liquor', 'lot', 'pharm'], flourish: 'Heading nowhere fast. Gets there anyway. The walk is a controlled demolition of a Tuesday.' }
];

function pickArchetype(route, corners, caseId) {
  const counts = {};
  for (const r of route) {
    const k = corners[r].type.key;
    counts[k] = (counts[k] || 0) + 1;
  }
  // score each archetype by overlap with route types
  let best = null, bestScore = -1, bestIdx = -1;
  ARCHETYPES.forEach((a, i) => {
    let score = 0;
    for (const k of a.match) score += counts[k] || 0;
    // tiebreak deterministic via case id + archetype name
    score = score * 1000 + (hash(caseId + a.name) % 997);
    if (score > bestScore) { bestScore = score; best = a; bestIdx = i; }
  });
  return best || ARCHETYPES[0];
}

// ---------- AI flourish (one optional polish line) ----------

async function aiFlourish(archetype, route, corners) {
  const stops = route.map((id) => corners[id].type.label).join(' > ');
  const messages = [
    {
      role: 'system',
      content: 'You are a deadpan plainclothes detective writing one final sentence on a Surveillance Report. Write ONE sentence under 28 words. No emojis, no hashtags, no exclamation points. Reference the route. Tone: dry, slightly amused, weary. Do not greet, do not sign off, just the sentence.'
    },
    {
      role: 'user',
      content: 'Archetype assigned: ' + archetype.name + '. Route: ' + stops + '. Write the final summary line of the report.'
    }
  ];
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 80 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const out = (data.content || '').trim().replace(/^["'“‘]+|["'”’]+$/g, '');
    return out || archetype.flourish;
  } catch (_) {
    return archetype.flourish;
  }
}

// ---------- Case-store (short share URLs) ----------

async function saveCase(payload) {
  try {
    const res = await fetch(CASE_STORE_BASE + '/case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, data: JSON.stringify(payload) })
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.id || null;
  } catch (_) { return null; }
}
async function loadCase(id) {
  try {
    const res = await fetch(CASE_STORE_BASE + '/case/' + encodeURIComponent(id));
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.data) return null;
    return JSON.parse(j.data);
  } catch (_) { return null; }
}

// ---------- App state ----------

const state = {
  caseId: null,
  city: null,
  route: [],     // array of corner ids in visit order
  startedAt: 0,
  timerInt: null,
  finished: false,
  pendingStop: false   // true while overlay is showing
};

// ---------- DOM refs ----------

const $ = (id) => document.getElementById(id);
const screens = {
  intro: () => $('intro'),
  walk: () => $('walk'),
  report: () => $('report')
};
function show(name) {
  ['intro', 'walk', 'report'].forEach((n) => {
    screens[n]().classList.toggle('hidden', n !== name);
  });
}

// ---------- Walk screen ----------

function startCase(caseId) {
  state.caseId = caseId;
  state.city = buildCity(caseId);
  state.route = [];
  state.finished = false;
  state.pendingStop = false;
  state.startedAt = Date.now();

  $('case-id').textContent = caseId;
  $('overlay-det').textContent = state.city.detective;
  updateProgressHud();
  show('walk');
  redrawWalkMap();
  startTimer();
}

function startTimer() {
  clearInterval(state.timerInt);
  state.timerInt = setInterval(tickTimer, 250);
  tickTimer();
}
function tickTimer() {
  if (state.finished) { clearInterval(state.timerInt); return; }
  if (state.pendingStop) return; // pause clock during dictation
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  const remaining = Math.max(0, WALK_SECONDS - elapsed);
  const t = $('hud-timer');
  t.textContent = String(remaining);
  t.classList.toggle('warn', remaining <= 15);
  if (remaining <= 0) finishWalk();
}

function updateProgressHud() {
  $('hud-progress').textContent = 'STOP ' + state.route.length + ' / ' + TOTAL_STOPS;
}

function redrawWalkMap() {
  const ctx = $('map').getContext('2d');
  drawMap(ctx, state.city, state.route, { showVan: true });
}

function onMapClick(ev) {
  if (state.finished || state.pendingStop) return;
  const canvas = $('map');
  const rect = canvas.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (ev.clientY - rect.top) * (canvas.height / rect.height);
  // pick nearest unvisited corner within 26px
  let best = null, bestD = 26 * 26;
  for (const c of state.city.corners) {
    if (state.route.indexOf(c.id) !== -1) continue;
    const dx = c.x - sx, dy = c.y - sy;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best) commitStop(best);
}

function commitStop(corner) {
  state.route.push(corner.id);
  state.pendingStop = true;
  updateProgressHud();
  redrawWalkMap();

  // populate overlay
  const stopIdx = state.route.length - 1;
  const prevCorner = stopIdx > 0 ? state.city.corners[state.route[stopIdx - 1]] : null;
  const line = detectiveLine(corner, prevCorner, stopIdx, TOTAL_STOPS, state.caseId);
  $('overlay-num').textContent = String(stopIdx + 1);
  $('overlay-loc').textContent = corner.type.label.toUpperCase() + ' / ' + corner.streets;
  $('overlay-line').textContent = line;
  $('map-overlay').classList.remove('hidden');
}

function dismissOverlay() {
  $('map-overlay').classList.add('hidden');
  state.pendingStop = false;
  // shift the timer baseline so the dictation pause doesn't cost the user time
  // (we approximate by assuming overlay is brief; for fairness we don't actually pause Date.now,
  // but tickTimer skips while pendingStop, so we need to advance startedAt by the pause length.)
  // Track pause duration via _overlayShownAt; if missing, no harm.
  if (state._overlayShownAt) {
    state.startedAt += (Date.now() - state._overlayShownAt);
    state._overlayShownAt = 0;
  }
  if (state.route.length >= TOTAL_STOPS) finishWalk();
}

// ---------- Finish ----------

function finishWalk() {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerInt);

  const corners = state.city.corners;
  // If they didn't reach 8 stops, auto-fill remaining nearest unvisited corners (deterministic from caseId)
  while (state.route.length < TOTAL_STOPS) {
    const last = corners[state.route[state.route.length - 1] || 0];
    const remaining = corners
      .filter((c) => state.route.indexOf(c.id) === -1)
      .map((c) => ({ c, d: (c.x - last.x) ** 2 + (c.y - last.y) ** 2 }))
      .sort((a, b) => a.d - b.d);
    if (!remaining.length) break;
    state.route.push(remaining[0].c.id);
  }

  buildAndShowReport(/* fromShare */ false);
}

async function buildAndShowReport(fromShare) {
  const corners = state.city.corners;
  const archetype = pickArchetype(state.route, corners, state.caseId);

  // Notes — one per stop (we already showed each as overlay; regenerate the same lines deterministically)
  const notes = state.route.map((id, i) => {
    const c = corners[id];
    const prev = i > 0 ? corners[state.route[i - 1]] : null;
    return {
      stop: i + 1,
      line: detectiveLine(c, prev, i, TOTAL_STOPS, state.caseId),
      loc: c.type.label + ' / ' + c.streets
    };
  });

  // Render report scaffold
  $('report-verdict').textContent = archetype.name;
  $('report-flourish').textContent = archetype.flourish;
  $('report-det').textContent = state.city.detective;
  $('report-case').textContent = state.caseId;
  $('report-date').textContent = 'FILED ' + formatDate(new Date());

  const exhibitCap = 'Route reconstructed from ' + state.route.length + ' confirmed stops over ' + WALK_SECONDS + 's of passive monitoring. Numbered in order of visitation.';
  $('exhibit-cap').textContent = exhibitCap;

  const ol = $('notes-list');
  ol.innerHTML = '';
  notes.forEach((n) => {
    const li = document.createElement('li');
    const meta = document.createElement('div');
    meta.className = 'note-loc';
    meta.textContent = n.loc.toUpperCase();
    const body = document.createElement('div');
    body.textContent = n.line;
    li.appendChild(meta);
    li.appendChild(body);
    ol.appendChild(li);
  });

  // Draw report map (static, no van overlay, full route)
  const reportCtx = $('report-map').getContext('2d');
  drawMap(reportCtx, state.city, state.route, { showVan: false, staticReport: true });

  show('report');

  // AI flourish — only when user just finished, not when re-hydrated from share.
  if (!fromShare) {
    // brief loading micro-state
    $('report-flourish').textContent = 'cross-referencing with prior subjects...';
    const flourish = await aiFlourish(archetype, state.route, corners);
    $('report-flourish').textContent = flourish;
    // Persist a short link with the flourish baked in so recipients see the same line.
    persistShareLink({
      v: 1,
      cid: state.caseId,
      route: state.route,
      verdict: archetype.name,
      flourish: flourish
    });
  }
}

function persistShareLink(payload) {
  // Save to case-store; if it works, replace URL with ?c=<id>. Otherwise leave URL alone.
  saveCase(payload).then((id) => {
    if (id) {
      const url = new URL(location.href);
      url.search = '?c=' + id;
      url.hash = '';
      history.replaceState(null, '', url.toString());
    }
  });
}

function formatDate(d) {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const y = d.getUTCFullYear();
  return `${m}/${day}/${y}`;
}

// ---------- Share-hydration ----------

async function hydrateIfShared() {
  const params = new URLSearchParams(location.search);
  const id = params.get('c');
  if (!id) return false;
  const payload = await loadCase(id);
  if (!payload || !payload.cid || !payload.route) return false;

  // Rebuild city from caseId, restore route, jump straight to report.
  state.caseId = payload.cid;
  state.city = buildCity(payload.cid);
  state.route = payload.route.slice();
  state.finished = true;

  // Render report directly with shared verdict + flourish
  $('report-verdict').textContent = payload.verdict || pickArchetype(state.route, state.city.corners, state.caseId).name;
  $('report-flourish').textContent = payload.flourish || pickArchetype(state.route, state.city.corners, state.caseId).flourish;
  $('report-det').textContent = state.city.detective;
  $('report-case').textContent = state.caseId;
  $('report-date').textContent = 'FILED ' + formatDate(new Date());

  const corners = state.city.corners;
  const ol = $('notes-list');
  ol.innerHTML = '';
  state.route.forEach((cid, i) => {
    const c = corners[cid];
    const prev = i > 0 ? corners[state.route[i - 1]] : null;
    const line = detectiveLine(c, prev, i, TOTAL_STOPS, state.caseId);
    const li = document.createElement('li');
    const meta = document.createElement('div');
    meta.className = 'note-loc';
    meta.textContent = (c.type.label + ' / ' + c.streets).toUpperCase();
    const body = document.createElement('div');
    body.textContent = line;
    li.appendChild(meta);
    li.appendChild(body);
    ol.appendChild(li);
  });
  $('exhibit-cap').textContent = 'Route reconstructed from ' + state.route.length + ' confirmed stops. Now click through your own.';

  // Render the static report map
  const reportCtx = $('report-map').getContext('2d');
  drawMap(reportCtx, state.city, state.route, { showVan: false, staticReport: true });

  // Restart button on a shared report should explicitly start a NEW case
  show('report');
  return true;
}

// ---------- Share helper ----------

function share() {
  const verdict = $('report-verdict').textContent || 'a Surveillance Report';
  const text = 'Surveillance report says I’m "' + verdict + '." Click through your own walk.';
  if (navigator.share) {
    navigator.share({ title: document.title, text: text, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'))
      .catch(() => alert(location.href));
  }
}
window.share = share;

// ---------- Boot ----------

window.addEventListener('DOMContentLoaded', async () => {
  // Map clicks
  $('map').addEventListener('click', onMapClick);
  $('overlay-continue').addEventListener('click', dismissOverlay);
  $('start-btn').addEventListener('click', () => startCase(newCaseId()));
  $('restart-btn').addEventListener('click', () => {
    // Strip share params and start a fresh case
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    history.replaceState(null, '', url.toString());
    startCase(newCaseId());
  });

  // Track when the overlay opens so we can refund the dictation pause.
  const overlayObserver = new MutationObserver(() => {
    const visible = !$('map-overlay').classList.contains('hidden');
    if (visible) state._overlayShownAt = Date.now();
  });
  overlayObserver.observe($('map-overlay'), { attributes: true, attributeFilter: ['class'] });

  const wasShared = await hydrateIfShared();
  if (!wasShared) show('intro');
});
