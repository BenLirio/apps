// Minor Saint of [Your Devotion] — riso prayer-card generator
// Deterministic saint routing from halo geometry; light AI flourish for the prayer text.

const SLUG = 'minor-saint-of-devotion';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';

// ===== Geometry helpers =====
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function polygonPerimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

function centroid(pts) {
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  return [sx / pts.length, sy / pts.length];
}

// Returns ratio of mean radial distance / max radial distance — closer to 1 = rounder, lower = jagged.
// Plus point-count of significant inflections (jaggedness proxy).
function shapeFeatures(pts) {
  if (pts.length < 4) return null;
  const [cx, cy] = centroid(pts);
  const radii = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
  const maxR = Math.max(...radii);
  const minR = Math.min(...radii);
  // standard deviation of radii (jaggedness)
  const varR = radii.reduce((s, r) => s + (r - meanR) * (r - meanR), 0) / radii.length;
  const stdR = Math.sqrt(varR);
  // bounding box
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  const area = polygonArea(pts);
  const peri = polygonPerimeter(pts);
  // isoperimetric ratio: 4*pi*A / P^2  (1 = perfect circle)
  const iso = peri > 0 ? (4 * Math.PI * area) / (peri * peri) : 0;
  return {
    cx, cy, meanR, maxR, minR, stdR,
    bboxW: w, bboxH: h,
    area, peri, iso,
    aspect: h > 0 ? w / h : 1,
    points: pts.length
  };
}

// Quantize features into a discrete saint slot.
// 12 saints in a fixed bank, routed by (size bucket, jaggedness bucket, openness bucket).
const SAINTS = [
  // size: 0=small, 1=medium, 2=wide
  // jagged: 0=smooth, 1=medium, 2=spiky
  // each combination maps to one saint
  { id: 'stubborn',     name_template: 'Saint {NAME}',           descriptor: 'Patron of the Stubborn',                 quality: 'small+spiky' },
  { id: 'second-tries', name_template: 'Saint {NAME}',           descriptor: 'Patron of Second Tries',                 quality: 'small+medium' },
  { id: 'tinyfires',    name_template: 'Saint {NAME}',           descriptor: 'Patron of Tiny Tended Fires',            quality: 'small+smooth' },
  { id: 'lostmail',     name_template: 'Saint {NAME}',           descriptor: 'Patron of the Half-Sent Letter',         quality: 'medium+spiky' },
  { id: 'glassywatch',  name_template: 'Saint {NAME}',           descriptor: 'Patron of Glassy-Eyed Watchings',        quality: 'medium+medium' },
  { id: 'soft-quitters',name_template: 'Saint {NAME}',           descriptor: 'Patron of the Soft Quitters',            quality: 'medium+smooth' },
  { id: 'slow',         name_template: 'Saint {NAME}',           descriptor: 'Patron of the Slow',                     quality: 'wide+smooth' },
  { id: 'wide-quiet',   name_template: 'Saint {NAME}',           descriptor: 'Patron of the Wide Quiet',               quality: 'wide+medium' },
  { id: 'unraveling',   name_template: 'Saint {NAME}',           descriptor: 'Patron of the Slow Unraveling',          quality: 'wide+spiky' },
  // tiny+huge bonus slots based on point count / openness
  { id: 'half-watched', name_template: 'Saint {NAME}',           descriptor: 'Patron of Half-Watched Documentaries',   quality: 'medium+open' },
  { id: 'almost',       name_template: 'Saint {NAME}',           descriptor: 'Patron of the Almost',                   quality: 'small+open' },
  { id: 'hush',         name_template: 'Saint {NAME}',           descriptor: 'Patron of the Last Quiet Hour',          quality: 'wide+closed' }
];

