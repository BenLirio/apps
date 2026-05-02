// Decision Arcade — 3 picture rounds. Pick whichever picture hits.
// The clock keeps you honest. Picks aggregate into 3 personality axes.
//
// Each round: 2 image options, no text. Pictures are intentionally abstract
// and aesthetic — vibe-picks rather than morality prompts. The axis loading
// is gentle, not telegraphed.
//
// Axes:
//   0  Practical  ←→  Adventurous   (R1: candle flame vs shooting star)
//   1  Logic      ←→  Feeling       (R2: ice cube vs ink in water)
//   2  Solitary   ←→  Connected     (R3: lone tree vs campfire)

const ROUNDS = [
  { axis: 0, options: [
    { img: 'images/candle.png',   alt: 'a single candle flame in the dark', shareEmoji: '🕯️', v: 0.05 },
    { img: 'images/meteor.png',   alt: 'a shooting star across the night sky', shareEmoji: '☄️', v: 0.95 },
  ]},
  { axis: 1, options: [
    { img: 'images/icecube.png',  alt: 'a clear ice cube on a dark surface', shareEmoji: '🧊', v: 0.05 },
    { img: 'images/inkdrop.png',  alt: 'a drop of ink blooming in water', shareEmoji: '💧', v: 0.95 },
  ]},
  { axis: 2, options: [
    { img: 'images/lonetree.png', alt: 'a single tree on a hill at twilight', shareEmoji: '🌳', v: 0.05 },
    { img: 'images/campfire.png', alt: 'a small campfire with rising sparks', shareEmoji: '🔥', v: 0.95 },
  ]},
];

const AXIS_LABELS = [
  ["Practical", "Adventurous"],
  ["Logic",     "Feeling"],
  ["Solitary",  "Connected"]
];

// 8 archetypes — one per (axis0, axis1, axis2) low/high combination.
// Picks are binary in this version, so we deterministically map every player
// to exactly one archetype rather than searching for a fuzzy match.
function archetypeFor(scores) {
  const a0 = scores[0] >= 0.5 ? 1 : 0;
  const a1 = scores[1] >= 0.5 ? 1 : 0;
  const a2 = scores[2] >= 0.5 ? 1 : 0;
  const key = (a0 << 2) | (a1 << 1) | a2;
  return ARCHETYPES[key];
}

// Indexed by (axis0 << 2) | (axis1 << 1) | axis2 — practical/adventurous,
// logic/feeling, solitary/connected.
const ARCHETYPES = [
  // 000 — practical, logic, solitary
  { name: "THE QUIET ARCHITECT",
    desc: "You move through life efficiently, decide with data, and you build mostly in private.",
    flavor: "You have a colour-coded spreadsheet for things you've never told anyone about." },
  // 001 — practical, logic, connected
  { name: "THE STEADY ANCHOR",
    desc: "You're the measured one — calm under pressure, and the friend everyone calls when something breaks.",
    flavor: "Your group chat ranks you the steadiest hand in a crisis." },
  // 010 — practical, feeling, solitary
  { name: "THE SOFT HERMIT",
    desc: "You feel deeply, mostly inside the safety of your own four walls.",
    flavor: "You've cried at a candle commercial and then made yourself a small dinner." },
  // 011 — practical, feeling, connected
  { name: "THE WARM HEARTH",
    desc: "Your home is the safe place where everyone ends up — and you keep it that way on purpose.",
    flavor: "You've talked three friends through a crisis without leaving your couch." },
  // 100 — adventurous, logic, solitary
  { name: "THE LONE STRATEGIST",
    desc: "You take big swings — but only after you've run the numbers, and you take them alone.",
    flavor: "You called it a calculated risk. You'd seen the spreadsheet weeks ago — you didn't tell anyone." },
  // 101 — adventurous, logic, connected
  { name: "THE EXPEDITION LEADER",
    desc: "You take the group somewhere far on purpose, with a plan and a packing list.",
    flavor: "You've turned a vacation into a logistical operation and everyone thanked you for it." },
  // 110 — adventurous, feeling, solitary
  { name: "THE WANDERING ROMANTIC",
    desc: "You chase the next intense moment — and the moment is almost always about you in it.",
    flavor: "You've impulse-booked a flight to recover from a feeling. It worked." },
  // 111 — adventurous, feeling, connected
  { name: "THE PASSIONATE PILGRIM",
    desc: "Big heart, big map — and you take the people you love along for the ride.",
    flavor: "You've thrown a party that became a road trip that became a story everyone retells." },
];

