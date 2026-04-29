// Stop The Line — The Daily Replica
// Single-tap timing toy. 10 rounds. Date-seeded daily. Risograph/brutalist editorial aesthetic.

'use strict';

// ---------- Word bank (pinned, punchy UPPERCASE) ----------
const WORD_BANK = [
  'SCANDAL', 'CORRUPTION', 'CAT', 'EMBEZZLE', 'BANANA', 'OVERTHROW', 'LAUNDRY', 'TRUCE',
  'MOON', 'BRIBE', 'PUDDING', 'FIASCO', 'PIGEON', 'BLACKOUT', 'LAWSUIT', 'TOAST',
  'COUP', 'PLOT', 'OWL', 'GRIDLOCK', 'PANIC', 'SUBPOENA', 'RACCOON', 'RUMOR',
  'HEIST', 'OUTAGE', 'CHEESE', 'TREATY', 'MELTDOWN', 'BIRTHDAY', 'BANKRUPT', 'SWAN',
  'PROTEST', 'FERRY', 'BOGUS', 'GHOST', 'WEDDING', 'SNAKE', 'KICKBACK', 'DRIZZLE',
  'MUTINY', 'CELERY', 'UPSET', 'BLIMP', 'DELAY', 'JURY', 'MAYOR', 'CANAL',
  'COLLAPSE', 'REPRIEVE', 'BRUNCH', 'DYNASTY', 'DENTIST', 'STAMPEDE', 'OSTRICH', 'EDICT',
  'REFUND', 'PARADE', 'TURBINE', 'SOFA', 'PROBE', 'VERDICT', 'OTTER', 'REGRET',
  'BADGER', 'RALLY', 'VETO', 'MUFFIN', 'FORGERY', 'CASSEROLE', 'TANGLE', 'CLERK',
  'AUDIT', 'EVACUATE', 'HOSTAGE', 'GNOME', 'ANTHEM', 'RECALL', 'WAFFLE', 'DISASTER'
];

// ---------- Filler-headline template bank ----------
const TEMPLATES = [
  'MAYOR DENIES CLAIMS OF {X}',
  'LOCAL READERS BAFFLED BY {X}',
  'COURT WEIGHS SECOND {X}',
  'PUBLIC RECORDS HINT AT {X}',
  'SOURCES CONFIRM LATE-NIGHT {X}',
  'CITY COUNCIL TABLES {X} MOTION',
  'WITNESSES DESCRIBE SUDDEN {X}',
  'CHIEF RESIGNS AMID {X}',
  'NEIGHBORS STUNNED BY BACKYARD {X}',
  'COMMITTEE TO REVIEW {X}',
  'BREAKING: {X} SPOTTED AT CITY HALL',
  'WEATHER SERVICE UPGRADES {X} WATCH',
  'OFFICIALS DOWNPLAY {X}',
  'OPINION PAGE DIVIDED OVER {X}',
  'HIGH SCHOOL CANCELS {X} EVENT',
  'AUDIT REVEALS QUIET {X}',
  'DOWNTOWN STILL REELING FROM {X}',
  'NEW POLL ASKS: IS {X} OK?',
  'EXCLUSIVE: INSIDE THE {X} PROBE',
  'STATE FAIR TO FEATURE LIVE {X}'
];

