const SLUG = 'exquisite-corpse';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

const W = 100, H = 200, FOLD = 100;
const MAX_STROKES = 5;
const MAX_POINTS_PER_STROKE = 25;

const ARCHETYPES = [
  { name: "The Gilded Snarler", bin: "Gildatus irasci" },
  { name: "The Twilight Hussar", bin: "Velocirex nocturnus" },
  { name: "Princess of Seven Ankles", bin: "Regina septemcrurii" },
  { name: "The Unassuming Lurker", bin: "Modestus vigilans" },
  { name: "The Bottled Empress", bin: "Imperatrix amphora" },
  { name: "The Paper-Lantern Hound", bin: "Canis lanternus" },
  { name: "The Grief-Soaked Heron", bin: "Ardea maestus" },
  { name: "The Thundering Salesman", bin: "Vendor tonitrus" },
  { name: "The Bureaucratic Owl", bin: "Strix ministerium" },
  { name: "The Pocket-Lint Serpent", bin: "Serpens textilis" },
  { name: "The Vagrant Archbishop", bin: "Episcopus errans" },
  { name: "The Cold-Handed Violinist", bin: "Musicus frigidus" },
  { name: "The Dyspeptic Plover", bin: "Charadrius queritor" },
  { name: "The Drunkard's Apology", bin: "Paenitens ebrius" },
  { name: "The Marbled Accountant", bin: "Calculator marmoreus" },
  { name: "The Overlong Dachshund", bin: "Longus canis" },
  { name: "The Regrettable Duchess", bin: "Ducissa pudenda" },
  { name: "The Iron-Ribbed Cherub", bin: "Cherubinus ferreus" },
  { name: "The Somnambulant Postman", bin: "Nuntius somnians" },
  { name: "The Exclamatory Crab", bin: "Cancer acclamans" },
  { name: "The Unchurched Ibex", bin: "Ibex profanus" },
  { name: "The Gentleman's Mistake", bin: "Error gentilis" },
  { name: "The Moss-Gowned Bailiff", bin: "Bailivus muscinus" },
  { name: "The Quiet Professor", bin: "Professor taciturnus" },
  { name: "The Notary's Companion", bin: "Socius notarii" },
  { name: "The Spinster's Delight", bin: "Deliciae coelibis" },
  { name: "The Anxious Hedgehog", bin: "Erinaceus trepidus" },
  { name: "The Unfashionable Beetle", bin: "Scarabaeus obsoletus" },
  { name: "The Sighing Sphinx", bin: "Sphinx suspirans" },
  { name: "The Accidental Clergyman", bin: "Presbyter fortuitus" }
];

const FALLBACK_BLURBS = [
  "Seen chiefly at dusk, and chiefly by those who have failed an examination within the preceding fortnight. Subsists upon regret and the corners of unattended pastries.",
  "A solitary creature of damp parish halls. Builds its nest from discarded sermons and one modestly unpaid bill.",
  "Emits a low, reproachful humming when discussed in polite company. Feeds chiefly upon minor civic grievances.",
  "Prefers the undersides of second-hand furniture. Its mating rituals consist of slow, deliberate rearrangements of the kitchenware.",
  "Nests in the shoes of departing guests. The species subsists almost entirely upon overheard compliments.",
  "Ordinarily indolent, though prone to sudden bursts of industry when observed. Found exclusively at the outskirts of reputable towns.",
  "Its cry resembles a kettle being politely scolded. Prefers the society of widows and wet Tuesday afternoons.",
  "Moves only by inconvenience. The specimen reportedly grows one inch for every appointment the observer has missed.",
  "A pensive creature of libraries and under-tended gardens. Known to exchange letters with its own shadow.",
  "Subsists upon the exhaled sighs of disappointed headmasters. Conspicuously refuses to acknowledge the second hand of a clock.",
  "Of uncertain origin, and firmer opinion. Feeds chiefly upon the hesitations of others, taken warm.",
  "Habitual in its dislikes. Prefers north-facing windows and correspondence conducted in a smaller hand than is strictly necessary."
];

// ---------- state ----------
const STATE = {
  phase: 'landing',
  top: [],
  bot: [],
  anchors: [],
  archetype: null,
  seed: 0,
  blurb: ''
};

