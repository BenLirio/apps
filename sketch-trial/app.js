// Sketch Trial — Bureau of Forensic Sketch Evaluation
// AI vision analyzes the user's actual sketch → bureau wanted-poster verdict

const SLUG = 'sketch-trial';
const VISION_ENDPOINT = 'https://sm3y7y9t2a.execute-api.us-east-1.amazonaws.com/vision';

// ------------------------------------------------------------------
// Crime catalog (absurd-but-petty crimes; chosen by daily-rotating seed)
// ------------------------------------------------------------------
const CRIMES = [
  "stole the last bagel",
  "replied-all to a corporate-wide email at 11:47pm",
  "returned a romance novel in worse condition",
  "rearranged someone else's spice rack alphabetically without consent",
  "left a single grape in the office fruit bowl for nine days",
  "passed off a Costco rotisserie chicken as homemade",
  "double-dipped at a wake",
  "rolled a yoga mat in the wrong direction at the studio",
  "borrowed a pen at the bank and walked off with it",
  "microwaved fish in the open-plan kitchen at 2:14pm",
  "took the elevator down one floor",
  "merged into the carpool lane with zero passengers",
  "subscribed to a 14-day free trial 19 days in a row",
  "asked the barista 'is the matcha any good?'",
  "left a one-star review for a small bakery over a missing napkin",
  "took the last good metal fork from the office drawer",
  "let the printer run out without refilling it",
  "tried to merge onto a pedestrian-only street",
  "sent a calendar invite with no description, no agenda, and no end time"
];

// ------------------------------------------------------------------
// Fallback archetype catalog — used only when vision fails or sketch is empty.
// The vision model produces its own archetype name normally.
// ------------------------------------------------------------------
const FALLBACK_ARCHETYPES = [
  { name: "The Lateral Brunch Bandit",       age: [28, 36], wear: "performative running shoes",         aka: "the Avocado Ghost" },
  { name: "The Petty Cash Phantom",          age: [42, 58], wear: "a beige half-zip",                   aka: "Receipts McGraw" },
  { name: "The Open-Plan Ogre",              age: [34, 47], wear: "noise-canceling headphones",          aka: "He Who Heats Salmon" },
  { name: "The Carpool Lane Cassanova",      age: [26, 38], wear: "wraparound sunglasses",               aka: "The Solo Diamond" },
  { name: "The Inbox Incendiary",            age: [29, 44], wear: "a 2019 conference lanyard",           aka: "Two-Sigma Dave" },
  { name: "The Spice Rack Vigilante",        age: [31, 49], wear: "a pristine apron with no stains",     aka: "The Cumin Auditor" },
  { name: "The Costco Counterfeiter",        age: [33, 52], wear: "a flour-dusted cardigan",             aka: "Rotisserie Pete" },
  { name: "The Fruit Bowl Hostage-Taker",    age: [25, 39], wear: "an employee-of-the-month pin",        aka: "The Ninth-Day Grape" },
  { name: "The Single-Floor Elevator Sphinx",age: [37, 55], wear: "leather loafers and a sigh",          aka: "The Atrium Whisperer" },
  { name: "The Office Pen Pilgrim",          age: [22, 33], wear: "three pens in one pocket",            aka: "The Bic Migrator" },
  { name: "The Trial Subscription Houdini",  age: [19, 29], wear: "a hoodie and a free t-shirt",         aka: "The 14-Day Ghost" },
  { name: "The Matcha Skeptic",              age: [24, 35], wear: "a tote bag with one earnest book",    aka: "The Counter-Lurker" },
  { name: "The One-Star Avenger",            age: [33, 51], wear: "a Bluetooth earpiece in 2026",        aka: "The Napkin Inspector" },
  { name: "The Metal Fork Marauder",         age: [27, 45], wear: "a slightly-too-clean tupperware",     aka: "Tines McGee" },
  { name: "The Printer Tray Defector",       age: [30, 48], wear: "a clip-on badge at the wrong angle",  aka: "Out-of-Toner Toni" },
  { name: "The Pedestrian-Mall Motorist",    age: [40, 60], wear: "a polo and a confident misunderstanding", aka: "The Bollard Tester" },
  { name: "The No-Agenda Calendar Goblin",   age: [35, 52], wear: "a Patagonia fleece dating to 2017",   aka: "Sync-Up Steve" },
  { name: "The Yoga Mat Reverser",           age: [29, 41], wear: "a bamboo-fiber tank top",             aka: "The Wrong-Way Warrior" },
  { name: "The Wake Double-Dipper",          age: [44, 62], wear: "a tie chosen for the buffet",         aka: "Black-Tie Crouton" },
  { name: "The Library Book Returner-of-Doom",age: [29, 43], wear: "a cardigan with a coffee horizon",   aka: "Spine-Cracker Sue" }
];

