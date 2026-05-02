/* Bug Catalogue — tap-to-pin entomology display case.
 * Daily seeded species pool drifts across a corkboard. Catch up to 6.
 * Resulting "specimen plate" is the share artifact. */

// ====================== CONFIG ======================
const HUNT_SECONDS = 30;
const MAX_CATCHES = 6;
const POOL_SIZE = 12;          // species in today's drift
const ACTIVE_BUGS_TARGET = 5;  // average bugs alive at once
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';
const APP_SLUG = 'bug-catalogue';

// ====================== SPECIES CATALOG ======================
// Each species: { id, name, kind (crawler|flyer|drifter), palette, draw(svg builder) }
// "kind" controls trajectory style. Palette is a riso-style 2-3 color set.
const SPECIES = [
  { id: 'clockroach',   name: 'Gold-banded clock-roach', kind: 'crawler', baseSpeed: 1.0,
    palette: ['#5a3f24', '#b89149', '#241808'],
    draw: (c1,c2,c3) => bodyOval(c1,c2,c3,{bands:true,antennae:true,wings:false,legs:6}) },
  { id: 'stainmoth',    name: 'Stained-glass moth', kind: 'flyer', baseSpeed: 1.6,
    palette: ['#b3402a', '#2c5d63', '#f1e3c4'],
    draw: (c1,c2,c3) => mothShape(c1,c2,c3,{stained:true}) },
  { id: 'cigwalker',    name: 'Cigarette-bearer', kind: 'crawler', baseSpeed: 0.7,
    palette: ['#3a2418', '#d8c290', '#ff6b35'],
    draw: (c1,c2,c3) => bodyOval(c1,c2,c3,{bands:false,antennae:true,wings:false,legs:6,cig:true}) },
  { id: 'velvetbumble', name: 'Velvet bumble-pretender', kind: 'flyer', baseSpeed: 1.2,
    palette: ['#1a140d', '#e0a82e', '#f1e3c4'],
    draw: (c1,c2,c3) => bumbleShape(c1,c2,c3) },
  { id: 'paperwasp',    name: 'Hand-folded paper wasp', kind: 'flyer', baseSpeed: 1.8,
    palette: ['#d4c08a', '#5a3f24', '#b3402a'],
    draw: (c1,c2,c3) => waspShape(c1,c2,c3) },
  { id: 'glassbeetle',  name: 'Translucent glass beetle', kind: 'crawler', baseSpeed: 0.9,
    palette: ['#cfe7e7', '#2c5d63', '#1f2a23'],
    draw: (c1,c2,c3) => beetleShape(c1,c2,c3,{glass:true}) },
  { id: 'inkmite',      name: 'Ink-spilling mite', kind: 'crawler', baseSpeed: 0.6,
    palette: ['#1f1410', '#2c5d63', '#f1e3c4'],
    draw: (c1,c2,c3) => mitelikeShape(c1,c2,c3) },
  { id: 'lampfly',      name: 'Streetlamp lace-fly', kind: 'flyer', baseSpeed: 2.0,
    palette: ['#f3dca3', '#5a3f24', '#fff'],
    draw: (c1,c2,c3) => laceflyShape(c1,c2,c3) },
  { id: 'minerbug',     name: 'Coal-miner ground beetle', kind: 'crawler', baseSpeed: 0.85,
    palette: ['#2a2018', '#7a6242', '#0f0a06'],
    draw: (c1,c2,c3) => beetleShape(c1,c2,c3,{glass:false}) },
  { id: 'ribbonworm',   name: 'Ribbon-worm caterpillar', kind: 'crawler', baseSpeed: 0.5,
    palette: ['#b3402a', '#f1e3c4', '#5a3f24'],
    draw: (c1,c2,c3) => caterpillarShape(c1,c2,c3) },
  { id: 'jewelhopper',  name: 'Velvet-jeweled grasshopper', kind: 'crawler', baseSpeed: 1.1,
    palette: ['#2c5d63', '#e0a82e', '#1f2a23'],
    draw: (c1,c2,c3) => grasshopperShape(c1,c2,c3) },
  { id: 'mournfly',     name: 'Mourning bottle-fly', kind: 'flyer', baseSpeed: 2.2,
    palette: ['#1a140d', '#5a8071', '#2c5d63'],
    draw: (c1,c2,c3) => bottleflyShape(c1,c2,c3) },
  { id: 'silkdrifter',  name: 'Silk-thread drifter', kind: 'drifter', baseSpeed: 0.4,
    palette: ['#f1e3c4', '#cfe7e7', '#5a3f24'],
    draw: (c1,c2,c3) => silkShape(c1,c2,c3) },
  { id: 'amberbee',     name: 'Amber-cased bee-mimic', kind: 'flyer', baseSpeed: 1.5,
    palette: ['#e0a82e', '#5a3f24', '#1a140d'],
    draw: (c1,c2,c3) => bumbleShape(c1,c2,c3) },
  { id: 'ironcricket',  name: 'Iron-shell cricket', kind: 'crawler', baseSpeed: 0.95,
    palette: ['#3a3a3a', '#7a6242', '#1f1f1f'],
    draw: (c1,c2,c3) => grasshopperShape(c1,c2,c3) },
  { id: 'paperghost',   name: 'Paper-ghost moth', kind: 'flyer', baseSpeed: 1.3,
    palette: ['#f1e3c4', '#d4c08a', '#5a3f24'],
    draw: (c1,c2,c3) => mothShape(c1,c2,c3,{stained:false}) },
  { id: 'rustbeetle',   name: 'Rusted hinge-beetle', kind: 'crawler', baseSpeed: 0.8,
    palette: ['#7a3a1a', '#b89149', '#1a0e06'],
    draw: (c1,c2,c3) => beetleShape(c1,c2,c3,{glass:false}) },
  { id: 'silvermidge',  name: 'Silver tax-collector midge', kind: 'flyer', baseSpeed: 2.4,
    palette: ['#cfd6d8', '#2c5d63', '#1f1f1f'],
    draw: (c1,c2,c3) => laceflyShape(c1,c2,c3) },
  { id: 'velvetdarner', name: 'Velvet darner', kind: 'flyer', baseSpeed: 1.9,
    palette: ['#3a2a52', '#e0a82e', '#1a140d'],
    draw: (c1,c2,c3) => waspShape(c1,c2,c3) },
  { id: 'bookworm',     name: 'Marginalia bookworm', kind: 'crawler', baseSpeed: 0.55,
    palette: ['#a07a3a', '#f1e3c4', '#3a2418'],
    draw: (c1,c2,c3) => caterpillarShape(c1,c2,c3) },
  { id: 'opalmoth',     name: 'Opal-eyed dusk moth', kind: 'flyer', baseSpeed: 1.4,
    palette: ['#5a4a7a', '#e6c8d8', '#1a140d'],
    draw: (c1,c2,c3) => mothShape(c1,c2,c3,{stained:true}) },
  { id: 'leafmime',     name: 'Polite leaf-mime', kind: 'crawler', baseSpeed: 0.7,
    palette: ['#5a8071', '#a8c099', '#2c3a30'],
    draw: (c1,c2,c3) => bodyOval(c1,c2,c3,{bands:false,antennae:true,wings:false,legs:6}) },
  { id: 'bronzebug',    name: 'Bronze-collared sundial bug', kind: 'crawler', baseSpeed: 1.0,
    palette: ['#b89149', '#3a2a10', '#e0c87a'],
    draw: (c1,c2,c3) => beetleShape(c1,c2,c3,{glass:false}) },
  { id: 'foglace',      name: 'Fog-lace darner', kind: 'flyer', baseSpeed: 1.7,
    palette: ['#c8d4d6', '#2c5d63', '#fff'],
    draw: (c1,c2,c3) => laceflyShape(c1,c2,c3) },
  { id: 'porcelainbee', name: 'Porcelain-cup bee', kind: 'flyer', baseSpeed: 1.3,
    palette: ['#f5ecd6', '#b3402a', '#1a140d'],
    draw: (c1,c2,c3) => bumbleShape(c1,c2,c3) },
  { id: 'spectrebug',   name: 'Spectacled assembly-bug', kind: 'crawler', baseSpeed: 0.75,
    palette: ['#5a3f24', '#cfe7e7', '#1f1410'],
    draw: (c1,c2,c3) => bodyOval(c1,c2,c3,{bands:true,antennae:true,wings:true,legs:6}) },
  { id: 'sootmoth',     name: 'Soot-eating chimney moth', kind: 'flyer', baseSpeed: 1.5,
    palette: ['#2a2218', '#d4c08a', '#5a4a3a'],
    draw: (c1,c2,c3) => mothShape(c1,c2,c3,{stained:false}) },
  { id: 'spiralweevil', name: 'Spiral-shelled weevil', kind: 'crawler', baseSpeed: 0.65,
    palette: ['#6f4a24', '#e0c87a', '#2a1808'],
    draw: (c1,c2,c3) => beetleShape(c1,c2,c3,{glass:false}) },
  { id: 'fernhopper',   name: 'Fern-frond hopper', kind: 'crawler', baseSpeed: 1.05,
    palette: ['#4a6a3a', '#e0c87a', '#1f2a18'],
    draw: (c1,c2,c3) => grasshopperShape(c1,c2,c3) },
  { id: 'velvetfly',    name: 'Velvet seamstress fly', kind: 'flyer', baseSpeed: 2.1,
    palette: ['#3a2418', '#b3402a', '#e0a82e'],
    draw: (c1,c2,c3) => bottleflyShape(c1,c2,c3) },
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
  const shuffled = seededShuffle(rng, SPECIES);
  return shuffled.slice(0, POOL_SIZE);
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

// ====================== SVG SHAPE LIBRARY ======================
// Each builder returns an SVG string (square viewbox 0 0 80 80).
// Body color c1, accent c2, deep c3.
function svgFrame(inner) {
  return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
function bodyOval(c1, c2, c3, opt) {
  // generic 6-leg crawler
  let s = '';
  // legs
  if (opt.legs) {
    for (let i = 0; i < 3; i++) {
      const y = 32 + i * 7;
      s += `<line x1="40" y1="${y}" x2="${22}" y2="${y - 3}" stroke="${c3}" stroke-width="2"/>`;
      s += `<line x1="40" y1="${y}" x2="${58}" y2="${y - 3}" stroke="${c3}" stroke-width="2"/>`;
    }
  }
  // body
  s += `<ellipse cx="40" cy="44" rx="14" ry="22" fill="${c1}" stroke="${c3}" stroke-width="1.5"/>`;
  // head
  s += `<circle cx="40" cy="22" r="8" fill="${c1}" stroke="${c3}" stroke-width="1.5"/>`;
  // eye dots
  s += `<circle cx="37" cy="20" r="1.4" fill="${c3}"/><circle cx="43" cy="20" r="1.4" fill="${c3}"/>`;
  // bands
  if (opt.bands) {
    s += `<path d="M28,38 Q40,42 52,38" stroke="${c2}" stroke-width="3" fill="none"/>`;
    s += `<path d="M28,48 Q40,52 52,48" stroke="${c2}" stroke-width="3" fill="none"/>`;
    s += `<path d="M30,58 Q40,62 50,58" stroke="${c2}" stroke-width="3" fill="none"/>`;
  }
  // wings (flat)
  if (opt.wings) {
    s += `<ellipse cx="28" cy="40" rx="10" ry="14" fill="${c2}" opacity=".55"/>`;
    s += `<ellipse cx="52" cy="40" rx="10" ry="14" fill="${c2}" opacity=".55"/>`;
  }
  // antennae
  if (opt.antennae) {
    s += `<path d="M37,16 Q32,8 28,4" stroke="${c3}" stroke-width="1.5" fill="none"/>`;
    s += `<path d="M43,16 Q48,8 52,4" stroke="${c3}" stroke-width="1.5" fill="none"/>`;
  }
  if (opt.cig) {
    s += `<rect x="46" y="18" width="14" height="3" fill="#f1e3c4" stroke="${c3}" stroke-width=".6"/>`;
    s += `<rect x="58" y="18" width="3" height="3" fill="${c2}"/>`;
    s += `<path d="M61,18 Q63,14 64,12" stroke="#cfd6d8" stroke-width="1" fill="none"/>`;
  }
  return svgFrame(s);
}
function mothShape(c1, c2, c3, opt) {
  let s = '';
  // wings
  s += `<path d="M40,40 Q12,18 8,38 Q14,52 40,46 Z" fill="${c1}" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<path d="M40,40 Q68,18 72,38 Q66,52 40,46 Z" fill="${c1}" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<path d="M40,46 Q18,58 18,68 Q34,62 40,52 Z" fill="${c2}" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<path d="M40,46 Q62,58 62,68 Q46,62 40,52 Z" fill="${c2}" stroke="${c3}" stroke-width="1.2"/>`;
  if (opt.stained) {
    // stained-glass paneling
    s += `<path d="M22,32 L28,42 M30,28 L34,44 M52,42 L58,32 M50,28 L46,44" stroke="${c3}" stroke-width=".8" opacity=".65"/>`;
    s += `<circle cx="22" cy="38" r="2" fill="${c2}"/><circle cx="58" cy="38" r="2" fill="${c2}"/>`;
  } else {
    s += `<path d="M22,32 Q28,38 24,44 M58,32 Q52,38 56,44" stroke="${c3}" stroke-width=".8" opacity=".5" fill="none"/>`;
  }
  // body
  s += `<ellipse cx="40" cy="44" rx="3.5" ry="14" fill="${c3}"/>`;
  // head + antennae
  s += `<circle cx="40" cy="30" r="3" fill="${c3}"/>`;
  s += `<path d="M38,28 Q34,22 30,20" stroke="${c3}" stroke-width="1" fill="none"/>`;
  s += `<path d="M42,28 Q46,22 50,20" stroke="${c3}" stroke-width="1" fill="none"/>`;
  return svgFrame(s);
}
function bumbleShape(c1, c2, c3) {
  let s = '';
  // wings (clear)
  s += `<ellipse cx="26" cy="34" rx="14" ry="9" fill="#fff" opacity=".55" stroke="${c3}" stroke-width=".6"/>`;
  s += `<ellipse cx="54" cy="34" rx="14" ry="9" fill="#fff" opacity=".55" stroke="${c3}" stroke-width=".6"/>`;
  // body
  s += `<ellipse cx="40" cy="46" rx="14" ry="18" fill="${c2}" stroke="${c3}" stroke-width="1.4"/>`;
  // bands
  s += `<path d="M27,40 L53,40" stroke="${c1}" stroke-width="5"/>`;
  s += `<path d="M28,52 L52,52" stroke="${c1}" stroke-width="5"/>`;
  s += `<path d="M30,60 L50,60" stroke="${c1}" stroke-width="3"/>`;
  // head
  s += `<circle cx="40" cy="30" r="6" fill="${c1}" stroke="${c3}" stroke-width="1.4"/>`;
  // antennae
  s += `<path d="M37,26 Q33,18 31,16" stroke="${c3}" stroke-width="1" fill="none"/>`;
  s += `<path d="M43,26 Q47,18 49,16" stroke="${c3}" stroke-width="1" fill="none"/>`;
  return svgFrame(s);
}
function waspShape(c1, c2, c3) {
  let s = '';
  // wings (long)
  s += `<ellipse cx="40" cy="34" rx="22" ry="6" fill="#fff" opacity=".6" stroke="${c3}" stroke-width=".5"/>`;
  // body — segmented
  s += `<ellipse cx="40" cy="30" rx="6" ry="5" fill="${c1}" stroke="${c3}" stroke-width="1"/>`;
  s += `<ellipse cx="40" cy="44" rx="6" ry="9" fill="${c1}" stroke="${c3}" stroke-width="1"/>`;
  s += `<path d="M34,42 L46,42 M34,48 L46,48" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<ellipse cx="40" cy="60" rx="5" ry="8" fill="${c2}" stroke="${c3}" stroke-width="1"/>`;
  s += `<path d="M40,68 L40,74" stroke="${c3}" stroke-width="2"/>`; // stinger
  // head
  s += `<circle cx="40" cy="20" r="4" fill="${c1}" stroke="${c3}" stroke-width="1"/>`;
  s += `<path d="M37,17 Q33,10 30,8 M43,17 Q47,10 50,8" stroke="${c3}" stroke-width="1" fill="none"/>`;
  return svgFrame(s);
}
function beetleShape(c1, c2, c3, opt) {
  let s = '';
  // legs
  for (let i = 0; i < 3; i++) {
    const y = 38 + i * 8;
    s += `<line x1="36" y1="${y}" x2="${20}" y2="${y + 4}" stroke="${c3}" stroke-width="2"/>`;
    s += `<line x1="44" y1="${y}" x2="${60}" y2="${y + 4}" stroke="${c3}" stroke-width="2"/>`;
  }
  // body — beetle dome
  s += `<ellipse cx="40" cy="46" rx="18" ry="22" fill="${c1}" stroke="${c3}" stroke-width="1.6"/>`;
  // wing-case split
  s += `<line x1="40" y1="26" x2="40" y2="66" stroke="${c3}" stroke-width="1.4"/>`;
  if (opt.glass) {
    s += `<path d="M28,32 Q34,38 32,46 M52,32 Q46,38 48,46" stroke="${c2}" stroke-width=".8" fill="none" opacity=".7"/>`;
  } else {
    s += `<path d="M28,40 Q40,38 52,40" stroke="${c2}" stroke-width="1.6" fill="none" opacity=".7"/>`;
  }
  // head
  s += `<ellipse cx="40" cy="22" rx="8" ry="6" fill="${c1}" stroke="${c3}" stroke-width="1.4"/>`;
  // mandibles
  s += `<path d="M36,16 L32,12 M44,16 L48,12" stroke="${c3}" stroke-width="1.2"/>`;
  return svgFrame(s);
}
function mitelikeShape(c1, c2, c3) {
  let s = '';
  // many legs
  for (let i = 0; i < 4; i++) {
    const y = 32 + i * 6;
    s += `<line x1="40" y1="${y}" x2="${18}" y2="${y - 4 + i * 2}" stroke="${c3}" stroke-width="1.6"/>`;
    s += `<line x1="40" y1="${y}" x2="${62}" y2="${y - 4 + i * 2}" stroke="${c3}" stroke-width="1.6"/>`;
  }
  // round body
  s += `<circle cx="40" cy="44" r="16" fill="${c1}" stroke="${c3}" stroke-width="1.5"/>`;
  s += `<circle cx="40" cy="44" r="10" fill="${c2}" opacity=".4"/>`;
  // ink drip
  s += `<path d="M40,60 Q42,68 40,72 Q38,68 40,60 Z" fill="${c2}"/>`;
  return svgFrame(s);
}
function laceflyShape(c1, c2, c3) {
  let s = '';
  // wings — lacy
  s += `<path d="M40,38 Q14,20 10,40 Q18,46 40,42 Z" fill="${c1}" opacity=".75" stroke="${c2}" stroke-width=".6"/>`;
  s += `<path d="M40,38 Q66,20 70,40 Q62,46 40,42 Z" fill="${c1}" opacity=".75" stroke="${c2}" stroke-width=".6"/>`;
  s += `<path d="M40,42 Q22,52 24,62 Q34,56 40,46 Z" fill="${c1}" opacity=".55" stroke="${c2}" stroke-width=".6"/>`;
  s += `<path d="M40,42 Q58,52 56,62 Q46,56 40,46 Z" fill="${c1}" opacity=".55" stroke="${c2}" stroke-width=".6"/>`;
  // veins
  s += `<path d="M40,38 L18,32 M40,38 L20,40 M40,38 L18,46 M40,38 L62,32 M40,38 L60,40 M40,38 L62,46" stroke="${c3}" stroke-width=".5" opacity=".6"/>`;
  // body
  s += `<ellipse cx="40" cy="42" rx="2.2" ry="10" fill="${c3}"/>`;
  s += `<circle cx="40" cy="32" r="2.6" fill="${c3}"/>`;
  s += `<path d="M38,30 L34,24 M42,30 L46,24" stroke="${c3}" stroke-width=".8" fill="none"/>`;
  return svgFrame(s);
}
function caterpillarShape(c1, c2, c3) {
  let s = '';
  // segments along a slight curve
  for (let i = 0; i < 6; i++) {
    const cx = 18 + i * 9;
    const cy = 44 + Math.sin(i) * 3;
    const r = 6 + (i === 5 ? 1 : 0);
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${(i % 2) ? c2 : c1}" stroke="${c3}" stroke-width="1.2"/>`;
  }
  // head
  s += `<circle cx="68" cy="42" r="6" fill="${c1}" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<circle cx="69" cy="40" r="1.2" fill="${c3}"/>`;
  s += `<path d="M68,36 Q70,30 72,28 M70,38 Q74,34 76,32" stroke="${c3}" stroke-width="1" fill="none"/>`;
  return svgFrame(s);
}
function grasshopperShape(c1, c2, c3) {
  let s = '';
  // hind leg (big)
  s += `<path d="M44,46 L62,38 L58,52 Z" fill="${c1}" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<line x1="58" y1="52" x2="68" y2="62" stroke="${c3}" stroke-width="2"/>`;
  // mid + fore legs
  s += `<line x1="40" y1="48" x2="30" y2="60" stroke="${c3}" stroke-width="1.5"/>`;
  s += `<line x1="36" y1="40" x2="22" y2="46" stroke="${c3}" stroke-width="1.5"/>`;
  // body
  s += `<ellipse cx="36" cy="42" rx="14" ry="8" fill="${c1}" stroke="${c3}" stroke-width="1.4"/>`;
  s += `<path d="M22,38 Q36,32 50,40" stroke="${c2}" stroke-width="2" fill="none" opacity=".7"/>`;
  // head
  s += `<circle cx="22" cy="40" r="6" fill="${c1}" stroke="${c3}" stroke-width="1.4"/>`;
  s += `<circle cx="20" cy="38" r="1.4" fill="${c3}"/>`;
  // antennae
  s += `<path d="M20,36 Q14,28 10,24 M22,34 Q18,26 14,22" stroke="${c3}" stroke-width="1" fill="none"/>`;
  return svgFrame(s);
}
function bottleflyShape(c1, c2, c3) {
  let s = '';
  // wings translucent
  s += `<ellipse cx="28" cy="32" rx="14" ry="7" fill="#fff" opacity=".5" stroke="${c3}" stroke-width=".6"/>`;
  s += `<ellipse cx="52" cy="32" rx="14" ry="7" fill="#fff" opacity=".5" stroke="${c3}" stroke-width=".6"/>`;
  // metallic body
  s += `<ellipse cx="40" cy="44" rx="11" ry="14" fill="${c2}" stroke="${c3}" stroke-width="1.4"/>`;
  s += `<ellipse cx="40" cy="40" rx="6" ry="6" fill="${c1}" opacity=".75"/>`;
  // head w/ big eye
  s += `<circle cx="40" cy="28" r="6" fill="${c1}" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<circle cx="38" cy="26" r="3" fill="${c2}"/><circle cx="42" cy="26" r="3" fill="${c2}"/>`;
  // legs
  s += `<line x1="34" y1="50" x2="22" y2="60" stroke="${c3}" stroke-width="1.5"/>`;
  s += `<line x1="46" y1="50" x2="58" y2="60" stroke="${c3}" stroke-width="1.5"/>`;
  s += `<line x1="34" y1="44" x2="20" y2="48" stroke="${c3}" stroke-width="1.5"/>`;
  s += `<line x1="46" y1="44" x2="60" y2="48" stroke="${c3}" stroke-width="1.5"/>`;
  return svgFrame(s);
}
function silkShape(c1, c2, c3) {
  let s = '';
  // floating spider-on-thread
  s += `<line x1="40" y1="0" x2="40" y2="32" stroke="${c3}" stroke-width=".6" opacity=".7"/>`;
  s += `<ellipse cx="40" cy="44" rx="10" ry="9" fill="${c1}" stroke="${c3}" stroke-width="1.2"/>`;
  s += `<circle cx="40" cy="36" r="4" fill="${c2}" stroke="${c3}" stroke-width="1"/>`;
  // legs - 8
  for (let i = 0; i < 4; i++) {
    const a = 0.5 + i * 0.35;
    const x1 = 40 + Math.cos(a) * 10;
    const y1 = 44 + Math.sin(a) * 9;
    const x2 = 40 + Math.cos(a) * 22;
    const y2 = 44 + Math.sin(a) * 14;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c3}" stroke-width="1.2"/>`;
    const x1m = 40 - Math.cos(a) * 10;
    const x2m = 40 - Math.cos(a) * 22;
    s += `<line x1="${x1m}" y1="${y1}" x2="${x2m}" y2="${y2}" stroke="${c3}" stroke-width="1.2"/>`;
  }
  return svgFrame(s);
}

function speciesSvg(species) {
  const [c1, c2, c3] = species.palette;
  return species.draw(c1, c2, c3);
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
  // spawn a couple immediately so the board doesn't feel empty
  for (let i = 0; i < 3; i++) spawnBug();
  rafId = requestAnimationFrame(tick);
}

function resetSlots() {
  document.querySelectorAll('.slot').forEach(s => {
    s.classList.remove('filled');
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
  const species = pool[Math.floor(Math.random() * pool.length)];
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
  const sizePx = (species.kind === 'drifter' ? 36 : species.kind === 'flyer' ? 38 : 42) * (0.9 + Math.random() * 0.3);

  // DOM
  const el = document.createElement('div');
  el.className = 'bug';
  el.style.width = sizePx + 'px';
  el.style.height = sizePx + 'px';
  el.style.left = '0';
  el.style.top = '0';
  el.innerHTML = speciesSvg(species);
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
  });
}

function updateBugs(now) {
  const board = document.getElementById('board');
  const W = board.clientWidth, H = board.clientHeight - 80;
  for (let i = bugs.length - 1; i >= 0; i--) {
    const b = bugs[i];
    const t = now - b.born;
    // wobble
    const perpX = -Math.sin(b.rot);
    const perpY =  Math.cos(b.rot);
    const wob = Math.sin(t * b.wobbleHz) * b.wobbleAmp;
    b.x += b.vx + perpX * wob;
    b.y += b.vy + perpY * wob;

    // gentle direction drift for flyers
    if (b.kind === 'flyer' && Math.random() < 0.02) {
      const a = Math.atan2(b.vy, b.vx) + (Math.random() - 0.5) * 0.6;
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(a) * sp;
      b.vy = Math.sin(a) * sp;
      b.rot = a;
    }

    // off-screen culling
    if (b.x < -90 || b.x > W + 90 || b.y < -90 || b.y > H + 90) {
      b.el.remove();
      bugs.splice(i, 1);
      continue;
    }

    // render — face direction of travel
    const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2; // svgs face up
    b.el.style.transform = `translate(${b.x - b.sizePx/2}px, ${b.y - b.sizePx/2}px) rotate(${angle}rad)`;
  }
}

function pinBug(id) {
  if (!huntActive) return;
  const idx = bugs.findIndex(b => b.id === id);
  if (idx < 0) return;
  const b = bugs[idx];
  if (caught.length >= MAX_CATCHES) return;

  // play squelch
  squelch();

  // record
  const ts = Date.now();
  caught.push({ speciesId: b.speciesId, ts });

  // pinned animation
  b.el.classList.add('pinned');
  setTimeout(() => { b.el.remove(); }, 360);
  bugs.splice(idx, 1);

  // fill slot
  const slotIdx = caught.length - 1;
  const slot = document.querySelector('.slot[data-i="' + slotIdx + '"]');
  if (slot) {
    slot.classList.add('filled');
    const species = SPECIES.find(s => s.id === b.speciesId);
    slot.innerHTML = speciesSvg(species);
  }
  updateCaughtLabel();

  if (caught.length >= MAX_CATCHES) {
    setTimeout(() => endHunt(), 500);
  }
}

// ====================== SOUND (squelch / paper-thump) ======================
let _audioCtx = null;
function squelch() {
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
  } catch (e) { /* silent */ }
}

