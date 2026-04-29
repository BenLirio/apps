// Fortune Vending — drop a coin, mash the button, peel the tab.
// Deterministic: today's three fortunes are a pure function of the date,
// and — more importantly — each fortune is ANCHORED to a real property of today:
//   can 1 — WEEKDAY fortune  (the character of today's day-of-week)
//   can 2 — MOON fortune     (today's moon phase)
//   can 3 — NUMBER fortune   (today's ordinal day of the year + how far into the year)
// so every reveal refers to a thing you can check with your own eyes.

// -------------------- Weekday bank (one per day-of-week, with 3 variants each) --------------------
// Each variant is a deadpan, slightly-weird line that only makes sense on that day.
const WEEKDAY_FORTUNES = {
  sun: [
    "sunday is the only day that knows it is sunday. do less.",
    "a sunday fortune: whatever you postpone today will keep.",
    "sunday measures you by what you do not finish. relax."
  ],
  mon: [
    "monday is asking for very little. match its energy.",
    "a monday kindness, once extended, compounds through thursday.",
    "on a monday, the first correct choice is the second cup."
  ],
  tue: [
    "tuesday is an underrated workhorse. thank it quietly.",
    "on a tuesday, your second email lands better than your first.",
    "tuesday's small errand will save wednesday from itself."
  ],
  wed: [
    "wednesday is the spine of the week. stand up once.",
    "the fridge hums a slightly different tune on wednesdays.",
    "on a wednesday, the meeting shortens itself. accept the gift."
  ],
  thu: [
    "thursday pretends to be friday. do not correct it.",
    "a thursday habit survives the weekend. pick it carefully.",
    "on a thursday, someone will say 'almost there' and mean it."
  ],
  fri: [
    "friday owes you nothing and will still deliver.",
    "on a friday, leave one small thing undone. it will wait.",
    "friday evening, a stranger's playlist will be exactly right."
  ],
  sat: [
    "saturday forgives saturday. that's the whole point.",
    "on a saturday, the wrong shoes are the right shoes.",
    "saturday's plan is the second plan. the first was a draft."
  ]
};

// -------------------- Moon phase bank (8 phases, 2 variants each) --------------------
const MOON_FORTUNES = {
  'new':           ["under a new moon, begin the small thing you will not announce.",
                    "new moon: your inbox is a forest. start one fire."],
  'waxing-crescent':["the crescent is leaning in. so can you.",
                     "a waxing crescent asks: what did you defer last monday?"],
  'first-quarter': ["first quarter: push the boring half. the good half is coming.",
                    "at first quarter, decisions made before noon stick."],
  'waxing-gibbous':["waxing gibbous: bright enough to read by, if you went outside.",
                    "under a gibbous moon, returns of favors arrive unbidden."],
  'full':          ["full moon. everyone is slightly more themselves. tolerate them.",
                    "a full moon is a receipt. check what you asked for last month."],
  'waning-gibbous':["waning gibbous: finish a thing you no longer feel like finishing.",
                    "the gibbous is shrinking. so is your patience. be kind anyway."],
  'last-quarter':  ["last quarter: cancel one plan. no one will mind.",
                    "at last quarter, the apology you owe is shorter than you think."],
  'waning-crescent':["a waning crescent hides more than it shows. today, same.",
                     "under a thinning moon, unfinished drafts look better than they are."]
};

const MOON_NAMES = {
  'new':            'new moon',
  'waxing-crescent':'waxing crescent',
  'first-quarter':  'first quarter',
  'waxing-gibbous': 'waxing gibbous',
  'full':           'full moon',
  'waning-gibbous': 'waning gibbous',
  'last-quarter':   'last quarter',
  'waning-crescent':'waning crescent'
};

// -------------------- Number-of-the-year fortunes --------------------
// Slot 3 reads off today's ordinal day-of-year. We render templates with the
// real numbers filled in so the fortune literally quotes today's date math.
const NUMBER_TEMPLATES = [
  "this is day {n} of {year}. {pct}% is already behind you. {pct_read}",
  "{n} days in. {left} to go. the middle ones are always the vivid ones.",
  "day {n}: an odd little integer. say it out loud once. it will feel like a number again.",
  "you are {pct}% of the way through {year}. no one grades this part.",
  "on the {nth} day, the year stretches and looks at you. nod.",
  "day {n} of {year} is a fine number. small but committed.",
  "{left} days left in {year}. more than enough for one small correct decision.",
  "the {nth} day of the year has a specific weight. carry it lightly."
];

