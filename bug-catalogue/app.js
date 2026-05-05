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
// Each species: { id, name, binomial, kind, rarity, baseSpeed, fact }
// Real insects (and a few near-relatives), real Latin binomials, real
// one-sentence biological facts shown on the specimen plate at the end.
//
// kind = crawler | flyer | drifter | hopper | zigzag — controls trajectory.
// rarity = common | uncommon | rare | legendary — controls spawn weight + visual treatment.
// Visuals are committed PNGs at bugs/{id}.png — Victorian natural-history
// engravings, transparent backgrounds, oriented with the insect facing up.
// (Image filenames are historical; the engravings read as period-style
// insect plates and pair with the real species named above them.)
const SPECIES = [
  { id: 'clockroach',
    name: 'American Cockroach',           binomial: 'Periplaneta americana',
    kind: 'crawler', rarity: 'common',    baseSpeed: 1.0,
    fact: 'Native to Africa despite the name, it can run up to about three miles per hour and survive without its head for roughly a week, breathing through small holes along each body segment.' },
  { id: 'stainmoth',
    name: 'Atlas Moth',                   binomial: 'Attacus atlas',
    kind: 'flyer',   rarity: 'legendary', baseSpeed: 1.6,
    fact: 'Among the largest moths in the world by wing surface area, it has no functional mouth and lives only one to two weeks as an adult on energy stored entirely from its caterpillar stage.' },
  { id: 'cigwalker',
    name: 'Western Harvester Ant',        binomial: 'Pogonomyrmex occidentalis',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.7,
    fact: 'Workers gather seeds for the colony and clear vegetation in a circular disc around the nest entrance, sometimes a meter or more across.' },
  { id: 'velvetbumble',
    name: 'Common Eastern Bumblebee',     binomial: 'Bombus impatiens',
    kind: 'flyer',   rarity: 'common',    baseSpeed: 1.2,
    fact: 'Unlike honey bees, bumblebees can warm their flight muscles by shivering, which lets them forage in cooler weather where most other bees cannot fly.' },
  { id: 'paperwasp',
    name: 'European Paper Wasp',          binomial: 'Polistes dominula',
    kind: 'flyer',   rarity: 'uncommon',  baseSpeed: 1.8,
    fact: 'It builds open-comb nests from chewed wood pulp; introduced to North America in the 1980s, it now competes with native paper wasps across most of the continent.' },
  { id: 'glassbeetle',
    name: 'Six-Spotted Tiger Beetle',     binomial: 'Cicindela sexguttata',
    kind: 'crawler', rarity: 'rare',      baseSpeed: 0.9,
    fact: 'One of the fastest insects on Earth relative to its size — it runs so quickly that its eyes briefly lose the ability to gather enough light, so it must stop to relocate prey.' },
  { id: 'inkmite',
    name: 'Common Springtail',            binomial: 'Folsomia candida',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.6,
    fact: 'Not technically an insect, it leaps using a spring-loaded organ called a furcula tucked beneath its abdomen, propelling itself many times its body length to escape predators.' },
  { id: 'lampfly',
    name: 'Green Lacewing',               binomial: 'Chrysoperla carnea',
    kind: 'flyer',   rarity: 'rare',      baseSpeed: 2.0,
    fact: 'Adults sip pollen and nectar, but the larvae are voracious aphid predators — gardeners call them "aphid lions" and breed them to protect crops.' },
  { id: 'minerbug',
    name: 'Violet Ground Beetle',         binomial: 'Carabus violaceus',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.85,
    fact: 'A nocturnal hunter that preys on slugs, snails, and caterpillars; its iridescent purple sheen comes from microscopic ridges in its shell rather than pigment.' },
  { id: 'ribbonworm',
    name: 'Monarch Caterpillar',          binomial: 'Danaus plexippus',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.5,
    fact: 'It feeds exclusively on milkweed and stores cardenolide toxins from the plant, which makes both the caterpillar and the resulting butterfly unpalatable to most predators.' },
  { id: 'jewelhopper',
    name: 'Differential Grasshopper',     binomial: 'Melanoplus differentialis',
    kind: 'hopper',  rarity: 'uncommon',  baseSpeed: 1.1,
    fact: 'It can leap roughly twenty times its body length using a catch-and-release mechanism in its hind legs that stores elastic energy and snaps it free, much like a crossbow.' },
  { id: 'mournfly',
    name: 'Blue Bottle Fly',              binomial: 'Calliphora vomitoria',
    kind: 'zigzag',  rarity: 'uncommon',  baseSpeed: 2.2,
    fact: 'Forensic entomologists rely on the predictable growth rate of its larvae to estimate time of death at crime scenes, sometimes accurate within hours.' },
  { id: 'silkdrifter',
    name: 'Common Mayfly',                binomial: 'Ephemera vulgata',
    kind: 'drifter', rarity: 'common',    baseSpeed: 0.4,
    fact: 'Adults live only a single day — sometimes only hours — long enough to mate and lay eggs; the order name "Ephemeroptera" literally means "short-lived wings".' },
  { id: 'amberbee',
    name: 'Western Honey Bee',            binomial: 'Apis mellifera',
    kind: 'flyer',   rarity: 'uncommon',  baseSpeed: 1.5,
    fact: 'Returning foragers communicate the direction and distance of food sources through a "waggle dance" performed in the dark of the hive, decoded by other workers through touch and vibration.' },
  { id: 'ironcricket',
    name: 'Field Cricket',                binomial: 'Gryllus pennsylvanicus',
    kind: 'hopper',  rarity: 'uncommon',  baseSpeed: 0.95,
    fact: 'Males chirp by rubbing a scraper on one wing against a file of teeth on the other; chirp rate rises with temperature, accurate enough to estimate it within a few degrees Fahrenheit.' },
  { id: 'paperghost',
    name: 'White Plume Moth',             binomial: 'Pterophorus pentadactyla',
    kind: 'flyer',   rarity: 'uncommon',  baseSpeed: 1.3,
    fact: 'At rest it folds its feather-like wings into a slim T-shape, mimicking a dried twig or grass blade so closely that it disappears against pale stems in daylight.' },
  { id: 'rustbeetle',
    name: 'Eastern Eyed Click Beetle',    binomial: 'Alaus oculatus',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.8,
    fact: 'The two large false eyespots on its back deter predators; if knocked onto its back, it snaps a hinge between body segments and launches itself into the air with an audible click.' },
  { id: 'silvermidge',
    name: 'Common House Mosquito',        binomial: 'Culex pipiens',
    kind: 'zigzag',  rarity: 'common',    baseSpeed: 2.4,
    fact: 'Only females bite — they need a blood meal to develop eggs — and they locate hosts by sensing the carbon dioxide in exhaled breath from up to fifty meters away.' },
  { id: 'velvetdarner',
    name: 'Common Green Darner',          binomial: 'Anax junius',
    kind: 'flyer',   rarity: 'rare',      baseSpeed: 1.9,
    fact: 'One of the few migrating dragonflies in North America, it travels over a thousand miles between Canada and the southern U.S. across multiple generations each year.' },
  { id: 'bookworm',
    name: 'Common Silverfish',            binomial: 'Lepisma saccharinum',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.55,
    fact: 'A near-living-fossil — its body plan has barely changed in roughly 400 million years, predating the dinosaurs by more than 150 million.' },
  { id: 'opalmoth',
    name: 'Luna Moth',                    binomial: 'Actias luna',
    kind: 'flyer',   rarity: 'legendary', baseSpeed: 1.4,
    fact: 'Adults have no functional mouthparts and live only about a week, devoting their entire short adulthood to mating; their long curved tails confuse the echolocation of hunting bats.' },
  { id: 'leafmime',
    name: 'Walking Leaf',                 binomial: 'Phyllium philippinicum',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.7,
    fact: 'Its body mimics a leaf so precisely — including pretend bite marks and veins — that other walking-leaf insects sometimes attempt to eat it by mistake.' },
  { id: 'bronzebug',
    name: 'Rose Chafer',                  binomial: 'Cetonia aurata',
    kind: 'crawler', rarity: 'common',    baseSpeed: 1.0,
    fact: 'Iridescent green adults are common pollinators in summer; the metallic sheen comes from microscopic light-interference structures, not pigment, since true green pigments would absorb the light it reflects.' },
  { id: 'foglace',
    name: 'Tiger Crane Fly',              binomial: 'Nephrotoma ferruginea',
    kind: 'zigzag',  rarity: 'rare',      baseSpeed: 1.7,
    fact: 'Often mistaken for a giant mosquito, it has no functional biting mouthparts and adults live only a few days, frequently dying soon after laying eggs in damp soil.' },
  { id: 'porcelainbee',
    name: 'Red Mason Bee',                binomial: 'Osmia bicornis',
    kind: 'flyer',   rarity: 'rare',      baseSpeed: 1.3,
    fact: 'A solitary bee that builds individual nest cells from mud or chewed leaves; the female lays each egg with its own pollen ball before sealing the cell, then dies before her offspring emerge.' },
  { id: 'spectrebug',
    name: 'Northern Walking Stick',       binomial: 'Diapheromera femorata',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.75,
    fact: 'One of very few insects in North America capable of parthenogenesis — unmated females routinely lay viable eggs that hatch into more females.' },
  { id: 'sootmoth',
    name: 'Eastern Tent Caterpillar',     binomial: 'Malacosoma americanum',
    kind: 'flyer',   rarity: 'common',    baseSpeed: 1.5,
    fact: 'Caterpillars build a silken communal tent in the fork of a host tree (often cherry or apple) and emerge in formation along scent trails to feed, returning together at night.' },
  { id: 'spiralweevil',
    name: 'Boll Weevil',                  binomial: 'Anthonomus grandis',
    kind: 'crawler', rarity: 'common',    baseSpeed: 0.65,
    fact: 'It devastated American cotton crops in the early 1900s; the city of Enterprise, Alabama later erected a public monument to it after the destruction forced farmers to diversify into peanuts and grow rich on them.' },
  { id: 'fernhopper',
    name: 'Greater Anglewing Katydid',    binomial: 'Microcentrum rhombifolium',
    kind: 'hopper',  rarity: 'common',    baseSpeed: 1.05,
    fact: 'Males "sing" in late summer by rubbing their wing edges together, producing a rhythmic high-frequency call that gives the insect its onomatopoeic common name.' },
  { id: 'velvetfly',
    name: 'Tachinid Fly',                 binomial: 'Tachina grossa',
    kind: 'flyer',   rarity: 'common',    baseSpeed: 2.1,
    fact: 'A parasitoid: females lay eggs on or inside other insects, often caterpillars, and the larvae develop inside the still-living host before killing it on emergence.' },
];