// Fixed name bank — 24 names. Choose deterministically from halo seed.
const SAINT_NAMES = [
  'Mira', 'Odilo', 'Petra', 'Cassian', 'Linnea', 'Brom',
  'Vespa', 'Hadwig', 'Quill', 'Ansel', 'Mireille', 'Tobiah',
  'Iola', 'Senan', 'Velma', 'Caspar', 'Wren', 'Pelagia',
  'Edmer', 'Sidonie', 'Roan', 'Gisla', 'Cyprian', 'Theora'
];

function quantize(feat, openLoop) {
  // Normalize size to canvas dimension (assume canvas drawn-area normalized 0..640)
  const dim = Math.max(feat.bboxW, feat.bboxH);
  let sizeBucket;
  if (dim < 220) sizeBucket = 0;        // small
  else if (dim < 380) sizeBucket = 1;   // medium
  else sizeBucket = 2;                  // wide

  // jaggedness via std-deviation-of-radius / mean radius (coefficient of variation)
  const cv = feat.meanR > 0 ? feat.stdR / feat.meanR : 0;
  let jagBucket;
  if (cv < 0.10) jagBucket = 0;     // smooth
  else if (cv < 0.22) jagBucket = 1; // medium
  else jagBucket = 2;               // spiky

  // openness bucket: did the user close the loop tight, leave it gaping?
  let openBucket;
  if (openLoop > 0.32) openBucket = 'open';
  else if (openLoop < 0.10) openBucket = 'closed';
  else openBucket = 'mid';

  return { sizeBucket, jagBucket, openBucket, dim, cv };
}

function pickSaint(feat, openLoop) {
  const q = quantize(feat, openLoop);
  // Routing matrix
  let chosenId;
  if (q.openBucket === 'open' && q.sizeBucket === 0) chosenId = 'almost';
  else if (q.openBucket === 'open' && q.sizeBucket === 1) chosenId = 'half-watched';
  else if (q.openBucket === 'closed' && q.sizeBucket === 2) chosenId = 'hush';
  else if (q.sizeBucket === 0 && q.jagBucket === 2) chosenId = 'stubborn';
  else if (q.sizeBucket === 0 && q.jagBucket === 1) chosenId = 'second-tries';
  else if (q.sizeBucket === 0 && q.jagBucket === 0) chosenId = 'tinyfires';
  else if (q.sizeBucket === 1 && q.jagBucket === 2) chosenId = 'lostmail';
  else if (q.sizeBucket === 1 && q.jagBucket === 1) chosenId = 'glassywatch';
  else if (q.sizeBucket === 1 && q.jagBucket === 0) chosenId = 'soft-quitters';
  else if (q.sizeBucket === 2 && q.jagBucket === 0) chosenId = 'slow';
  else if (q.sizeBucket === 2 && q.jagBucket === 1) chosenId = 'wide-quiet';
  else chosenId = 'unraveling';

  const saint = SAINTS.find(s => s.id === chosenId);

  // Saint name from a deterministic hash of geometry buckets only
  // (so the same halo shape always gets the same name regardless of devotion text)
  const seed = hash(`${chosenId}|${q.sizeBucket}|${q.jagBucket}|${q.openBucket}`);
  const name = SAINT_NAMES[seed % SAINT_NAMES.length];

  return {
    id: chosenId,
    name,
    full_name: saint.name_template.replace('{NAME}', name),
    descriptor: saint.descriptor,
    bucket: q
  };
}