// ---------- Seed utilities (mulberry32) ----------
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function niceDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[m - 1]}. ${d}, ${y}`;
}

// ---------- Plan today's run ----------
// Picks 10 distinct target words; for each round builds a ~600-word scroll ribbon by
// instantiating templates with seeded filler words and inserts the target exactly once
// mid-stream at a seeded position.
function buildRun(seedStr) {
  const rng = mulberry32(hashStr(seedStr));
  // Pick 10 distinct indices from WORD_BANK
  const pool = WORD_BANK.slice();
  // Fisher-Yates using rng
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const targets = pool.slice(0, 10);

  const rounds = targets.map((target, idx) => {
    // Filler corpus: words that are NOT the target
    const filler = WORD_BANK.filter(w => w !== target);

    // Build ~26 headlines separated by "  //  "
    const headlines = [];
    for (let k = 0; k < 26; k++) {
      const tpl = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
      const w = filler[Math.floor(rng() * filler.length)];
      headlines.push(tpl.replace('{X}', w));
    }

    // Pick a mid-stream insertion point (between headlines 10..18)
    const insertAt = 10 + Math.floor(rng() * 8);
    const targetTpl = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
    const targetHeadline = targetTpl.replace('{X}', target);
    headlines.splice(insertAt, 0, targetHeadline);

    // Speed curve
    const speeds = [240, 280, 320, 360, 400, 440, 480, 520, 560, 600];
    return {
      target,
      targetHeadline,
      speed: speeds[idx],
      headlines,
      insertIdx: insertAt // index in the final headlines array
    };
  });
  return { targets, rounds };
}

// ---------- Printer Titles ----------
// Buckets by average pixel deviation across 10 rounds. Lower is better.
// 6 tiers, playful names.
function bucketTitle(avg) {
  if (avg < 8)   return 'Ink-Blooded Prodigy';
  if (avg < 18)  return 'Masthead Savant';
  if (avg < 35)  return 'Gazette Chief';
  if (avg < 60)  return 'Pamphleteer';
  if (avg < 100) return 'Apprentice Inker';
  return 'Press Saboteur';
}

// ---------- DOM refs ----------
const $ = id => document.getElementById(id);
const startScreen = $('start-screen');
const gameScreen = $('game-screen');
const endScreen = $('end-screen');
const canvas = $('press');
const ctx = canvas.getContext('2d');
const stampEl = $('stamp-overlay');

// ---------- State ----------
const DATE_KEY = todayKey();
let state = {
  mode: 'daily',   // 'daily' | 'practice'
  seed: DATE_KEY,
  runIdx: 0,
  run: null,
  results: [],     // { target, deviation, headline }
  roundActive: false,
  roundStart: 0,
  rafId: null,
  canvasW: 0,
  canvasH: 0,
  // text layout cache
  ribbon: null,    // { text, segments:[{word,x,w}], totalW, fontPx }
};

// ---------- Canvas sizing ----------
function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  // Simple no-DPR path per KB guidance (lo-fi aesthetic). Use CSS pixel buffer.
  canvas.width = Math.max(320, Math.floor(rect.width));
  canvas.height = Math.max(180, Math.floor(rect.height));
  state.canvasW = canvas.width;
  state.canvasH = canvas.height;
}

// ---------- Ribbon layout ----------
// Produces a single long string for a round's scroll + a segment index for the target word.
function layoutRibbon(round) {
  const sep = '   //   ';
  const fontPx = state.canvasW < 380 ? 38 : (state.canvasW < 480 ? 44 : 50);
  ctx.font = `900 ${fontPx}px "Archivo Black", "Rubik Mono One", sans-serif`;

  let cursor = 0;
  const segments = [];
  const text = round.headlines.join(sep);

  // Measure each token across the full text to get each word bbox
  // We'll rebuild segments by splitting on spaces inside each headline
  let runningX = 0;
  const headlineStarts = [];
  for (let i = 0; i < round.headlines.length; i++) {
    headlineStarts.push(runningX);
    const h = round.headlines[i];
    const words = h.split(' ');
    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const wWidth = ctx.measureText(word).width;
      segments.push({ word, x: runningX, w: wWidth, headlineIdx: i });
      runningX += wWidth;
      if (w < words.length - 1) {
        runningX += ctx.measureText(' ').width;
      }
    }
    if (i < round.headlines.length - 1) {
      runningX += ctx.measureText(sep).width;
    }
  }
  const totalW = runningX;

  // Find target word positions: headlines[insertIdx] contains exactly one target
  const targetHeadlineIdx = round.insertIdx;
  const targetSegments = segments.filter(s => s.headlineIdx === targetHeadlineIdx && s.word === round.target);
  // Fallback: match first occurrence anywhere (shouldn't need it)
  const targetSeg = targetSegments[0] || segments.find(s => s.word === round.target);

  return {
    text,
    segments,
    totalW,
    fontPx,
    target: round.target,
    targetSeg,   // { x, w, word, headlineIdx }
    startOffset: 0 // will be set per round
  };
}

// ---------- Render frame ----------
function drawFrame(nowMs) {
  const W = state.canvasW;
  const H = state.canvasH;
  ctx.clearRect(0, 0, W, H);

  // paper background tint
  ctx.fillStyle = '#ebe0c6';
  ctx.fillRect(0, 0, W, H);

  // subtle horizontal ink rules
  ctx.fillStyle = '#14110f';
  ctx.globalAlpha = 0.22;
  ctx.fillRect(0, 18, W, 1);
  ctx.fillRect(0, H - 19, W, 1);
  ctx.globalAlpha = 1;

  const r = state.run.rounds[state.runIdx];
  const ribbon = state.ribbon;
  // pixels per ms
  const pxPerMs = r.speed / 1000;
  const elapsed = nowMs - state.roundStart;
  // offsetX: the text position (in ribbon coords) that currently sits at x=0 of canvas
  // We want the target word to be at center of canvas at the "ideal" time.
  // Ribbon starts off-screen right: at t=0, left edge of ribbon sits at x = W + ribbon.startOffset
  // So draw-x for ribbon coord p is: (W + startOffset) - pxPerMs * elapsed + p
  const ribbonStartX = (W + ribbon.startOffset) - pxPerMs * elapsed;

  // Draw the scrolling headline text
  ctx.font = `900 ${ribbon.fontPx}px "Archivo Black", "Rubik Mono One", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#14110f';

  // Render only segments whose bounding box intersects viewport for perf
  const yMid = Math.round(H / 2);
  const visLeft = -ribbonStartX - 40;
  const visRight = -ribbonStartX + W + 40;

  for (let i = 0; i < ribbon.segments.length; i++) {
    const s = ribbon.segments[i];
    if (s.x + s.w < visLeft) continue;
    if (s.x > visRight) break;
    const drawX = ribbonStartX + s.x;
    // Highlight target word in hot red
    if (s.word === ribbon.target && s.headlineIdx === ribbon.targetSeg.headlineIdx) {
      ctx.fillStyle = '#e5382a';
      ctx.fillText(s.word, drawX, yMid);
      ctx.fillStyle = '#14110f';
    } else {
      ctx.fillText(s.word, drawX, yMid);
    }
  }

  // Draw the guillotine bracket — 60px wide translucent red band at center-x
  const cx = Math.round(W / 2);
  const gWidth = 60;
  ctx.fillStyle = 'rgba(229, 56, 42, 0.16)';
  ctx.fillRect(cx - gWidth / 2, 0, gWidth, H);

  // Bracket verticals
  ctx.strokeStyle = '#e5382a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - gWidth / 2 + 1.5, 4);
  ctx.lineTo(cx - gWidth / 2 + 1.5, H - 4);
  ctx.moveTo(cx + gWidth / 2 - 1.5, 4);
  ctx.lineTo(cx + gWidth / 2 - 1.5, H - 4);
  ctx.stroke();

  // Corner brackets (top + bottom)
  const bk = 14;
  ctx.beginPath();
  ctx.moveTo(cx - gWidth / 2, 4); ctx.lineTo(cx - gWidth / 2 + bk, 4);
  ctx.moveTo(cx + gWidth / 2, 4); ctx.lineTo(cx + gWidth / 2 - bk, 4);
  ctx.moveTo(cx - gWidth / 2, H - 4); ctx.lineTo(cx - gWidth / 2 + bk, H - 4);
  ctx.moveTo(cx + gWidth / 2, H - 4); ctx.lineTo(cx + gWidth / 2 - bk, H - 4);
  ctx.stroke();

  // Dead-center hairline
  ctx.strokeStyle = 'rgba(229, 56, 42, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, 0); ctx.lineTo(cx + 0.5, H);
  ctx.stroke();

  // Check auto-fail condition: target has fully passed guillotine off-screen left
  if (state.roundActive && ribbon.targetSeg) {
    const targetCenter = ribbon.targetSeg.x + ribbon.targetSeg.w / 2;
    const targetScreenX = ribbonStartX + targetCenter;
    // If target's right edge is past left edge of canvas by a safety margin, auto-fail.
    if (ribbonStartX + ribbon.targetSeg.x + ribbon.targetSeg.w < -20) {
      autoFailRound();
      return;
    }
  }

  if (state.roundActive) {
    state.rafId = requestAnimationFrame(drawFrame);
  }
}