// ------------------------------------------------------------------
// Hash + seeded RNG
// ------------------------------------------------------------------
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function todaysCrimeIndex() {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return hashStr(key) % CRIMES.length;
}

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const state = {
  strokes: [],
  current: null,
  crimeIdx: 0,
  caseNo: '',
  verdict: null
};

// ------------------------------------------------------------------
// DOM hooks
// ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const els = {};
function bindEls() {
  ['brief-stage','loading-stage','poster-stage','crime-text','case-no',
   'reroll-crime','sketch','canvas-overlay','undo','clear','stroke-count',
   'submit','loading-line','poster','poster-name','poster-meta','poster-charge',
   'poster-lastseen','poster-exhibits','poster-file','poster-date','poster-sketch',
   'share','retry']
    .forEach(id => els[id] = $(id));
}

// ------------------------------------------------------------------
// Canvas (HiDPI-aware)
// ------------------------------------------------------------------
let ctx, dpr = 1, cw = 600, ch = 600;
function setupCanvas() {
  const canvas = els['sketch'];
  ctx = canvas.getContext('2d', { willReadFrequently: false });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    cw = Math.max(1, Math.floor(rect.width));
    ch = Math.max(1, Math.floor(rect.height));
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  requestAnimationFrame(resize);
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  ['touchstart','touchmove','touchend','gesturestart','gesturechange','gestureend','contextmenu']
    .forEach(ev => canvas.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
}

function pointFromEvent(ev) {
  const rect = els['sketch'].getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) * (cw / rect.width),
    y: (ev.clientY - rect.top)  * (ch / rect.height),
    t: performance.now()
  };
}

function onPointerDown(ev) {
  ev.preventDefault();
  els['sketch'].setPointerCapture?.(ev.pointerId);
  state.current = { points: [pointFromEvent(ev)] };
  state.strokes.push(state.current);
  hideOverlay();
  drawStroke(state.current, true);
  updateStrokeCount();
}
function onPointerMove(ev) {
  if (!state.current) return;
  ev.preventDefault();
  const p = pointFromEvent(ev);
  const last = state.current.points[state.current.points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.6) return;
  state.current.points.push(p);
  drawStroke(state.current, true);
}
function onPointerUp(ev) {
  if (!state.current) return;
  if (state.current.points.length === 1) {
    const p = state.current.points[0];
    state.current.points.push({ x: p.x + 0.6, y: p.y + 0.6, t: p.t + 1 });
    drawStroke(state.current, true);
  }
  state.current = null;
}

