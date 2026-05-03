/* Reality TV Reaction Engine
   Deterministic: same chip sequence -> same verdict.
   No external APIs. Pure client-side pixel-art canvas.
   Voice: Bureau of Casting (mock-bureaucratic). Roast lands on the institution. */

const SLUG = 'reality-tv-reaction-engine';
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';

// ----- 12 mundane vignettes (deterministic order via seed-of-the-day not needed —
//       same vignettes shown each run so chip sequence is the only causal axis). -----
// Each vignette: id, caption, draw(ctx, t) where t in [0,1] over the 1.5s clip.
const VIGNETTES = [
  { id: 'cereal',   caption: 'a guy buys cereal for the third time this week',  draw: drawCereal },
  { id: 'car',      caption: 'a woman moves her car for street cleaning',       draw: drawCarMove },
  { id: 'pigeon',   caption: 'a pigeon eats a chip on the curb',                draw: drawPigeon },
  { id: 'oatmilk',  caption: 'your barista forgets the oat milk',               draw: drawBarista },
  { id: 'elev',     caption: 'two strangers ride the elevator in silence',      draw: drawElevator },
  { id: 'dog',      caption: 'a man waits for his dog to finish sniffing',      draw: drawDogWalk },
  { id: 'mail',     caption: 'a teen retrieves a single piece of mail',         draw: drawMail },
  { id: 'hold',     caption: 'someone holds the elevator with one hand',        draw: drawHoldDoor },
  { id: 'plant',    caption: 'a coworker rotates her desk plant',               draw: drawPlant },
  { id: 'crosswalk',caption: 'a jogger waits for the walk sign',                draw: drawCrosswalk },
  { id: 'umbr',     caption: 'a woman closes a stuck umbrella',                 draw: drawUmbrella },
  { id: 'lostkey',  caption: 'a man checks every pocket twice',                 draw: drawPockets }
];
// Use the first 10 — deterministic, brisk, matches description.
const PLAYLIST = VIGNETTES.slice(0, 10);

const CHIPS = ['POLITE_GASP', 'DRAMATIC_PAUSE', 'CONFESSIONAL_BOOTH', 'VILLAIN_EDIT', 'NO_REACTION'];
const CHIP_LABEL = {
  POLITE_GASP:        'POLITE GASP',
  DRAMATIC_PAUSE:     'DRAMATIC PAUSE',
  CONFESSIONAL_BOOTH: 'CONFESSIONAL BOOTH',
  VILLAIN_EDIT:       'VILLAIN EDIT',
  NO_REACTION:        'NO REACTION'
};
const CHIP_SHORT = {
  POLITE_GASP:        'GASP',
  DRAMATIC_PAUSE:     'PAUSE',
  CONFESSIONAL_BOOTH: 'CONFESS',
  VILLAIN_EDIT:       'VILLAIN',
  NO_REACTION:        'NO REACT'
};

// Each chip contributes deterministically to four axes (0..1 each).
// Designed so the chip-axis mapping has a real structure users can intuit.
//   drama = pause + villain + confess*0.4 + gasp*0.2
//   pettiness = villain + gasp*0.6 + pause*0.2
//   confessional = confess + pause*0.2
//   villainy = villain + confess*0.3
const AXIS_WEIGHTS = {
  POLITE_GASP:        { drama: 0.20, petty: 0.60, confess: 0.05, villain: 0.10 },
  DRAMATIC_PAUSE:     { drama: 1.00, petty: 0.20, confess: 0.20, villain: 0.30 },
  CONFESSIONAL_BOOTH: { drama: 0.40, petty: 0.05, confess: 1.00, villain: 0.30 },
  VILLAIN_EDIT:       { drama: 0.80, petty: 1.00, confess: 0.10, villain: 1.00 },
  NO_REACTION:        { drama: 0.00, petty: 0.00, confess: 0.00, villain: 0.00 }
};
const AXES = ['drama','petty','confess','villain'];
const AXIS_LABEL = {
  drama:   'drama-density',
  petty:   'pettiness-velocity',
  confess: 'confessional-honesty',
  villain: 'villain-arc'
};

