// Catch of the Day — Lake Verity Survey
// Pixel-art tap-fishing minigame -> deterministic species -> 1830s field plate reveal.

const SLUG = 'catch-of-the-day';
const IMAGE_ENDPOINT = 'https://6kwpxgbgkc.execute-api.us-east-1.amazonaws.com/image';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const intro = $('intro');
const game = $('game');
const loading = $('loading');
const reveal = $('reveal');

const beginBtn = $('begin-btn');
const recastBtn = $('recast-btn');
const actionBtn = $('action-btn');
const promptLine = $('prompt-line');
const phaseLabel = $('phase-label');
const tensionFill = $('tension-fill');
const tensionBand = $('tension-band');
const strikePips = $('strike-pips');
const lake = $('lake');
const ctx = lake.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------- Hash / determinism ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
function seeded(h) {
  let x = h | 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) / 4294967296);
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---------- Species generation (deterministic) ----------
const ADJECTIVES = ['Glass-Toothed', 'Fog-Bellied', 'Iron-Scaled', 'Lantern-Eyed', 'Whisper-Finned',
  'Brass-Mouthed', 'Slate-Backed', 'Ember-Striped', 'Hollow-Gilled', 'Spectacled',
  'Velvet-Jawed', 'Pewter', 'Rust-Cheeked', 'Hook-Nosed', 'Marbled',
  'Twice-Looking', 'Sundered', 'Penitent', 'Vespertine', 'Hermit'];
const COMMON = ['Drift Carp', 'Ditch Pike', 'Pulpit Bass', 'Lake Sturgeon', 'Reed Trout',
  'Vesper Perch', 'Iron Bream', 'Quill Eel', 'Cathedral Tench', 'Hollow Roach',
  'Almsbox Pickerel', 'Vellum Minnow', 'Pew Char', 'Verity Mackerel', 'Bell-Tower Gar'];
const GENERA = ['Cyprinus', 'Esox', 'Perca', 'Salmo', 'Acipenser', 'Tinca', 'Anguilla', 'Lepisosteus'];
const SPECIES_LATIN = ['vitreodens', 'nebulonis', 'ferrofolium', 'lucernoculus', 'susurrans',
  'penitens', 'vespertinus', 'eremita', 'cavus', 'rubicundus',
  'marmoreus', 'paeniteor', 'campanae', 'speculatrix', 'humilis'];

const BODY_SHAPES = ['long and torpedo-like', 'deep-bodied and oval', 'compressed laterally and arched', 'slender and ribbon-like', 'stout and barrel-bellied'];
const SCALES = ['large overlapping bronze scales', 'small mirror-bright scales arranged in tight rows', 'rough plate-like scales along the dorsal line', 'tiny soft scales fading into the belly', 'silvery scales tipped with rust'];
const EYE = ['large pale-yellow eyes', 'small intelligent black eyes ringed in copper', 'milky lantern-like eyes', 'amber eyes with vertical pupils', 'glassy disc-like eyes'];
const FINS = ['long flowing dorsal fin with spiny rays', 'tattered translucent caudal fin', 'broad fan-shaped pectorals', 'low pewter-grey dorsal ridge', 'slender pointed tail with crescent edge'];
const MOUTH = ['a downturned philosophical mouth', 'a slight underbite revealing tiny needle teeth', 'fleshy whiskers at the corners of the mouth', 'a small puckered toothless mouth', 'a wide grim smile crowded with hooked teeth'];
const HABITAT = ['the eastern shallows of Verity Basin', 'the reedbeds south of the chapel inlet', 'the cold deepwater off Cormorant Point', 'the silted northern flats', 'the still channels beneath the mill weir'];
const STATUS_LABELS = ['COMMON', 'COMMON', 'NOTABLE', 'NOTABLE', 'UNCOMMON', 'RARE', 'CELEBRATED'];