// -------------------- Helpers --------------------

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function todayKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
}

function parseKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || '');
  if (!m) return null;
  const d = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
  if (isNaN(d.getTime())) return null;
  return d;
}

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

// Day of year (1..366) for a Date
function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = (d - start) + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / 86400000);
}

function daysInYear(y) {
  return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
}

function ordinalSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  switch (n % 10) {
    case 1: return n + 'st';
    case 2: return n + 'nd';
    case 3: return n + 'rd';
    default: return n + 'th';
  }
}

// Approximate moon phase bucket for a date.
// Uses the well-known synodic-month approximation: reference new moon 2000-01-06 18:14 UTC.
// Returns one of the keys in MOON_FORTUNES.
function moonPhaseKey(d) {
  const SYNODIC = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
  const diffDays = (d.getTime() - ref) / 86400000;
  let age = diffDays % SYNODIC;
  if (age < 0) age += SYNODIC;
  // 8 buckets of ~3.69 days each
  const frac = age / SYNODIC; // 0..1
  if (frac < 0.03 || frac >= 0.97) return 'new';
  if (frac < 0.22) return 'waxing-crescent';
  if (frac < 0.28) return 'first-quarter';
  if (frac < 0.47) return 'waxing-gibbous';
  if (frac < 0.53) return 'full';
  if (frac < 0.72) return 'waning-gibbous';
  if (frac < 0.78) return 'last-quarter';
  return 'waning-crescent';
}

function weekdayKey(d) {
  return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
}

function pickFrom(arr, seed) {
  return arr[seed % arr.length];
}

function fillNumberTemplate(tpl, d) {
  const n = dayOfYear(d);
  const total = daysInYear(d.getFullYear());
  const left = total - n;
  const pct = Math.round((n / total) * 100);
  // small optional readout phrasing
  const pct_read = pct < 25 ? 'plenty of runway.' :
                   pct < 50 ? 'still early, somehow.' :
                   pct < 75 ? 'past the middle. keep going.' :
                              'the year is in its own final act.';
  return tpl
    .replaceAll('{n}', n)
    .replaceAll('{year}', d.getFullYear())
    .replaceAll('{left}', left)
    .replaceAll('{pct}', pct)
    .replaceAll('{pct_read}', pct_read)
    .replaceAll('{nth}', ordinalSuffix(n));
}

// Three distinct day-anchored fortunes for a given date.
// Returns array of { text, anchor } where anchor is a short human-readable tag
// like "thursday" or "waxing gibbous" or "day 109 of 2026" — shown under the fortune
// so the user can *see* that the reveal is tied to today.
function fortunesFor(dateKey) {
  const d = parseKey(dateKey) || new Date();

  // Slot 1 — weekday
  const wk = weekdayKey(d);
  const wkVariants = WEEKDAY_FORTUNES[wk];
  const wkText = pickFrom(wkVariants, hash(dateKey + '::wk'));
  const wkLabel = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][d.getDay()];

  // Slot 2 — moon
  const mp = moonPhaseKey(d);
  const mpVariants = MOON_FORTUNES[mp];
  const mpText = pickFrom(mpVariants, hash(dateKey + '::mp'));
  const mpLabel = MOON_NAMES[mp];

  // Slot 3 — number of the year
  const tpl = pickFrom(NUMBER_TEMPLATES, hash(dateKey + '::num'));
  const numText = fillNumberTemplate(tpl, d);
  const n = dayOfYear(d);
  const numLabel = 'day ' + n + ' of ' + d.getFullYear();

  return [
    { text: wkText,  anchor: wkLabel },
    { text: mpText,  anchor: mpLabel },
    { text: numText, anchor: numLabel }
  ];
}

function prettyDate(d) {
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return days[d.getDay()] + ' ' + months[d.getMonth()] + ' ' + pad2(d.getDate()) + ' ' + d.getFullYear();
}

