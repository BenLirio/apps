// Sketch Trial — Bureau of Forensic Sketch Evaluation
// Deterministic stroke-geometry analysis → archetype verdict → riso wanted poster

const SLUG = 'sketch-trial';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

// ------------------------------------------------------------------
// Crime catalog (16 absurd-but-petty crimes; each chosen by daily-rotating seed)
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
// 30-archetype catalog. Each has the bureau-poster fixings.
// The verdict is deterministic — we map metrics + crime-seed onto this list.
// ------------------------------------------------------------------
const ARCHETYPES = [
  { name: "The Lateral Brunch Bandit",      age: [28, 36], wear: "performative running shoes", aka: "the Avocado Ghost" },
  { name: "The Petty Cash Phantom",         age: [42, 58], wear: "a beige half-zip",           aka: "Receipts McGraw" },
  { name: "The Open-Plan Ogre",             age: [34, 47], wear: "noise-canceling headphones", aka: "He Who Heats Salmon" },
  { name: "The Carpool Lane Cassanova",     age: [26, 38], wear: "wraparound sunglasses",      aka: "The Solo Diamond" },
  { name: "The Inbox Incendiary",           age: [29, 44], wear: "a lanyard from a 2019 conference", aka: "Two-Sigma Dave" },
  { name: "The Spice Rack Vigilante",       age: [31, 49], wear: "a pristine apron with no stains", aka: "The Cumin Auditor" },
  { name: "The Costco Counterfeiter",       age: [33, 52], wear: "a flour-dusted cardigan (suspect)", aka: "Rotisserie Pete" },
  { name: "The Fruit Bowl Hostage-Taker",   age: [25, 39], wear: "an HR-issued employee-of-the-month pin", aka: "The Ninth-Day Grape" },
  { name: "The Single-Floor Elevator Sphinx", age: [37, 55], wear: "leather loafers and a sigh", aka: "The Atrium Whisperer" },
  { name: "The Office Pen Pilgrim",         age: [22, 33], wear: "three pens in one pocket",   aka: "The Bic Migrator" },
  { name: "The Trial Subscription Houdini", age: [19, 29], wear: "a hoodie and a free t-shirt", aka: "The 14-Day Ghost" },
  { name: "The Matcha Skeptic",             age: [24, 35], wear: "a tote bag with one earnest book", aka: "The Counter-Lurker" },
  { name: "The One-Star Avenger",           age: [33, 51], wear: "a Bluetooth earpiece in 2026", aka: "The Napkin Inspector" },
  { name: "The Metal Fork Marauder",        age: [27, 45], wear: "a slightly-too-clean tupperware", aka: "Tines McGee" },
  { name: "The Printer Tray Defector",      age: [30, 48], wear: "a clip-on badge dangling at the wrong angle", aka: "Out-of-Toner Toni" },
  { name: "The Pedestrian-Mall Motorist",   age: [40, 60], wear: "a polo and a confident misunderstanding", aka: "The Bollard Tester" },
  { name: "The No-Agenda Calendar Goblin",  age: [35, 52], wear: "a Patagonia fleece dating to 2017", aka: "Sync-Up Steve" },
  { name: "The Yoga Mat Reverser",          age: [29, 41], wear: "a bamboo-fiber tank top",    aka: "The Wrong-Way Warrior" },
  { name: "The Wake Double-Dipper",         age: [44, 62], wear: "a tie chosen for the buffet", aka: "Black-Tie Crouton" },
  { name: "The Rotisserie Reaper",          age: [36, 54], wear: "a tote stained with rosemary", aka: "The Plastic Bag Smuggler" },
  { name: "The Library Book Returner-of-Doom", age: [29, 43], wear: "a cardigan with a coffee horizon", aka: "Spine-Cracker Sue" },
  { name: "The Polite Tailgater",           age: [31, 47], wear: "a knit beanie indoors",       aka: "Two-Foot Tony" },
  { name: "The Quiet Loud-Talker",          age: [38, 52], wear: "a hands-free earpiece, on",   aka: "Decibel Dan" },
  { name: "The Punctuation Outlaw",         age: [21, 31], wear: "a thrifted blazer over a meme tee", aka: "The Comma Splicer" },
  { name: "The Aggressively Polite Driver", age: [55, 70], wear: "driving gloves in spring",    aka: "Mr. After-You" },
  { name: "The Fluorescent-Light Whisperer", age: [27, 38], wear: "a pencil skirt and conviction", aka: "The Bulb Inspector" },
  { name: "The Tip-Jar Architect",          age: [23, 34], wear: "an apron with three button pins", aka: "Round-Up Rita" },
  { name: "The Group Chat Necromancer",     age: [26, 39], wear: "a soft hoodie at 11:43pm",    aka: "The 'remember when' Reviver" },
  { name: "The Salad Bar Strategist",       age: [33, 50], wear: "a slightly-bowed plate",      aka: "The Topping Triangulator" },
  { name: "The Espresso Window Loiterer",   age: [28, 42], wear: "a denim jacket and 2.5 dogs", aka: "Macchiato Mike" }
];