// 16 named casting verdicts. Each has a deadpan casting-director quote
// and a "shape" (drama, petty, confess, villain) used by nearest-vector pick.
const VERDICTS = [
  {
    name: "The Stage-Whispering Producer's Pet",
    shape: [0.80, 0.30, 0.20, 0.40],
    quote: "We're going to seat them next to the sound mixer. It's where their best work happens.",
    attrib: "— Casting Director's Memo, Page 4"
  },
  {
    name: "The Quiet Threat in the Confessional Booth",
    shape: [0.50, 0.30, 0.95, 0.50],
    quote: "Says nothing in the kitchen. Says everything in the booth. Hire immediately.",
    attrib: "— Casting Director's Memo, Page 1"
  },
  {
    name: "The Cousin Who Ruins Thanksgiving On Purpose",
    shape: [0.70, 0.85, 0.30, 0.85],
    quote: "Volatile, but you can hear them chewing through three walls. Network gold.",
    attrib: "— Note to Producer, internal"
  },
  {
    name: "The Friend-Group Switzerland",
    shape: [0.20, 0.20, 0.20, 0.05],
    quote: "Neutral. Beige. Will absorb every plotline and reflect none. Cast as the calm before something.",
    attrib: "— Casting Director's Memo, Page 7"
  },
  {
    name: "The Long-Suffering Roommate (Camera-Ready)",
    shape: [0.60, 0.55, 0.70, 0.20],
    quote: "Sighs in 4K. Their eye-roll is on its own contract.",
    attrib: "— Bureau of Casting"
  },
  {
    name: "The Office Antagonist (HR-Approved)",
    shape: [0.55, 0.95, 0.20, 0.65],
    quote: "Petty enough to drive a season. Polite enough to avoid lawsuits. Greenlight.",
    attrib: "— Legal & Casting joint note"
  },
  {
    name: "The Producer's Favorite Mistake",
    shape: [0.95, 0.70, 0.55, 0.80],
    quote: "Off-script and unbookable for crime shows. Perfect for ours.",
    attrib: "— Casting Director's Memo, Page 11"
  },
  {
    name: "The Background Actor With Aspirations",
    shape: [0.45, 0.25, 0.50, 0.10],
    quote: "Hovers near the cake table whenever an argument starts. Keep them in the deep crowd.",
    attrib: "— Production Note"
  },
  {
    name: "The Reformed Villain (Season Two Pivot)",
    shape: [0.65, 0.50, 0.85, 0.70],
    quote: "Did the press tour. Did the cry. Will not be doing the apology.",
    attrib: "— Press Office"
  },
  {
    name: "The Wedding Guest Who Knows Things",
    shape: [0.40, 0.65, 0.80, 0.25],
    quote: "Quietly devastating. Will be miked at every reception, by court order if necessary.",
    attrib: "— Bureau of Casting"
  },
  {
    name: "The Reality-Show Saint",
    shape: [0.30, 0.10, 0.70, 0.05],
    quote: "Will not gossip. Will not drink. Will not fight. Re-cast.",
    attrib: "— Producer's Notes (rejected)"
  },
  {
    name: "The Final-Rose Frontrunner Nobody Remembers",
    shape: [0.50, 0.30, 0.50, 0.15],
    quote: "Won the season. Asked you to please not include a clip in the recap. Honored.",
    attrib: "— Casting Director's Memo, Page 22"
  },
  {
    name: "The Reunion Episode's Closing Argument",
    shape: [0.85, 0.85, 0.95, 0.55],
    quote: "Brought receipts. Had them laminated. Subpoenaed the producer.",
    attrib: "— Reunion Logs, Hour 3"
  },
  {
    name: "The Texting-And-Eyebrows Specialist",
    shape: [0.55, 0.55, 0.30, 0.35],
    quote: "Says the entire act-three twist with one eyebrow. We'll do close-ups.",
    attrib: "— DP's request"
  },
  {
    name: "The Cult-Documentary's Most Reasonable Person",
    shape: [0.35, 0.20, 0.85, 0.10],
    quote: "Suspiciously calm. Network safe. We will be calling them again in seven years.",
    attrib: "— Bureau of Casting"
  },
  {
    name: "The Producer Disguised As A Contestant",
    shape: [0.70, 0.40, 0.80, 0.85],
    quote: "Did not audition. Was always already here. Do not let them near the editor.",
    attrib: "— Internal Memo, Confidential"
  }
];

// ----- DOM -----
const $ = id => document.getElementById(id);
let canvas, ctx;
let state = {
  i: 0,                 // clip index 0..9
  picks: [],            // chip per clip
  clipStart: 0,
  rafId: null,
  ended: false,
  startedAt: 0
};

window.addEventListener('DOMContentLoaded', () => {
  canvas = $('stage');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  $('startBtn').addEventListener('click', startSession);
  document.querySelectorAll('.chip').forEach(b => {
    b.addEventListener('click', () => onChip(b.dataset.chip));
  });
  $('replayBtn').addEventListener('click', () => location.href = location.pathname);

  // Hydrate from share link if present
  hydrateFromShareLink();
});