// -------------------- State --------------------

const STORAGE_KEY = 'fortune-vending-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: null, opened: [] };
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return { date: null, opened: [] };
    return { date: s.date || null, opened: Array.isArray(s.opened) ? s.opened : [] };
  } catch (e) {
    return { date: null, opened: [] };
  }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

// -------------------- Audio --------------------

let audioCtx = null;
function getCtx() {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { audioCtx = null; }
  return audioCtx;
}

function playCoinPing() {
  const ctx = getCtx(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.24);
}

function playButtonClick() {
  const ctx = getCtx(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(180, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.1);
}

function playThud() {
  const ctx = getCtx(); if (!ctx) return;
  const t = ctx.currentTime;
  // low oscillator burst
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(og).connect(ctx.destination);
  o.start(t); o.stop(t + 0.3);

  // short noise click on top
  const bufSize = Math.floor(ctx.sampleRate * 0.08);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.25, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  ns.connect(ng).connect(ctx.destination);
  ns.start(t);
}

function playPeelRip() {
  const ctx = getCtx(); if (!ctx) return;
  const t = ctx.currentTime;
  const bufSize = Math.floor(ctx.sampleRate * 0.25);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const env = 1 - i / bufSize;
    data[i] = (Math.random() * 2 - 1) * env * 0.5;
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1500;
  const g = ctx.createGain();
  g.gain.value = 0.4;
  ns.connect(hp).connect(g).connect(ctx.destination);
  ns.start(t);
}

// -------------------- Sharing / URL fragment --------------------
// fragment format:  #YYYY-MM-DD/c1   (date + can number the sharer drew)

function parseFragment() {
  const f = (location.hash || '').replace(/^#/, '');
  if (!f) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:\/c([1-3]))?$/.exec(f);
  if (!m) return null;
  return { date: m[1], can: m[2] ? parseInt(m[2], 10) : null };
}

function setFragmentForToday(canNum) {
  const k = todayKey();
  const frag = '#' + k + (canNum ? '/c' + canNum : '');
  if (location.hash !== frag) {
    history.replaceState(null, '', location.pathname + location.search + frag);
  }
}

// -------------------- DOM refs --------------------

const els = {
  machine:    null,
  light:      null,
  stock:      null,
  cans:       null,
  bigButton:  null,
  coinSlot:   null,
  coin:       null,
  coinHint:   null,
  coinTray:   null,
  chute:      null,
  chuteInner: null,
  thinking:   null,
  peelScreen: null,
  pulltab:    null,
  canTop:     null,
  fortunePaper: null,
  fortuneText:  null,
  fortuneMeta:  null,
  soldOut:    null,
  todayList:  null,
  share:      null,
  backBtn:    null,
  introLede:  null
};

let state = { date: null, opened: [] };
let coinInserted = false;
let canInChute = false;
let lastCanNum = 0;     // can number the user just opened this session
let animating = false;
let viewMode = 'machine'; // machine | shared-archive

// -------------------- Init --------------------

document.addEventListener('DOMContentLoaded', () => {
  els.machine    = document.getElementById('machine');
  els.light      = document.getElementById('light');
  els.stock      = document.getElementById('stock');
  els.cans       = Array.from(document.querySelectorAll('.can'));
  els.bigButton  = document.getElementById('bigButton');
  els.coinSlot   = document.getElementById('coinSlot');
  els.coin       = document.getElementById('coin');
  els.coinHint   = document.getElementById('coinHint');
  els.coinTray   = document.getElementById('coinTray');
  els.chute      = document.getElementById('chute');
  els.chuteInner = document.getElementById('chuteInner');
  els.thinking   = document.getElementById('thinking');
  els.peelScreen = document.getElementById('peelScreen');
  els.pulltab    = document.getElementById('pulltab');
  els.canTop     = document.getElementById('canTop');
  els.fortunePaper = document.getElementById('fortunePaper');
  els.fortuneText  = document.getElementById('fortuneText');
  els.fortuneMeta  = document.getElementById('fortuneMeta');
  els.soldOut    = document.getElementById('soldOut');
  els.todayList  = document.getElementById('todayList');
  els.share      = document.getElementById('share');
  els.backBtn    = document.getElementById('backButton');
  els.introLede  = document.querySelector('#intro .lede');

  // Reset state if the stored day is not today
  const saved = loadState();
  const tk = todayKey();
  if (saved.date === tk) {
    state = saved;
  } else {
    state = { date: tk, opened: [] };
    saveState(state);
  }

  // If URL fragment points to another date, show that date's archive
  const frag = parseFragment();
  if (frag && frag.date && frag.date !== tk) {
    return showArchive(frag);
  }

  renderMachine();
  wireCoin();
  wireButton();
  wirePulltab();
  wireBack();

  // If already sold out today, skip to sold-out screen
  if (state.opened.length >= 3) {
    showSoldOut();
  }
});

// -------------------- Render machine state --------------------

function renderMachine() {
  const remaining = 3 - state.opened.length;
  els.stock.textContent = remaining + ' left';

  els.cans.forEach(c => {
    const idx = parseInt(c.getAttribute('data-idx'), 10);
    const consumed = state.opened.indexOf(idx) !== -1;
    c.classList.toggle('consumed', consumed);
  });

  if (remaining <= 0) {
    els.coin.classList.add('used');
    els.coinHint.textContent = "that's it for today.";
    els.bigButton.disabled = true;
    els.bigButton.classList.remove('ready');
    return;
  }

  // Reset interaction state for next can
  coinInserted = false;
  canInChute = false;
  els.coin.classList.remove('used', 'dragging');
  els.coinHint.textContent = 'drag the coin up to the slot';
  els.bigButton.disabled = true;
  els.bigButton.classList.remove('ready', 'pressed');
  els.light.classList.remove('on');
  els.chuteInner.innerHTML = '';
}

// -------------------- Coin interactions --------------------

function wireCoin() {
  const coin = els.coin;
  const slot = els.coinSlot;

  // HTML5 drag (desktop)
  coin.addEventListener('dragstart', (e) => {
    if (coinInserted) return;
    coin.classList.add('dragging');
    try { e.dataTransfer.setData('text/plain', 'coin'); } catch (_) {}
  });
  coin.addEventListener('dragend', () => coin.classList.remove('dragging'));

  slot.addEventListener('dragover', (e) => {
    if (coinInserted) return;
    e.preventDefault();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    insertCoin();
  });

  // Pointer-based drag (touch + mouse fallback)
  let dragging = false;
  let startX = 0, startY = 0;
  let ghost = null;

  coin.addEventListener('pointerdown', (e) => {
    if (coinInserted) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    coin.setPointerCapture(e.pointerId);
    coin.classList.add('dragging');
  });
  coin.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    coin.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';

    // check if over the slot
    const slotRect = slot.getBoundingClientRect();
    if (
      e.clientX >= slotRect.left && e.clientX <= slotRect.right &&
      e.clientY >= slotRect.top  && e.clientY <= slotRect.bottom
    ) {
      slot.classList.add('drag-over');
    } else {
      slot.classList.remove('drag-over');
    }
  });
  coin.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    coin.classList.remove('dragging');
    const slotRect = slot.getBoundingClientRect();
    const over = (
      e.clientX >= slotRect.left && e.clientX <= slotRect.right &&
      e.clientY >= slotRect.top  && e.clientY <= slotRect.bottom
    );
    coin.style.transform = '';
    slot.classList.remove('drag-over');
    if (over) insertCoin();
  });
  coin.addEventListener('pointercancel', () => {
    dragging = false;
    coin.classList.remove('dragging');
    coin.style.transform = '';
    slot.classList.remove('drag-over');
  });

  // Tap fallback — tap the coin, then tap the slot (robust on any device)
  coin.addEventListener('click', (e) => {
    if (coinInserted) return;
    // If this was a real drag, pointerup already handled it; only handle short taps with no movement.
    els.coinHint.textContent = 'now tap the slot.';
    slot.classList.add('drag-over');
    const onSlotTap = () => {
      slot.removeEventListener('click', onSlotTap);
      slot.classList.remove('drag-over');
      insertCoin();
    };
    slot.addEventListener('click', onSlotTap, { once: true });
  });

  // Keyboard accessibility
  coin.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      insertCoin();
    }
  });
}