// ------------------------------------------------------------------
// Hash + seeded RNG (deterministic given drawing + crime)
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
function pickSeeded(arr, seed) { return arr[seed % arr.length]; }

// Daily-rotating crime: today's date hashed into the crimes list
function todaysCrimeIndex() {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return hashStr(key) % CRIMES.length;
}

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const state = {
  strokes: [],          // [{points: [{x,y,t}], color}]
  current: null,
  crimeIdx: 0,
  caseNo: '',
  metrics: null,
  archetype: null
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
// Canvas (HiDPI-aware via offscreen-render scale)
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
  // Use rAF after first layout to dodge first-load stretch
  requestAnimationFrame(resize);
  // Re-size on viewport changes
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
  }

  // Pointer events — covers mouse + touch + pen uniformly
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  // Suppress gestures / context-menu hijacks on the drawing surface
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
  // Skip jitter
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.6) return;
  state.current.points.push(p);
  drawStroke(state.current, true);
}
function onPointerUp(ev) {
  if (!state.current) return;
  // Drop empty/dot strokes that only have one point — convert to a small dot
  if (state.current.points.length === 1) {
    const p = state.current.points[0];
    state.current.points.push({ x: p.x + 0.6, y: p.y + 0.6, t: p.t + 1 });
    drawStroke(state.current, true);
  }
  state.current = null;
}

function drawStroke(stroke, partial) {
  if (partial) {
    // Append the last segment to whatever's on the canvas
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
    state.metrics = null;
    state.archetype = null;
    redraw();
    updateStrokeCount();
    els['canvas-overlay'].classList.remove('gone');
    showStage('brief-stage');
    state.crimeIdx = (state.crimeIdx + 1 + Math.floor(Math.random() * (CRIMES.length - 1))) % CRIMES.length;
    setCrime();
  });
}