async function hydrateFromShareLink() {
  const shortId = new URLSearchParams(location.search).get('c');
  let frag = '';
  if (shortId) {
    frag = await loadCaseFromStore(shortId) || '';
  }
  if (!frag) frag = (location.hash || '').replace(/^#/,'');
  if (!frag) return;
  const picks = parseFragment(frag);
  if (picks && picks.length === 10) {
    state.picks = picks;
    state.i = 10;
    renderResult({ skipPersist: true });
  }
}

function parseFragment(frag) {
  // 10 chars, each one of [G,P,C,V,N]
  const map = { G:'POLITE_GASP', P:'DRAMATIC_PAUSE', C:'CONFESSIONAL_BOOTH', V:'VILLAIN_EDIT', N:'NO_REACTION' };
  if (!/^[GPCVN]{10}$/.test(frag)) return null;
  return Array.from(frag).map(ch => map[ch]);
}
function compactFragment(picks) {
  const map = { POLITE_GASP:'G', DRAMATIC_PAUSE:'P', CONFESSIONAL_BOOTH:'C', VILLAIN_EDIT:'V', NO_REACTION:'N' };
  return picks.map(p => map[p]).join('');
}

function startSession() {
  state = { i: 0, picks: [], clipStart: 0, rafId: null, ended: false, startedAt: performance.now() };
  $('intro').hidden = true;
  $('result').hidden = true;
  $('play').hidden = false;
  // Initialize trail
  const trail = $('trail');
  trail.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const cell = document.createElement('div');
    cell.className = 'trail-cell t-EMPTY';
    cell.textContent = (i+1);
    cell.dataset.i = i;
    trail.appendChild(cell);
  }
  enableChips(true);
  startClip(0);
}

function enableChips(on) {
  document.querySelectorAll('.chip').forEach(b => b.disabled = !on);
}

function startClip(i) {
  state.i = i;
  state.clipStart = performance.now();
  $('clipNum').textContent = (i+1);
  $('caption').textContent = PLAYLIST[i].caption;
  $('stamp').hidden = true;
  $('timerFill').style.transition = 'none';
  $('timerFill').style.transform = 'scaleX(1)';
  // reflow then animate
  void $('timerFill').offsetWidth;
  $('timerFill').style.transition = 'transform 1.5s linear';
  $('timerFill').style.transform = 'scaleX(0)';
  enableChips(true);
  loop();
}

function loop() {
  const t = (performance.now() - state.clipStart) / 1500;
  if (t >= 1) {
    // auto-advance: log NO_REACTION if no pick yet
    if (state.picks.length === state.i) {
      logPick('NO_REACTION', { auto: true });
    }
    nextOrFinish();
    return;
  }
  drawClip(state.i, Math.max(0, Math.min(0.999, t)));
  state.rafId = requestAnimationFrame(loop);
}

function drawClip(i, t) {
  // pixel-art bg + scene
  const v = PLAYLIST[i];
  ctx.fillStyle = '#1a2a22';
  ctx.fillRect(0,0,320,200);
  v.draw(ctx, t);
  // tiny clip slate at top-left
  ctx.fillStyle = '#000';
  ctx.fillRect(4, 4, 70, 14);
  ctx.fillStyle = '#f2c300';
  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(`CLIP ${String(i+1).padStart(2,'0')}/10`, 7, 6);
}

function onChip(chip) {
  if (state.i >= 10 || state.ended) return;
  if (state.picks.length !== state.i) return; // already logged for this clip
  logPick(chip, { auto: false });
  // brief stamp flash, then advance after a short beat (don't wait full 1.5s)
  setTimeout(() => nextOrFinish(), 420);
}

function logPick(chip, opts) {
  state.picks[state.i] = chip;
  // stamp on canvas overlay
  const stampEl = $('stamp');
  stampEl.className = `stamp-flash c-${chip}`;
  stampEl.textContent = CHIP_LABEL[chip];
  stampEl.hidden = false;
  // trail update
  const cell = document.querySelector(`.trail-cell[data-i="${state.i}"]`);
  if (cell) {
    cell.className = `trail-cell t-${chip}`;
    cell.textContent = CHIP_SHORT[chip];
  }
  enableChips(false);
}

function nextOrFinish() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  if (state.i + 1 >= 10) {
    state.ended = true;
    $('play').hidden = true;
    renderResult({});
  } else {
    startClip(state.i + 1);
  }
}

// ----- Scoring + verdict -----
function computeAxes(picks) {
  const sum = { drama:0, petty:0, confess:0, villain:0 };
  picks.forEach(p => {
    const w = AXIS_WEIGHTS[p];
    if (!w) return;
    sum.drama += w.drama;
    sum.petty += w.petty;
    sum.confess += w.confess;
    sum.villain += w.villain;
  });
  // normalize: max single-chip contribution per axis = 1, max sum = 10. Scale to 0..1.
  return {
    drama:   Math.min(1, sum.drama   / 10),
    petty:   Math.min(1, sum.petty   / 10),
    confess: Math.min(1, sum.confess / 10),
    villain: Math.min(1, sum.villain / 10)
  };
}

function pickVerdict(axes) {
  const v = [axes.drama, axes.petty, axes.confess, axes.villain];
  let best = null, bestD = Infinity, bestIdx = -1;
  VERDICTS.forEach((cand, idx) => {
    let d = 0;
    for (let k = 0; k < 4; k++) {
      const dx = v[k] - cand.shape[k];
      d += dx * dx;
    }
    if (d < bestD) { bestD = d; best = cand; bestIdx = idx; }
  });
  return best;
}