function generateSpecies(catchData, rng) {
  const adj = pick(rng, ADJECTIVES);
  const common = pick(rng, COMMON);
  const genus = pick(rng, GENERA);
  const sp = pick(rng, SPECIES_LATIN);
  const body = pick(rng, BODY_SHAPES);
  const scale = pick(rng, SCALES);
  const eye = pick(rng, EYE);
  const fin = pick(rng, FINS);
  const mouth = pick(rng, MOUTH);
  const habitat = pick(rng, HABITAT);

  // status weighted by catch quality
  const quality = scoreCatch(catchData);
  let status;
  if (quality > 0.85) status = 'CELEBRATED';
  else if (quality > 0.7) status = 'RARE';
  else if (quality > 0.55) status = 'UNCOMMON';
  else if (quality > 0.4) status = 'NOTABLE';
  else status = 'COMMON';

  return {
    name: `${adj} ${common}`,
    latin: `${genus} ${sp}`,
    body, scale, eye, fin, mouth, habitat, status, quality
  };
}

function scoreCatch(c) {
  // 0..1 quality from the six metrics
  const dist = Math.min(1, c.castDistance / 100);
  const peaks = Math.min(1, c.tensionPeaks / 8);
  const fight = Math.min(1, c.fightDuration / 25);
  const closeBy = 1 - Math.min(1, c.snapNearMisses / 4);
  const rhythm = Math.min(1, 1 - Math.abs(c.reelInterval - 600) / 1000);
  const bite = Math.min(1, c.timeOfBite / 8);
  return (dist * 0.18 + peaks * 0.18 + fight * 0.22 + closeBy * 0.18 + rhythm * 0.12 + bite * 0.12);
}

// ---------- Catch state binning (for stable hash) ----------
function binMetrics(c) {
  return {
    cd: Math.round(c.castDistance / 5) * 5,
    tp: c.tensionPeaks,
    fd: Math.round(c.fightDuration),
    sm: c.snapNearMisses,
    ri: Math.round(c.reelInterval / 100) * 100,
    tb: Math.round(c.timeOfBite),
    ok: c.outcome
  };
}
function catchKey(c) {
  return JSON.stringify(binMetrics(c));
}

// ---------- Game state ----------
const STATE = { IDLE: 0, CASTING: 1, WAITING: 2, FIGHTING: 3, OVER: 4 };
let state = STATE.IDLE;

let castPower = 0;        // 0..1, hold-and-release meter
let castPowerDir = 1;
let castDistance = 0;     // pixels in canvas world
let waitTimer = 0;
let biteAt = 0;
let fightStart = 0;
let tension = 0.5;        // 0..1
let tensionTarget = 0.5;
let tensionVelocity = 0;
let strikes = 0;
let metrics = null;
let lastReelTaps = [];
let tensionPeaks = 0;
let inRedZone = false;
let lastFrame = 0;
let fishX = 0, fishY = 0;
let bobberX = 175, bobberY = 130;
let particles = [];

// game loop control
let rafId = null;

// pixel art helpers
function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawSky() {
  // gradient sky in big chunky blocks
  for (let i = 0; i < 8; i++) {
    const y = i * 8;
    const c = `rgb(${30 + i * 6}, ${50 + i * 8}, ${90 + i * 4})`;
    px(0, y, 350, 8, c);
  }
  // clouds
  px(40, 18, 28, 6, '#7a8da0');
  px(48, 12, 14, 6, '#7a8da0');
  px(220, 32, 36, 6, '#6e8095');
  px(232, 26, 16, 6, '#6e8095');
}

function drawWater(time) {
  // water surface
  px(0, 64, 350, 4, '#3a5470');
  // body
  for (let i = 0; i < 60; i++) {
    const y = 68 + i * 7;
    const tone = Math.max(0, 60 - i * 1.2);
    px(0, y, 350, 7, `rgb(${20 + tone * 0.3}, ${30 + tone * 0.4}, ${50 + tone * 0.6})`);
  }
  // wave glints
  ctx.fillStyle = 'rgba(180,200,220,0.3)';
  for (let x = 0; x < 350; x += 14) {
    const o = Math.sin((time / 600) + x * 0.13) * 4;
    ctx.fillRect(x + o, 70, 6, 2);
  }
  // distant shore
  px(0, 60, 350, 4, '#243a4a');
}