// ---------- utilities ----------
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function extractFeatures(strokes) {
  const strokeCount = strokes.length;
  const points = strokes.flat();
  const pointCount = points.length;
  if (pointCount === 0) return { strokeCount: 0, pointCount: 0, aspect: 10, angularity: 0, sym: 0, sig: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const aspect = Math.round((w / h) * 10);
  let angSum = 0, angN = 0;
  for (const s of strokes) {
    for (let i = 2; i < s.length; i++) {
      const a1 = Math.atan2(s[i-1].y - s[i-2].y, s[i-1].x - s[i-2].x);
      const a2 = Math.atan2(s[i].y - s[i-1].y, s[i].x - s[i-1].x);
      let d = Math.abs(a2 - a1);
      if (d > Math.PI) d = 2 * Math.PI - d;
      angSum += d; angN++;
    }
  }
  const angularity = angN > 0 ? Math.round((angSum / angN) * 10) : 0;
  const cx = (minX + maxX) / 2;
  let l = 0, r = 0;
  for (const p of points) { if (p.x < cx) l++; else r++; }
  const sym = Math.abs(l - r);
  const sig = (strokeCount * 73 + pointCount * 11 + aspect * 37 + angularity * 19 + sym * 7) | 0;
  return { strokeCount, pointCount, aspect, angularity, sym, sig };
}

function pickArchetype(topFeat, botFeat) {
  const combined = ((topFeat.sig * 31 + botFeat.sig * 17 + topFeat.strokeCount * 11 + botFeat.strokeCount * 13 + topFeat.angularity * 5 + botFeat.angularity * 3) >>> 0);
  const a = ARCHETYPES[combined % ARCHETYPES.length];
  return { name: a.name, bin: a.bin, seed: combined };
}

function fallbackBlurb(archetype) {
  return FALLBACK_BLURBS[hash(archetype.name) % FALLBACK_BLURBS.length];
}

function plateNumber(seed) {
  return 100 + (seed % 900);
}

function victorianDate() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date();
  const day = d.getDate();
  const suf = (day % 10 === 1 && day !== 11) ? 'st'
            : (day % 10 === 2 && day !== 12) ? 'nd'
            : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  return `${day}${suf} ${months[d.getMonth()]}, 1867`;
}

// ---------- stroke shaping ----------
function subsample(s, max) {
  if (s.length <= max) return s.slice();
  const out = [s[0]];
  const stride = (s.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) out.push(s[Math.round(i * stride)]);
  out.push(s[s.length - 1]);
  return out;
}

function trimStrokes(strokes) {
  const filtered = strokes.filter(s => s.length >= 2);
  const picked = filtered.slice(0, MAX_STROKES);
  return picked.map(s => subsample(s, MAX_POINTS_PER_STROKE));
}

// ---------- encoding ----------
function encodeBytes(top, bot) {
  const bytes = [];
  for (const strokes of [top, bot]) {
    bytes.push(strokes.length & 0xFF);
    for (const s of strokes) {
      const pc = Math.min(s.length, 255);
      bytes.push(pc);
      if (pc === 0) continue;
      let px = clamp(Math.round(s[0].x), 0, 255);
      let py = clamp(Math.round(s[0].y), 0, 255);
      bytes.push(px, py);
      for (let i = 1; i < pc; i++) {
        const nx = clamp(Math.round(s[i].x), 0, 255);
        const ny = clamp(Math.round(s[i].y), 0, 255);
        let dx = clamp(nx - px, -128, 127);
        let dy = clamp(ny - py, -128, 127);
        bytes.push(dx < 0 ? dx + 256 : dx);
        bytes.push(dy < 0 ? dy + 256 : dy);
        px += dx; py += dy;
      }
    }
  }
  return bytes;
}