// ---------- Round control ----------
function startRound() {
  sizeCanvas();
  const r = state.run.rounds[state.runIdx];
  $('round-n').textContent = String(state.runIdx + 1);
  $('target-word').textContent = r.target;

  state.ribbon = layoutRibbon(r);
  // Give a 600ms lead-in so the reader gets oriented
  state.ribbon.startOffset = 0;
  state.roundStart = performance.now() + 600;
  state.roundActive = true;
  cancelAnimationFrame(state.rafId);
  state.rafId = requestAnimationFrame(drawFrame);
}

function endRound(deviation) {
  if (!state.roundActive) return;
  state.roundActive = false;
  cancelAnimationFrame(state.rafId);
  const r = state.run.rounds[state.runIdx];
  state.results.push({
    target: r.target,
    deviation: Math.round(deviation),
    headline: r.targetHeadline
  });
  showStamp(Math.round(deviation));
  setTimeout(() => {
    state.runIdx++;
    if (state.runIdx >= 10) {
      finishRun();
    } else {
      startRound();
    }
  }, 700);
}

function autoFailRound() {
  endRound(200); // worst bucket, matches spec
}

function handleTap(ev) {
  if (!state.roundActive) return;
  ev.preventDefault();
  const now = performance.now();
  const r = state.run.rounds[state.runIdx];
  const ribbon = state.ribbon;
  const pxPerMs = r.speed / 1000;
  const elapsed = now - state.roundStart;
  if (elapsed < 0) return; // lead-in buffer, ignore extremely early taps
  const ribbonStartX = (state.canvasW + ribbon.startOffset) - pxPerMs * elapsed;
  const targetCenter = ribbon.targetSeg.x + ribbon.targetSeg.w / 2;
  const targetScreenX = ribbonStartX + targetCenter;
  const canvasCenter = state.canvasW / 2;
  const deviation = Math.abs(targetScreenX - canvasCenter);
  // Cap at 200 for sanity if target hasn't arrived yet / has passed far
  endRound(Math.min(deviation, 200));
}