// ------------------------------------------------------------------
// Stroke geometry: deterministic feature extraction
// ------------------------------------------------------------------
function computeMetrics(strokes, W, H) {
  // Degenerate input → minimal metrics
  if (!strokes || strokes.length === 0) {
    return null;
  }

  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  let totalLen = 0;
  let totalPts = 0;
  let inkPx = 0;
  let xSum = 0, ySum = 0;
  let xSumWeighted = 0;
  let strokeLengths = [];
  let strokeCount = 0;
  let angleChanges = 0;
  let sharpAngles = 0;

  for (const s of strokes) {
    const pts = s.points;
    if (!pts || pts.length < 2) continue;
    strokeCount++;
    let len = 0;
    let prevAngle = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
      xSum += p.x;
      ySum += p.y;
      totalPts++;
      if (i > 0) {
        const dx = p.x - pts[i-1].x;
        const dy = p.y - pts[i-1].y;
        const seg = Math.hypot(dx, dy);
        len += seg;
        inkPx += seg * 3; // approx pen width 3
        if (seg > 0.2) {
          const ang = Math.atan2(dy, dx);
          if (prevAngle !== null) {
            let d = ang - prevAngle;
            // wrap to [-pi, pi]
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            const ad = Math.abs(d);
            angleChanges += ad;
            if (ad > Math.PI / 3) sharpAngles++;
          }
          prevAngle = ang;
        }
      }
    }
    strokeLengths.push(len);
    totalLen += len;
  }

  if (totalPts === 0) return null;

  const cx = xSum / totalPts;
  const cy = ySum / totalPts;
  const bbW = Math.max(1, xMax - xMin);
  const bbH = Math.max(1, yMax - yMin);
  const aspect = bbW / bbH; // > 1 wide; < 1 tall
  const inkDensity = Math.min(1, inkPx / (bbW * bbH + 1));
  const avgStrokeLen = totalLen / Math.max(1, strokeCount);
  const verticalAsymmetry = ((cy - (yMin + bbH / 2)) / bbH); // - = top-heavy, + = bottom-heavy
  const horizontalAsymmetry = ((cx - (xMin + bbW / 2)) / bbW);
  const spikiness = sharpAngles / Math.max(1, totalPts);
  const centroidOffset = Math.hypot((cx - W/2) / W, (cy - H/2) / H);

  return {
    strokeCount,
    totalPts,
    totalLen: Math.round(totalLen),
    avgStrokeLen: Math.round(avgStrokeLen),
    aspect: round2(aspect),
    bbW: Math.round(bbW),
    bbH: Math.round(bbH),
    inkDensity: round3(inkDensity),
    verticalAsymmetry: round3(verticalAsymmetry),
    horizontalAsymmetry: round3(horizontalAsymmetry),
    spikiness: round3(spikiness),
    centroidOffset: round3(centroidOffset),
    angleSum: Math.round(angleChanges * 10) / 10,
    canvasW: W,
    canvasH: H
  };
}
const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;

// Compress geometry into a stable digest used as the seed
function metricsDigest(m) {
  if (!m) return 0;
  const s = [
    m.strokeCount, m.totalLen, m.avgStrokeLen,
    Math.round(m.aspect * 100),
    Math.round(m.inkDensity * 1000),
    Math.round(m.verticalAsymmetry * 1000),
    Math.round(m.horizontalAsymmetry * 1000),
    Math.round(m.spikiness * 1000),
    Math.round(m.centroidOffset * 1000)
  ].join('|');
  return hashStr(s);
}

// ------------------------------------------------------------------
// Verdict mapping (deterministic): combine metrics digest with crime
// ------------------------------------------------------------------
function pickArchetype(metrics, crimeIdx) {
  if (!metrics) {
    // Fallback for "submitted with no drawing" — pick by crime alone
    return ARCHETYPES[crimeIdx % ARCHETYPES.length];
  }
  const seed = (metricsDigest(metrics) ^ hashStr('crime:' + crimeIdx)) >>> 0;
  return ARCHETYPES[seed % ARCHETYPES.length];
}

function buildExhibits(m) {
  if (!m) return [];
  const aspectLabel = m.aspect > 1.15 ? 'wide-set' : m.aspect < 0.85 ? 'narrow' : 'symmetrical';
  const inkLabel = m.inkDensity > 0.18 ? 'heavy-handed' : m.inkDensity > 0.07 ? 'measured' : 'restrained';
  const spikeLabel = m.spikiness > 0.06 ? 'severe' : m.spikiness > 0.025 ? 'tense' : 'soft';
  const vertLabel = m.verticalAsymmetry > 0.08 ? 'low-set jaw' : m.verticalAsymmetry < -0.08 ? 'high brow' : 'balanced';

  return [
    { k: `bounding aspect`,         v: `${m.aspect}  (${aspectLabel})` },
    { k: `ink density`,             v: `${(m.inkDensity * 100).toFixed(1)}%  (${inkLabel})` },
    { k: `stroke count`,            v: `${m.strokeCount}` },
    { k: `avg stroke length`,       v: `${m.avgStrokeLen}px` },
    { k: `vertical asymmetry`,      v: `${m.verticalAsymmetry}  (${vertLabel})` },
    { k: `eyebrow spikiness index`, v: `${m.spikiness}  (${spikeLabel})` },
    { k: `centroid offset`,         v: `${m.centroidOffset}` }
  ];
}