function decodeBytes(bytes) {
  const result = { top: [], bot: [] };
  let i = 0;
  for (const key of ['top', 'bot']) {
    if (i >= bytes.length) break;
    const strokeCount = bytes[i++];
    for (let j = 0; j < strokeCount; j++) {
      if (i >= bytes.length) break;
      const pc = bytes[i++];
      const stroke = [];
      if (pc === 0) { result[key].push(stroke); continue; }
      if (i + 1 >= bytes.length) break;
      let px = bytes[i++];
      let py = bytes[i++];
      stroke.push({ x: px, y: py });
      for (let k = 1; k < pc && i + 1 < bytes.length; k++) {
        let dx = bytes[i++]; if (dx > 127) dx -= 256;
        let dy = bytes[i++]; if (dy > 127) dy -= 256;
        px += dx; py += dy;
        stroke.push({ x: px, y: py });
      }
      result[key].push(stroke);
    }
  }
  return result;
}

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64ToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ---------- anchors ----------
function computeAnchors(topStrokes) {
  const anchors = [];
  const seen = new Set();
  for (const s of topStrokes) {
    if (s.length === 0) continue;
    // take the last point if it's near the fold
    const last = s[s.length - 1];
    if (last.y >= FOLD - 14) {
      const key = Math.round(last.x / 4);
      if (!seen.has(key)) { anchors.push({ x: last.x }); seen.add(key); }
    }
    // also any segment that crosses the fold-zone
    for (let i = 1; i < s.length; i++) {
      if (s[i].y >= FOLD - 6 && s[i-1].y < FOLD - 6) {
        const key = Math.round(s[i].x / 4);
        if (!seen.has(key)) { anchors.push({ x: s[i].x }); seen.add(key); }
      }
    }
  }
  return anchors.slice(0, 5);
}

// ---------- rendering ----------
function sizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const ww = Math.max(1, Math.round(rect.width * dpr));
  const hh = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== ww || canvas.height !== hh) {
    canvas.width = ww;
    canvas.height = hh;
  }
  return { ctx: canvas.getContext('2d'), cw: canvas.width, ch: canvas.height };
}