function insertCoin() {
  if (coinInserted) return;
  if (state.opened.length >= 3) return;
  coinInserted = true;
  playCoinPing();
  els.coin.classList.add('used');
  els.coinHint.textContent = 'now mash the button.';
  els.bigButton.disabled = false;
  els.bigButton.classList.add('ready');
  els.light.classList.add('on');
}

// -------------------- Button mash --------------------

function wireButton() {
  els.bigButton.addEventListener('click', () => {
    if (els.bigButton.disabled || animating) return;
    if (!coinInserted) return;
    animating = true;
    playButtonClick();
    els.bigButton.classList.add('pressed');
    els.bigButton.classList.remove('ready');
    els.bigButton.disabled = true;

    setTimeout(() => els.bigButton.classList.remove('pressed'), 180);

    // Thinking message
    els.thinking.classList.remove('hidden');
    setTimeout(() => {
      els.thinking.classList.add('hidden');
      dropCan();
    }, 800);
  });
}

function dropCan() {
  // Figure out which can number this is (first unopened)
  let canNum = null;
  for (let i = 1; i <= 3; i++) {
    if (state.opened.indexOf(i) === -1) { canNum = i; break; }
  }
  if (!canNum) { animating = false; return; }
  lastCanNum = canNum;

  // Remove a can from the shelf visually
  const shelfCan = document.querySelector('.can.c' + canNum);
  if (shelfCan) shelfCan.classList.add('consumed');

  // Drop pixel can into chute
  els.chuteInner.innerHTML = '';
  const dropCanEl = document.createElement('div');
  dropCanEl.className = 'can-drop';
  els.chuteInner.appendChild(dropCanEl);
  canInChute = true;

  // Thud at the moment of landing (~0.55s into the keyframe)
  setTimeout(() => {
    playThud();
    els.chute.classList.add('shake');
    setTimeout(() => els.chute.classList.remove('shake'), 200);
  }, 500);

  // After animation settles, transition to peel screen
  setTimeout(() => {
    animating = false;
    showPeel(canNum);
  }, 1100);
}

