// Provenance Office — Northbrook Civic Museum
// Deterministic feature extraction is the *interpretation* layer.
// The LLM only writes the curator's prose around already-locked figures.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'provenance-office';

// ---------- Canvas + drawing ----------
const pad = document.getElementById('pad');
const ctx = pad.getContext('2d', { willReadFrequently: true });
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

let CSSW = 0, CSSH = 0;     // CSS pixels (post-layout)
let drawing = false;
let tool = 'ink';            // 'ink' | 'erase'
let strokes = [];            // [{tool, points:[{x,y}], length}]
let currentStroke = null;
let lastFeatures = null;     // last computed feature bundle

const INK_COLOR = '#2b1d10';
const PAPER_COLOR = '#f9eecc';

function sizeCanvas() {
  // run inside rAF so flex/grid layout has settled
  requestAnimationFrame(() => {
    const rect = pad.getBoundingClientRect();
    CSSW = Math.max(1, Math.round(rect.width));
    CSSH = Math.max(1, Math.round(rect.height));
    pad.width = CSSW * DPR;
    pad.height = CSSH * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    redraw();
  });
}

function redraw() {
  ctx.clearRect(0, 0, CSSW, CSSH);
  for (const s of strokes) {
    drawStroke(s);
  }
}

function drawStroke(s) {
  if (!s.points.length) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.tool === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = 18;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 3.2;
  }
  ctx.beginPath();
  const p0 = s.points[0];
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < s.points.length; i++) {
    const p = s.points[i];
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

function eventToPoint(e) {
  const rect = pad.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return {
    x: (t.clientX - rect.left) * (CSSW / rect.width),
    y: (t.clientY - rect.top) * (CSSH / rect.height)
  };
}

function startStroke(e) {
  e.preventDefault();
  drawing = true;
  const p = eventToPoint(e);
  currentStroke = { tool, points: [p], length: 0 };
  strokes.push(currentStroke);
  // draw a single dot so taps register
  ctx.lineCap = 'round';
  if (tool === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.fillStyle = INK_COLOR;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI*2); ctx.fill();
  }
  updateFeaturesLive();
}

function moveStroke(e) {
  if (!drawing || !currentStroke) return;
  e.preventDefault();
  const p = eventToPoint(e);
  const last = currentStroke.points[currentStroke.points.length - 1];
  const dx = p.x - last.x, dy = p.y - last.y;
  const d = Math.hypot(dx, dy);
  if (d < 1.2) return;
  currentStroke.points.push(p);
  currentStroke.length += d;
  // incremental segment
  if (currentStroke.tool === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = 18;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 3.2;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  updateFeaturesLive();
}

function endStroke(e) {
  if (!drawing) return;
  if (e) e.preventDefault();
  drawing = false;
  currentStroke = null;
  updateFeaturesLive();
}

pad.addEventListener('mousedown', startStroke);
pad.addEventListener('mousemove', moveStroke);
window.addEventListener('mouseup', endStroke);
pad.addEventListener('touchstart', startStroke, { passive: false });
pad.addEventListener('touchmove', moveStroke, { passive: false });
pad.addEventListener('touchend', endStroke, { passive: false });
pad.addEventListener('touchcancel', endStroke, { passive: false });
pad.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Tool toggles ----------
document.getElementById('tool-ink').addEventListener('click', () => setTool('ink'));
document.getElementById('tool-erase').addEventListener('click', () => setTool('erase'));
document.getElementById('tool-clear').addEventListener('click', clearAll);

function setTool(t) {
  tool = t;
  document.getElementById('tool-ink').setAttribute('aria-pressed', t === 'ink' ? 'true' : 'false');
  document.getElementById('tool-erase').setAttribute('aria-pressed', t === 'erase' ? 'true' : 'false');
}

function clearAll() {
  strokes = [];
  redraw();
  updateFeaturesLive();
}

// ---------- Feature extraction (deterministic) ----------
// Buckets are FIXED. The LLM does not get to pick rarity/era/craftsmanship.

const ERA_BUCKETS = [
  // {label, lo, hi}  — keyed off a feature blend
  { label: "pre-classical (uncertain)" },
  { label: "early agrarian" },
  { label: "middle bronze" },
  { label: "late iron, ceremonial" },
  { label: "early industrial" },
  { label: "late industrial" },
  { label: "interwar civic" },
  { label: "post-1962 amateur revival" },
  { label: "indeterminate, recent" }
];

const RARITY_BUCKETS = [
  "common",
  "passably uncommon",
  "uncommon",
  "scarce",
  "remarkably scarce",
  "near-unique (per available registers)"
];

function inkPixelCount() {
  if (!CSSW || !CSSH) return 0;
  // sample a coarse grid for performance
  const W = CSSW, H = CSSH;
  const stepX = Math.max(2, Math.floor(W / 80));
  const stepY = Math.max(2, Math.floor(H / 80));
  let inked = 0, total = 0;
  // We can't easily read the canvas pixels at CSS coords with DPR scaling using getImageData
  // without un-scaling. Use the backing buffer instead.
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, pad.width, pad.height);
  } catch (_) { return 0; }
  const data = imageData.data;
  const bw = pad.width, bh = pad.height;
  const bsx = Math.max(2, Math.floor(bw / 80));
  const bsy = Math.max(2, Math.floor(bh / 80));
  for (let y = 0; y < bh; y += bsy) {
    for (let x = 0; x < bw; x += bsx) {
      const i = (y * bw + x) * 4;
      const a = data[i + 3];
      if (a > 40) inked++;
      total++;
    }
  }
  return total ? inked / total : 0;
}