// Plate-level curator framing notes — kept deadpan and bureau-flavored.
const CURATOR_HEADERS = [
  "Curator's note: a serviceable afternoon's identification.",
  "Curator's note: today's drift logged, named, and described.",
  "Curator's note: specimens cooperated; the cabinet accepts them.",
  "Curator's note: the field index advances by a few entries.",
  "Curator's note: collected, labeled, and shelved.",
  "Curator's note: a modest but instructive plate.",
  "Curator's note: an improving morning's catalogue.",
  "Curator's note: nothing rare today, but everything correctly placed.",
  "Curator's note: the board accepts what crosses it.",
];

const PLATE_TITLES = [
  'A field plate, properly catalogued.',
  'Today, what crossed the board.',
  "The morning's identifications.",
  'Specimens, in order pinned.',
  'A small but accurate catalogue.',
  'Of this morning’s drift.',
  'The pinned and the named.',
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

// ====================== TIME FORMATTING ======================
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
    card.innerHTML = `
      <div class="specimen-art"><div class="specimen-pin"></div>${speciesImg(species)}</div>
      <p class="specimen-num">Specimen ${String(i + 1).padStart(2, '0')} &middot; pinned ${fmtTime(c.ts)}</p>
      <p class="specimen-common">${escapeText(species.name)}</p>
      <p class="specimen-latin">${escapeText(species.binomial)}</p>
      <p class="specimen-rarity">${RARITY_TIERS[tier].label}</p>
      <p class="specimen-note">${escapeText(species.fact)}</p>
    `;
    grid.appendChild(card);
  });
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