const COMPUTING_MSGS = [
  "cross-referencing your chaos with the archives...",
  "consulting the oracle of bad decisions...",
  "mapping your soul onto the decision matrix...",
  "running your picks through the vibes engine...",
  "summoning your archetype from the void..."
];

// ── Adaptive timer config ──────────────────────────────────────────────
// Picture rounds are slightly slower than emoji rounds — give the eye time
// to scan two big pictures. Fixed pace per round (3 rounds is too few for
// meaningful recalibration).
const TIMER_BASE_MS    = 3500;

let currentQ = 0;
let picks = []; // {axis, value, hesitated, shareEmoji, responseMs}
let axisSums = [0, 0, 0];
let axisCounts = [0, 0, 0];
let timerInterval = null;
let timerStart = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function startGame() {
  currentQ = 0;
  picks = [];
  axisSums = [0, 0, 0];
  axisCounts = [0, 0, 0];
  preloadAllImages();
  showScreen('screen-game');
  loadRound(0);
}

// Pictures are ~1MB each; without this the browser only fetches when a round
// renders and the 3.5s timer can fire before the image paints on slow mobile.
let _preloaded = false;
function preloadAllImages() {
  if (_preloaded) return;
  ROUNDS.forEach(r => r.options.forEach(o => { (new Image()).src = o.img; }));
  _preloaded = true;
}

function loadRound(idx) {
  const r = ROUNDS[idx];
  document.getElementById('q-current').textContent = idx + 1;

  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';
  r.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pic-btn';
    btn.dataset.idx = String(i);
    btn.setAttribute('aria-label', opt.alt);
    btn.innerHTML = '<img class="pic-img" src="' + opt.img + '" alt="' + opt.alt + '" draggable="false">';
    btn.addEventListener('click', () => choose(i));
    grid.appendChild(btn);
  });

  document.getElementById('hesitate-flash').classList.remove('show');
  startTimer();
}

function startTimer() {
  const bar = document.getElementById('timer-bar');
  const seconds = (TIMER_BASE_MS / 1000).toFixed(1);
  document.getElementById('timer-seconds').textContent = seconds + 's';

  bar.classList.remove('danger');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  bar.getBoundingClientRect();

  timerStart = Date.now();
  bar.style.transition = `width ${TIMER_BASE_MS}ms linear`;
  bar.style.width = '0%';

  const dangerOffset = Math.max(TIMER_BASE_MS - 700, TIMER_BASE_MS * 0.7);
  setTimeout(() => bar.classList.add('danger'), dangerOffset);

  timerInterval = setTimeout(hesitate, TIMER_BASE_MS);
}

function clearTimer() {
  clearTimeout(timerInterval);
  timerInterval = null;
}

function choose(idx) {
  if (timerInterval === null) return;
  clearTimer();

  const responseMs = Date.now() - timerStart;
  const r = ROUNDS[currentQ];
  const item = r.options[idx];

  picks.push({
    axis: r.axis,
    value: item.v,
    hesitated: false,
    shareEmoji: item.shareEmoji,
    responseMs
  });
  axisSums[r.axis] += item.v;
  axisCounts[r.axis]++;

  Array.from(document.querySelectorAll('.pic-btn')).forEach((b, i) => {
    b.disabled = true;
    if (i === idx) b.classList.add('selected'); else b.classList.add('faded');
  });

  setTimeout(advance, 360);
}