// ----- Render result -----
async function renderResult(opts) {
  const axes = computeAxes(state.picks);
  const verdict = pickVerdict(axes);

  $('archetype').textContent = verdict.name;
  $('quote').innerHTML = verdict.quote + `<span class="attrib">${verdict.attrib}</span>`;

  // axes bars
  const axesEl = $('axes');
  axesEl.innerHTML = '';
  AXES.forEach(k => {
    const row = document.createElement('div');
    row.className = 'axis-row';
    const label = document.createElement('span');
    label.textContent = `// ${AXIS_LABEL[k]}`;
    const val = document.createElement('span');
    val.className = 'axis-val';
    val.textContent = (axes[k] * 100).toFixed(0).padStart(2,'0');
    const bar = document.createElement('div');
    bar.className = 'axis-bar';
    const fill = document.createElement('span');
    fill.style.width = (axes[k] * 100).toFixed(1) + '%';
    bar.appendChild(fill);
    row.appendChild(label);
    row.appendChild(val);
    row.appendChild(bar);
    axesEl.appendChild(row);
  });

  // 2x5 clipboard grid of thumbnails
  const grid = $('cbGrid');
  grid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'cb-thumb';
    const c = document.createElement('canvas');
    c.width = 120; c.height = 120;
    const tctx = c.getContext('2d');
    tctx.imageSmoothingEnabled = false;
    // draw a representative still of the clip into 120x120 (centered crop of 320x200)
    const tmp = document.createElement('canvas');
    tmp.width = 320; tmp.height = 200;
    const tmpctx = tmp.getContext('2d');
    tmpctx.imageSmoothingEnabled = false;
    tmpctx.fillStyle = '#1a2a22'; tmpctx.fillRect(0,0,320,200);
    PLAYLIST[i].draw(tmpctx, 0.55);
    // crop center 200x200 -> draw onto 120x120
    tctx.drawImage(tmp, 60, 0, 200, 200, 0, 0, 120, 120);
    wrap.appendChild(c);
    const stamp = document.createElement('div');
    const chip = state.picks[i] || 'NO_REACTION';
    stamp.className = `cb-stamp s-${chip}`;
    stamp.textContent = CHIP_SHORT[chip];
    wrap.appendChild(stamp);
    grid.appendChild(wrap);
  }
  $('cbFoot').textContent = `// case ${shortHash(state.picks.join(','))} · file under: ${verdict.name.replace(/^The /,'').toLowerCase()}`;

  $('result').hidden = false;
  // scroll into view
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Persist via case-store + permalink
  if (!opts || !opts.skipPersist) {
    const frag = compactFragment(state.picks);
    const id = await saveCaseToStore(frag);
    if (id) {
      history.replaceState(null, '', '?c=' + id);
    } else {
      history.replaceState(null, '', '#' + frag);
    }
  }
  $('permalinkLine').textContent = `// permalink: ${location.href}`;
}

function shortHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0,6).toUpperCase();
}

// ----- case-store wiring -----
async function saveCaseToStore(data) {
  try {
    const r = await fetch(CASE_STORE_BASE + '/case', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ slug: SLUG, data })
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.id || null;
  } catch (e) { return null; }
}
async function loadCaseFromStore(id) {
  try {
    const r = await fetch(CASE_STORE_BASE + '/case/' + encodeURIComponent(id));
    if (!r.ok) return null;
    const j = await r.json();
    return j.data || null;
  } catch (e) { return null; }
}

// ----- Share -----
function share() {
  const archetype = $('archetype').textContent || 'a casting decision';
  const text = `The Bureau of Casting just cast me as: ${archetype}.`;
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, text, url }).catch(()=>{});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied — show your agent.');
    }).catch(() => {
      prompt('Copy your casting link:', url);
    });
  }
}
window.share = share;

// =============================================================================
// PIXEL-ART VIGNETTES
// All draws use a deliberately limited palette and chunky pixels (no antialias).
// 320x200 stage. Loop: t in [0,1].
// =============================================================================

const PALETTE = {
  sky:    '#3b556d',
  sky2:   '#2c4258',
  sun:    '#e6b35a',
  ground: '#5a3a2a',
  grass:  '#3a6a3a',
  snow:   '#cfd8dc',
  brick:  '#a4593a',
  brick2: '#7d3f29',
  white:  '#f0e8c8',
  black:  '#1a1714',
  dark:   '#2a2a28',
  amber:  '#e6a02c',
  red:    '#b3321b',
  blue:   '#3a6a8a',
  green:  '#3a8a4a',
  pink:   '#d96d8a',
  yellow: '#f2c300',
  skin:   '#e6b58a',
  skin2:  '#a47a55',
  shadow: 'rgba(0,0,0,0.35)'
};

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function bg(ctx, top, bot) {
  // simple two-band sky/ground
  px(ctx, 0, 0, 320, 130, top);
  px(ctx, 0, 130, 320, 70, bot);
}