function drawAngler() {
  // pixel-art angler on a small dock at top-right
  // dock
  px(245, 56, 105, 8, '#5a3e1f');
  px(245, 64, 105, 2, '#3a2614');
  // legs of dock
  for (let lx = 250; lx < 350; lx += 16) {
    px(lx, 64, 3, 8, '#3a2614');
  }
  // angler body
  px(282, 32, 10, 24, '#3a2a1a'); // coat
  px(285, 22, 6, 10, '#d4b48a');  // head
  px(284, 18, 8, 4, '#2b1d0e');   // hat brim
  px(286, 14, 4, 4, '#2b1d0e');   // hat top
  // fishing rod
  ctx.strokeStyle = '#a78352';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(290, 32);
  ctx.lineTo(170, 80);
  ctx.stroke();
  // line down to bobber
  ctx.strokeStyle = '#e0d6b0';
  ctx.beginPath();
  ctx.moveTo(170, 80);
  ctx.lineTo(bobberX, bobberY);
  ctx.stroke();
}

function drawBobber(time) {
  // red and white bobber
  const wob = Math.sin(time / 200) * 1;
  const by = bobberY + wob;
  px(bobberX - 4, by - 4, 8, 4, '#a93a1a');
  px(bobberX - 4, by, 8, 4, '#e8d6a9');
  px(bobberX - 1, by - 6, 2, 2, '#2b1d0e');
}

function drawCastMeter() {
  // power meter overlay near bottom
  const w = 250, h = 14;
  const x = (350 - w) / 2, y = 410;
  px(x - 2, y - 2, w + 4, h + 4, '#2b1d0e');
  px(x, y, w, h, '#1a1a1a');
  px(x, y, Math.floor(w * castPower), h, '#c9a83d');
  // sweet spot
  px(x + Math.floor(w * 0.7), y, 2, h, '#6b8e3a');
  px(x + Math.floor(w * 0.95), y, 2, h, '#a93a1a');
}

function drawFightHUD(time) {
  // fish silhouette underwater, fighting
  const fy = fishY + Math.sin(time / 180) * 4;
  // body
  ctx.fillStyle = '#1a2230';
  ctx.fillRect(fishX - 14, fy - 5, 28, 10);
  ctx.fillRect(fishX + 12, fy - 3, 6, 6);
  // tail
  ctx.fillRect(fishX + 18, fy - 7, 4, 14);
  // splash particles
  for (const p of particles) {
    ctx.fillStyle = `rgba(220,230,240,${p.life / 30})`;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

function spawnSplash(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, life: 30 });
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life--;
  }
  particles = particles.filter(p => p.life > 0);
}

// ---------- Game loop ----------
function frame(t) {
  rafId = requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = t;
  const dt = Math.min(50, t - lastFrame);
  lastFrame = t;

  drawSky();
  drawWater(t);

  if (state === STATE.CASTING) {
    castPower += castPowerDir * (dt / 800);
    if (castPower >= 1) { castPower = 1; castPowerDir = -1; }
    if (castPower <= 0) { castPower = 0; castPowerDir = 1; }
    drawAngler();
    bobberX = 175;
    bobberY = 130;
    drawBobber(t);
    drawCastMeter();
  } else if (state === STATE.WAITING) {
    waitTimer += dt;
    drawAngler();
    drawBobber(t);
    if (waitTimer >= biteAt) {
      // bite!
      metrics.timeOfBite = waitTimer / 1000;
      spawnSplash(bobberX, bobberY);
      enterFightPhase();
    }
  } else if (state === STATE.FIGHTING) {
    // tension drifts upward (fish pulls); player taps to give slack
    tensionVelocity += (0.0005 + Math.random() * 0.0008) * (dt / 16);
    tension += tensionVelocity * (dt / 16);
    tension = Math.max(0, Math.min(1, tension));

    // fish movement
    fishX = bobberX + Math.sin(t / 400) * 30;
    fishY = bobberY + 30 + Math.sin(t / 250) * 6;

    // detect peak crossings (entering red zone)
    if (tension > 0.78 && !inRedZone) {
      inRedZone = true;
      tensionPeaks++;
    } else if (tension < 0.65 && inRedZone) {
      inRedZone = false;
    }

    // strike if held in red too long
    if (tension > 0.95) {
      strikes++;
      metrics.snapNearMisses++;
      tension = 0.85;
      tensionVelocity = -0.01;
      flashStrike();
      if (strikes >= 2) {
        endRun(false);
        return;
      }
    }

    // fish tires
    const elapsed = (t - fightStart) / 1000;
    if (elapsed > 18 + (Math.random() * 4)) {
      metrics.fightDuration = elapsed;
      endRun(true);
      return;
    }

    drawAngler();
    drawBobber(t);
    drawFightHUD(t);
    updateTensionUI();
    updateParticles();
  } else {
    drawAngler();
    drawBobber(t);
  }
}