function extractFeatures() {
  // Aggregate stroke geometry
  const inkStrokes = strokes.filter(s => s.tool === 'ink' && s.points.length);
  const strokeCount = inkStrokes.length;
  let totalPath = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let pointCount = 0;
  for (const s of inkStrokes) {
    totalPath += s.length;
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      pointCount++;
    }
  }
  if (!isFinite(minX)) { minX = minY = maxX = maxY = 0; }
  const bbW = Math.max(0, maxX - minX);
  const bbH = Math.max(0, maxY - minY);
  const aspect = bbH > 0 ? bbW / bbH : 0;
  const density = inkPixelCount();    // 0..1 fraction of inked pixels
  const canvasArea = (CSSW || 1) * (CSSH || 1);
  const bbArea = bbW * bbH;
  const fillRatio = canvasArea ? bbArea / canvasArea : 0;

  // Aspect adjective
  let aspectLabel = '—';
  if (strokeCount === 0) aspectLabel = '—';
  else if (aspect === 0) aspectLabel = 'singular point';
  else if (aspect < 0.55) aspectLabel = 'vertically dominant';
  else if (aspect < 0.85) aspectLabel = 'tall, leaning';
  else if (aspect < 1.15) aspectLabel = 'roughly square';
  else if (aspect < 1.7)  aspectLabel = 'broad, settled';
  else                    aspectLabel = 'horizontally dominant';

  // Era bucket — deterministic blend of stroke count, density, aspect.
  // Build a "signature" integer from rounded buckets so the bucket is stable
  // for the same drawing on submit.
  let era = '—';
  if (strokeCount > 0) {
    const sBucket = Math.min(8, Math.floor(strokeCount / 3));     // 0..8
    const dBucket = Math.min(8, Math.floor(density * 200));        // 0..8
    const aBucket = Math.min(8, Math.floor((aspect || 1) * 3));    // 0..8+
    const sig = (sBucket * 31 + dBucket * 7 + aBucket * 13) % ERA_BUCKETS.length;
    era = ERA_BUCKETS[sig].label;
  }

  // Rarity bucket — keyed off how *unusual* the drawing geometry is.
  // High path-per-stroke + high stroke count + low density = "near-unique".
  let rarity = '—';
  if (strokeCount > 0) {
    const pps = totalPath / Math.max(1, strokeCount);
    let score = 0;
    score += Math.min(3, Math.floor(strokeCount / 4));      // strokes
    score += Math.min(2, Math.floor(pps / 80));             // long strokes
    score += density > 0.18 ? 0 : (density > 0.07 ? 1 : 2); // restraint
    score = Math.min(RARITY_BUCKETS.length - 1, score);
    rarity = RARITY_BUCKETS[score];
  }

  // Craftsmanship score — 0.0–10.0
  let craft = 0;
  if (strokeCount > 0) {
    const strokeBonus = Math.min(4, strokeCount * 0.35);                  // 0..4
    const pathBonus = Math.min(3.5, totalPath / 240);                      // 0..3.5
    const fillPenalty = Math.max(0, fillRatio - 0.45) * 6;                 // overfilled = penalty
    const sparsePenalty = density < 0.01 ? 1.2 : 0;
    const tidyBonus = (strokeCount >= 2 && strokeCount <= 18 && density > 0.02 && density < 0.25) ? 1.6 : 0;
    craft = strokeBonus + pathBonus + tidyBonus - fillPenalty - sparsePenalty;
    // mild noise tied to geometry, not random — keeps decimals interesting but stable
    const tail = ((Math.round(totalPath) * 7 + strokeCount * 3) % 10) / 10;
    craft = Math.max(0.4, Math.min(9.7, craft + tail * 0.4));
  }

  // Proposed acquisition sum — absurd, deterministic, scales with appraisal.
  // Always at least $48,000; bumps for rarity / craft / era index.
  let proposedSum = 0;
  if (strokeCount > 0) {
    const rarityIdx = RARITY_BUCKETS.indexOf(rarity);
    const eraIdx = ERA_BUCKETS.findIndex(e => e.label === era);
    const base = 48000 + rarityIdx * 22500 + eraIdx * 9100;
    const craftMul = 1 + (craft / 10) * 1.6;                  // 1..2.6
    const strokeBump = Math.min(strokeCount, 60) * 437;
    const pathBump = Math.round(totalPath) * 13;
    const raw = base * craftMul + strokeBump + pathBump;
    // round to look hand-typed (no round-thousands)
    proposedSum = Math.round(raw / 100) * 100 + 312;
  }

  return {
    strokeCount,
    pointCount,
    totalPath: Math.round(totalPath),
    density,            // 0..1
    aspect,
    aspectLabel,
    era,
    rarity,
    craft,
    proposedSum
  };
}