function drawStrokesOn(canvas, strokes, opts = {}) {
  const { ctx, cw, ch } = sizeCanvas(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.scale(cw / W, ch / H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = opts.color || '#1e1812';
  ctx.lineWidth = opts.width != null ? opts.width : 1.4;
  for (const s of strokes) {
    if (!s || s.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.stroke();
  }
  if (opts.liveStroke && opts.liveStroke.length >= 2) {
    const s = opts.liveStroke;
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.stroke();
  }
  if (opts.anchors && opts.anchors.length) {
    ctx.fillStyle = '#b8891a';
    for (const a of opts.anchors) {
      ctx.beginPath();
      ctx.arc(a.x, FOLD, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(184,137,26,0.25)';
    for (const a of opts.anchors) {
      ctx.beginPath();
      ctx.arc(a.x, FOLD, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderFull(canvas) {
  drawStrokesOn(canvas, [...STATE.top, ...STATE.bot], { width: 1.5 });
  const { ctx, cw, ch } = sizeCanvas(canvas);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = 'rgba(80,50,20,0.25)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  const y = Math.round((FOLD / H) * ch) + 0.5;
  ctx.moveTo(0, y);
  ctx.lineTo(cw, y);
  ctx.stroke();
  ctx.restore();
}

// ---------- drawing input binding ----------
function bindDrawing(canvas, opts) {
  const { yMin, yMax, getStrokes, onStroke, anchors } = opts;
  let drawing = false;
  let live = null;

  function toVirtual(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width * W, 0, W);
    const y = (clientY - rect.top) / rect.height * H;
    return { x, y };
  }

  function render() {
    drawStrokesOn(canvas, getStrokes(), {
      liveStroke: live,
      anchors: anchors || null
    });
  }

  function start(e) {
    e.preventDefault();
    if (getStrokes().length >= MAX_STROKES) return;
    const t = e.touches ? e.touches[0] : e;
    const { x, y } = toVirtual(t.clientX, t.clientY);
    if (y < yMin - 2 || y > yMax + 2) return;
    const cy = clamp(y, yMin, yMax);
    live = [{ x, y: cy }];
    drawing = true;
    render();
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const { x, y } = toVirtual(t.clientX, t.clientY);
    const cy = clamp(y, yMin, yMax);
    const last = live[live.length - 1];
    if (Math.abs(cy - last.y) < 0.5 && Math.abs(x - last.x) < 0.5) return;
    live.push({ x, y: cy });
    render();
  }

  function end(e) {
    if (!drawing) return;
    e && e.preventDefault && e.preventDefault();
    drawing = false;
    if (live && live.length >= 2) onStroke(live);
    live = null;
    render();
  }

  canvas.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);

  const ro = new ResizeObserver(() => render());
  ro.observe(canvas);

  return { render, destroy: () => ro.disconnect() };
}

// ---------- screen management ----------
const screens = ['landing', 'p1', 'handoff', 'p2', 'reveal'];
function showScreen(name) {
  STATE.phase = name;
  for (const s of screens) {
    const el = document.getElementById('screen-' + s);
    if (!el) continue;
    el.classList.toggle('hidden', s !== name);
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------- AI call ----------
async function generateBlurb(archetype, topFeat, botFeat) {
  const key = 'blurb_v1_' + archetype.name.replace(/\s+/g, '_') + '_' + archetype.seed;
  try {
    const cached = localStorage.getItem(key);
    if (cached) return cached;
  } catch (_) {}

  const messages = [
    {
      role: 'system',
      content: "You are Professor Ichabod Prentiss, Victorian naturalist, author of the 1867 Cryptozoological Plates. Given a hybrid creature's name and a few observed traits, you write its entry for the field guide: exactly two sentences, under 45 words total. First sentence on its habits or temperament; second on habitat or diet. Formal 1867 prose, dry wit, no modern references, no quotation marks, no preface. Output the two sentences only."
    },
    {
      role: 'user',
      content: `Name: ${archetype.name} (${archetype.bin}). Observed features: upper half has ${topFeat.strokeCount} stroke(s), angularity ${topFeat.angularity}/31; lower half has ${botFeat.strokeCount} stroke(s), angularity ${botFeat.angularity}/31; overall symmetry offset ${topFeat.sym + botFeat.sym}. Write the field-guide entry.`
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 140 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const text = (data && data.content ? data.content : '').trim();
    if (!text) throw new Error('empty');
    try { localStorage.setItem(key, text); } catch (_) {}
    return text;
  } catch (_) {
    return fallbackBlurb(archetype);
  }
}

// ---------- reveal ----------
async function doReveal() {
  showScreen('reveal');
  const loadingEl = document.getElementById('loading');
  const frameEl = document.getElementById('plate-frame');
  const shareEl = document.getElementById('share');
  loadingEl.style.display = 'block';
  frameEl.style.display = 'none';
  shareEl.style.display = 'none';

  const topFeat = extractFeatures(STATE.top);
  const botFeat = extractFeatures(STATE.bot);
  const archetype = pickArchetype(topFeat, botFeat);
  STATE.archetype = archetype;
  STATE.seed = archetype.seed;

  const start = Date.now();
  const blurb = await generateBlurb(archetype, topFeat, botFeat);
  const wait = Math.max(0, 900 - (Date.now() - start));
  await new Promise(r => setTimeout(r, wait));

  STATE.blurb = blurb;

  document.getElementById('creature-name').textContent = archetype.name;
  document.getElementById('creature-binomial').textContent = archetype.bin;
  document.getElementById('creature-blurb').textContent = blurb;
  document.getElementById('obs-date').textContent = victorianDate();
  const pn = plateNumber(archetype.seed);
  document.getElementById('plate-num').textContent = pn;
  document.getElementById('plate-num-2').textContent = pn;

  loadingEl.style.display = 'none';
  frameEl.style.display = 'block';
  shareEl.style.display = 'flex';

  // Render full creature
  requestAnimationFrame(() => {
    renderFull(document.getElementById('cvs-reveal'));
  });

  // Write fragment for sharing (unless we loaded from one already)
  if (!STATE.fromShare) {
    const encoded = bytesToB64(encodeBytes(trimStrokes(STATE.top), trimStrokes(STATE.bot)));
    history.replaceState(null, '', '#s=' + encoded);
  }
}

// ---------- share ----------
window.share = function () {
  const url = location.href;
  const title = STATE.archetype ? 'Exquisite Corpse: ' + STATE.archetype.name : 'Exquisite Corpse';
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('#share .primary');
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Link copied';
        setTimeout(() => { btn.textContent = prev; }, 1800);
      }
    }).catch(() => prompt('Copy the plate link:', url));
  } else {
    prompt('Copy the plate link:', url);
  }
};

// ---------- init ----------
function resetState() {
  STATE.top = [];
  STATE.bot = [];
  STATE.anchors = [];
  STATE.archetype = null;
  STATE.blurb = '';
  STATE.fromShare = false;
  document.getElementById('plate-num').textContent = '—';
  document.getElementById('plate-num-2').textContent = '—';
  document.getElementById('hint-1').textContent = '\u00A0';
  document.getElementById('hint-2').textContent = '\u00A0';
}

function updateHint1() {
  const n = STATE.top.length;
  const el = document.getElementById('hint-1');
  if (n === 0) el.textContent = 'Draw however you like. 1 to 5 strokes.';
  else if (n >= MAX_STROKES) el.textContent = 'Five strokes is quite enough — pass when ready.';
  else el.textContent = `${n} stroke${n === 1 ? '' : 's'} recorded.`;
}

function updateHint2() {
  const n = STATE.bot.length;
  const el = document.getElementById('hint-2');
  if (n === 0) el.textContent = 'Complete what you think Player One began. 1 to 5 strokes.';
  else if (n >= MAX_STROKES) el.textContent = 'Five strokes is quite enough — reveal when ready.';
  else el.textContent = `${n} stroke${n === 1 ? '' : 's'} recorded.`;
}

function initP1() {
  const canvas = document.getElementById('cvs-edit');
  STATE.top = [];
  updateHint1();
  const ctrl = bindDrawing(canvas, {
    yMin: 0,
    yMax: FOLD,
    getStrokes: () => STATE.top,
    onStroke: (s) => {
      STATE.top.push(s);
      updateHint1();
      ctrl.render();
    }
  });
  requestAnimationFrame(() => ctrl.render());

  document.getElementById('undo-1').onclick = () => {
    STATE.top.pop();
    updateHint1();
    ctrl.render();
  };
  document.getElementById('done-1').onclick = () => {
    if (STATE.top.length === 0) {
      document.getElementById('hint-1').textContent = 'Nothing has been drawn yet — give it a stroke or two.';
      return;
    }
    STATE.anchors = computeAnchors(STATE.top);
    showScreen('handoff');
  };
}

function initP2() {
  const canvas = document.getElementById('cvs-edit-2');
  STATE.bot = [];
  updateHint2();
  const ctrl = bindDrawing(canvas, {
    yMin: FOLD,
    yMax: H,
    getStrokes: () => STATE.bot,
    onStroke: (s) => {
      STATE.bot.push(s);
      updateHint2();
      ctrl.render();
    },
    anchors: STATE.anchors
  });
  requestAnimationFrame(() => ctrl.render());

  document.getElementById('undo-2').onclick = () => {
    STATE.bot.pop();
    updateHint2();
    ctrl.render();
  };
  document.getElementById('done-2').onclick = () => {
    if (STATE.bot.length === 0) {
      document.getElementById('hint-2').textContent = 'Nothing has been drawn yet — complete the specimen.';
      return;
    }
    doReveal();
  };
}

function wire() {
  document.getElementById('begin').onclick = () => {
    resetState();
    history.replaceState(null, '', location.pathname + location.search);
    showScreen('p1');
    initP1();
  };
  document.getElementById('p2-ready').onclick = () => {
    showScreen('p2');
    initP2();
  };
  document.getElementById('again').onclick = () => {
    resetState();
    history.replaceState(null, '', location.pathname + location.search);
    showScreen('landing');
  };
}

function tryLoadFromFragment() {
  const m = location.hash.match(/^#s=(.+)$/);
  if (!m) return false;
  try {
    const bytes = b64ToBytes(m[1]);
    const { top, bot } = decodeBytes(bytes);
    if (!top.length && !bot.length) return false;
    STATE.top = top;
    STATE.bot = bot;
    STATE.fromShare = true;
    doReveal();
    return true;
  } catch (_) {
    return false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  wire();
  if (!tryLoadFromFragment()) {
    showScreen('landing');
  }
});