// -------------------- Peel to reveal --------------------

function wirePulltab() {
  const tab = els.pulltab;
  let dragging = false;
  let startX = 0, startY = 0;
  let moved = 0;

  tab.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    moved = 0;
    try { tab.setPointerCapture(e.pointerId); } catch (_) {}
  });
  tab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    moved = Math.sqrt(dx*dx + dy*dy);
    tab.style.transform = 'translate(calc(-50% + ' + dx + 'px), ' + dy + 'px)';
    if (moved > 40) {
      dragging = false;
      try { tab.releasePointerCapture(e.pointerId); } catch (_) {}
      peelOpen();
    }
  });
  tab.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (moved < 15) {
      // treated as a tap — allow tap-to-peel as a robust fallback
      peelOpen();
    } else if (moved < 40) {
      tab.style.transform = 'translateX(-50%)';
    }
  });
  tab.addEventListener('pointercancel', () => {
    dragging = false;
    tab.style.transform = 'translateX(-50%)';
  });

  tab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      peelOpen();
    }
  });
}

function peelOpen() {
  if (els.pulltab.classList.contains('peeled')) return;
  els.pulltab.classList.add('peeled');
  playPeelRip();
  setTimeout(() => {
    els.fortunePaper.classList.add('revealed');
  }, 250);
}

function showPeel(canNum) {
  // Prepare the fortune content but keep it hidden until tab is pulled
  const picks = fortunesFor(todayKey());
  const fortune = picks[canNum - 1];
  els.fortuneText.textContent = fortune.text;
  // The meta line names the REAL anchor this fortune is tied to, so the user
  // can see that today's reveal is not arbitrary — it's pinned to a thing
  // they can check: today's weekday, today's moon phase, or today's day number.
  els.fortuneMeta.textContent = 'can ' + canNum + ' of 3 · ' + fortune.anchor + ' · ' + prettyDate(new Date());

  // Reset peel UI
  els.pulltab.classList.remove('peeled');
  els.pulltab.style.transform = 'translateX(-50%)';
  els.fortunePaper.classList.remove('revealed');

  // Hide machine interaction elements, show peel screen
  hideAllScreens();
  els.peelScreen.classList.remove('hidden');

  // Mark as opened + persist
  if (state.opened.indexOf(canNum) === -1) {
    state.opened.push(canNum);
    saveState(state);
  }

  // Update URL fragment to reflect the can the user drew (for sharing)
  setFragmentForToday(canNum);
}