function showStamp(dev) {
  let label = '';
  if (dev < 8)   label = 'CLEAN CUT';
  else if (dev < 18) label = 'SHARP';
  else if (dev < 35) label = 'STAMPED';
  else if (dev < 60) label = 'SMUDGED';
  else if (dev < 100) label = 'WOBBLY';
  else if (dev >= 200) label = 'MISPRINT';
  else               label = 'LATE';
  stampEl.innerHTML = `${label}<span class="stamp-dev">${dev} PX OFF</span>`;
  stampEl.classList.add('on');
  setTimeout(() => stampEl.classList.remove('on'), 550);
}

// ---------- Session finish ----------
function finishRun() {
  const devs = state.results.map(r => r.deviation);
  const avg = devs.reduce((a, b) => a + b, 0) / devs.length;
  const best = state.results.reduce((a, b) => a.deviation < b.deviation ? a : b);
  const title = bucketTitle(avg);

  // Persist best / streak only on the DAILY run
  let streakText = '';
  if (state.mode === 'daily') {
    persistDaily(avg);
    const streak = loadStreak();
    if (streak > 1) streakText = `${streak}-day streak`;
    else streakText = 'New reader';
  } else {
    streakText = 'Practice press';
  }

  // Build clipping DOM
  $('clip-date').textContent = niceDate(DATE_KEY);
  $('clip-head').textContent = `LOCAL READER CROWNED ${title.toUpperCase()}`;
  $('clip-sub').textContent = `All 10 presses stopped within ${Math.round(avg)} px of the mark today.`;
  $('clip-best').textContent = best.headline;
  $('clip-streak').textContent = streakText;
  $('clip-seed').textContent = DATE_KEY;

  // Tuned lede body
  const ledeBodies = [
    `he press did not lie this morning. By the tenth bell our reader had found the mark ${bestCount(devs)} times, and this clipping is the receipt.`,
    `oday's run favored the steady-handed. Average deviation: ${Math.round(avg)} pixels across ten guillotine stops.`,
    `he ribbon scrolled, and ${title} answered. ${bestCount(devs)} of ten stops cleared the centerline handily.`
  ];
  const pickR = mulberry32(hashStr(DATE_KEY + title))();
  const ledePick = ledeBodies[Math.floor(pickR * ledeBodies.length)];
  $('clip-drop').textContent = ledePick.charAt(0).toUpperCase();
  $('clip-lede-body').textContent = ledePick.slice(1);

  // Stash for share()
  window.__STL_RESULT__ = { title, avg: Math.round(avg), best, devs, streakText };

  goto('end');
}

