// Doodle Diagnostics Bureau
// Mechanic: 20s doodle → deterministic geometric features → archetype lookup → LLM 4-line diagnosis
// Determinism: same strokes always produce the same verdict + tag. LLM diagnosis is cached in case-store payload.

const SLUG = 'doodle-diagnostics-bureau';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';

const DRAW_SECONDS = 20;
const CANVAS_W = 600;
const CANVAS_H = 380;

/* ============ STATE ============ */
let strokes = [];           // Array<Array<{x:number,y:number,t:number}>>
let currentStroke = null;
let drawing = false;
let evaluationActive = false;
let timerId = null;
let timerEnd = 0;
let countdownLeft = DRAW_SECONDS;
let subjectName = '';
let evalDate = '';

/* ============ DOM ============ */
const $ = (id) => document.getElementById(id);

/* ============ HASH (deterministic) ============ */
function hash(str) {
  let h = 2166136261 >>> 0; // FNV-1a 32
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/* ============ DATE ============ */
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

/* ============ CANVAS DRAWING ============ */
function getPadCtx() { return $('pad').getContext('2d'); }

function setupCanvasResolution(canvas) {
  // logical drawing coords are 0..600 x 0..380 (CSS aspect-ratio set in CSS)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / CANVAS_W, 0, 0, canvas.height / CANVAS_H, 0, 0);
  return ctx;
}

function eventToPoint(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  const cx = t.clientX, cy = t.clientY;
  const x = ((cx - rect.left) / rect.width) * CANVAS_W;
  const y = ((cy - rect.top) / rect.height) * CANVAS_H;
  return { x: clamp(x, 0, CANVAS_W), y: clamp(y, 0, CANVAS_H), t: performance.now() };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawAllStrokes(ctx, strokesArr) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#2a3da8'; // ballpoint blue
  for (const s of strokesArr) {
    if (s.length < 2) {
      // dot
      ctx.beginPath();
      ctx.arc(s[0].x, s[0].y, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = '#2a3da8';
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.stroke();
  }
}

function startStrokeAt(p) {
  if (!evaluationActive) return;
  drawing = true;
  currentStroke = [p];
  strokes.push(currentStroke);
  $('canvas-empty').style.display = 'none';
}

function continueStrokeTo(p) {
  if (!drawing || !currentStroke) return;
  const last = currentStroke[currentStroke.length - 1];
  const dx = p.x - last.x, dy = p.y - last.y;
  if (dx * dx + dy * dy < 1.0) return; // skip jittery dupes
  currentStroke.push(p);
  // incremental draw
  const ctx = getPadCtx();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4; ctx.strokeStyle = '#2a3da8';
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function endStroke() {
  drawing = false;
  currentStroke = null;
}

function bindCanvas() {
  const c = $('pad');
  setupCanvasResolution(c);
  // Re-setup on resize
  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      setupCanvasResolution(c);
      drawAllStrokes(getPadCtx(), strokes);
    }, 80);
  });

  c.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    startStrokeAt(eventToPoint(e, c));
  });
  c.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    e.preventDefault();
    continueStrokeTo(eventToPoint(e, c));
  });
  c.addEventListener('pointerup', (e) => {
    e.preventDefault();
    endStroke();
  });
  c.addEventListener('pointercancel', endStroke);
  c.addEventListener('pointerleave', () => { if (drawing) endStroke(); });
}

/* ============ TIMER ============ */
function startEvaluation() {
  if (evaluationActive) return;
  subjectName = ($('subject-name').value || '').trim();
  evalDate = todayStr();
  evaluationActive = true;
  strokes = [];
  drawAllStrokes(getPadCtx(), strokes);
  $('canvas-empty').style.display = 'none';
  $('start-btn').disabled = true;
  $('start-btn').textContent = 'Drawing time...';
  $('clear-btn').disabled = true;

  $('timer-overlay').style.display = 'flex';
  countdownLeft = DRAW_SECONDS;
  $('timer-overlay').querySelector('.timer-num').textContent = countdownLeft;
  timerEnd = performance.now() + DRAW_SECONDS * 1000;

  function tick() {
    const remainMs = Math.max(0, timerEnd - performance.now());
    const remainS = Math.ceil(remainMs / 1000);
    if (remainS !== countdownLeft) {
      countdownLeft = remainS;
      const el = $('timer-overlay').querySelector('.timer-num');
      if (el) el.textContent = countdownLeft;
    }
    if (remainMs <= 0) {
      finishEvaluation();
      return;
    }
    timerId = requestAnimationFrame(tick);
  }
  timerId = requestAnimationFrame(tick);
}