function drawStroke(stroke, partial) {
  if (partial) {
    const pts = stroke.points;
    if (pts.length < 2) return;
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    drawSegment(a, b);
  } else {
    redraw();
  }
}
function drawSegment(a, b) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14213d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
function redraw() {
  ctx.clearRect(0, 0, cw, ch);
  for (const s of state.strokes) {
    if (s.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      const p = s.points[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

// ------------------------------------------------------------------
// Toolbar / overlay
// ------------------------------------------------------------------
function hideOverlay() {
  els['canvas-overlay']?.classList.add('gone');
}
function updateStrokeCount() {
  els['stroke-count'].textContent = `${state.strokes.length} stroke${state.strokes.length === 1 ? '' : 's'}`;
}

function bindToolbar() {
  els['undo'].addEventListener('click', () => {
    state.strokes.pop();
    redraw();
    updateStrokeCount();
    if (state.strokes.length === 0) els['canvas-overlay'].classList.remove('gone');
  });
  els['clear'].addEventListener('click', () => {
    state.strokes = [];
    redraw();
    updateStrokeCount();
    els['canvas-overlay'].classList.remove('gone');
  });
  els['reroll-crime'].addEventListener('click', () => {
    state.crimeIdx = (state.crimeIdx + 1 + Math.floor(Math.random() * (CRIMES.length - 1))) % CRIMES.length;
    setCrime();
  });
  els['submit'].addEventListener('click', onSubmit);
  els['retry']?.addEventListener('click', () => {
    state.strokes = [];
    state.verdict = null;
    redraw();
    updateStrokeCount();
    els['canvas-overlay'].classList.remove('gone');
    showStage('brief-stage');
    state.crimeIdx = (state.crimeIdx + 1 + Math.floor(Math.random() * (CRIMES.length - 1))) % CRIMES.length;
    setCrime();
  });
}

// ------------------------------------------------------------------
// Vision call: send the sketch + crime to the bureau, get a JSON verdict
// ------------------------------------------------------------------
async function bureauAnalyze(sketchDataUrl, crime) {
  const prompt =
`You are the Bureau of Forensic Sketch Evaluation, a fictional deadpan-bureaucratic agency. A citizen has hand-drawn the suspect they imagine for an absurdly petty crime. Look carefully at the actual sketch and produce a wanted-poster verdict that REACTS to what you literally see in the drawing.

Crime under investigation: "${crime}".

Output strict JSON with EXACTLY these keys (no extra keys, no commentary, no markdown fences):
{
  "archetype_name": "<grand bureaucratic suspect name, 4-7 words, beginning with 'The'. Match the energy of what you see AND the absurd crime. Examples: 'The Lateral Brunch Bandit', 'The Petty Cash Phantom', 'The Open-Plan Ogre'.>",
  "aka": "<street alias, 2-4 words. Examples: 'the Avocado Ghost', 'Receipts McGraw', 'Tines McGee'.>",
  "age": <integer 19-72 that fits the drawn suspect's vibe>,
  "wear": "<short clothing/accessory description, 3-7 words. Examples: 'performative running shoes', 'a beige half-zip'.>",
  "forensic_notes": [<exactly 4 strings>],
  "last_seen": "<ONE sentence beginning 'last seen', max 22 words, mentioning an oddly specific location or behavior. Don't name the suspect or the crime.>"
}

forensic_notes rules:
- Each entry is a SINGLE deadpan-bureaucratic observation (8-14 words) about something you actually see in the sketch — features present or missing, asymmetries, expression, posture, distinctive marks, or the geometry of the drawing itself. Frame as bureau evidence.
- Tone examples: "subject's left eyebrow set materially higher than the right", "minimal facial structure suggests decisive avoidance of accountability", "asymmetric grin consistent with light-to-moderate smug behavior", "no visible ears; the bureau finds this concerning".
- No emojis. No quotes inside the strings. No hashtags.

Output ONLY the JSON object.`;

  try {
    const res = await fetch(VISION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        image: sketchDataUrl,
        prompt,
        response_format: 'json_object'
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const text = (data.text || '').trim();
    if (!text) throw new Error('no_text');
    return normalizeVerdict(JSON.parse(text));
  } catch (_) {
    return null;
  }
}

function normalizeVerdict(v) {
  if (!v || typeof v !== 'object') return null;
  const name = String(v.archetype_name || '').trim();
  if (!name) return null;
  const notes = Array.isArray(v.forensic_notes)
    ? v.forensic_notes.filter(s => typeof s === 'string' && s.trim()).slice(0, 5).map(s => s.trim())
    : [];
  if (notes.length < 2) return null;
  return {
    name: name.toUpperCase(),
    aka: String(v.aka || '').trim() || 'unknown',
    age: clampInt(v.age, 19, 72, 32),
    wear: String(v.wear || '').trim() || 'nondescript clothing',
    forensic_notes: notes,
    last_seen: String(v.last_seen || '').trim() || 'last seen leaving the area without explanation.'
  };
}
function clampInt(n, lo, hi, def) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x)) return def;
  return Math.max(lo, Math.min(hi, x));
}

// ------------------------------------------------------------------
// Deterministic fallback verdict — used if vision fails or no strokes
// ------------------------------------------------------------------
function fallbackVerdict(crime, strokeCount) {
  const seed = (hashStr(crime) ^ Math.imul(strokeCount + 1, 2654435761)) >>> 0;
  const rng = mulberry32(seed);
  const arch = FALLBACK_ARCHETYPES[seed % FALLBACK_ARCHETYPES.length];
  const ageRange = arch.age[1] - arch.age[0] + 1;
  const age = arch.age[0] + Math.floor(rng() * ageRange);
  const places = [
    "near the cold-brew tap of an unfamiliar kitchen",
    "lurking by a public-library return slot at 4:51pm",
    "exiting an elevator one floor below their stated destination",
    "queueing for matcha with apparent unease",
    "hovering over a self-checkout screen",
    "loitering near a printer with no paper in tray 2"
  ];
  const tells = [
    "no apparent remorse",
    "an air of professional vagueness",
    "earpods in, conversing audibly with no one",
    "fingertips faintly stained with whatever they touched last"
  ];
  const place = places[Math.floor(rng() * places.length)];
  const tell  = tells[Math.floor(rng() * tells.length)];
  const notes = strokeCount === 0
    ? [
        "no sketch on file; the suspect's likeness remains pending",
        "absence of evidence considered, on this occasion, evidence of avoidance",
        "case advanced regardless, per Bureau Protocol 14-B",
        "subject described in archives as 'remarkably unremarkable'"
      ]
    : [
        "submitted sketch reviewed by on-call bureau examiner",
        "preliminary evidence consistent with prior incidents in this docket",
        "facial features inconclusive but match the cataloged archetype",
        "case advanced to wanted-poster stage pending no further appeal"
      ];
  return {
    name: arch.name.toUpperCase(),
    aka: arch.aka,
    age,
    wear: arch.wear,
    forensic_notes: notes,
    last_seen: `last seen ${place} wearing ${arch.wear}, ${tell}.`
  };
}

// ------------------------------------------------------------------
// Stage flow
// ------------------------------------------------------------------
function showStage(id) {
  ['brief-stage','loading-stage','poster-stage'].forEach(s => {
    els[s].hidden = (s !== id);
  });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

const LOADING_LINES = [
  "examining the suspect's likeness…",
  "consulting the bureau's archives…",
  "comparing against prior offenders…",
  "convening the panel of senior sketch artists…",
  "stamping case file CONFIDENTIAL…",
  "drafting the wanted poster…",
  "verifying chain of custody on Exhibit A…"
];

async function onSubmit() {
  const crime = CRIMES[state.crimeIdx];

  showStage('loading-stage');
  let i = 0;
  els['loading-line'].textContent = LOADING_LINES[i];
  const ticker = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    els['loading-line'].textContent = LOADING_LINES[i];
  }, 700);

  // Render the decorated version for the poster (always)
  const sketchForPoster = renderPosterSketchPNG();

  // Skip the vision call entirely if there's nothing drawn
  let visionVerdict = null;
  if (state.strokes.length > 0) {
    const cleanForVision = renderCleanSketchForVision();
    const visionP = bureauAnalyze(cleanForVision, crime);
    const minDwell = new Promise(r => setTimeout(r, 1500));
    [visionVerdict] = await Promise.all([visionP, minDwell]);
  } else {
    await new Promise(r => setTimeout(r, 1500));
  }

  const verdict = visionVerdict || fallbackVerdict(crime, state.strokes.length);
  state.verdict = verdict;

  clearInterval(ticker);
  renderPoster(verdict, crime, sketchForPoster);
  showStage('poster-stage');
  els['share'].classList.add('show');
}

// Clean white-bg sketch for the vision model (no decorations to confuse it)
function renderCleanSketchForVision(edge = 768) {
  const out = document.createElement('canvas');
  out.width = edge;
  out.height = edge;
  const octx = out.getContext('2d');
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, edge, edge);
  const sx = edge / cw, sy = edge / ch;
  octx.strokeStyle = '#000000';
  octx.lineWidth = 4;
  octx.lineCap = 'round';
  octx.lineJoin = 'round';
  for (const s of state.strokes) {
    const pts = s.points;
    if (!pts || pts.length < 2) continue;
    octx.beginPath();
    octx.moveTo(pts[0].x * sx, pts[0].y * sy);
    for (let i = 1; i < pts.length; i++) {
      octx.lineTo(pts[i].x * sx, pts[i].y * sy);
    }
    octx.stroke();
  }
  return out.toDataURL('image/jpeg', 0.85);
}

