// Stowaway Manifest — pick a passenger, watch the seeded zeppelin voyage,
// receive an official Customs House manifest. Same passenger × same UTC date = same voyage.

// ---------- Deterministic RNG ----------

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return (((r ^ (r >>> 14)) >>> 0) / 4294967296);
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---------- Date helpers ----------

function utcDateString(d) {
  d = d || new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formattedDate(s) {
  // s = YYYY-MM-DD
  const [y, m, d] = s.split('-').map(Number);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

function depClock() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  let s = Math.max(0, Math.floor((next - now) / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  s %= 3600;
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${ss} UTC`;
}

// ---------- Passenger archetypes (8) ----------

const PASSENGERS = [
  {
    id: 'diplomats-cat',
    name: "The Diplomat's Cat",
    blurb: "Outranks you. Has a sealed pouch.",
    palette: { coat: '#4a3520', accent: '#a8862e', detail: '#211a10' },
    bias: { contraband: 0.35, charm: 0.85, stealth: 0.55, weather: 0.4 },
    cargoFlavor: ['sealed diplomatic pouch', 'one (1) silver fish-fork', 'a small unsigned letter'],
    sprite: 'cat'
  },
  {
    id: 'carpetbagger',
    name: "The Carpetbagger",
    blurb: "Six trunks. None match.",
    palette: { coat: '#5a2a1c', accent: '#c0a35d', detail: '#1c1108' },
    bias: { contraband: 0.7, charm: 0.45, stealth: 0.25, weather: 0.5 },
    cargoFlavor: ['four (4) brass doorknobs', 'someone else\'s wedding portrait', 'a tin labeled MOTHER'],
    sprite: 'carpet'
  },
  {
    id: 'stowaway-monk',
    name: "The Stowaway Monk",
    blurb: "Travels light. Prays louder.",
    palette: { coat: '#3a2c14', accent: '#d8b25a', detail: '#1a1206' },
    bias: { contraband: 0.1, charm: 0.6, stealth: 0.85, weather: 0.7 },
    cargoFlavor: ['one (1) bowl, chipped', 'a hymn to clouds', 'forty days of silence (declared)'],
    sprite: 'monk'
  },
  {
    id: 'calendar-bandit',
    name: "The Calendar Bandit",
    blurb: "Steals Thursdays. Profession unknown.",
    palette: { coat: '#1c2a4a', accent: '#b89545', detail: '#0a0f1c' },
    bias: { contraband: 0.6, charm: 0.55, stealth: 0.75, weather: 0.5 },
    cargoFlavor: ['three (3) loose Thursdays', 'a pocketwatch running backwards', 'a borrowed almanac, 1881'],
    sprite: 'bandit'
  },
  {
    id: 'retired-clown',
    name: "The Retired Clown",
    blurb: "Said retired. Brought the wig.",
    palette: { coat: '#7a1f2f', accent: '#e8d2a0', detail: '#1a0808' },
    bias: { contraband: 0.4, charm: 0.7, stealth: 0.2, weather: 0.5 },
    cargoFlavor: ['one (1) red nose, decommissioned', 'fourteen (14) silk scarves, knotted', 'a small dog labeled NOT A DOG'],
    sprite: 'clown'
  },
  {
    id: 'phantom-bride',
    name: "The Phantom Bride",
    blurb: "Has a ticket for two. Travels alone.",
    palette: { coat: '#d8cdb0', accent: '#9d2a2a', detail: '#3a2210' },
    bias: { contraband: 0.2, charm: 0.65, stealth: 0.8, weather: 0.85 },
    cargoFlavor: ['one (1) pressed lily, brittle', 'an empty seat (occupied)', 'a vow, unredeemed'],
    sprite: 'bride'
  },
  {
    id: 'beekeeper-emeritus',
    name: "The Beekeeper Emeritus",
    blurb: "Smells of smoke and honey.",
    palette: { coat: '#6b4a14', accent: '#f0c54a', detail: '#1f1408' },
    bias: { contraband: 0.5, charm: 0.5, stealth: 0.4, weather: 0.55 },
    cargoFlavor: ['one (1) hive, dormant (allegedly)', 'two (2) jars of \'92 clover', 'a veil, scorched'],
    sprite: 'bee'
  },
  {
    id: 'unlicensed-cartographer',
    name: "The Unlicensed Cartographer",
    blurb: "Maps places that don't exist yet.",
    palette: { coat: '#2a4a3a', accent: '#d4b870', detail: '#0e1a14' },
    bias: { contraband: 0.55, charm: 0.4, stealth: 0.5, weather: 0.65 },
    cargoFlavor: ['nine (9) maps of nowhere', 'a compass that points at lunch', 'a port marked \'HERE BE PAPERWORK\''],
    sprite: 'carto'
  }
];

// ---------- Voyage event templates ----------

// Event kinds (any subset, in order, length 6-9). Selected by passenger bias + seed.
const EVENT_KINDS = [
  'departure', 'cloudbank', 'storm', 'customs_check', 'kraken',
  'rival_airship', 'sea_market', 'ghost_signal', 'wind_change',
  'inspection_drone', 'gull_swarm', 'lightning', 'midnight_thaw', 'arrival'
];

const EVENT_LIB = {
  departure: {
    caption: "Mooring lines fall. The bureau clerks wave without looking up.",
    log: "Departure Port — under sail",
    weight: 1.0, only_first: true
  },
  cloudbank: {
    caption: "Three hours into a cloudbank the color of old tea. The kettle weeps.",
    log: "Cloudbank passage — visibility nil",
    weight: 0.8
  },
  storm: {
    caption: "A storm. The barometer faints. {p} steadies the gondola lamp.",
    log: "Squall, NE — gondola pitched 18°",
    weight: 0.9
  },
  customs_check: {
    caption: "A customs cutter pulls alongside. Three inspectors ask after {p}.",
    log: "Mid-route inspection — papers reviewed",
    weight: 1.0
  },
  kraken: {
    caption: "Twelve miles south of nowhere, a tentacle salutes the ship. {p} salutes back.",
    log: "Kraken sighted — formal greeting exchanged",
    weight: 0.7
  },
  rival_airship: {
    caption: "A rival airship, painted an unlicensed maroon, draws even and refuses to make eye contact.",
    log: "Rival airship — pace-matched 41 minutes",
    weight: 0.85
  },
  sea_market: {
    caption: "A floating market: pickled fog, dried rumors, postcards from places that haven't happened yet.",
    log: "Sea market — three (3) items acquired",
    weight: 0.6
  },
  ghost_signal: {
    caption: "Wireless picks up Morse from a vessel sunk in 1899. It says: GIVE OUR REGARDS TO {p}.",
    log: "Ghost signal — relayed regards",
    weight: 0.65
  },
  wind_change: {
    caption: "The wind changes its mind. So does the captain.",
    log: "Heading adjusted — 14° starboard",
    weight: 0.7
  },
  inspection_drone: {
    caption: "An automated brass owl circles the gondola, blinking. {p} feeds it a biscuit.",
    log: "Bureau drone — biscuit accepted",
    weight: 0.55
  },
  gull_swarm: {
    caption: "A swarm of gulls audits the cargo. They find irregularities.",
    log: "Avian audit — 2 minor citations",
    weight: 0.5
  },
  lightning: {
    caption: "Lightning rewrites the manifest in flashes. Most paragraphs survive.",
    log: "Electrical event — 1 paragraph lost",
    weight: 0.55
  },
  midnight_thaw: {
    caption: "Midnight. The thaw. Everyone tells one (1) true thing. {p} tells two.",
    log: "Midnight thaw — confessions logged",
    weight: 0.55
  },
  arrival: {
    caption: "Port lanterns ahead. The customs house already has its rubber stamps warmed.",
    log: "Approach — port lanterns sighted",
    weight: 1.0, only_last: true
  }
};

// ---------- Verdict pool ----------

const VERDICTS = {
  release: [
    "RELEASED PENDING VIBES",
    "PASSED — UNREMARKABLE",
    "WAVED THROUGH (CHARMED)",
    "ADMITTED PROVISIONALLY",
    "CLEARED — SEE ME LATER",
    "FREE TO GO, SOMEHOW"
  ],
  hold: [
    "DETAINED FOR PAPERWORK",
    "FILED UNDER 'COME BACK TUESDAY'",
    "QUARANTINED, ALPHABETICALLY",
    "REQUIRES SECOND BISCUIT",
    "PENDING THE INK SUPPLY",
    "WITHHELD FOR ADDITIONAL OPINIONS"
  ],
  refuse: [
    "SPIRITUALLY INADMISSIBLE CARGO",
    "REFUSED — TOO PERSUASIVE",
    "DENIED ON PRINCIPLE (HIS)",
    "EJECTED, POLITELY",
    "INADMISSIBLE — KARMIC TONNAGE",
    "RETURNED TO ORIGIN, UNOPENED"
  ],
  weird: [
    "CONFISCATED INTO A SAFE NO ONE OWNS",
    "RECLASSIFIED AS WEATHER",
    "ESCORTED TO A DIFFERENT TUESDAY",
    "MARRIED TO A LARGER FORM",
    "RELEASED ON THE CONDITION OF A SHRUG",
    "FILED UNDER MISCELLANEOUS, FONDLY"
  ]
};

const FATES_PORT = [
  { tone: 'release', text: 'ADMITTED' },
  { tone: 'release', text: 'CLEARED' },
  { tone: 'hold', text: 'DETAINED' },
  { tone: 'refuse', text: 'TURNED BACK' },
  { tone: 'weird', text: 'RELEASED ON A TECHNICALITY' },
  { tone: 'release', text: 'STAMPED & FORGOTTEN' },
  { tone: 'refuse', text: 'CONFISCATED IN FULL' },
  { tone: 'weird', text: 'REASSIGNED TO TUESDAY' }
];

// ---------- Inspector name parts ----------

const FIRST_NAMES = [
  'Inspector', 'Sub-Inspector', 'Junior Inspector', 'Senior Clerk',
  'Deputy', 'Examiner', 'Wardress', 'Auditor', 'Petty Inspector', 'Clerk-Errant'
];
const SURNAMES = [
  'Mott', 'Halberd', 'Quinn-Beasley', 'Voss', 'Pemberton', 'Crew', 'Halloran',
  'Strake', 'Vance', 'Rourke', 'Drabble', 'Finch', 'Lemberg', 'Ousby',
  'Pell', 'Colvin', 'Thursfield', 'Wadham', 'Sturt', 'Briar', 'Ainsley'
];

const PORTS_OF_ARRIVAL = [
  'PORT BARROW',
  'NEW HASSELT',
  'PORT FENWICK-BY-DAWN',
  'CALAVRE',
  'OLD AERODROME',
  'GLAS HARBOR',
  'ST. ELMO',
  'EMBARCADERO MENOR',
  'COURT-OF-RUST',
  'NORTHFIELD MOORING'
];

const ZEPPELIN_NAMES = [
  'AURELIA',
  'PRINCESS DOROTHEA',
  'NEPENTHE',
  'AUGUR',
  'INSOMNIAC',
  'MARGINALIA',
  'BIBLIOMANE',
  'WHITESTOAT',
  'PROCRASTINATOR',
  'AMBASSADOR LIPP'
];

// ---------- Build voyage from seed + passenger ----------

function buildVoyage(passenger, dateStr) {
  const seed = hash32(passenger.id + '|' + dateStr);
  const rng = mulberry32(seed);

  // Pick 7 events: departure + 5 middle + arrival
  const middle = EVENT_KINDS.filter(k => !EVENT_LIB[k].only_first && !EVENT_LIB[k].only_last);
  // Bias by passenger: contraband-heavy → more customs/drone; stealth → more ghost/cloud; charm → market/inspection
  const biasWeights = {};
  for (const k of middle) {
    let w = EVENT_LIB[k].weight;
    if (['customs_check', 'inspection_drone', 'gull_swarm'].includes(k)) w *= (0.5 + passenger.bias.contraband);
    if (['ghost_signal', 'cloudbank', 'midnight_thaw'].includes(k)) w *= (0.5 + passenger.bias.stealth);
    if (['sea_market', 'rival_airship'].includes(k)) w *= (0.5 + passenger.bias.charm);
    if (['storm', 'lightning', 'wind_change', 'kraken'].includes(k)) w *= (0.5 + passenger.bias.weather);
    biasWeights[k] = w;
  }

  const chosen = [];
  const pool = middle.slice();
  for (let i = 0; i < 5; i++) {
    let total = 0;
    for (const k of pool) total += biasWeights[k];
    let r = rng() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= biasWeights[pool[j]];
      if (r <= 0) { idx = j; break; }
    }
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }

  const sequence = ['departure', ...chosen, 'arrival'];

  // Build events at evenly spaced timestamps across 60s
  const events = sequence.map((kind, i) => {
    const t = i === 0 ? 0 : i === sequence.length - 1 ? 60 : Math.round((i / (sequence.length - 1)) * 60);
    return {
      kind,
      t,
      caption: EVENT_LIB[kind].caption.replace(/\{p\}/g, passenger.name),
      log: EVENT_LIB[kind].log
    };
  });

  // Determine fate: weighted by contraband (more = worse), charm (more = better), stealth (more = better)
  const luck = (passenger.bias.charm + passenger.bias.stealth) / 2 - passenger.bias.contraband;
  // Map luck (-1..1) + rng nudge to fate index
  const fateRoll = (luck + 1) / 2 + (rng() - 0.5) * 0.5; // 0..1ish
  let fate;
  if (fateRoll > 0.7) fate = pick(rng, FATES_PORT.filter(f => f.tone === 'release'));
  else if (fateRoll > 0.45) fate = pick(rng, FATES_PORT.filter(f => f.tone === 'release' || f.tone === 'weird'));
  else if (fateRoll > 0.25) fate = pick(rng, FATES_PORT.filter(f => f.tone === 'hold' || f.tone === 'weird'));
  else fate = pick(rng, FATES_PORT.filter(f => f.tone === 'refuse' || f.tone === 'hold'));

  // Three inspectors
  const inspectors = [];
  const tones = ['release', 'hold', 'refuse', 'weird'];
  const usedSurnames = new Set();
  for (let i = 0; i < 3; i++) {
    let sur;
    do { sur = pick(rng, SURNAMES); } while (usedSurnames.has(sur));
    usedSurnames.add(sur);
    const tone = tones[Math.floor(rng() * tones.length)];
    inspectors.push({
      title: pick(rng, FIRST_NAMES),
      name: sur,
      verdict: pick(rng, VERDICTS[tone]),
      tone
    });
  }

  // Featured cargo audit
  const cargoItem = pick(rng, passenger.cargoFlavor);
  const cargoVerdict = pick(rng, [
    'declared but unconvincingly',
    'undeclared, photogenic',
    'declared in error, twice',
    'declared sincerely',
    'undeclared, smelled of pine',
    'declared in iambic pentameter'
  ]);
  const cargoNote = pick(rng, [
    'Released — stamped, then re-stamped for emphasis.',
    'Held pending the arrival of a smaller form.',
    'Reclassified as weather; no further action.',
    'Confiscated; later returned with apology and a fig.',
    'Forwarded to the Bureau of Things That Happen Anyway.',
    'Filed under MISC / SEE LATER.'
  ]);

  const port = pick(rng, PORTS_OF_ARRIVAL);
  const zeppelin = pick(rng, ZEPPELIN_NAMES);
  const voyageNo = String(seed % 9999).padStart(4, '0');

  return { events, fate, inspectors, cargoItem, cargoVerdict, cargoNote, port, zeppelin, voyageNo, seed };
}

// ---------- Pixel-art passenger sprites (16x16) ----------
// drawn into a small canvas via colored squares.
// Each sprite returns a function that paints it given (ctx, scale, palette).

const SPRITES = {
  cat: [
    "................",
    "................",
    "...##......##...",
    "..####....####..",
    "..######.######.",
    ".###############",
    ".##.##.....##.##",
    ".###############",
    "..#############.",
    "..##.#......#.##",
    "..##.########.##",
    "...##########...",
    "....#......#....",
    "....##....##....",
    "................",
    "................"
  ],
  carpet: [
    "................",
    "....######......",
    "...##....##.....",
    "..##.@..@.##....",
    "..##......##....",
    "..##..--..##....",
    "...########.....",
    "....#@##@#......",
    "...##....##.....",
    "..############..",
    ".##..######..##.",
    ".##.########.##.",
    ".##.########.##.",
    ".##..######..##.",
    "..############..",
    "................"
  ],
  monk: [
    "................",
    ".....######.....",
    "....########....",
    "....##.@@.##....",
    "....##.--.##....",
    "....########....",
    "...##########...",
    "..############..",
    "..##########.##.",
    "...##########...",
    "....########....",
    "....##....##....",
    "....##....##....",
    "....##....##....",
    "...####..####...",
    "................"
  ],
  bandit: [
    "................",
    "...##########...",
    "..#####@@#####..",
    "..#####@@#####..",
    "...##########...",
    "....########....",
    "....@@----@@....",
    "....##.@@.##....",
    "....########....",
    "...####..####...",
    "..####....####..",
    ".####......####.",
    "..##........##..",
    "..##........##..",
    ".####......####.",
    "................"
  ],
  clown: [
    "................",
    "..@#..####..#@..",
    "..@@##....##@@..",
    "....##.@@.##....",
    "....##.@@.##....",
    "....##....##....",
    "....##.@@.##....",
    "....########....",
    "...####@@####...",
    "..############..",
    ".####@####@####.",
    "..####....####..",
    "...####..####...",
    "....##....##....",
    "...####..####...",
    "................"
  ],
  bride: [
    "................",
    "....########....",
    "...##########...",
    "..############..",
    "...##########...",
    "....##.@@.##....",
    "....##.--.##....",
    "....########....",
    "...##########...",
    "..############..",
    ".##############.",
    "##.##########.##",
    "..############..",
    "...##########...",
    "....##....##....",
    "................"
  ],
  bee: [
    "................",
    "....#@@@@@@#....",
    "...#@@####@@#...",
    "..#@@@.@@.@@@#..",
    "..#@@##--##@@#..",
    "...#@@####@@#...",
    "....#@@@@@@#....",
    "....##----##....",
    "...####--####...",
    "..####------####",
    "..##----##----##",
    "..####------####",
    "...##########...",
    "....##....##....",
    "....##....##....",
    "................"
  ],
  carto: [
    "................",
    "................",
    "....########....",
    "...##########...",
    "..####@##@####..",
    "..####----####..",
    "..####.@@.####..",
    "...##########...",
    "....########....",
    "..############..",
    ".####.####.####.",
    ".####.####.####.",
    "..##########.##.",
    "..##......####..",
    "..##......##....",
    "................"
  ]
};

function drawSprite(ctx, key, palette, scale) {
  const grid = SPRITES[key];
  if (!grid) return;
  ctx.fillStyle = '#ddc995'; // bg already set on canvas
  // colors by char
  const colorMap = {
    '#': palette.coat,
    '@': palette.accent,
    '-': palette.detail,
    '.': null
  };
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      const col = colorMap[c];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
}

// ---------- DOM rendering ----------

let chosenPassenger = null;
let chosenDate = null;
let voyage = null;
let voyageStart = 0;
let voyageRAF = null;

function renderPassengerGrid() {
  const grid = document.getElementById('passenger-grid');
  grid.innerHTML = '';
  for (const p of PASSENGERS) {
    const card = document.createElement('button');
    card.className = 'passenger';
    card.type = 'button';
    card.setAttribute('data-id', p.id);
    card.innerHTML = `
      <div class="ptag">№${(hash32(p.id) % 99 + 1).toString().padStart(2, '0')}</div>
      <canvas width="64" height="64"></canvas>
      <div class="pname">${p.name}</div>
      <div class="pdesc">${p.blurb}</div>
    `;
    grid.appendChild(card);
    const c = card.querySelector('canvas');
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ddc995';
    ctx.fillRect(0, 0, 64, 64);
    drawSprite(ctx, p.sprite, p.palette, 4);
    card.addEventListener('click', () => choosePassenger(p));
  }
}

function setHeaderInfo() {
  const date = utcDateString();
  document.getElementById('utc-date').textContent = formattedDate(date);
  document.getElementById('seal-id').textContent = '№' + ((hash32(date) % 9000) + 1000);
  const tick = () => {
    const el = document.getElementById('dep-clock');
    if (el) el.textContent = depClock();
  };
  tick();
  setInterval(tick, 1000);
}

function choosePassenger(p) {
  chosenPassenger = p;
  chosenDate = utcDateString();
  voyage = buildVoyage(p, chosenDate);
  // update fragment
  history.replaceState(null, '', '#' + encodeURIComponent(p.id) + '-' + chosenDate);
  startVoyage();
}

// ---------- Voyage canvas animation ----------

function startVoyage() {
  document.getElementById('pick').hidden = true;
  document.getElementById('voyage').hidden = false;

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  voyageStart = performance.now();
  const eventEls = {};
  const eventsContainer = document.getElementById('voyage-events');
  eventsContainer.innerHTML = '';
  for (const ev of voyage.events) {
    const d = document.createElement('div');
    d.textContent = `T+${String(ev.t).padStart(2, '0')}s · ${ev.log}`;
    eventsContainer.appendChild(d);
    eventEls[ev.t] = { el: d, ev };
  }

  const captionEl = document.getElementById('voyage-caption');
  const clockEl = document.getElementById('voyage-clock');
  const W = canvas.width, H = canvas.height;

  // Pre-render starfield (deterministic)
  const starRng = mulberry32(voyage.seed ^ 0xA5A5);
  const stars = [];
  for (let i = 0; i < 30; i++) stars.push({ x: starRng() * W, y: starRng() * H * 0.6, b: starRng() });

  // Cloud sprites
  const cloudRng = mulberry32(voyage.seed ^ 0xC10D);
  const clouds = [];
  for (let i = 0; i < 6; i++) clouds.push({ x: cloudRng() * W, y: 30 + cloudRng() * 80, w: 30 + cloudRng() * 40, s: 0.2 + cloudRng() * 0.3 });

  function frame(now) {
    const elapsed = (now - voyageStart) / 1000; // seconds
    const t = Math.min(60, elapsed);
    const tNorm = t / 60;
    clockEl.textContent = String(Math.floor(t)).padStart(2, '0') + ' / 60';

    // determine current event
    const currentEvent = voyage.events.slice().reverse().find(e => t >= e.t) || voyage.events[0];
    captionEl.textContent = currentEvent.caption;

    // mark events as shown
    for (const ev of voyage.events) {
      if (t >= ev.t) eventEls[ev.t].el.classList.add('show');
    }

    // ---- Background ----
    // Sky gradient changes through voyage: dawn → noon → dusk → night → port-glow
    const phase = tNorm; // 0..1
    let sky1, sky2;
    if (phase < 0.25) { sky1 = '#3a4a6e'; sky2 = '#9a7440'; } // dawn
    else if (phase < 0.55) { sky1 = '#4a78b5'; sky2 = '#c8d6e0'; } // day
    else if (phase < 0.8) { sky1 = '#3a3050'; sky2 = '#a04a2a'; } // dusk
    else { sky1 = '#1a1830'; sky2 = '#3a2840'; } // night
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sky1);
    grad.addColorStop(1, sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // stars (visible night)
    if (phase > 0.6) {
      const starAlpha = Math.min(1, (phase - 0.6) * 3);
      for (const s of stars) {
        ctx.fillStyle = `rgba(255, 240, 200, ${starAlpha * (0.4 + s.b * 0.6)})`;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 2, 2);
      }
    }

    // sea/land at bottom
    ctx.fillStyle = '#1a2b40';
    ctx.fillRect(0, H - 36, W, 36);
    // wave ripples
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 8; i++) {
      const wx = ((i * 50 + Math.floor(t * 8)) % (W + 50)) - 25;
      ctx.fillRect(wx, H - 28 + (i % 2) * 4, 22, 2);
    }

    // clouds drift
    ctx.fillStyle = 'rgba(220, 200, 160, 0.55)';
    for (const c of clouds) {
      const cx = ((c.x - t * 12 * c.s) % (W + 80) + W + 80) % (W + 80) - 40;
      ctx.fillRect(cx, c.y, c.w, 8);
      ctx.fillRect(cx + 6, c.y - 4, c.w - 12, 4);
      ctx.fillRect(cx + 4, c.y + 8, c.w - 8, 4);
    }

    // ---- Event effects ----
    drawEventLayer(ctx, currentEvent, t, W, H, voyage);

    // ---- Zeppelin ----
    // Zeppelin path: drifts left → right across canvas, with vertical bobbing
    const zx = 30 + tNorm * (W - 90);
    const zy = 70 + Math.sin(t * 0.8) * 8;
    drawZeppelin(ctx, zx, zy, voyage.seed);

    if (t < 60) voyageRAF = requestAnimationFrame(frame);
    else { setTimeout(showManifest, 600); }
  }

  voyageRAF = requestAnimationFrame(frame);
}

function drawZeppelin(ctx, x, y, seed) {
  // Body
  ctx.fillStyle = '#d8c7a0';
  // ellipse approximation in pixels
  ctx.fillRect(x, y, 60, 16);
  ctx.fillRect(x - 4, y + 3, 4, 10);
  ctx.fillRect(x + 60, y + 3, 4, 10);
  ctx.fillRect(x + 4, y - 2, 52, 2);
  ctx.fillRect(x + 4, y + 16, 52, 2);
  // Stripe
  ctx.fillStyle = '#8a1c1c';
  ctx.fillRect(x + 6, y + 7, 48, 2);
  // Gondola
  ctx.fillStyle = '#3a2a14';
  ctx.fillRect(x + 22, y + 18, 16, 6);
  ctx.fillRect(x + 24, y + 24, 12, 2);
  // Window
  ctx.fillStyle = '#f0c54a';
  ctx.fillRect(x + 26, y + 19, 2, 2);
  ctx.fillRect(x + 30, y + 19, 2, 2);
  ctx.fillRect(x + 34, y + 19, 2, 2);
  // Tail fin
  ctx.fillStyle = '#b89545';
  ctx.fillRect(x - 2, y + 1, 2, 14);
}

function drawEventLayer(ctx, ev, t, W, H, voyage) {
  const k = ev.kind;
  const localT = t - ev.t;
  switch (k) {
    case 'storm':
    case 'lightning': {
      // Rain
      ctx.fillStyle = 'rgba(180, 200, 220, 0.55)';
      const rRng = mulberry32((voyage.seed ^ 0x44 ^ ev.t) >>> 0);
      for (let i = 0; i < 60; i++) {
        const rx = (rRng() * W + (t * 30) % W) % W;
        const ry = (rRng() * H + (t * 90) % H) % H;
        ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 4);
      }
      if (k === 'lightning' && Math.floor(t * 2) % 3 === 0) {
        ctx.fillStyle = 'rgba(255,255,240,0.4)';
        ctx.fillRect(0, 0, W, H);
      }
      break;
    }
    case 'kraken': {
      // Tentacle rising from sea
      ctx.fillStyle = '#3a2050';
      const tx = W * 0.7;
      const phase = Math.sin(t * 1.2) * 4;
      for (let i = 0; i < 14; i++) {
        const yy = H - 36 - i * 6;
        const xx = tx + Math.sin(i * 0.5 + t) * (8 + i * 0.5) + phase;
        ctx.fillRect(Math.floor(xx), Math.floor(yy), 8 - Math.floor(i / 3), 6);
      }
      // suckers
      ctx.fillStyle = '#80506a';
      for (let i = 2; i < 14; i += 2) {
        const yy = H - 36 - i * 6;
        const xx = tx + Math.sin(i * 0.5 + t) * (8 + i * 0.5) + phase;
        ctx.fillRect(Math.floor(xx) + 2, Math.floor(yy) + 1, 2, 2);
      }
      break;
    }
    case 'rival_airship': {
      // Rival ship flying parallel, lower or higher
      const rx = W - 60 - ((localT * 12) % 80);
      const ry = 130;
      ctx.fillStyle = '#80303a';
      ctx.fillRect(rx, ry, 40, 10);
      ctx.fillRect(rx + 2, ry - 1, 36, 1);
      ctx.fillRect(rx + 2, ry + 10, 36, 1);
      ctx.fillStyle = '#1a1010';
      ctx.fillRect(rx + 16, ry + 11, 8, 3);
      break;
    }
    case 'customs_check': {
      // Customs cutter with a flag
      const cx = 40 + (localT * 6) % 60;
      const cy = H - 30;
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(cx, cy, 30, 8);
      ctx.fillStyle = '#a04040';
      ctx.fillRect(cx + 14, cy - 14, 1, 14);
      ctx.fillRect(cx + 15, cy - 14, 8, 6);
      break;
    }
    case 'sea_market': {
      // Bobbing market boats
      for (let i = 0; i < 4; i++) {
        const bx = 40 + i * 70 + Math.sin(t * 0.6 + i) * 4;
        const by = H - 28;
        ctx.fillStyle = ['#b85a30', '#508a4a', '#a04a8a', '#c8a040'][i];
        ctx.fillRect(bx, by, 22, 6);
        ctx.fillStyle = '#1a1010';
        ctx.fillRect(bx + 10, by - 6, 1, 6);
      }
      break;
    }
    case 'gull_swarm': {
      // Pixel gulls
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 18; i++) {
        const gx = (i * 21 + t * 30) % (W + 40) - 20;
        const gy = 50 + Math.sin(i + t) * 12;
        ctx.fillRect(Math.floor(gx), Math.floor(gy), 2, 1);
        ctx.fillRect(Math.floor(gx) - 2, Math.floor(gy) + 1, 2, 1);
        ctx.fillRect(Math.floor(gx) + 2, Math.floor(gy) + 1, 2, 1);
      }
      break;
    }
    case 'cloudbank': {
      ctx.fillStyle = 'rgba(220, 210, 180, 0.5)';
      ctx.fillRect(0, 40, W, H - 80);
      break;
    }
    case 'ghost_signal': {
      // Faint ghost ship silhouette
      ctx.fillStyle = 'rgba(180, 220, 220, 0.35)';
      const gx = 30 + (localT * 5) % 80;
      ctx.fillRect(gx, H - 50, 50, 6);
      ctx.fillRect(gx + 22, H - 60, 2, 10);
      ctx.fillRect(gx + 16, H - 56, 16, 2);
      break;
    }
    case 'inspection_drone': {
      // Brass owl drone circling
      const dx = W / 2 + Math.cos(t * 1.3) * 50;
      const dy = 90 + Math.sin(t * 1.3) * 18;
      ctx.fillStyle = '#c0a040';
      ctx.fillRect(Math.floor(dx), Math.floor(dy), 6, 4);
      ctx.fillStyle = '#1a0a08';
      ctx.fillRect(Math.floor(dx) + 1, Math.floor(dy) + 1, 1, 1);
      ctx.fillRect(Math.floor(dx) + 4, Math.floor(dy) + 1, 1, 1);
      // wings
      if (Math.floor(t * 4) % 2 === 0) {
        ctx.fillStyle = '#a07020';
        ctx.fillRect(Math.floor(dx) - 4, Math.floor(dy) + 1, 4, 1);
        ctx.fillRect(Math.floor(dx) + 6, Math.floor(dy) + 1, 4, 1);
      }
      break;
    }
    case 'wind_change': {
      // diagonal wind streaks
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      for (let i = 0; i < 12; i++) {
        const wx = (i * 35 + t * 50) % (W + 30) - 15;
        ctx.fillRect(Math.floor(wx), 60 + i * 8, 14, 1);
      }
      break;
    }
    case 'midnight_thaw': {
      // soft moonglow
      const grd = ctx.createRadialGradient(W * 0.7, 50, 4, W * 0.7, 50, 80);
      grd.addColorStop(0, 'rgba(255,250,220,0.5)');
      grd.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff5d0';
      ctx.fillRect(W * 0.7 - 4, 46, 8, 8);
      break;
    }
    case 'arrival': {
      // Port lights ahead
      ctx.fillStyle = '#f0c54a';
      for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 50, H - 30, 3, 3);
      // pier
      ctx.fillStyle = '#3a2814';
      ctx.fillRect(0, H - 24, W, 4);
      break;
    }
    case 'departure': {
      // Receding port silhouette
      ctx.fillStyle = '#1a1010';
      ctx.fillRect(0, H - 30, 60 - localT * 1.5, 8);
      ctx.fillStyle = '#f0c54a';
      ctx.fillRect(20, H - 26, 2, 2);
      ctx.fillRect(40, H - 28, 2, 2);
      break;
    }
  }
}

// ---------- Manifest doc render ----------

function showManifest() {
  document.getElementById('voyage').hidden = true;
  document.getElementById('manifest').hidden = false;

  const doc = document.getElementById('manifest-doc');
  doc.className = 'manifest-doc';
  const p = chosenPassenger;
  const v = voyage;
  const fateClass = v.fate.tone === 'release' ? 'green' : v.fate.tone === 'hold' ? 'blue' : v.fate.tone === 'refuse' ? '' : 'blue';

  doc.innerHTML = `
    <div class="corner-stamp tr">CUSTOMS · ${v.port}</div>
    <div class="corner-stamp bl">SEAL ${v.voyageNo}</div>

    <div class="m-head">
      <div class="seal">CUSTOMS HOUSE / OFFICE OF AERIAL ARRIVALS</div>
      <h2>DAILY MANIFEST</h2>
      <div class="nbr">VOYAGE №${v.voyageNo} · AIRSHIP ${v.zeppelin}</div>
    </div>

    <div class="m-row"><span class="lbl">Date</span><span class="val">${formattedDate(chosenDate)}</span></div>
    <div class="m-row"><span class="lbl">Port of Arrival</span><span class="val">${v.port}</span></div>
    <div class="m-row"><span class="lbl">Passenger</span><span class="val">${p.name}</span></div>
    <div class="m-row"><span class="lbl">Declared Profession</span><span class="val">${p.blurb}</span></div>

    <div class="m-section">
      <h3>Stamped Fate at Port</h3>
      <div class="fate-stamp ${fateClass}">${v.fate.text}</div>
    </div>

    <div class="m-section">
      <h3>Inspectors' Verdicts</h3>
      <div class="inspectors">
        ${v.inspectors.map(i => `
          <div class="ins">
            <div class="who">${i.title} ${i.name}</div>
            <div class="verdict">${i.verdict}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="m-section">
      <h3>Hand-Drawn Route Map</h3>
      <canvas id="route-map" width="380" height="170"></canvas>
    </div>

    <div class="m-section">
      <h3>Featured Cargo Audit</h3>
      <div class="cargo-audit">
        <div class="cgr">${v.cargoItem}</div>
        <div>declared status: <em>${v.cargoVerdict}</em></div>
        <div class="cgnote">${v.cargoNote}</div>
      </div>
    </div>

    <div class="m-foot">
      <div>
        <div class="signature">${v.inspectors[0].title} ${v.inspectors[0].name}</div>
        <div style="margin-top:2px">CHIEF EXAMINER, ${v.port}</div>
      </div>
      <div style="text-align:right">
        <div>STAMPED ${formattedDate(chosenDate)}</div>
        <div>FILE №${v.voyageNo}-${(v.seed % 99).toString().padStart(2, '0')}</div>
      </div>
    </div>
  `;

  // route map
  drawRouteMap();

  document.getElementById('share').style.display = 'flex';
}

function drawRouteMap() {
  const c = document.getElementById('route-map');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;

  // parchment background
  ctx.fillStyle = 'rgba(245, 230, 200, 0.6)';
  ctx.fillRect(0, 0, W, H);

  // compass rose
  ctx.strokeStyle = '#5a4a30';
  ctx.fillStyle = '#5a4a30';
  ctx.lineWidth = 1;
  const cmpX = W - 36, cmpY = 30;
  ctx.beginPath();
  ctx.moveTo(cmpX, cmpY - 12);
  ctx.lineTo(cmpX + 4, cmpY);
  ctx.lineTo(cmpX, cmpY + 12);
  ctx.lineTo(cmpX - 4, cmpY);
  ctx.closePath();
  ctx.stroke();
  ctx.font = '10px "IM Fell English SC", serif';
  ctx.fillText('N', cmpX - 3, cmpY - 14);

  // departure & arrival points
  const startX = 30, startY = H - 35;
  const endX = W - 40, endY = 50;
  const events = voyage.events;

  // generate path waypoints from event sequence (deterministic by seed)
  const rng = mulberry32(voyage.seed ^ 0xBEEF);
  const points = [{ x: startX, y: startY }];
  for (let i = 1; i < events.length - 1; i++) {
    const tFrac = i / (events.length - 1);
    const baseX = startX + (endX - startX) * tFrac;
    const baseY = startY + (endY - startY) * tFrac;
    const offY = (rng() - 0.5) * 50;
    const offX = (rng() - 0.5) * 30;
    points.push({ x: baseX + offX, y: baseY + offY, ev: events[i] });
  }
  points.push({ x: endX, y: endY });

  // draw dotted path
  ctx.strokeStyle = '#3a2814';
  ctx.fillStyle = '#3a2814';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    // wiggly segment
    const midX = (prev.x + cur.x) / 2 + (rng() - 0.5) * 12;
    const midY = (prev.y + cur.y) / 2 + (rng() - 0.5) * 12;
    ctx.quadraticCurveTo(midX, midY, cur.x, cur.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // event marks
  const iconFor = {
    storm: '~', lightning: '!', kraken: '✦', customs_check: '×',
    rival_airship: '◬', sea_market: '☐', ghost_signal: '?',
    cloudbank: '○', wind_change: '»', inspection_drone: '◉',
    gull_swarm: '·', midnight_thaw: '☾'
  };
  ctx.font = '11px "IM Fell English SC", serif';
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    ctx.fillStyle = '#5a2a14';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2814';
    const sym = iconFor[pt.ev.kind] || '·';
    ctx.fillText(sym, pt.x + 4, pt.y - 4);
  }

  // start marker (anchor)
  ctx.fillStyle = '#3a2814';
  ctx.beginPath();
  ctx.arc(startX, startY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '9px "Special Elite", monospace';
  ctx.fillText('DEPARTURE', startX - 6, startY + 14);

  // end marker (port)
  ctx.fillStyle = '#8a1c1c';
  ctx.fillRect(endX - 3, endY - 3, 6, 6);
  ctx.fillStyle = '#3a2814';
  ctx.fillText(voyage.port, endX - 30, endY - 8);

  // Title at top
  ctx.font = '11px "IM Fell English SC", serif';
  ctx.fillStyle = '#3a2814';
  ctx.fillText('Route as flown — by hand, in haste.', 12, 16);
}

// ---------- Reset / fragment hydration ----------

function reset() {
  history.replaceState(null, '', location.pathname);
  document.getElementById('manifest').hidden = true;
  document.getElementById('voyage').hidden = true;
  document.getElementById('pick').hidden = false;
}

function tryHydrateFromFragment() {
  const frag = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!frag) return false;
  // Format: <passengerId>-YYYY-MM-DD
  const m = frag.match(/^(.+)-(\d{4}-\d{2}-\d{2})$/);
  if (!m) return false;
  const passengerId = m[1];
  const date = m[2];
  const p = PASSENGERS.find(x => x.id === passengerId);
  if (!p) return false;
  chosenPassenger = p;
  chosenDate = date;
  voyage = buildVoyage(p, date);
  // For replay, skip the 60s and go straight to manifest? No — show voyage so it feels reproduced.
  // But honor the share contract: replay the same voyage. Let users skip via tap.
  startVoyage();
  return true;
}

// ---------- Share / download ----------

function share() {
  const url = location.href;
  const title = `Stowaway Manifest — ${chosenPassenger.name} on ${formattedDate(chosenDate)}`;
  const text = `${chosenPassenger.name} → ${voyage.port}: ${voyage.fate.text}.`;
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url)
      .then(() => alert('Link copied — same passenger, same date, same voyage.'))
      .catch(() => alert(url));
  }
}

async function downloadManifest() {
  const node = document.getElementById('manifest-doc');
  if (!node) return;
  // Render the manifest doc to a canvas using html-to-image style approach via SVG foreignObject
  try {
    const rect = node.getBoundingClientRect();
    const w = Math.ceil(rect.width);
    const h = Math.ceil(rect.height);
    const scale = 2;

    // serialize node
    const clone = node.cloneNode(true);
    // inline computed styles for fonts
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Special Elite',monospace;color:#211a10;width:${w}px;">
            ${node.outerHTML}
          </div>
        </foreignObject>
      </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w * scale;
      c.height = h * scale;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f0e6d0';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      // include the route-map raster from the live canvas if available
      const routeMap = document.getElementById('route-map');
      if (routeMap) {
        const r = routeMap.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const rx = (r.left - nodeRect.left) * scale;
        const ry = (r.top - nodeRect.top) * scale;
        ctx.drawImage(routeMap, rx, ry, r.width * scale, r.height * scale);
      }
      URL.revokeObjectURL(url);
      c.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `manifest-${chosenPassenger.id}-${chosenDate}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, 'image/png');
    };
    img.onerror = () => {
      alert('PNG export failed — try the share link instead.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  } catch (e) {
    alert('PNG export failed — try the share link instead.');
  }
}

// expose
window.share = share;
window.downloadManifest = downloadManifest;
window.reset = reset;

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', () => {
  setHeaderInfo();
  renderPassengerGrid();
  if (location.hash) tryHydrateFromFragment();
});