function updateTensionUI() {
  tensionFill.style.width = (tension * 100) + '%';
  // strike pips
  const pips = ['<span style="color:#6b8e3a">&#x2713;</span>','<span style="color:#6b8e3a">&#x2713;</span>'];
  for (let i = 0; i < strikes; i++) pips[i] = '<span style="color:#a93a1a">&#x2715;</span>';
  strikePips.innerHTML = pips.join(' ');
}

function flashStrike() {
  game.style.animation = 'none';
  // brief shake
  const shell = document.querySelector('.game-shell');
  shell.animate([
    { transform: 'translate(0,0)' },
    { transform: 'translate(-4px,2px)' },
    { transform: 'translate(4px,-2px)' },
    { transform: 'translate(0,0)' }
  ], { duration: 200 });
}

// ---------- Phase transitions ----------
function startCastPhase() {
  state = STATE.CASTING;
  phaseLabel.textContent = 'Cast';
  promptLine.textContent = 'Hold the rod. Release at the green mark.';
  actionBtn.textContent = 'HOLD TO CAST';
  actionBtn.classList.remove('tap');
  actionBtn.classList.remove('charging');
  castPower = 0;
  castPowerDir = 1;
  tensionFill.style.width = '0%';
}

function startWaitPhase() {
  state = STATE.WAITING;
  phaseLabel.textContent = 'Wait';
  promptLine.textContent = 'A specimen approaches. Patience.';
  actionBtn.textContent = '...';
  actionBtn.classList.remove('charging');
  // distance influences bite timing & quality
  metrics.castDistance = Math.round(castPower * 100);
  // bobber position based on distance
  bobberY = 130 + (1 - castPower) * 30; // closer = lower; farther = higher near horizon? but we keep canvas coherent
  bobberY = 100 + castPower * 60; // farther = closer to far shore in image space (lower y? no, our water starts at 64). put deeper.
  bobberY = 80 + castPower * 40;
  bobberX = 60 + castPower * 230; // farther casts go further out across the water
  waitTimer = 0;
  // bite time: 1.5s + up to 5s based on quality of cast (sweet spot ~0.85)
  const cd = castPower;
  const ideal = Math.abs(cd - 0.85);
  biteAt = 1500 + ideal * 5000 + Math.random() * 1500;
}

function enterFightPhase() {
  state = STATE.FIGHTING;
  fightStart = performance.now();
  phaseLabel.textContent = 'Fight';
  promptLine.textContent = 'Tap to give slack. Stay clear of the red.';
  actionBtn.textContent = 'TAP TO GIVE SLACK';
  actionBtn.classList.add('tap');
  tension = 0.55;
  tensionVelocity = 0.002;
  strikes = 0;
  tensionPeaks = 0;
  inRedZone = false;
  lastReelTaps = [];
  metrics.tensionPeaks = 0;
  metrics.snapNearMisses = 0;
  updateTensionUI();
}

function endRun(landed) {
  state = STATE.OVER;
  cancelAnimationFrame(rafId); rafId = null;
  metrics.tensionPeaks = tensionPeaks;
  // reel rhythm
  if (lastReelTaps.length >= 2) {
    let total = 0;
    for (let i = 1; i < lastReelTaps.length; i++) total += lastReelTaps[i] - lastReelTaps[i - 1];
    metrics.reelInterval = total / (lastReelTaps.length - 1);
  } else {
    metrics.reelInterval = 1500;
  }
  if (!metrics.fightDuration) metrics.fightDuration = (performance.now() - fightStart) / 1000;
  metrics.outcome = landed ? 'caught' : 'lost';
  setTimeout(() => goToReveal(metrics), 400);
}