// ------------------------------------------------------------------
// Last-seen line: optional one LLM call, with deterministic fallback
// ------------------------------------------------------------------
function deterministicLastSeen(arch, crime, m, seed) {
  const rng = mulberry32(seed);
  const places = [
    "near the cold-brew tap of an unfamiliar kitchen",
    "lurking by a public-library return slot at 4:51pm",
    "approaching a shared spice rack with intent",
    "exiting an elevator one floor below their stated destination",
    "reaching toward an unattended fruit bowl",
    "loitering near a printer with no paper in tray 2",
    "merging without signaling at moderate speeds",
    "queueing for matcha with apparent unease",
    "circling the breakroom in a clockwise pattern",
    "stationed at a buffet, hovering over the dip",
    "browsing greeting cards with no recipient in mind",
    "asking the barista a clarifying question of low yield",
    "watching the printer warm up like it owes them money",
    "making aggressive eye contact with a self-checkout screen"
  ];
  const tells = [
    "no apparent remorse",
    "a half-empty stainless water bottle, sweating",
    "a confident misunderstanding of office hours",
    "earpods in, conversing audibly with no one",
    "a slightly bowed posture suggesting a recent buffet",
    "knowingly broken Bluetooth earpiece",
    "an air of professional vagueness",
    "fingertips faintly stained with whatever they touched last"
  ];
  const place = places[Math.floor(rng() * places.length)];
  const tell = tells[Math.floor(rng() * tells.length)];
  const ageMin = arch.age[0], ageMax = arch.age[1];
  const ageRange = ageMax - ageMin + 1;
  const age = ageMin + Math.floor(rng() * ageRange);
  return { age, line: `last seen ${place} wearing ${arch.wear}, ${tell}.` };
}

async function maybeLLMLine(arch, crime, m, seed) {
  // Deterministic baseline (used as fallback + age source)
  const det = deterministicLastSeen(arch, crime, m, seed);

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: 'You write a single "last seen" line for a fake wanted-poster. ONE sentence, max 22 words. Start with "last seen". Mention an oddly specific location or behavior. Do not name the suspect. Do not name the crime. No emojis. No quotes. No hashtags. Tone: deadpan-bureaucratic, faintly absurd.'
          },
          {
            role: 'user',
            content: `Suspect archetype: ${arch.name}. Known to wear: ${arch.wear}. Crime under investigation: ${crime}. Write the "last seen" line.`
          }
        ]
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let line = (data.content || '').trim();
    // Sanitize: strip leading/trailing quotes, trim length, ensure starts lowercase 'last seen'
    line = line.replace(/^["'\s]+|["'\s]+$/g, '');
    if (line && line.length < 240) {
      // Ensure it begins "last seen" or close
      if (!/^last seen/i.test(line)) line = 'last seen ' + line.replace(/^[a-z]/, c => c.toLowerCase());
      return { age: det.age, line };
    }
  } catch (_) { /* fall through */ }
  return det;
}