// ===== Prayer fallbacks (deterministic) =====
const PRAYER_FALLBACKS = {
  'stubborn': "Hold the line we kept holding.\nBless the no we said three times.\nLet the door stay shut, gently.\nGrant us another small refusal.",
  'second-tries': "We who reopened the tab,\nwho dialed the same number twice,\nbless the soft loop of return —\nthe second knock that finally lands.",
  'tinyfires': "Watch over our small kept fires:\nthe mug, the lamp, the slow kettle.\nKeep them lit when no one is looking.\nIt counts. It still counts.",
  'lostmail': "Bless the draft that was never sent,\nthe address half-remembered, half-meant.\nLet the words wait, patient as paper,\nuntil we are ready to mail ourselves.",
  'glassywatch': "For the eyes that glaze and still see —\nbless the long stare at small things.\nLet attention wander and return.\nThis, too, is a kind of looking.",
  'soft-quitters': "We laid the project down gently.\nNothing was burned. Nothing was buried.\nBless the quiet release without ceremony,\nand the day we did not need it.",
  'slow': "Bless the slow ones, the unhurried —\nthose who stand in the doorway thinking.\nLet the kettle whistle without us.\nWe will arrive. We always arrive.",
  'wide-quiet': "For the wide quiet of an empty room,\nthe long minute before the door clicks —\nbless this hush. Let it widen.\nLet us mistake it for arrival.",
  'unraveling': "Bless the slow unraveling,\nthe loose thread we keep pulling.\nLet the sweater take its time.\nNothing is lost yet. Almost nothing.",
  'half-watched': "Bless the documentary at minute eighteen,\nthe podcast nobody finished,\nthe lecture that became weather —\nlet half-attention be a form of devotion.",
  'almost': "Bless the almost-ed and the nearly,\nthe first foot raised in the doorway,\nthe word held just behind the teeth.\nLet almost be honored as enough.",
  'hush': "For the last quiet hour of a long day,\nwhen the house ticks and settles —\nbless this hush. Bless the empty cup.\nBless the small, true done-ness."
};

// ===== Canvas drawing =====
const traceCanvas = () => document.getElementById('halo-canvas');
const finalCanvas = () => document.getElementById('halo-final');

let traceCtx;
let drawing = false;
let pts = [];   // in canvas-internal coords
let strokes = [];
let currentStroke = [];

function setupTrace() {
  const c = traceCanvas();
  // Make canvas physical resolution match displayed size for crisp drawing
  const rect = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(rect.width * dpr);
  c.height = Math.round(rect.height * dpr);
  traceCtx = c.getContext('2d');
  traceCtx.scale(dpr, dpr);
  drawTraceBg();
  attachTraceEvents();
}

function drawTraceBg() {
  const c = traceCanvas();
  const rect = c.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  traceCtx.clearRect(0, 0, w, h);
  // dotted center cross to signal "trace area"
  traceCtx.strokeStyle = 'rgba(31,58,115,0.18)';
  traceCtx.lineWidth = 1;
  traceCtx.setLineDash([2, 6]);
  traceCtx.beginPath();
  traceCtx.moveTo(w / 2, 16); traceCtx.lineTo(w / 2, h - 16);
  traceCtx.moveTo(16, h / 2); traceCtx.lineTo(w - 16, h / 2);
  traceCtx.stroke();
  traceCtx.setLineDash([]);
  // ghost circle
  traceCtx.strokeStyle = 'rgba(217,74,61,0.15)';
  traceCtx.lineWidth = 1;
  traceCtx.beginPath();
  traceCtx.arc(w / 2, h / 2, Math.min(w, h) * 0.32, 0, Math.PI * 2);
  traceCtx.stroke();
}

function getEventPoint(e) {
  const c = traceCanvas();
  const rect = c.getBoundingClientRect();
  const t = (e.touches && e.touches[0]) || e;
  return [t.clientX - rect.left, t.clientY - rect.top];
}

function attachTraceEvents() {
  const c = traceCanvas();
  const start = (e) => {
    e.preventDefault();
    drawing = true;
    currentStroke = [];
    const p = getEventPoint(e);
    currentStroke.push(p);
    pts.push(p);
    document.getElementById('card-instr').classList.add('fade');
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = getEventPoint(e);
    const last = currentStroke[currentStroke.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 2) {
      currentStroke.push(p);
      pts.push(p);
      drawIncremental();
    }
  };
  const end = (e) => {
    if (!drawing) return;
    drawing = false;
    if (currentStroke.length > 1) strokes.push(currentStroke.slice());
    evaluateLoop();
  };
  c.addEventListener('mousedown', start);
  c.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  c.addEventListener('touchstart', start, { passive: false });
  c.addEventListener('touchmove', move, { passive: false });
  c.addEventListener('touchend', end);
  c.addEventListener('touchcancel', end);
}