// ---------- Input handling ----------
let actionDown = false;
function actionPress() {
  actionDown = true;
  if (state === STATE.CASTING) {
    actionBtn.classList.add('charging');
  } else if (state === STATE.FIGHTING) {
    // tap to give slack
    tension -= 0.12;
    tensionVelocity = Math.min(tensionVelocity, -0.005);
    if (tension < 0) tension = 0;
    lastReelTaps.push(performance.now());
    if (lastReelTaps.length > 20) lastReelTaps.shift();
  }
}
function actionRelease() {
  if (!actionDown) return;
  actionDown = false;
  if (state === STATE.CASTING) {
    actionBtn.classList.remove('charging');
    startWaitPhase();
  }
}

actionBtn.addEventListener('mousedown', actionPress);
actionBtn.addEventListener('mouseup', actionRelease);
actionBtn.addEventListener('mouseleave', actionRelease);
actionBtn.addEventListener('touchstart', (e) => { e.preventDefault(); actionPress(); }, { passive: false });
actionBtn.addEventListener('touchend', (e) => { e.preventDefault(); actionRelease(); }, { passive: false });

// ---------- Begin / restart ----------
beginBtn.addEventListener('click', () => {
  intro.classList.add('hidden');
  game.classList.remove('hidden');
  startGame();
});

recastBtn.addEventListener('click', () => {
  reveal.classList.add('hidden');
  intro.classList.remove('hidden');
  // reset URL fragment
  history.replaceState(null, '', location.pathname);
});

function startGame() {
  metrics = {
    castDistance: 0,
    tensionPeaks: 0,
    fightDuration: 0,
    snapNearMisses: 0,
    reelInterval: 0,
    timeOfBite: 0,
    outcome: 'caught'
  };
  startCastPhase();
  lastFrame = 0;
  rafId = requestAnimationFrame(frame);
}

// ---------- Reveal: build the field plate ----------
async function goToReveal(m) {
  game.classList.add('hidden');
  loading.classList.remove('hidden');

  // determinism: hash binned metrics
  const key = catchKey(m);
  const h = hash(key);
  const rng = seeded(h);
  const species = (m.outcome === 'caught') ? generateSpecies(m, rng) : null;

  // encode catch state in URL fragment (small enough)
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(binMetrics(m)))));
  history.replaceState(null, '', '#' + enc);

  // pick a thematic loading line deterministically
  const LOAD_LINES = [
    "Pressing the specimen between sheets of vellum...",
    "Mixing iron-gall ink. The plate is being engraved.",
    "The Survey assistant is sharpening a fresh quill.",
    "Cataloguing scales. Cross-referencing the Verity register.",
    "Awaiting the field illustrator's verdict on the eye colour."
  ];
  $('loading-copy').textContent = LOAD_LINES[h % LOAD_LINES.length];

  // start image fetch (or fallback path) and the AI flourish in parallel
  const imgPromise = (m.outcome === 'caught')
    ? loadFishImage(species, h)
    : Promise.resolve(null); // for failure: empty hook plate, no image-gen call

  const flourishPromise = generateBehavioralNote(species, m);

  // ensure loading shows for at least 900ms so the line registers
  const minDelay = new Promise(r => setTimeout(r, 900));
  const [img, flourish] = await Promise.all([imgPromise, flourishPromise, minDelay]);

  renderPlate(species, m, img, flourish, h);
  loading.classList.add('hidden');
  reveal.classList.remove('hidden');
}

function buildImagePrompt(species, seedH) {
  return [
    `An 1830s naturalist's scientific illustration of a freshwater fish, single specimen, side profile, centered on aged sepia paper.`,
    `Style: Audubon-era copperplate engraving, fine etched cross-hatching, faded ink wash, museum field plate.`,
    `Specimen description: a ${species.body} fish with ${species.scale}, ${species.eye}, ${species.fin}, and ${species.mouth}.`,
    `Aged paper background with subtle foxing and age spots. No frame. No text, no labels, no captions, no letters, no numbers, no writing whatsoever — pure illustration only.`,
    `Muted earth-tone palette: sepia browns, ochre, umber, dull bronze, faded gold, cream paper.`,
    `The fish should fill most of the composition, drawn from a side view, anatomically observed, slightly stiff and formal as in a 19th-century field guide.`,
    `Seed: ${seedH}.`
  ].join(' ');
}