// Decorated sketch that goes onto the wanted poster
function renderPosterSketchPNG() {
  const out = document.createElement('canvas');
  const W = 800, H = 800;
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fffaf0';
  octx.fillRect(0, 0, W, H);
  octx.strokeStyle = 'rgba(20,33,61,0.08)';
  octx.lineWidth = 1;
  octx.beginPath(); octx.moveTo(0, H/2); octx.lineTo(W, H/2); octx.stroke();
  octx.beginPath(); octx.moveTo(W/2, 0); octx.lineTo(W/2, H); octx.stroke();
  const sx = W / cw, sy = H / ch;
  octx.strokeStyle = '#14213d';
  octx.lineWidth = 4;
  octx.lineCap = 'round';
  octx.lineJoin = 'round';
  for (const s of state.strokes) {
    const pts = s.points;
    if (!pts || pts.length < 2) continue;
    octx.beginPath();
    octx.moveTo(pts[0].x * sx, pts[0].y * sy);
    for (let i = 1; i < pts.length; i++) {
      octx.lineTo(pts[i].x * sx, pts[i].y * sy);
    }
    octx.stroke();
  }
  octx.strokeStyle = '#14213d';
  octx.lineWidth = 6;
  octx.strokeRect(3, 3, W - 6, H - 6);
  octx.save();
  octx.translate(W - 100, 80);
  octx.rotate(-0.15);
  octx.fillStyle = 'rgba(255,61,131,0.85)';
  octx.fillRect(-70, -22, 140, 36);
  octx.fillStyle = '#f3e9d2';
  octx.font = 'bold 22px Courier New, monospace';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText('EXHIBIT A', 0, 0);
  octx.restore();
  return out.toDataURL('image/png');
}