function finishEvaluation() {
  if (!evaluationActive) return;
  evaluationActive = false;
  endStroke();
  $('timer-overlay').style.display = 'none';
  $('start-btn').disabled = false;
  $('start-btn').textContent = 'Begin 20s evaluation';
  $('clear-btn').disabled = false;

  if (totalPoints(strokes) < 4) {
    // empty / barely-anything submission — let them try again, with a voiced prompt
    $('canvas-empty').style.display = 'flex';
    $('canvas-empty').textContent = "the bureau requires at least one mark — try again";
    $('canvas-empty').style.color = '#6e1c14';
    return;
  }

  // Show loading then reveal
  $('loading').style.display = 'block';
  setTimeout(() => buildAndReveal(strokes, subjectName, evalDate), 1200);
}

function totalPoints(strokesArr) {
  let n = 0;
  for (const s of strokesArr) n += s.length;
  return n;
}

/* ============ FEATURE EXTRACTION ============ */
// All deterministic. Quantized to integers for stable hashing.
function extractFeatures(strokesArr) {
  const allPts = [];
  for (const s of strokesArr) for (const p of s) allPts.push(p);
  if (allPts.length === 0) {
    return { strokeCount: 0, pointCount: 0, totalLength: 0, bboxArea: 1,
             density: 0, curvature: 0, symmetry: 0, coverage: 0,
             avgStrokeLen: 0, longestStrokeRatio: 0 };
  }

  // bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const bboxArea = bw * bh;

  // total length + per-stroke length
  let totalLength = 0;
  let longestStroke = 0;
  let curvatureSum = 0;
  let curvatureSamples = 0;
  for (const s of strokesArr) {
    let strokeLen = 0;
    for (let i = 1; i < s.length; i++) {
      const dx = s[i].x - s[i - 1].x;
      const dy = s[i].y - s[i - 1].y;
      strokeLen += Math.hypot(dx, dy);
    }
    totalLength += strokeLen;
    if (strokeLen > longestStroke) longestStroke = strokeLen;

    // approximate curvature: angular change per unit length
    for (let i = 2; i < s.length; i++) {
      const ax = s[i - 1].x - s[i - 2].x;
      const ay = s[i - 1].y - s[i - 2].y;
      const bx = s[i].x - s[i - 1].x;
      const by = s[i].y - s[i - 1].y;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 0.5 || lb < 0.5) continue;
      const cos = (ax * bx + ay * by) / (la * lb);
      const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
      curvatureSum += ang;
      curvatureSamples++;
    }
  }
  const curvature = curvatureSamples > 0 ? (curvatureSum / curvatureSamples) : 0;
  const density = totalLength / bboxArea; // ink per pixel^2 in bbox

  // symmetry: mirror across vertical center of bbox; sample-based
  // For each point, check distance to mirrored counterpart's nearest point.
  const cx = (minX + maxX) / 2;
  const sample = sampleEvenly(allPts, 80);
  let symScore = 0;
  let symN = 0;
  for (const p of sample) {
    const mx = 2 * cx - p.x;
    const my = p.y;
    const nearest = nearestPointDist(sample, mx, my);
    // normalize by bbox diagonal
    const diag = Math.hypot(bw, bh) || 1;
    symScore += 1 - Math.min(1, nearest / (diag * 0.25));
    symN++;
  }
  const symmetry = symN > 0 ? symScore / symN : 0;

  // coverage: fraction of canvas the bbox occupies
  const coverage = bboxArea / (CANVAS_W * CANVAS_H);

  const strokeCount = strokesArr.length;
  const pointCount = allPts.length;
  const avgStrokeLen = totalLength / Math.max(1, strokeCount);
  const longestStrokeRatio = longestStroke / Math.max(1, totalLength);

  return {
    strokeCount,
    pointCount,
    totalLength: Math.round(totalLength),
    bboxArea: Math.round(bboxArea),
    density: round3(density),
    curvature: round3(curvature),
    symmetry: round3(symmetry),
    coverage: round3(coverage),
    avgStrokeLen: Math.round(avgStrokeLen),
    longestStrokeRatio: round3(longestStrokeRatio),
    bw: Math.round(bw),
    bh: Math.round(bh),
  };
}