function drawCereal(ctx, t) {
  // Grocery store aisle, shelves with cereal boxes; guy walks slowly with a box
  bg(ctx, '#cdd8e6', '#8a7a5a'); // fluorescent store
  // back wall shelves
  for (let y = 30; y < 120; y += 22) {
    px(ctx, 0, y, 320, 4, '#5d4a36');
  }
  // cereal boxes on shelves
  const colors = ['#e0432a','#f2c300','#3a6a8a','#3a8a4a','#d96d8a','#e6a02c'];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 16; col++) {
      const c = colors[(row*16 + col) % colors.length];
      px(ctx, 6 + col*20, 14 + row*22, 16, 14, c);
      px(ctx, 8 + col*20, 16 + row*22, 12, 6, '#fff8e7');
    }
  }
  // floor tiles
  for (let i = 0; i < 16; i++) {
    px(ctx, i*22, 130, 22, 1, '#5a5040');
    px(ctx, 0, 130 + i*8, 320, 1, '#5a5040');
  }
  // guy (faces right, walks t=0..1)
  const gx = Math.round(40 + t * 200);
  drawPerson(ctx, gx, 132, '#3a6a8a', '#1a1714', '#e6b58a');
  // cereal box in his hands
  px(ctx, gx + 9, 158, 12, 14, '#e0432a');
  px(ctx, gx + 11, 161, 8, 4, '#fff8e7');
  // legs walking phase
  const phase = Math.floor(t * 6) % 2;
  px(ctx, gx + 4, 188, 4, phase ? 8 : 6, '#1a1714');
  px(ctx, gx + 12, 188, 4, phase ? 6 : 8, '#1a1714');
  // ceiling lights
  for (let i = 0; i < 4; i++) px(ctx, 30 + i*70, 0, 40, 4, '#fffde0');
}

function drawCarMove(ctx, t) {
  // Street with parked car; woman with keys; car edges forward
  bg(ctx, '#3b556d', '#444b3a');
  // street
  px(ctx, 0, 140, 320, 60, '#2a2a28');
  // dashed center line, scrolls with t
  for (let i = 0; i < 12; i++) {
    const x = ((i*32) - t*40 + 800) % 340;
    px(ctx, x, 168, 16, 4, '#f0e8c8');
  }
  // sidewalk
  px(ctx, 0, 132, 320, 8, '#7d7468');
  // building
  px(ctx, 0, 0, 320, 100, '#5a4a3a');
  for (let y = 16; y < 100; y += 18) {
    for (let x = 12; x < 320; x += 26) {
      px(ctx, x, y, 14, 10, '#cdd8e6');
    }
  }
  // street-cleaning sign
  px(ctx, 250, 60, 4, 70, '#7d7468');
  px(ctx, 240, 50, 24, 16, '#f2c300');
  ctx.fillStyle = '#1a1714';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('NO PARK', 240, 60);
  // car (moves forward small amount)
  const cx = 60 + Math.round(t * 30);
  px(ctx, cx, 142, 86, 26, '#b3321b');
  px(ctx, cx + 12, 134, 56, 14, '#b3321b');
  px(ctx, cx + 16, 138, 18, 8, '#3b556d');
  px(ctx, cx + 38, 138, 22, 8, '#3b556d');
  px(ctx, cx + 6, 162, 14, 14, '#1a1714');
  px(ctx, cx + 66, 162, 14, 14, '#1a1714');
  px(ctx, cx + 9, 165, 8, 8, '#7d7468');
  px(ctx, cx + 69, 165, 8, 8, '#7d7468');
  // exhaust puff
  if (t > 0.3) {
    px(ctx, cx - 10 - Math.round(t*8), 156, 8, 4, '#cfd8dc');
    px(ctx, cx - 18 - Math.round(t*8), 152, 6, 3, '#cfd8dc');
  }
  // woman at curb with keys held up
  const wx = 200;
  drawPerson(ctx, wx, 90, '#d96d8a', '#1a1714', '#e6b58a');
  px(ctx, wx + 14, 110, 4, 4, '#f2c300'); // keys
  px(ctx, wx + 18, 112, 2, 2, '#f2c300');
}