function hesitate() {
  timerInterval = null;

  const r = ROUNDS[currentQ];
  picks.push({
    axis: r.axis,
    value: 0.5,
    hesitated: true,
    shareEmoji: '⏳',
    responseMs: TIMER_BASE_MS
  });
  axisSums[r.axis] += 0.5;
  axisCounts[r.axis]++;

  document.getElementById('hesitate-flash').classList.add('show');
  Array.from(document.querySelectorAll('.pic-btn')).forEach(b => {
    b.disabled = true;
    b.classList.add('faded');
  });

  setTimeout(advance, 700);
}

function advance() {
  currentQ++;
  if (currentQ >= ROUNDS.length) {
    showResult();
  } else {
    loadRound(currentQ);
  }
}

function showResult() {
  // Hesitations land at 0.5 (mid-axis); decisive picks pin to ~0.05 or ~0.95.
  const normalized = axisSums.map((sum, i) =>
    axisCounts[i] > 0 ? sum / axisCounts[i] : 0.5
  );

  const archetype = archetypeFor(normalized);

  // Picked strip — 3 emoji-fallbacks below the archetype line
  const stripEl = document.getElementById('picked-strip');
  stripEl.innerHTML = '';
  picks.forEach(p => {
    const span = document.createElement('span');
    span.className = 'picked-cell' + (p.hesitated ? ' hesitated' : '');
    span.textContent = p.shareEmoji;
    stripEl.appendChild(span);
  });

  const stripStr = picks.map(p => p.shareEmoji).join(' ');
  window._shareEmoji =
    `🎮 Decision Arcade — ${archetype.name}\n\n${stripStr}\n\nfind yours → ${location.href}`;

  const chartEl = document.getElementById('axis-chart');
  chartEl.innerHTML = '';
  normalized.forEach((val, i) => {
    const pct = Math.round(val * 100);
    const row = document.createElement('div');
    row.className = 'axis-row';
    row.innerHTML = `
      <span class="axis-row-label-left">${AXIS_LABELS[i][0]}</span>
      <div class="axis-track">
        <div class="axis-fill" style="width:${pct}%"></div>
      </div>
      <span class="axis-row-label-right">${AXIS_LABELS[i][1]}</span>
    `;
    chartEl.appendChild(row);
  });

  document.getElementById('archetype-name').textContent = archetype.name;
  document.getElementById('archetype-desc').textContent = archetype.desc;

  const hesitations = picks.filter(p => p.hesitated).length;
  const decided = picks.filter(p => !p.hesitated);
  const avgMs = decided.length
    ? Math.round(decided.reduce((a, p) => a + p.responseMs, 0) / decided.length)
    : 0;

  let flavor = archetype.flavor;
  const tail = [];
  if (hesitations >= 2) {
    tail.push(`hesitated ${hesitations}× — your gut has opinions it won't commit to`);
  }
  if (avgMs > 0) {
    const avgSec = (avgMs / 1000).toFixed(1);
    tail.push(`average pick: ${avgSec}s`);
  }
  if (tail.length) flavor += ' (' + tail.join(' · ') + ')';
  document.getElementById('result-flavor').textContent = flavor;

  const msg = COMPUTING_MSGS[Math.floor(Math.random() * COMPUTING_MSGS.length)];
  document.getElementById('computing-msg').textContent = msg;
  showScreen('screen-computing');

  setTimeout(() => {
    showScreen('screen-result');
    document.getElementById('share').style.display = 'block';
  }, 1600);
}

function restartGame() {
  showScreen('screen-intro');
}

function share() {
  const text = window._shareEmoji || document.title;
  if (navigator.share) {
    navigator.share({ title: document.title, text, url: location.href }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => alert('Result copied to clipboard!'));
  }
}