function fmtMoney(n) {
  if (!n) return '$ —';
  return '$' + n.toLocaleString('en-US');
}

function fmtPath(px) {
  // pretend the canvas is ~6 inches across; this is decorative
  if (!px) return '0 in.';
  const inches = (px / 100).toFixed(1);
  return inches + ' in.';
}

function fmtAspect(f) {
  if (!f.strokeCount) return '—';
  const r = f.aspect ? f.aspect.toFixed(2) : '—';
  return r + ' (' + f.aspectLabel + ')';
}

// ---------- Live readout ----------
const $ = id => document.getElementById(id);

function setText(id, txt) {
  const el = $(id);
  if (el && el.textContent !== txt) {
    el.textContent = txt;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 220);
  }
}

let updateScheduled = false;
function updateFeaturesLive() {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    updateScheduled = false;
    const f = extractFeatures();
    lastFeatures = f;

    setText('r-strokes', String(f.strokeCount));
    setText('r-path', fmtPath(f.totalPath));
    setText('r-density', f.strokeCount ? (f.density * 100).toFixed(1) + ' %' : '— %');
    setText('r-aspect', fmtAspect(f));
    setText('r-era', f.era);
    setText('r-rarity', f.rarity);
    setText('r-craft', f.strokeCount ? f.craft.toFixed(1) + ' / 10' : '— / 10');

    // Form number — derived from the shape so it changes as the drawing does
    const num = formNumberFor(f);
    setText('form-num', 'File №: ' + num);

    // Submit gate
    const submitBtn = $('submit');
    submitBtn.disabled = f.strokeCount < 1;

    const status = $('readout-status');
    const foot = $('readout-foot');
    if (f.strokeCount === 0) {
      status.textContent = 'awaiting strokes';
      foot.textContent = 'Begin marking the canvas above. Figures update with each stroke.';
    } else if (f.strokeCount < 3) {
      status.textContent = 'preliminary';
      foot.textContent = 'Office stenographers are taking provisional measurements.';
    } else {
      status.textContent = 'in record';
      foot.textContent = 'Figures herein form the basis of the appraisal letter.';
    }
  });
}

function formNumberFor(f) {
  // 5-digit derived number — stable per bucket, not random
  const seed = (f.strokeCount * 991 + f.totalPath * 7 + Math.round(f.density * 10000) * 13) % 100000;
  return 'PROV-2026-' + String(seed).padStart(5, '0');
}

// ---------- Officer pool (deterministic pick) ----------
const OFFICERS = [
  "Eunice T. Hollander",
  "Wallace A. Beresford",
  "Margery J. Stoddart",
  "Cyrus L. Whitcombe",
  "Henrietta P. Aldrich",
  "Bartholomew R. Coltrane",
  "Imogen M. Crowfield",
  "Phineas E. Vandermeer",
  "Lavinia G. Marston",
  "Ezra W. Pemberton"
];