async function loadFishImage(species, seedH) {
  const cacheKey = 'cotd_img_' + seedH;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  const prompt = buildImagePrompt(species, seedH);
  try {
    const res = await fetch(IMAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        prompt,
        quality: 'pro',
        aspect_ratio: '1:1'
      })
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    if (!data || !data.image) throw 0;
    try { localStorage.setItem(cacheKey, data.image); } catch (_) {}
    return data.image;
  } catch (_) {
    return null;
  }
}

const FALLBACK_NOTES = [
  "The specimen surfaced after a measured struggle and offered no resistance to inspection.",
  "Retrieved without fanfare. Notable for its composure under the line's strain.",
  "An ordinary fight. The fish appeared resigned, almost cordial, by the end.",
  "Fought with brief but pointed enthusiasm. Recovered intact.",
  "A surprisingly philosophical specimen, considered the air for a long moment before consenting to the basket."
];

function staticBehavioralNote(species, m, h) {
  const base = FALLBACK_NOTES[h % FALLBACK_NOTES.length];
  return `Fought for ${Math.round(m.fightDuration)}s with ${m.tensionPeaks} surface ${m.tensionPeaks === 1 ? 'breach' : 'breaches'}. ${base}`;
}

async function generateBehavioralNote(species, m) {
  const h = hash(catchKey(m));
  if (m.outcome === 'lost') {
    const LOST_LINES = [
      "The line went slack at the second strain. The basket returns home empty.",
      "Two corrections came too late. The fish, presumed substantial, kept its name.",
      "The rod dipped, the rod recovered, the rod dipped a second time and that was that."
    ];
    return LOST_LINES[h % LOST_LINES.length];
  }

  const messages = [
    {
      role: 'system',
      content: "You write a single short field-naturalist's note for an 1830s scientific plate. Dry, deadpan, observational, dignified. Quote the exact catch metrics where natural. One to two sentences, under 35 words. No emojis, no hashtags, no exclamation marks, no modern slang."
    },
    {
      role: 'user',
      content: `Species: ${species.name} (${species.latin}).\nFight duration: ${Math.round(m.fightDuration)} seconds.\nSurface tension peaks: ${m.tensionPeaks}.\nLine-snap near-misses: ${m.snapNearMisses}.\nCast distance: ${m.castDistance}m.\nTime to bite: ${Math.round(m.timeOfBite)}s.\nWrite the behavioural note.`
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 90 })
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    const out = (data.content || '').trim();
    return out || staticBehavioralNote(species, m, h);
  } catch (_) {
    return staticBehavioralNote(species, m, h);
  }
}

const NATURALIST_QUOTES = [
  '"The fish, when held aloft, regarded me with the practiced indifference of one who has seen worse weather."',
  '"It is the lake that catches us; we merely arrange the rods."',
  '"In the basket it was already a memory. In the plate it becomes a rumour."',
  '"Of the morning\'s work I record only what the line agreed to confirm."',
  '"A specimen is, by definition, a fish that has stopped arguing."',
  '"Verity Lake holds her gossip close. Today she lent us a verb."'
];
const LOST_QUOTES = [
  '"Of the empty hook one may write at length, having nothing to interrupt."',
  '"The fish kept its silhouette and we kept our humility."',
  '"There remains, today, only the rumour of fins."'
];