function renderPoster(verdict, crime, sketchDataUrl) {
  els['poster-name'].textContent = verdict.name;
  els['poster-meta'].textContent = `aka "${verdict.aka}"  ·  age ${verdict.age}  ·  ${verdict.wear}`;
  els['poster-charge'].textContent = `CHARGE: ${crime}`;
  els['poster-lastseen'].textContent = verdict.last_seen;
  els['poster-sketch'].src = sketchDataUrl;

  const list = els['poster-exhibits'];
  list.innerHTML = '';
  for (const note of verdict.forensic_notes) {
    const li = document.createElement('li');
    li.className = 'note';
    li.textContent = note;
    list.appendChild(li);
  }
  els['poster-file'].textContent = state.caseNo;
  const d = new Date();
  els['poster-date'].textContent = d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------
// Crime prominence / case number
// ------------------------------------------------------------------
function setCrime() {
  els['crime-text'].textContent = CRIMES[state.crimeIdx];
}
function setCaseNo() {
  const n = (Math.floor(Math.random() * 9000) + 1000);
  state.caseNo = `BFSE-${new Date().getFullYear()}-${n}`;
  els['case-no'].textContent = `CASE NO. ${state.caseNo}`;
}

// ------------------------------------------------------------------
// Share
// ------------------------------------------------------------------
function share() {
  const v = state.verdict;
  const text = v
    ? `the bureau identified me as ${toTitleCase(v.name)}.`
    : `the bureau is reviewing my sketch.`;
  if (navigator.share) {
    navigator.share({ title: document.title, text, url: location.href }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'))
      .catch(() => alert(location.href));
  } else {
    alert(location.href);
  }
}
function toTitleCase(s) {
  return s.toLowerCase().replace(/(^|\s)\S/g, t => t.toUpperCase());
}
window.share = share;

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
function init() {
  bindEls();
  state.crimeIdx = todaysCrimeIndex();
  setCrime();
  setCaseNo();
  setupCanvas();
  bindToolbar();
  updateStrokeCount();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