function bestCount(devs) {
  // Stops under 30px count as "clean"
  return devs.filter(d => d < 30).length;
}

// ---------- Persistence ----------
function persistDaily(avg) {
  try {
    const key = 'stl_history';
    const raw = localStorage.getItem(key);
    const hist = raw ? JSON.parse(raw) : {};
    const prev = hist[DATE_KEY];
    const rounded = Math.round(avg);
    if (prev == null || rounded < prev) hist[DATE_KEY] = rounded;
    localStorage.setItem(key, JSON.stringify(hist));
  } catch (e) { /* ignore */ }
}
function loadBestToday() {
  try {
    const raw = localStorage.getItem('stl_history');
    if (!raw) return null;
    const hist = JSON.parse(raw);
    return hist[DATE_KEY] ?? null;
  } catch (e) { return null; }
}
function loadStreak() {
  try {
    const raw = localStorage.getItem('stl_history');
    if (!raw) return 1;
    const hist = JSON.parse(raw);
    // Walk backwards from today counting consecutive days
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const k = `${y}-${m}-${day}`;
      if (hist[k] != null) count++;
      else break;
      d.setDate(d.getDate() - 1);
    }
    return Math.max(count, 1);
  } catch (e) { return 1; }
}

// ---------- Screen router ----------
function goto(name) {
  startScreen.style.display = name === 'start' ? 'block' : 'none';
  gameScreen.style.display = name === 'game' ? 'block' : 'none';
  endScreen.style.display = name === 'end' ? 'block' : 'none';
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------- Session start ----------
function newSession(mode) {
  state.mode = mode;
  state.seed = mode === 'daily'
    ? DATE_KEY
    : DATE_KEY + '-practice-' + Date.now().toString(36);
  state.run = buildRun(state.seed);
  state.runIdx = 0;
  state.results = [];
  goto('game');
  // Wait a tick for layout so the canvas has its bounding rect
  requestAnimationFrame(() => requestAnimationFrame(startRound));
}

// ---------- Share ----------
function share() {
  const r = window.__STL_RESULT__;
  if (!r) { defaultShare(); return; }
  const streakBit = r.streakText && r.streakText !== 'New reader' && r.streakText !== 'Practice press'
    ? ` (${r.streakText})` : '';
  const text = `THE DAILY REPLICA — ${DATE_KEY}
Crowned ${r.title.toUpperCase()}. All 10 presses within ${r.avg} px${streakBit}.
stop the line → `;
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, text, url }).catch(() => fallbackCopy(text + url));
  } else {
    fallbackCopy(text + url);
  }
}
function defaultShare() {
  if (navigator.share) navigator.share({ title: document.title, url: location.href });
  else fallbackCopy(location.href);
}
function fallbackCopy(t) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(t).then(() => alert('Clipping copied to clipboard.')).catch(() => alert(t));
  } else {
    alert(t);
  }
}
// Expose globally for onclick="share()" fallback markup
window.share = share;

// ---------- Init ----------
function init() {
  $('start-date').textContent = niceDate(DATE_KEY);

  // returning-player block
  const best = loadBestToday();
  if (best != null) {
    const streak = loadStreak();
    $('returning').style.display = 'block';
    $('best-today').textContent = `${best} PX AVG`;
    $('streak-badge').textContent = streak > 1 ? `${streak} DAYS` : 'DAY 1';
  }

  $('start-btn').addEventListener('click', () => newSession('daily'));
  $('replay-btn').addEventListener('click', () => newSession('practice'));
  $('share-btn').addEventListener('click', share);

  // canvas tap → stop
  canvas.addEventListener('pointerdown', handleTap, { passive: false });

  // resize handling
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.roundActive) {
        sizeCanvas();
        // re-layout ribbon at new width but keep timing
        state.ribbon = layoutRibbon(state.run.rounds[state.runIdx]);
      }
    }, 120);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