function drawPigeon(ctx, t) {
  // Curb with pigeon, chip wrapper
  bg(ctx, '#3b556d', '#7d7468');
  // curb
  px(ctx, 0, 130, 320, 8, '#5a5040');
  px(ctx, 0, 138, 320, 62, '#7d7468');
  // sidewalk cracks
  for (let i = 0; i < 8; i++) px(ctx, 30 + i*40, 138 + (i%2)*30, 30, 1, '#5a5040');
  // chip wrapper
  px(ctx, 150, 134, 14, 4, '#e0432a');
  px(ctx, 152, 138, 10, 2, '#f2c300');
  // pigeon (head bobs)
  const px_ = 130 + Math.round(t * 18);
  const bob = Math.floor(t * 8) % 2;
  // body
  px(ctx, px_, 110, 22, 14, '#7d8a96');
  // tail
  px(ctx, px_ - 6, 112, 6, 8, '#5a6a76');
  // head (bobs down)
  px(ctx, px_ + 14, 100 + bob*4, 10, 10, '#7d8a96');
  px(ctx, px_ + 24, 104 + bob*4, 4, 2, '#e6a02c'); // beak
  px(ctx, px_ + 22, 102 + bob*4, 2, 2, '#1a1714'); // eye
  // legs
  px(ctx, px_ + 4, 124, 2, 8, '#a47a55');
  px(ctx, px_ + 14, 124, 2, 8, '#a47a55');
  // chip in beak (later)
  if (t > 0.5) px(ctx, px_ + 28, 106 + bob*4, 6, 4, '#f2c300');
  // distant person legs walking by
  const fx = 40 + Math.round(t * 240);
  px(ctx, fx, 110, 4, 18, '#3a6a8a');
  px(ctx, fx + 6, 110, 4, 18, '#3a6a8a');
  px(ctx, fx, 128, 4, 4, '#1a1714');
  px(ctx, fx + 6, 128, 4, 4, '#1a1714');
}

function drawBarista(ctx, t) {
  // Cafe counter; barista hands cup; jar of OAT MILK on a shelf, untouched
  bg(ctx, '#5a3a2a', '#3a2a1a');
  // back wall + shelf
  px(ctx, 0, 0, 320, 110, '#5a3a2a');
  for (let i = 0; i < 12; i++) px(ctx, i*28, 14, 24, 2, '#7d4a3a');
  px(ctx, 0, 70, 320, 4, '#3a2a1a');
  // jars on shelf (one labeled OAT MILK)
  for (let i = 0; i < 8; i++) px(ctx, 12 + i*36, 38, 18, 24, '#cfd8dc');
  // OAT MILK jar — full, untouched (highlighted)
  px(ctx, 156, 38, 18, 24, '#f0e8c8');
  px(ctx, 156, 38, 18, 6, '#3a8a4a');
  ctx.fillStyle = '#1a1714';
  ctx.font = 'bold 6px monospace';
  ctx.fillText('OAT', 158, 51);
  ctx.fillText('MILK', 157, 58);
  // counter
  px(ctx, 0, 110, 320, 14, '#7d4a3a');
  // espresso machine
  px(ctx, 24, 80, 50, 30, '#1a1714');
  px(ctx, 30, 88, 38, 14, '#7d7468');
  px(ctx, 44, 102, 4, 8, '#e6a02c');
  // cup being slid forward with t
  const cx = 110 + Math.round(t * 80);
  px(ctx, cx, 100, 18, 14, '#f0e8c8');
  px(ctx, cx + 2, 100, 14, 4, '#a47a55'); // dark coffee — no oat milk
  px(ctx, cx + 18, 104, 4, 6, '#f0e8c8'); // handle
  // little vapor
  px(ctx, cx + 6, 92, 2, 4, '#cfd8dc');
  px(ctx, cx + 10, 88, 2, 4, '#cfd8dc');
  // barista (head + apron)
  drawPerson(ctx, 200, 70, '#3a8a4a', '#1a1714', '#e6b58a');
  // customer hand reaching from right
  px(ctx, 290 - Math.round(t*30), 108, 24, 8, '#e6b58a');
  px(ctx, 290 - Math.round(t*30), 116, 8, 4, '#3a6a8a');
}

function drawElevator(ctx, t) {
  // Two strangers, mirror, floor indicator counts up
  bg(ctx, '#7d7468', '#5a5040');
  // back wall
  px(ctx, 0, 0, 320, 200, '#7d7468');
  // mirror
  px(ctx, 60, 20, 200, 50, '#9aa6b8');
  px(ctx, 60, 20, 200, 4, '#5a5040');
  // floor indicator
  px(ctx, 140, 4, 40, 14, '#1a1714');
  ctx.fillStyle = '#f2c300';
  ctx.font = 'bold 10px monospace';
  const floor = 1 + Math.floor(t * 8);
  ctx.fillText(`▲ ${floor}`, 146, 6);
  // floor
  px(ctx, 0, 180, 320, 20, '#5a5040');
  // person A
  drawPerson(ctx, 80, 100, '#3a6a8a', '#1a1714', '#e6b58a');
  // person B
  drawPerson(ctx, 200, 100, '#b3321b', '#1a1714', '#a47a55');
  // both stare at the indicator (no movement)
  // tiny phone glow on B
  px(ctx, 214, 134, 8, 12, '#cdd8e6');
}