function drawIncremental() {
  // Redraw bg + all strokes (cheap at this scale)
  drawTraceBg();
  traceCtx.lineCap = 'round';
  traceCtx.lineJoin = 'round';
  traceCtx.lineWidth = 6;
  traceCtx.strokeStyle = '#d94a3d';
  traceCtx.shadowColor = 'rgba(31,58,115,0.55)';
  traceCtx.shadowBlur = 0;
  traceCtx.shadowOffsetX = 1.5;
  traceCtx.shadowOffsetY = 1.5;
  for (const s of strokes) drawStroke(s);
  if (currentStroke.length > 1) drawStroke(currentStroke);
  traceCtx.shadowOffsetX = 0;
  traceCtx.shadowOffsetY = 0;
}

function drawStroke(s) {
  if (s.length < 2) return;
  traceCtx.beginPath();
  traceCtx.moveTo(s[0][0], s[0][1]);
  for (let i = 1; i < s.length; i++) traceCtx.lineTo(s[i][0], s[i][1]);
  traceCtx.stroke();
}

function evaluateLoop() {
  // We treat the union of all strokes as the halo shape — but only enable if there's enough material.
  const all = pts;
  if (all.length < 12) {
    setNextDisabled(true, 'keep going &mdash; the halo needs more line');
    return;
  }
  const feat = shapeFeatures(all);
  if (!feat || feat.area < 1500) {
    setNextDisabled(true, 'too small &mdash; the halo must have more body');
    return;
  }
  setNextDisabled(false, 'good. submit when ready.');
}

function setNextDisabled(disabled, hintMsg) {
  document.getElementById('trace-next').disabled = !!disabled;
  document.getElementById('trace-hint').innerHTML = hintMsg;
}

function clearTrace() {
  pts = [];
  strokes = [];
  currentStroke = [];
  drawTraceBg();
  setNextDisabled(true, 'close the loop &mdash; the Curia accepts only sealed halos');
  document.getElementById('card-instr').classList.remove('fade');
}

// ===== Compute halo features for routing =====
function getHaloFeatures() {
  const c = traceCanvas();
  const rect = c.getBoundingClientRect();
  // Normalize all points to a 0..640 reference frame so quantization thresholds are stable
  const sx = 640 / rect.width;
  const sy = 640 / rect.height;
  const norm = pts.map(([x, y]) => [x * sx, y * sy]);
  const feat = shapeFeatures(norm);

  // openness measure: gap between first and last point of the FIRST stroke,
  // normalized by mean radius. Big gap = open halo.
  let openLoop = 0;
  if (strokes.length >= 1) {
    const first = strokes[0][0];
    const last = strokes[strokes.length - 1][strokes[strokes.length - 1].length - 1];
    if (first && last) {
      const fn = [first[0] * sx, first[1] * sy];
      const ln = [last[0] * sx, last[1] * sy];
      const gap = Math.hypot(fn[0] - ln[0], fn[1] - ln[1]);
      openLoop = feat && feat.meanR > 0 ? gap / feat.meanR : 0;
    }
  }
  return { feat, openLoop, normPts: norm };
}