function renderPlate(species, m, img, flourish, h) {
  const isCaught = (m.outcome === 'caught');
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  $('log-date').textContent = dateStr;
  $('plate-num').textContent = romanize((h % 89) + 1);
  $('cat-no').textContent = 'VS-' + String((h % 9000) + 1000);

  if (isCaught) {
    $('plate-title').textContent = species.name;
    $('plate-latin').innerHTML = `<i>${species.latin}</i>`;
    $('habitat-note').textContent = capFirst(species.habitat) + '.';
    const stamp = $('status-stamp');
    stamp.textContent = species.status;
    stamp.classList.remove('lost');

    // image
    const fishImg = $('fish-img');
    const fallback = $('fallback-svg');
    if (img) {
      fishImg.src = img;
      fishImg.style.display = 'block';
      fallback.style.display = 'none';
    } else {
      fishImg.style.display = 'none';
      fallback.style.display = 'block';
    }

    $('caption-strip').textContent =
      `fig. i. — collected by tap and patience, ${dateStr}. From ${species.habitat}.`;
  } else {
    // The One That Got Away
    $('plate-title').textContent = 'The One That Got Away';
    $('plate-latin').innerHTML = `<i>specimen non grata</i>`;
    $('habitat-note').textContent = 'Verity Basin, indeterminate depth.';
    const stamp = $('status-stamp');
    stamp.textContent = 'UNCATALOGUED';
    stamp.classList.add('lost');

    // empty hook plate — no image-gen call, just the SVG
    const fishImg = $('fish-img');
    const fallback = $('fallback-svg');
    fishImg.style.display = 'none';
    fallback.style.display = 'block';
    drawEmptyHookSVG(fallback);
    $('caption-strip').textContent = `fig. i. — the absence, recorded in good faith, ${dateStr}.`;
  }

  $('behavioral-note').textContent = flourish;

  // metrics table
  const table = $('metrics-table');
  table.innerHTML = '';
  const rows = [
    ['Cast distance', m.castDistance + ' m'],
    ['Time to bite', Math.round(m.timeOfBite) + ' s'],
    ['Fight duration', Math.round(m.fightDuration) + ' s'],
    ['Surface peaks', String(m.tensionPeaks)],
    ['Line-snap near-misses', String(m.snapNearMisses)],
    ['Reel rhythm', Math.round(m.reelInterval) + ' ms']
  ];
  for (const [k, v] of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${v}</td>`;
    table.appendChild(tr);
  }

  // quote
  const quotes = isCaught ? NATURALIST_QUOTES : LOST_QUOTES;
  const q = quotes[h % quotes.length];
  $('quote').innerHTML = `${q} <cite>&mdash; Dr. E. Halverston, Verity Survey, 1834</cite>`;
}

function drawEmptyHookSVG(svg) {
  svg.innerHTML = `
    <rect width="400" height="400" fill="#e8d6a9"/>
    <g stroke="#3a2614" stroke-width="2" fill="none">
      <line x1="200" y1="40" x2="200" y2="220"/>
      <path d="M200 220 Q200 280 240 280 Q280 280 280 240" stroke-width="3"/>
      <line x1="200" y1="40" x2="195" y2="55"/>
      <line x1="200" y1="40" x2="205" y2="55"/>
    </g>
    <g stroke="#3a2614" stroke-width="0.6" fill="none" opacity="0.5">
      <path d="M60 320 Q200 305 340 320"/>
      <path d="M60 335 Q200 318 340 335"/>
      <path d="M60 350 Q200 333 340 350"/>
    </g>
    <text x="200" y="385" font-family="serif" font-style="italic" text-anchor="middle" fill="#5a3e1f" font-size="13">— specimen absent, hook intact —</text>
  `;
}

// ---------- helpers ----------
function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function romanize(num) {
  const map = [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90],
    ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
  let r = '';
  for (const [s, v] of map) {
    while (num >= v) { r += s; num -= v; }
  }
  return r;
}

// ---------- Share ----------
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied — paste it to share this plate.'))
      .catch(() => alert(location.href));
  }
}
window.share = share;

// ---------- Restore from URL fragment (deep link to a plate) ----------
function tryRestoreFromHash() {
  if (!location.hash || location.hash.length < 4) return false;
  try {
    const enc = location.hash.slice(1);
    const json = decodeURIComponent(escape(atob(enc)));
    const binned = JSON.parse(json);
    if (typeof binned !== 'object' || !binned) return false;
    // reconstruct an approximate metrics object from the binned values
    const m = {
      castDistance: binned.cd || 0,
      tensionPeaks: binned.tp || 0,
      fightDuration: binned.fd || 0,
      snapNearMisses: binned.sm || 0,
      reelInterval: binned.ri || 0,
      timeOfBite: binned.tb || 0,
      outcome: binned.ok || 'caught'
    };
    intro.classList.add('hidden');
    game.classList.add('hidden');
    loading.classList.remove('hidden');
    goToReveal(m);
    return true;
  } catch (_) {
    return false;
  }
}

// boot
if (!tryRestoreFromHash()) {
  // intro is already visible by default
}