function drawDogWalk(ctx, t) {
  // Park path; man stands still, dog sniffs a bush, doesn't move
  bg(ctx, '#5a8aa6', '#3a6a3a');
  // path
  px(ctx, 0, 138, 320, 62, '#a48a6a');
  // bush
  px(ctx, 200, 110, 50, 30, '#3a6a3a');
  px(ctx, 196, 116, 58, 22, '#3a6a3a');
  for (let i = 0; i < 8; i++) px(ctx, 198 + i*6, 108 + (i%2)*4, 4, 4, '#5aaa5a');
  // tree trunk
  px(ctx, 270, 60, 14, 80, '#5a3a2a');
  px(ctx, 250, 20, 50, 50, '#3a6a3a');
  // man standing
  drawPerson(ctx, 80, 100, '#1a6e6a', '#1a1714', '#e6b58a');
  // leash
  ctx.strokeStyle = '#1a1714';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 130);
  ctx.lineTo(170 + Math.sin(t*8)*3, 158);
  ctx.stroke();
  // dog at bush, tail wags
  const wag = Math.floor(t * 8) % 2 ? 0 : 4;
  px(ctx, 160, 152, 26, 14, '#a47a55');
  px(ctx, 184, 148, 8, 8, '#a47a55'); // head
  px(ctx, 156 - wag, 154, 6, 4, '#a47a55'); // tail
  px(ctx, 160, 166, 4, 8, '#7d4a3a'); // legs
  px(ctx, 178, 166, 4, 8, '#7d4a3a');
  // sniff lines
  if (t > 0.3) {
    px(ctx, 192, 152, 6, 1, '#cdd8e6');
    px(ctx, 198, 150, 4, 1, '#cdd8e6');
  }
}

function drawMail(ctx, t) {
  // Mailbox bank in apartment lobby; teen retrieves a single envelope
  bg(ctx, '#3b556d', '#5a5040');
  // lobby wall
  px(ctx, 0, 0, 320, 130, '#9a8a6a');
  // mailbox grid
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      px(ctx, 50 + col*38, 30 + row*22, 32, 18, '#7d7468');
      px(ctx, 50 + col*38, 30 + row*22, 32, 4, '#5a5040');
      px(ctx, 80 + col*38, 36 + row*22, 2, 6, '#1a1714');
    }
  }
  // one open box (highlighted)
  px(ctx, 50 + 2*38, 30 + 1*22, 32, 18, '#1a1714');
  px(ctx, 50 + 2*38, 30 + 1*22, 32, 4, '#5a5040');
  // teen
  drawPerson(ctx, 110, 70, '#b3321b', '#1a1714', '#e6b58a');
  // envelope being pulled out
  const ex = 124 + Math.round(t * 14);
  px(ctx, ex, 60, 18, 10, '#f0e8c8');
  px(ctx, ex, 60, 18, 1, '#a47a55');
}

function drawHoldDoor(ctx, t) {
  // Elevator with one hand stuck in the door slot
  bg(ctx, '#7d7468', '#5a5040');
  px(ctx, 0, 0, 320, 200, '#5a5040');
  // elevator frame
  px(ctx, 60, 30, 200, 160, '#1a1714');
  // door (closing then jammed open)
  const gap = 50 - Math.round(t * 30); // closes a bit
  px(ctx, 70, 40, 90 - gap/2, 140, '#9aa6b8');
  px(ctx, 170 + gap/2, 40, 90 - gap/2, 140, '#9aa6b8');
  // hand in the gap
  px(ctx, 152, 100, 16, 10, '#e6b58a');
  px(ctx, 148, 110, 24, 8, '#3a6a8a'); // sleeve
  // arrow lights
  px(ctx, 290, 14, 14, 14, '#1a1714');
  px(ctx, 294, 18, 6, 6, t > 0.5 ? '#f2c300' : '#5a5040');
  // floor
  px(ctx, 0, 184, 320, 16, '#3a3025');
}

function drawPlant(ctx, t) {
  // Office desk; coworker spins a small potted plant a quarter turn
  bg(ctx, '#cdd8e6', '#7d7468');
  // desk
  px(ctx, 0, 130, 320, 70, '#a47a55');
  // monitor
  px(ctx, 60, 60, 90, 60, '#1a1714');
  px(ctx, 64, 64, 82, 52, '#3a6a8a');
  px(ctx, 100, 120, 14, 10, '#1a1714');
  // pot
  px(ctx, 200, 110, 28, 20, '#a4593a');
  // leaves rotate as t increases
  const lean = Math.round(t * 10);
  px(ctx, 204 - lean, 88, 6, 22, '#3a8a4a');
  px(ctx, 214 + lean, 84, 6, 26, '#3a8a4a');
  px(ctx, 220 - lean, 96, 6, 14, '#5aaa5a');
  // hand reaching
  px(ctx, 250 - Math.round(t*10), 100, 16, 10, '#e6b58a');
  // chair back partial
  px(ctx, 280, 80, 30, 60, '#5a5040');
  // mug
  px(ctx, 30, 116, 18, 14, '#f0e8c8');
  px(ctx, 48, 120, 4, 6, '#f0e8c8');
}

