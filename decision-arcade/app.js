// Decision Arcade — 3 picture rounds. Pick the picture that hits.
// The clock learns your pace. Picks aggregate into 3 axes.
//
// Each round: 2 image options, no text. Each option has axis (0..2) + value [0,1]
// where 0 = left pole of the axis, 1 = right pole. Each axis appears once.
//
// Axes:
//   0  Practical  ←→  Adventurous   (R1: morning vibe — bed vs plane)
//   1  Logic      ←→  Feeling       (R2: how you decide — spreadsheet vs heart)
//   2  Selfish    ←→  Altruist      (R3: found cash — wallet vs give it away)

const ROUNDS = [
  { axis: 0, options: [
    { img: 'images/bed.jpg',         alt: 'cozy bed in morning light',   shareEmoji: '🛏️', v: 0.05 },
    { img: 'images/plane.jpg',       alt: 'passport and plane ticket',   shareEmoji: '✈️', v: 0.95 },
  ]},
  { axis: 1, options: [
    { img: 'images/spreadsheet.jpg', alt: 'organized spreadsheet',       shareEmoji: '📊', v: 0.05 },
    { img: 'images/heart.jpg',       alt: 'glowing heart on a pillow',   shareEmoji: '🫀', v: 0.95 },
  ]},
  { axis: 2, options: [
    { img: 'images/wallet.jpg',      alt: 'wallet stuffed with cash',    shareEmoji: '💰', v: 0.05 },
    { img: 'images/give.jpg',        alt: 'hands giving cash away',      shareEmoji: '🤝', v: 0.95 },
  ]},
];

const AXIS_LABELS = [
  ["Practical", "Adventurous"],
  ["Logic",     "Feeling"],
  ["Selfish",   "Altruist"]
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
// logic/feeling, selfish/altruist.
const ARCHETYPES = [
  // 000 — practical, logic, selfish
  { name: "THE QUIET HOARDER",
    desc: "You move through life efficiently, decide with data, and your name is on every lease.",
    flavor: "You have a colour-coded spreadsheet for what you'd do with a windfall." },
  // 001 — practical, logic, altruist
  { name: "THE RATIONAL ALTRUIST",
    desc: "You want to help — and you have a 5-step plan to do it efficiently.",
    flavor: "Your donations are optimized. Your empathy is scheduled." },
  // 010 — practical, feeling, selfish
  { name: "THE SOFT INDOORSMAN",
    desc: "You feel deeply, mostly about your own home and the warm bowl in front of you.",
    flavor: "You've cried at a candle commercial and then tucked yourself in." },
  // 011 — practical, feeling, altruist
  { name: "THE WARM HEARTH",
    desc: "Your home is the safe place where everyone ends up — and you keep it that way on purpose.",
    flavor: "You've talked three friends through a crisis without leaving your couch." },
  // 100 — adventurous, logic, selfish
  { name: "THE STRATEGIST",
    desc: "You take big swings — but only after you've run the numbers and the numbers are for you.",
    flavor: "You called it a calculated risk. You'd seen the spreadsheet weeks ago." },
  // 101 — adventurous, logic, altruist
  { name: "THE OPTIMIZED EXPLORER",
    desc: "You go far on purpose, and somehow the trip ends up helping someone other than you.",
    flavor: "You've turned a vacation into a fundraiser and a flight delay into a useful contact." },
  // 110 — adventurous, feeling, selfish
  { name: "THE WANDERING ROMANTIC",
    desc: "You chase the next intense moment, and the moment is almost always about you in it.",
    flavor: "You've impulse-booked a flight to recover from a feeling. It worked." },
  // 111 — adventurous, feeling, altruist
  { name: "THE PASSIONATE PILGRIM",
    desc: "Big heart, big map — you go far for the people you love and a few you've never met.",
    flavor: "You've given your seat away and then kept walking another six miles." },
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
  showScreen('screen-game');
  loadRound(0);
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