function wireBack() {
  els.backBtn.addEventListener('click', () => {
    hideAllScreens();
    // Show machine again
    document.getElementById('machine').style.display = '';
    els.coinTray.style.display = '';
    els.introLede.style.display = '';
    renderMachine();
    if (state.opened.length >= 3) {
      showSoldOut();
    } else {
      // Show share if user has opened at least one
      if (state.opened.length > 0) {
        els.share.style.display = '';
      }
    }
  });
}

function hideAllScreens() {
  els.peelScreen.classList.add('hidden');
  els.soldOut.classList.add('hidden');
  // machine + coin + intro stay visible by default
}

// -------------------- Sold out --------------------

function showSoldOut() {
  hideAllScreens();
  els.soldOut.classList.remove('hidden');

  // Build list of today's three fortunes, highlighting the last one opened
  const picks = fortunesFor(todayKey());
  els.todayList.innerHTML = '';
  picks.forEach((f, i) => {
    const li = document.createElement('li');
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'can ' + (i + 1) + ' · ' + f.anchor;
    const body = document.createElement('span');
    body.textContent = f.text;
    li.appendChild(tag);
    li.appendChild(body);
    if (lastCanNum && (i + 1) === lastCanNum) li.classList.add('highlight');
    els.todayList.appendChild(li);
  });

  // Hide the machine UI to keep focus on the sold-out state + share
  document.getElementById('machine').style.display = 'none';
  els.coinTray.style.display = 'none';
  if (els.introLede) els.introLede.style.display = 'none';

  els.share.style.display = '';

  // Ensure fragment reflects today so share link is correct
  setFragmentForToday(lastCanNum || null);
}

// -------------------- Archive view (landing from shared link) --------------------

function showArchive(frag) {
  const d = parseKey(frag.date);
  if (!d) { renderMachine(); return; }

  // Hide the live machine + coin + intro; show a read-only fortune list
  document.getElementById('machine').style.display = 'none';
  els.coinTray.style.display = 'none';
  if (els.introLede) {
    els.introLede.textContent = 'someone shared their fortunes with you.';
    els.introLede.style.display = '';
  }

  const picks = fortunesFor(frag.date);
  viewMode = 'shared-archive';
  hideAllScreens();
  els.soldOut.classList.remove('hidden');
  els.soldOut.querySelector('.sold-top').textContent = 'THAT DAY';
  els.soldOut.querySelector('.sold-sub').textContent = prettyDate(d);

  els.todayList.innerHTML = '';
  picks.forEach((f, i) => {
    const li = document.createElement('li');
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'can ' + (i + 1) + ' · ' + f.anchor;
    const body = document.createElement('span');
    body.textContent = f.text;
    li.appendChild(tag);
    li.appendChild(body);
    if (frag.can && (i + 1) === frag.can) li.classList.add('highlight');
    els.todayList.appendChild(li);
  });

  // Offer a button to go try today's own can
  els.share.style.display = '';
  const shareBtn = els.share.querySelector('button');
  shareBtn.textContent = 'go get your own today';
  shareBtn.onclick = () => {
    location.hash = '';
    location.reload();
  };
}

// -------------------- Share --------------------

function share() {
  // Make sure fragment is set to today + the can the user drew (if any)
  const tk = todayKey();
  const canPart = lastCanNum ? '/c' + lastCanNum : '';
  const frag = '#' + tk + canPart;
  const url = location.origin + location.pathname + frag;

  const title = document.title;
  const text = 'today\'s fortune from the vending machine';

  if (navigator.share) {
    navigator.share({ title: title, text: text, url: url }).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => alert('link copied. go on, paste it somewhere.'))
      .catch(() => alert(url));
  } else {
    alert(url);
  }
}