function pickOfficer(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0;
  return OFFICERS[Math.abs(h) % OFFICERS.length];
}

// ---------- Submit + LLM call ----------
const submitBtn = $('submit');
submitBtn.addEventListener('click', onSubmit);

async function onSubmit() {
  const f = lastFeatures || extractFeatures();
  if (!f.strokeCount) return;

  // Snapshot the drawing into a sepia-tinted PNG to embed
  const photoUrl = renderArchivePhoto();

  // Lock the file number + officer + date for this submission
  const fileNo = formNumberFor(f);
  const officer = pickOfficer(fileNo + '|' + f.era + '|' + f.rarity);
  const date = formatDate(new Date());

  // Switch view — pre-fill chrome FIRST, animate just the body when prose returns
  populateLetterChrome({ f, photoUrl, fileNo, officer, date });

  // Slide to the letter view
  $('draw-view').classList.add('hidden');
  $('letter-view').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Fetch curator prose around the locked figures
  const proseEl = $('prose-block');
  const prose = await fetchProse({ f, fileNo, officer });
  renderProse(proseEl, prose);
}

function populateLetterChrome({ f, photoUrl, fileNo, officer, date }) {
  $('l-file').textContent = fileNo;
  $('l-subject').textContent = 'Fig. 1, ' + f.aspectLabel;
  $('l-date').textContent = date;
  $('l-rarity').textContent = capitalize(f.rarity);
  $('l-era').textContent = capitalize(f.era);
  $('l-craft').textContent = f.craft.toFixed(1) + ' / 10';
  $('l-strokes').textContent = String(f.strokeCount);
  $('l-aspect').textContent = (f.aspect || 0).toFixed(2) + ' (' + f.aspectLabel + ')';
  $('l-sum').textContent = fmtMoney(f.proposedSum);
  $('l-officer').textContent = officer;
  $('l-photo').src = photoUrl;
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(d) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function renderArchivePhoto() {
  // Re-render onto a clean square offscreen canvas with the paper background
  // baked in, then return as a PNG data URL. Sepia tint is applied via CSS.
  const off = document.createElement('canvas');
  const size = 600;
  off.width = size; off.height = size;
  const octx = off.getContext('2d');
  octx.fillStyle = PAPER_COLOR;
  octx.fillRect(0, 0, size, size);
  // scale strokes from CSS-pixel coords to the offscreen size
  const sx = size / CSSW;
  const sy = size / CSSH;
  for (const s of strokes) {
    if (!s.points.length) continue;
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    if (s.tool === 'erase') {
      // skip erase strokes in the snapshot — they were destructive on the live canvas;
      // re-applying them on a freshly-painted background would erase paper
      continue;
    }
    octx.strokeStyle = INK_COLOR;
    octx.lineWidth = 3.2 * Math.min(sx, sy);
    octx.beginPath();
    octx.moveTo(s.points[0].x * sx, s.points[0].y * sy);
    for (let i = 1; i < s.points.length; i++) {
      octx.lineTo(s.points[i].x * sx, s.points[i].y * sy);
    }
    octx.stroke();
  }
  // Re-rasterize against a fresh paper layer so erase strokes are accounted for:
  // simplest correct approach — composite the live canvas (which already has erases applied)
  // onto a paper background.
  const off2 = document.createElement('canvas');
  off2.width = size; off2.height = size;
  const o2 = off2.getContext('2d');
  o2.fillStyle = PAPER_COLOR;
  o2.fillRect(0, 0, size, size);
  o2.drawImage(pad, 0, 0, pad.width, pad.height, 0, 0, size, size);
  return off2.toDataURL('image/png');
}

// ---------- AI call ----------
async function fetchProse({ f, fileNo, officer }) {
  const userInputs = {
    file_number: fileNo,
    rarity: f.rarity,
    era: f.era,
    craftsmanship_score: Number(f.craft.toFixed(1)),
    strokes: f.strokeCount,
    aspect: f.aspectLabel,
    proposed_sum_dollars: f.proposedSum,
    officer: officer
  };

  const messages = [
    {
      role: 'system',
      content: [
        "You are the senior provenance officer at the Northbrook Civic Museum, a fictional minor American institution founded in 1894.",
        "Your task: write THREE short paragraphs of an internal acquisition letter pleading the Board of Trustees to purchase a single unidentifiable artifact for an absurd sum. Mock-bureaucratic, gravely earnest, slightly desperate.",
        "Use the FIXED appraisal figures the user provides — do NOT invent or alter rarity, era, craftsmanship, strokes, aspect, or proposed sum. Reference them by name in your prose, but do not relist them as a table (the letter already has a table).",
        "Constraints:",
        "- THREE paragraphs only. Each 2-4 sentences. No headings. No lists. No emojis. No hashtags.",
        "- Do NOT begin with 'Dear Board of Trustees' (that salutation is already on the letter). Begin in medias res.",
        "- Do NOT sign off with a name (signature block is already present).",
        "- Voice: civic-museum officer, dignified, faintly Old-New-England, faintly desperate. Specific concrete details about the object's *form* drawn from the figures (e.g. an artifact of vertically dominant aspect 'leans, in the manner of a votive standard').",
        "- Avoid: 'I am pleased', 'I am writing to', 'in conclusion'. Avoid generic museum-speak ('priceless', 'stunning', 'unique opportunity').",
        "- Insist quietly that the proposed sum is reasonable, even modest, given the figures. Reference one specific feature (era OR rarity OR aspect) to motivate the asking price.",
        "Output JSON: {\"paragraphs\": [\"...\", \"...\", \"...\"]}. Exactly three strings."
      ].join("\n")
    },
    {
      role: 'user',
      content: "Appraisal figures (FIXED, do not modify):\n" + JSON.stringify(userInputs, null, 2)
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages,
        max_tokens: 500,
        response_format: 'json_object'
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let parsed = null;
    try { parsed = JSON.parse(data.content || '{}'); } catch (_) { parsed = null; }
    if (parsed && Array.isArray(parsed.paragraphs) && parsed.paragraphs.length >= 2) {
      return parsed.paragraphs.slice(0, 4).map(s => String(s).trim()).filter(Boolean);
    }
  } catch (_) {}

  return deterministicProse(f, fileNo, officer);
}

function deterministicProse(f, fileNo, officer) {
  const sum = fmtMoney(f.proposedSum);
  return [
    "It falls to this Office to commend, with the gravity the case demands, the artifact catalogued under " + fileNo + " and entered into the registers as Fig. 1. Its presumed era — " + f.era + " — is, in the considered opinion of the staff, the only honest reading available to us; finer dating must await the Board's leave to engage outside counsel.",
    "Concerning craftsmanship, the figure of " + f.craft.toFixed(1) + " out of ten is to be read as a *defended* rating, the staff having debated it through two unbroken afternoons. The aspect — " + f.aspectLabel + " — is unmistakable to the eye, and indeed it is on the strength of this proportion, and of the rarity classification (" + f.rarity + "), that the Office urges expedited action.",
    "The proposed acquisition sum of " + sum + " is, the Office submits, the lower bound of any defensible figure. The Board will note that delay invites private interest, and the Office cannot in conscience guarantee that the artifact will return to civic hands once it has departed them. We beg the Board's earliest reply."
  ];
}

function renderProse(el, paragraphs) {
  el.innerHTML = '';
  for (const p of paragraphs) {
    const node = document.createElement('p');
    node.textContent = p;
    el.appendChild(node);
  }
  el.classList.add('revealed');
}

// ---------- Restart ----------
$('restart').addEventListener('click', () => {
  $('letter-view').classList.add('hidden');
  $('draw-view').classList.remove('hidden');
  $('prose-block').classList.remove('revealed');
  $('prose-block').innerHTML = '<div class="prose-skel"><div class="prose-line"></div><div class="prose-line"></div><div class="prose-line"></div><div class="prose-line short"></div></div>';
  clearAll();
  window.scrollTo({ top: 0, behavior: 'instant' });
});

// ---------- Share ----------
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}
window.share = share;

// ---------- Bring it up ----------
window.addEventListener('resize', () => {
  // preserve strokes geometry; just rescale canvas backing
  const oldW = CSSW, oldH = CSSH;
  sizeCanvas();
  // strokes are stored in CSS px relative to old size — rescale
  if (oldW > 0 && oldH > 0 && (oldW !== CSSW || oldH !== CSSH)) {
    const sx = CSSW / oldW, sy = CSSH / oldH;
    for (const s of strokes) {
      for (const p of s.points) { p.x *= sx; p.y *= sy; }
    }
    redraw();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  sizeCanvas();
  updateFeaturesLive();
});

// also size on first frame in case DOMContentLoaded already ran
if (document.readyState !== 'loading') {
  sizeCanvas();
  updateFeaturesLive();
}