// ====================== PLATE ======================
function buildAndShowPlate() {
  // plate-level deterministic title/curator note seeded by date + caught ids
  const seedStr = todayKey() + '|' + caught.map(c => c.speciesId).join(',');
  const rng = mulberry32(hashStr(seedStr));
  const title = seededPick(rng, PLATE_TITLES);
  const curator = caught.length === 0
    ? "Curator's note: today, the case remained empty. Notable in itself."
    : seededPick(rng, CURATOR_HEADERS);

  document.getElementById('plate-title').textContent = title;
  document.getElementById('plate-curator').textContent = curator;
  document.getElementById('plate-date').textContent = humanDate();
  document.getElementById('plate-catno').textContent = catNo();

  const grid = document.getElementById('plate-grid');
  grid.innerHTML = '';
  if (caught.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'plate-empty';
    empty.textContent = 'No specimens were pinned. The board accepts that, too.';
    grid.appendChild(empty);
  } else {
    caught.forEach((c, i) => {
      const species = SPECIES.find(s => s.id === c.speciesId);
      if (!species) return;
      const card = document.createElement('div');
      card.className = 'specimen';
      const genus = genusFor(c.speciesId, c.ts);
      const epi = epithetFor(c.speciesId, c.ts);
      const note = fieldNoteFor(c.speciesId, c.ts);
      card.innerHTML = `
        <div class="specimen-art"><div class="specimen-pin"></div>${speciesSvg(species)}</div>
        <p class="specimen-num">Specimen ${String(i + 1).padStart(2, '0')} &middot; pinned ${fmtTime(c.ts)}</p>
        <p class="specimen-latin">${genus} ${epi}</p>
        <p class="specimen-note">— ${note}</p>
      `;
      grid.appendChild(card);
    });
  }

  showScreen('plate');
  // persist to share URL
  persistShare();
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
  buildAndShowPlateNoPersist();
}
function buildAndShowPlateNoPersist() {
  // same as buildAndShowPlate but skip persistShare (we already came from a link)
  const seedStr = todayKey() + '|' + caught.map(c => c.speciesId).join(',');
  const rng = mulberry32(hashStr(seedStr));
  const title = seededPick(rng, PLATE_TITLES);
  const curator = caught.length === 0
    ? "Curator's note: today, the case remained empty. Notable in itself."
    : seededPick(rng, CURATOR_HEADERS);

  document.getElementById('plate-title').textContent = title;
  document.getElementById('plate-curator').textContent = curator;
  document.getElementById('plate-date').textContent = humanDate();
  document.getElementById('plate-catno').textContent = catNo();

  const grid = document.getElementById('plate-grid');
  grid.innerHTML = '';
  caught.forEach((c, i) => {
    const species = SPECIES.find(s => s.id === c.speciesId);
    if (!species) return;
    const card = document.createElement('div');
    card.className = 'specimen';
    const genus = genusFor(c.speciesId, c.ts);
    const epi = epithetFor(c.speciesId, c.ts);
    const note = fieldNoteFor(c.speciesId, c.ts);
    card.innerHTML = `
      <div class="specimen-art"><div class="specimen-pin"></div>${speciesSvg(species)}</div>
      <p class="specimen-num">Specimen ${String(i + 1).padStart(2, '0')} &middot; pinned ${fmtTime(c.ts)}</p>
      <p class="specimen-latin">${genus} ${epi}</p>
      <p class="specimen-note">— ${note}</p>
    `;
    grid.appendChild(card);
  });

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