// ===== Final card rendering =====
function renderFinalCard(haloPts, saintBucket) {
  const c = finalCanvas();
  const rect = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(rect.width * dpr);
  c.height = Math.round(rect.height * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  // The recorded points are in normalized 0..640 coords.
  // We want to draw the halo centered above where the saint name will appear.
  // The aspect-ratio of #halo-final is 1:0.66 -> wide, short. We'll put the halo
  // centered horizontally, vertically biased to the upper half.
  if (!haloPts || haloPts.length < 4) return;

  // Find bbox of halo
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const [x, y] of haloPts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const bw = maxX - minX;
  const bh = maxY - minY;
  // target halo size (relative to card width): ~46% of card width
  const targetSize = Math.min(w, h * 1.5) * 0.46;
  const scale = targetSize / Math.max(bw, bh);
  const tx = w / 2 - (minX + bw / 2) * scale;
  const ty = h * 0.55 - (minY + bh / 2) * scale;

  // Off-register two-pass riso fill: first a soft red shadow, then the deep blue ink.
  const drawHalo = (offX, offY, color, lineWidth, alpha) => {
    ctx.save();
    ctx.translate(tx + offX, ty + offY);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth / scale;
    ctx.beginPath();
    ctx.moveTo(haloPts[0][0], haloPts[0][1]);
    for (let i = 1; i < haloPts.length; i++) ctx.lineTo(haloPts[i][0], haloPts[i][1]);
    ctx.stroke();
    ctx.restore();
  };

  // Soft red mis-register
  drawHalo(2.5, 1.5, '#d94a3d', 8, 0.85);
  // Main blue ink
  drawHalo(0, 0, '#1f3a73', 6, 0.95);
  // ghost glow inside (fluorescent feel)
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(217,74,61,0.06)';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.55, targetSize * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Add some ink-bleed grain dots inside
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = (0.18 + Math.random() * 0.22) * targetSize;
    const x = w / 2 + Math.cos(a) * r;
    const y = h * 0.55 + Math.sin(a) * r;
    ctx.fillStyle = `rgba(31,58,115,${0.06 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + Math.random() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ===== AI flourish: short deadpan 4-line prayer (gated) =====
async function generatePrayer(saint, devotion) {
  const cacheKey = 'pray_' + hash(saint.id + '|' + saint.name + '|' + devotion.trim().toLowerCase());
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  const fallback = PRAYER_FALLBACKS[saint.id] || PRAYER_FALLBACKS['half-watched'];

  const sys = "You are the Office of Minor Saints, a deadpan and gently absurd ecclesiastical bureau that lifts (never roasts) the small mundane devotions of laypeople. Write a four-line prayer for one minor saint and one devotee. Voice: mock-bureaucratic-sacred, dry warmth, never sarcastic. Each line must end with a line break. Do not use 'amen'. No emojis. No hashtags. No greeting. No quotation marks. The prayer should reference the user's specific mundane devotion exactly once, gently. Do not roast the devotion. Output only the four lines, nothing else.";
  const user = `Saint: ${saint.full_name}\nPatronage: ${saint.descriptor}\nDevotee's mundane devotion: "${(devotion || '').slice(0, 110)}"`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        max_tokens: 130
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let text = (data.content || '').trim();
    // Trim quotes / stray markdown
    text = text.replace(/^["'“‘]+/, '').replace(/["'”’]+$/, '');
    // Keep at most 5 lines, drop empty
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
    if (lines.length < 3) throw new Error('too_short');
    const final = lines.slice(0, 4).join('\n');
    try { localStorage.setItem(cacheKey, final); } catch (_) {}
    return final;
  } catch (_) {
    return fallback;
  }
}

// ===== Loading messages (riso bureaucratic) =====
const LOADING_MESSAGES = [
  'the Curia is consulting the smaller calendar…',
  'cross-referencing your halo against the apocrypha…',
  'a sub-deacon is locating the correct rubber stamp…',
  'the Office is warming up the riso drum…',
  'measuring your devotion in liturgical centimeters…'
];

// ===== Stage transitions =====
function show(id) {
  document.querySelectorAll('.stage').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

let CURRENT = null; // saved state for reveal/share

async function runReveal({ haloPts, devotion, saint, replay = false }) {
  // Stage 3: ruling
  show('stage-ruling');
  const msg = LOADING_MESSAGES[hash(saint.id + devotion) % LOADING_MESSAGES.length];
  const ruling = document.getElementById('ruling-text');
  ruling.textContent = msg;

  // Run the AI call in parallel with a minimum delay to feel ceremonial.
  const minWait = new Promise(r => setTimeout(r, 1100));
  const prayerPromise = generatePrayer(saint, devotion);
  const [_, prayer] = await Promise.all([minWait, prayerPromise]);

  // Stage 4: card
  show('stage-card');

  // Saint info
  document.getElementById('saint-name').textContent = saint.full_name;
  document.getElementById('saint-patronage').textContent = saint.descriptor;
  document.getElementById('prayer').textContent = prayer;
  document.getElementById('devotion-echo').textContent = devotion.length > 60 ? devotion.slice(0, 57) + '…' : devotion;

  // Verdict number — deterministic from saint+devotion
  const num = (hash(saint.id + '|' + devotion) % 899) + 100;
  document.getElementById('verdict-num').textContent = 'no. ' + toRoman(num);

  // filed date: today
  const now = new Date();
  document.getElementById('filed-date').textContent = now.toISOString().slice(0, 10);

  // Render halo onto final card AFTER the section is visible (so layout has a width)
  // Use rAF so getBoundingClientRect returns a non-zero width.
  requestAnimationFrame(() => {
    renderFinalCard(haloPts, saint.bucket);
  });

  document.getElementById('share').style.display = 'flex';

  CURRENT = { haloPts, devotion, saint, prayer };

  // If this isn't a replay, save state to case-store and update the URL.
  if (!replay) {
    saveCaseState(haloPts, devotion, saint, prayer).then(id => {
      if (id) {
        const url = new URL(location.href);
        url.search = '?c=' + id;
        url.hash = '';
        history.replaceState(null, '', url.toString());
      }
    });
  }
}

function toRoman(num) {
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let s = '';
  for (const [v, sym] of map) {
    while (num >= v) { s += sym; num -= v; }
  }
  return s;
}

// ===== Case-store wiring =====
function compactPoints(haloPts) {
  // Round to integers (canvas is 0..640 normalized) and downsample if too many
  let pts = haloPts.map(([x, y]) => [Math.round(x), Math.round(y)]);
  // Cap at ~280 points
  if (pts.length > 280) {
    const step = Math.ceil(pts.length / 280);
    pts = pts.filter((_, i) => i % step === 0);
  }
  return pts;
}

async function saveCaseState(haloPts, devotion, saint, prayer) {
  const blob = {
    v: 1,
    p: compactPoints(haloPts),
    d: devotion.slice(0, 120),
    s: { id: saint.id, name: saint.name, full: saint.full_name, desc: saint.descriptor, b: saint.bucket },
    pr: prayer
  };
  const data = JSON.stringify(blob);
  if (data.length > 7800) {
    // Too big — drop bucket (recoverable from id) and trim points more aggressively
    blob.s = { id: saint.id, name: saint.name };
    blob.p = blob.p.filter((_, i) => i % 2 === 0);
  }
  try {
    const res = await fetch(CASE_STORE_BASE + '/case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, data: JSON.stringify(blob) })
    });
    if (!res.ok) return null;
    const out = await res.json();
    return out.id || null;
  } catch (_) {
    return null;
  }
}

async function loadCaseState(id) {
  try {
    const res = await fetch(CASE_STORE_BASE + '/case/' + encodeURIComponent(id));
    if (!res.ok) return null;
    const out = await res.json();
    if (!out || !out.data) return null;
    return JSON.parse(out.data);
  } catch (_) {
    return null;
  }
}

// ===== Boot / replay =====
async function boot() {
  // Set a flavorful file number and char counter
  const fnum = document.getElementById('filenum');
  if (fnum) fnum.textContent = 'MM·' + toRoman((hash(String(Date.now())) % 899) + 100);

  const dev = document.getElementById('devotion');
  const counter = document.getElementById('char-count');
  const next = document.getElementById('confess-next');
  if (dev) {
    dev.addEventListener('input', () => {
      const v = dev.value.trim();
      counter.textContent = String(dev.value.length);
      next.disabled = v.length < 2;
    });
  }

  // Wire action buttons
  document.getElementById('redo-btn').addEventListener('click', clearTrace);
  document.getElementById('back-btn').addEventListener('click', () => {
    show('stage-trace');
    requestAnimationFrame(() => {
      // re-init canvas in case viewport changed
      setupTrace();
      // restore strokes visually
      drawIncremental();
    });
  });
  document.getElementById('trace-next').addEventListener('click', () => {
    show('stage-confess');
    setTimeout(() => document.getElementById('devotion').focus(), 200);
  });
  document.getElementById('confess-next').addEventListener('click', async () => {
    const devotion = document.getElementById('devotion').value.trim();
    if (devotion.length < 2) {
      document.getElementById('confess-hint').textContent = 'hmm, the Curia needs at least a word';
      return;
    }
    const { feat, openLoop, normPts } = getHaloFeatures();
    if (!feat) {
      document.getElementById('confess-hint').textContent = 'the halo on file is incomplete &mdash; try redrawing.';
      return;
    }
    const saint = pickSaint(feat, openLoop);
    await runReveal({ haloPts: normPts, devotion, saint });
  });

  // Case-store hydration
  const params = new URLSearchParams(location.search);
  const cid = params.get('c');
  if (cid) {
    const blob = await loadCaseState(cid);
    if (blob && blob.p && blob.s) {
      // Reconstruct saint object — recompute bucket if missing
      let saint;
      if (blob.s.full) {
        saint = {
          id: blob.s.id,
          name: blob.s.name,
          full_name: blob.s.full,
          descriptor: blob.s.desc,
          bucket: blob.s.b || {}
        };
      } else {
        // recompute from points
        const feat = shapeFeatures(blob.p);
        // recover openLoop heuristic
        const first = blob.p[0];
        const last = blob.p[blob.p.length - 1];
        const gap = Math.hypot(first[0] - last[0], first[1] - last[1]);
        const openLoop = feat && feat.meanR > 0 ? gap / feat.meanR : 0;
        saint = pickSaint(feat, openLoop);
      }
      // Use cached prayer if present
      if (blob.pr) {
        const cacheKey = 'pray_' + hash(saint.id + '|' + saint.name + '|' + (blob.d || '').trim().toLowerCase());
        try { localStorage.setItem(cacheKey, blob.pr); } catch (_) {}
      }
      await runReveal({ haloPts: blob.p, devotion: blob.d || '', saint, replay: true });
      return;
    }
  }

  // Fresh start
  setupTrace();
}

document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('resize', () => {
  // Re-init only if user is on trace stage
  const traceStage = document.getElementById('stage-trace');
  if (traceStage && !traceStage.classList.contains('hidden')) {
    setupTrace();
    drawIncremental();
  }
});

// ===== Public functions =====
function restart() {
  // wipe URL and reload to a clean state
  history.replaceState(null, '', location.pathname);
  pts = [];
  strokes = [];
  CURRENT = null;
  document.getElementById('devotion').value = '';
  document.getElementById('char-count').textContent = '0';
  document.getElementById('confess-next').disabled = true;
  show('stage-trace');
  requestAnimationFrame(setupTrace);
}

function share() {
  const url = location.href;
  const body = CURRENT && CURRENT.saint
    ? `the Order canonized me as ${CURRENT.saint.full_name}, ${CURRENT.saint.descriptor.toLowerCase()}.`
    : 'a minor saint has been issued in my name.';
  if (navigator.share) {
    navigator.share({ title: document.title, text: body, url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('prayer-card link copied to clipboard'));
  } else {
    prompt('copy this link:', url);
  }
}