function drawCrosswalk(ctx, t) {
  // Empty crosswalk, jogger waits, walk sign red
  bg(ctx, '#3b556d', '#444b3a');
  // street
  px(ctx, 0, 110, 320, 90, '#2a2a28');
  // crosswalk stripes
  for (let i = 0; i < 6; i++) px(ctx, 60 + i*36, 130, 22, 60, '#f0e8c8');
  // sidewalks
  px(ctx, 0, 100, 320, 10, '#7d7468');
  // walk-sign post
  px(ctx, 270, 30, 4, 70, '#5a5040');
  px(ctx, 256, 30, 32, 28, '#1a1714');
  // hand or person — stays red the whole clip
  px(ctx, 264, 38, 16, 14, t < 0.5 ? '#b3321b' : '#b3321b');
  ctx.fillStyle = '#f0e8c8';
  ctx.font = 'bold 6px monospace';
  ctx.fillText('WAIT', 262, 60);
  // jogger bounces in place
  const bob = Math.floor(t * 12) % 2 ? 0 : 2;
  drawPerson(ctx, 60, 60 + bob, '#3a8a4a', '#1a1714', '#e6b58a');
  // headphones
  px(ctx, 64, 56 + bob, 14, 4, '#1a1714');
  // empty road, no cars, just an angry stillness
}

function drawUmbrella(ctx, t) {
  // Rainy step; woman wrestles a stuck umbrella
  bg(ctx, '#5a5a6a', '#3a3a3a');
  // rain streaks (animated)
  for (let i = 0; i < 30; i++) {
    const rx = (i*11 + (t*60)) % 320;
    const ry = ((i*23 + t*120) % 200);
    px(ctx, rx, ry, 1, 4, '#9aa6b8');
  }
  // step / awning
  px(ctx, 0, 130, 320, 70, '#5a3a2a');
  px(ctx, 0, 0, 320, 30, '#3a2a1a');
  // woman
  drawPerson(ctx, 120, 80, '#1a6e6a', '#1a1714', '#a47a55');
  // umbrella — stuck partly open, jitters with t
  const stuck = 0.3 + Math.abs(Math.sin(t*10))*0.15;
  ctx.save();
  ctx.translate(140, 70);
  // canopy
  for (let i = -3; i <= 3; i++) {
    px(ctx, i*8, -Math.round(20*stuck) + Math.abs(i)*2, 8, 4, '#b3321b');
  }
  // shaft
  px(ctx, 0, -Math.round(20*stuck) + 4, 2, 30, '#1a1714');
  ctx.restore();
}

function drawPockets(ctx, t) {
  // Doorway; man pats every pocket twice; a tiny key glints on the ground
  bg(ctx, '#3b3030', '#1a1714');
  // door
  px(ctx, 100, 30, 120, 150, '#5a3a2a');
  px(ctx, 200, 110, 6, 6, '#f2c300'); // doorknob
  // step
  px(ctx, 80, 180, 160, 20, '#3a2a1a');
  // floor
  px(ctx, 0, 180, 320, 20, '#2a2a28');
  // man patting pockets (animate hand position)
  drawPerson(ctx, 130, 80, '#3a6a8a', '#1a1714', '#e6b58a');
  const phase = Math.floor(t * 8) % 4;
  // hands pat at 4 spots
  const spots = [[140,128],[156,128],[140,148],[156,148]];
  const s = spots[phase];
  px(ctx, s[0], s[1], 10, 6, '#e6b58a');
  // tiny key on ground (gleam pulses)
  px(ctx, 60, 178, 6, 2, '#f2c300');
  px(ctx, 64, 176, 4, 2, '#f2c300');
  if (Math.floor(t*10) % 2) px(ctx, 62, 174, 2, 2, '#fffde0');
}

function drawPerson(ctx, x, yTop, shirt, hair, skin) {
  // tiny pixel person ~24x52, head + shirt + pants. yTop = head top.
  // head
  px(ctx, x + 4, yTop, 16, 14, skin);
  // hair cap
  px(ctx, x + 2, yTop, 20, 4, hair);
  px(ctx, x + 2, yTop + 4, 4, 4, hair);
  px(ctx, x + 18, yTop + 4, 4, 4, hair);
  // eyes
  px(ctx, x + 8, yTop + 6, 2, 2, '#1a1714');
  px(ctx, x + 14, yTop + 6, 2, 2, '#1a1714');
  // mouth
  px(ctx, x + 9, yTop + 11, 6, 1, '#7d3f29');
  // neck
  px(ctx, x + 9, yTop + 14, 6, 4, skin);
  // shirt
  px(ctx, x, yTop + 18, 24, 30, shirt);
  // arms
  px(ctx, x - 4, yTop + 22, 4, 22, shirt);
  px(ctx, x + 24, yTop + 22, 4, 22, shirt);
  // hands
  px(ctx, x - 4, yTop + 44, 4, 4, skin);
  px(ctx, x + 24, yTop + 44, 4, 4, skin);
  // pants (truncate at stage bottom; some scenes draw legs themselves)
  px(ctx, x, yTop + 48, 10, 18, '#1a1714');
  px(ctx, x + 14, yTop + 48, 10, 18, '#1a1714');
}