// ------------------------------------------------------------------
// Stage flow
// ------------------------------------------------------------------
function showStage(id) {
  ['brief-stage','loading-stage','poster-stage'].forEach(s => {
    els[s].hidden = (s !== id);
  });
  // Scroll to top of stage
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

const LOADING_LINES = [
  "measuring eyebrow severity…",
  "indexing jaw set against the catalog…",
  "running stroke geometry through the archetype filter…",
  "cross-referencing with prior offenders…",
  "consulting the senior sketch artist…",
  "stamping case file CONFIDENTIAL…",
  "verifying centroid offset…"
];

async function onSubmit() {
  // If they truly drew nothing, still allow it (deterministic verdict by crime)
  const m = computeMetrics(state.strokes, cw, ch);
  state.metrics = m;
  const crime = CRIMES[state.crimeIdx];
  const arch = pickArchetype(m, state.crimeIdx);
  state.archetype = arch;

  showStage('loading-stage');
  // Cycle loading lines
  let i = 0;
  els['loading-line'].textContent = LOADING_LINES[i];
  const ticker = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    els['loading-line'].textContent = LOADING_LINES[i];
  }, 600);

  // Capture sketch before LLM call (so it's ready regardless of network)
  const sketchDataUrl = renderPosterSketchPNG();

  // Seed for deterministic last-seen fallback
  const seed = (metricsDigest(m || {}) ^ hashStr('lastseen:' + crime)) >>> 0;
  const lastSeenP = maybeLLMLine(arch, crime, m, seed);

  // Min loading dwell: 1500ms — long enough to read at least 2 lines
  const minDwell = new Promise(r => setTimeout(r, 1500));
  const [lastSeen] = await Promise.all([lastSeenP, minDwell]);

  clearInterval(ticker);
  renderPoster(arch, lastSeen, m, crime, sketchDataUrl);
  showStage('poster-stage');
  els['share'].classList.add('show');
}

// Render the user's actual sketch as a PNG at a reasonable size
function renderPosterSketchPNG() {
  const out = document.createElement('canvas');
  const W = 800, H = 800;
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  // Paper background
  octx.fillStyle = '#fffaf0';
  octx.fillRect(0, 0, W, H);
  // Light cross-hairs
  octx.strokeStyle = 'rgba(20,33,61,0.08)';
  octx.lineWidth = 1;
  octx.beginPath(); octx.moveTo(0, H/2); octx.lineTo(W, H/2); octx.stroke();
  octx.beginPath(); octx.moveTo(W/2, 0); octx.lineTo(W/2, H); octx.stroke();
  // Suspect strokes (scaled)
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
  // Border + label
  octx.strokeStyle = '#14213d';
  octx.lineWidth = 6;
  octx.strokeRect(3, 3, W - 6, H - 6);
  // Pink "EXHIBIT A" stamp
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

function renderPoster(arch, lastSeen, m, crime, sketchDataUrl) {
  els['poster-name'].textContent = arch.name.toUpperCase();
  els['poster-meta'].textContent = `aka "${arch.aka}"  ·  age ${lastSeen.age}`;
  els['poster-charge'].textContent = `CHARGE: ${crime}`;
  els['poster-lastseen'].textContent = lastSeen.line;
  els['poster-sketch'].src = sketchDataUrl;

  // Geometric exhibits list
  const list = els['poster-exhibits'];
  list.innerHTML = '';
  for (const ex of buildExhibits(m)) {
    const li = document.createElement('li');
    const k = document.createElement('span'); k.className = 'ex-key'; k.textContent = ex.k;
    const v = document.createElement('span'); v.className = 'ex-val'; v.textContent = ex.v;
    li.appendChild(k);
    li.appendChild(v);
    list.appendChild(li);
  }
  // File / date
  els['poster-file'].textContent = state.caseNo;
  const d = new Date();
  els['poster-date'].textContent = d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------
// Crime prominence
// ------------------------------------------------------------------
function setCrime() {
  els['crime-text'].textContent = CRIMES[state.crimeIdx];
}
function setCaseNo() {
  // Stable per-session case number for narrative anchoring
  const n = (Math.floor(Math.random() * 9000) + 1000);
  state.caseNo = `BFSE-${new Date().getFullYear()}-${n}`;
  els['case-no'].textContent = `CASE NO. ${state.caseNo}`;
}

// ------------------------------------------------------------------
// Share
// ------------------------------------------------------------------
function share() {
  const arch = state.archetype;
  const text = arch
    ? `the bureau identified me as ${arch.name}.`
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
window.share = share;

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
function init() {
  bindEls();
  // Daily-rotating crime, but allow re-roll
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