function sampleEvenly(pts, n) {
  if (pts.length <= n) return pts.slice();
  const out = [];
  const step = pts.length / n;
  for (let i = 0; i < n; i++) out.push(pts[Math.floor(i * step)]);
  return out;
}

function nearestPointDist(pts, x, y) {
  let best = Infinity;
  for (const p of pts) {
    const dx = p.x - x, dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

function round3(v) { return Math.round(v * 1000) / 1000; }

/* ============ ARCHETYPE TABLE ============ */
// 12 hand-curated subtypes. Selection is deterministic from features via scoring.
// Each subtype has tags from 2016 catalog + a fallback diagnosis.
const SUBTYPES = [
  {
    id: 'romantic',
    name: 'The Notebook-Margin Romantic',
    tag: '#aesthetic #soft grunge #lana del rey #flower crown #hopelessromantic',
    fallback: "Subject demonstrates pronounced loop-tightness and recurrent symmetric motifs.\nReport indicates a tendency to write feelings down in pencil, then erase them, then re-write them in pen.\nBureau notes suggest unresolved fixation on a person who already has a Tumblr.\nRecommended intervention: stop signing your name in cursive over their initials.",
  },
  {
    id: 'anarchist',
    name: 'The Algebra-Class Anarchist',
    tag: '#punk #f the police #anarchy #DIY #dontcare',
    fallback: "Subject displays high pen-lift count combined with aggressive directional changes.\nMargins indicate an instinctive hostility to ruled lines and to authority more broadly.\nBureau observes that the doodle was completed in roughly the time it takes to be sent to the principal.\nRecommended intervention: redirect this energy into anything other than the band you are about to start.",
  },
  {
    id: 'mystic',
    name: 'The Lowercase Spiral-Bound Mystic',
    tag: '#witchy #moon phases #crystal grid #stim #cosmic',
    fallback: "Subject's stroke geometry shows orbital, recursive forms with low symmetric anchoring.\nThe Bureau interprets this as evidence of preferring vibes to outcomes.\nNotebook is presumed to contain at least one drawing of a moon phase.\nRecommended intervention: it is okay to also do the homework, in addition to the energy work.",
  },
  {
    id: 'dissociator',
    name: 'The Third-Period Dissociator',
    tag: '#mood #vibes #honestly #idk #reblog if you relate',
    fallback: "Subject produced minimal ink in the allotted time, with wide unmarked regions.\nBureau records suggest the eyes were open but the subject was not, technically, present.\nThis is consistent with the third-period demographic.\nRecommended intervention: a snack, water, and possibly a different elective.",
  },
  {
    id: 'overachiever',
    name: 'The Color-Coded Overachiever',
    tag: '#studyblr #productivity #5amclub #aesthetic notes #planner',
    fallback: "Subject completed the doodle with high coverage, tight curvature control, and clean termination.\nBureau notes that the page was used efficiently, as if billable.\nThis is consistent with someone who alphabetizes their gel pens.\nRecommended intervention: please leave at least one weekend free of structure.",
  },
  {
    id: 'edgelord',
    name: 'The Hot-Topic Edgelord',
    tag: '#emo #mcr #black parade #scene #notlikeothergirls',
    fallback: "Subject's strokes feature aggressive verticality, dense crosshatching, and a refusal to round corners.\nThe Bureau registers a faint impression of song lyrics that were not on the assignment.\nThis is consistent with a peer group of one.\nRecommended intervention: the eyeliner is fine; the worldview could use airing out.",
  },
  {
    id: 'dreamer',
    name: 'The Window-Seat Dreamer',
    tag: '#daydream #escape #tumblrgirl #wanderlust #soft',
    fallback: "Subject's drawing drifts toward the upper-right quadrant with extended unbroken strokes.\nThe Bureau identifies this as a directional yearning toward Anywhere But Here.\nIt is statistically associated with not knowing what was on the worksheet.\nRecommended intervention: the dream is valid; the algebra is also still due.",
  },
  {
    id: 'comedian',
    name: 'The Back-Of-The-Class Comedian',
    tag: '#meme #relatable #ifeel #lol #vine',
    fallback: "Subject deployed many short, decisive strokes — the mechanical signature of someone drawing a tiny man saying something.\nBureau staff have, for legal reasons, declined to caption it.\nThis subtype tests below grade level on quietness.\nRecommended intervention: yes, it's funny; please save it for after the bell.",
  },
  {
    id: 'list-maker',
    name: 'The Bullet-Journal Catastrophist',
    tag: '#bujo #lists #anxiety mood #self care #tracker',
    fallback: "Subject defaulted to grid-like, repetitive linework with strong baseline alignment.\nBureau finds this consistent with a coping strategy of writing tasks down so they can be ignored on a printed schedule.\nThe doodle, while orderly, is also a list.\nRecommended intervention: one (1) day per week without a tracker.",
  },
  {
    id: 'collector',
    name: 'The Sticker-Page Hoarder',
    tag: '#kawaii #pastel #sticker #washi #aesthetic',
    fallback: "Subject covered the page with many small, isolated marks rather than continuous form.\nBureau interprets this as a deep-seated belief that more small good things will, eventually, equal one large good thing.\nThis is statistically correct.\nRecommended intervention: continue, but please use both sides of the paper.",
  },
  {
    id: 'theorist',
    name: 'The Conspiracy-Diagram Theorist',
    tag: '#truth #wake up #questioneverything #connections #researchblr',
    fallback: "Subject produced sprawling connected line-work with many directional changes and crossing strokes.\nThe Bureau notes that everything in the drawing appears to be linked to everything else, which is concerning.\nThis subtype almost certainly has a side blog.\nRecommended intervention: the connections are real; some of them are also coincidence.",
  },
  {
    id: 'minimalist',
    name: 'The One-Line-Wonder Minimalist',
    tag: '#minimal #aesthetic #lines #less is more #tumblrart',
    fallback: "Subject produced a single (or near-single) continuous stroke that nonetheless implies an entire scene.\nThe Bureau is impressed and slightly suspicious.\nThis subtype tends to caption photos with one (1) lowercase word.\nRecommended intervention: keep the restraint; expand the vocabulary.",
  },
];

// Deterministic scoring: each subtype is a vector; we pick the highest score.
// Inputs are normalized features. Same features → same archetype.
function pickSubtype(features) {
  const f = features;

  // Normalized signals (roughly 0..1)
  const dense = clamp01(f.density * 60);                  // typical density ~0.005..0.04
  const curvy = clamp01(f.curvature / (Math.PI * 0.5));   // 0..1 (avg angle / 90°)
  const sym = clamp01(f.symmetry);                        // 0..1
  const cov = clamp01(f.coverage * 4);                    // bbox up to ~1/4 of canvas → 1
  const lifts = clamp01(f.strokeCount / 30);              // 30+ pen-lifts saturates
  const longRatio = clamp01(f.longestStrokeRatio * 2);    // single dominant stroke
  const small = clamp01(f.avgStrokeLen / 80);             // higher = longer avg strokes
  const tinyMarks = clamp01(1 - small);                   // many tiny marks
  const sparse = clamp01(1 - dense);
  const spread = clamp01(cov);                            // wide canvas use

  // Score each subtype
  const scores = {
    romantic:    1.0 * curvy + 0.9 * sym + 0.4 * dense - 0.3 * lifts,
    anarchist:   1.1 * lifts + 0.8 * (1 - curvy) + 0.4 * dense - 0.3 * sym,
    mystic:      1.0 * curvy + 0.7 * (1 - sym) + 0.5 * longRatio - 0.2 * lifts,
    dissociator: 1.2 * sparse + 0.7 * (1 - lifts) + 0.4 * (1 - cov),
    overachiever: 1.0 * cov + 0.7 * dense + 0.5 * curvy + 0.3 * lifts - 0.2 * (1 - sym),
    edgelord:    0.9 * dense + 0.7 * (1 - curvy) + 0.5 * lifts + 0.3 * (1 - sym),
    dreamer:     0.9 * longRatio + 0.6 * curvy + 0.4 * (1 - dense) + 0.3 * cov,
    comedian:    1.1 * tinyMarks + 0.8 * lifts + 0.3 * (1 - sym),
    'list-maker': 1.0 * (1 - curvy) + 0.7 * lifts + 0.5 * sym - 0.2 * longRatio,
    collector:   1.0 * lifts + 0.9 * tinyMarks + 0.5 * spread + 0.3 * (1 - dense),
    theorist:    0.9 * dense + 0.7 * (1 - sym) + 0.6 * spread + 0.4 * lifts,
    minimalist:  1.3 * longRatio + 0.7 * (1 - lifts) + 0.4 * (1 - dense),
  };

  // Tiebreaker: deterministic hash of feature signature.
  const sig = [f.strokeCount, f.pointCount, f.totalLength, f.bboxArea,
               f.density, f.curvature, f.symmetry, f.coverage,
               f.avgStrokeLen, f.longestStrokeRatio].join('|');
  const h = hash(sig);

  let best = null;
  let bestScore = -Infinity;
  for (const sub of SUBTYPES) {
    const s = scores[sub.id] + ((h % 1000) / 1000) * 0.0001 * SUBTYPES.indexOf(sub);
    if (s > bestScore) { bestScore = s; best = sub; }
  }
  return best;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/* ============ DIAGNOSIS (LLM, with deterministic fallback) ============ */
async function generateDiagnosis(subtype, features, name) {
  const messages = [
    {
      role: 'system',
      content:
        "You are the Bureau of Adolescent Doodleography, writing a deadpan school-counselor evaluation. " +
        "Output EXACTLY four short lines. Each line is one full sentence. No bullets. No emojis. No headers. No quotes. " +
        "Tone: dry, clinical, faintly bemused, 2016-era school counselor pretending stroke geometry is a real diagnostic. " +
        "Each line should reference one of the provided geometric measurements as if it were behaviorally meaningful. " +
        "End the fourth line with a 'Recommended intervention:' clause that is gentle but absurd. " +
        "Do not invent a different subtype than the one given. Do not write more than ~26 words per line."
    },
    {
      role: 'user',
      content:
        `Adolescent Subtype (verdict): ${subtype.name}\n` +
        `Subject: ${name || 'anonymous'}\n` +
        `Geometric features:\n` +
        `- pen-lifts: ${features.strokeCount}\n` +
        `- avg stroke length (px): ${features.avgStrokeLen}\n` +
        `- ink density (length per bbox area): ${features.density}\n` +
        `- avg curvature (radians per joint): ${features.curvature}\n` +
        `- symmetry index (0-1): ${features.symmetry}\n` +
        `- canvas coverage: ${features.coverage}\n` +
        `Write the four-line evaluation now.`
    },
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 220 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const text = ((data && data.content) || '').trim();
    if (!text) return subtype.fallback;
    // sanity: must have at least 2 newlines or 2 sentence breaks; otherwise fall back
    const cleaned = cleanFourLines(text);
    return cleaned || subtype.fallback;
  } catch (_) {
    return subtype.fallback;
  }
}

function cleanFourLines(text) {
  // Normalize: split on newlines first, fall back to sentence splits.
  let lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 3) {
    lines = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  }
  if (lines.length === 0) return null;
  // Strip leading bullets / numbering
  lines = lines.map(l => l.replace(/^[-*•\d.\)\s]+/, '').trim()).filter(Boolean);
  // Take up to 4
  const out = lines.slice(0, 4);
  if (out.length < 2) return null;
  return out.join('\n');
}

/* ============ REVEAL ============ */
async function buildAndReveal(strokesArr, name, dateStr) {
  const features = extractFeatures(strokesArr);
  const subtype = pickSubtype(features);
  const diagnosis = await generateDiagnosis(subtype, features, name);

  $('loading').style.display = 'none';
  $('form').style.display = 'none';

  // Compose verdict view
  paintVerdict({ strokesArr, name, dateStr, features, subtype, diagnosis });

  // Save to case-store, replace URL
  const payload = compactPayload({ strokesArr, name, dateStr, features, subtype, diagnosis });
  saveAndReplaceUrl(payload);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function paintVerdict({ strokesArr, name, dateStr, features, subtype, diagnosis }) {
  $('verdict').style.display = 'block';

  // exhibit replay
  const rcv = $('replay-canvas');
  // sync resolution after layout
  requestAnimationFrame(() => {
    setupCanvasResolution(rcv);
    drawAllStrokes(rcv.getContext('2d'), strokesArr);
  });

  $('exhibit-caption').textContent =
    'submitted by ' + (name ? name : 'anonymous subject') + ' — ' + (dateStr || todayStr());

  $('m-strokes').textContent = String(features.strokeCount);
  $('m-density').textContent = formatDensity(features.density);
  $('m-loops').textContent = formatCurvature(features.curvature);
  $('m-sym').textContent = (features.symmetry * 100).toFixed(0) + '%';

  $('verdict-name').textContent = subtype.name;
  $('diagnosis-text').textContent = diagnosis;
  $('rec-tag').textContent = subtype.tag;
  $('filed-date').textContent = dateStr || todayStr();
}

function formatDensity(d) {
  if (d < 0.004) return 'sparse';
  if (d < 0.012) return 'moderate';
  if (d < 0.025) return 'heavy';
  return 'saturated';
}
function formatCurvature(c) {
  if (c < 0.25) return 'rigid (low)';
  if (c < 0.55) return 'measured';
  if (c < 0.85) return 'loopy';
  return 'orbital (high)';
}

/* ============ COMPACT SHARE PAYLOAD ============ */
// Strokes are quantized (each coord 0..255) to fit case-store budget.
function compactPayload(state) {
  const { strokesArr, name, dateStr, features, subtype, diagnosis } = state;
  // Quantize: x → 0..255 (CANVAS_W=600), y → 0..255 (CANVAS_H=380)
  const qStrokes = strokesArr.map(s =>
    s.map(p => ({
      x: Math.round((p.x / CANVAS_W) * 255),
      y: Math.round((p.y / CANVAS_H) * 255),
    }))
  );
  // Down-sample very long strokes to keep payload small (~max 60 points/stroke)
  const slim = qStrokes.map(s => simplify(s, 60));

  return {
    v: 1,
    n: name ? name.slice(0, 40) : '',
    d: dateStr || todayStr(),
    sub: subtype.id,
    diag: diagnosis,
    f: {
      sc: features.strokeCount,
      pc: features.pointCount,
      tl: features.totalLength,
      ba: features.bboxArea,
      de: features.density,
      cu: features.curvature,
      sy: features.symmetry,
      co: features.coverage,
      al: features.avgStrokeLen,
      lr: features.longestStrokeRatio,
    },
    s: slim,
  };
}

function simplify(arr, max) {
  if (arr.length <= max) return arr;
  const out = [];
  const step = arr.length / max;
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  // ensure last point preserved
  out.push(arr[arr.length - 1]);
  return out;
}

function expandPayload(p) {
  const sub = SUBTYPES.find(s => s.id === p.sub) || SUBTYPES[0];
  const strokesArr = (p.s || []).map(s =>
    s.map(pt => ({
      x: (pt.x / 255) * CANVAS_W,
      y: (pt.y / 255) * CANVAS_H,
    }))
  );
  const features = {
    strokeCount: p.f?.sc ?? 0,
    pointCount: p.f?.pc ?? 0,
    totalLength: p.f?.tl ?? 0,
    bboxArea: p.f?.ba ?? 1,
    density: p.f?.de ?? 0,
    curvature: p.f?.cu ?? 0,
    symmetry: p.f?.sy ?? 0,
    coverage: p.f?.co ?? 0,
    avgStrokeLen: p.f?.al ?? 0,
    longestStrokeRatio: p.f?.lr ?? 0,
  };
  return {
    strokesArr,
    name: p.n || '',
    dateStr: p.d || '',
    features,
    subtype: sub,
    diagnosis: p.diag || sub.fallback,
  };
}

/* ============ CASE-STORE ============ */
async function saveAndReplaceUrl(payload) {
  const blob = JSON.stringify(payload);
  if (blob.length > 7800) {
    // truncate strokes if absolutely necessary
    payload.s = payload.s.map(s => simplify(s, 30));
  }
  try {
    const res = await fetch(CASE_STORE_BASE + '/case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, data: JSON.stringify(payload) })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const { id } = await res.json();
    if (id) {
      const url = new URL(location.href);
      url.search = '?c=' + id;
      url.hash = '';
      history.replaceState(null, '', url.toString());
    }
  } catch (_) { /* swallow — share will fall back to current url */ }
}

async function loadFromCaseStore(id) {
  try {
    const res = await fetch(CASE_STORE_BASE + '/case/' + encodeURIComponent(id));
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || !j.data) return null;
    return JSON.parse(j.data);
  } catch (_) {
    return null;
  }
}

/* ============ SHARE ============ */
function share() {
  const url = location.href;
  const title = document.title;
  const text = "the bureau has filed your evaluation.";
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => alert('Link copied — share your evaluation.'))
      .catch(() => prompt('Copy your share link:', url));
  } else {
    prompt('Copy your share link:', url);
  }
}
window.share = share;

/* ============ RESET ============ */
function resetForm() {
  // strip any ?c=
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  history.replaceState(null, '', url.toString());

  strokes = [];
  evaluationActive = false;
  $('verdict').style.display = 'none';
  $('form').style.display = 'block';
  $('canvas-empty').style.display = 'flex';
  $('canvas-empty').textContent = 'tap or drag to begin doodling';
  $('canvas-empty').style.color = '';
  $('start-btn').disabled = false;
  $('start-btn').textContent = 'Begin 20s evaluation';
  $('clear-btn').disabled = false;
  $('subject-name').value = '';
  $('subject-date').value = todayStr();
  setTimeout(() => {
    setupCanvasResolution($('pad'));
    drawAllStrokes(getPadCtx(), strokes);
  }, 0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.resetForm = resetForm;

/* ============ INIT ============ */
async function init() {
  bindCanvas();
  $('subject-date').value = todayStr();

  $('clear-btn').addEventListener('click', () => {
    if (evaluationActive) return;
    strokes = [];
    drawAllStrokes(getPadCtx(), strokes);
    $('canvas-empty').style.display = 'flex';
    $('canvas-empty').textContent = 'tap or drag to begin doodling';
    $('canvas-empty').style.color = '';
  });
  $('start-btn').addEventListener('click', startEvaluation);

  // Hydrate from share link if present
  const params = new URLSearchParams(location.search);
  const id = params.get('c');
  if (id) {
    // Try to load — show form briefly, then verdict, no LLM call
    const loaded = await loadFromCaseStore(id);
    if (loaded && loaded.sub) {
      const state = expandPayload(loaded);
      $('form').style.display = 'none';
      $('verdict').style.display = 'block';
      paintVerdict(state);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    // fall through to fresh form
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
