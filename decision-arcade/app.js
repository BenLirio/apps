// Decision Arcade — 10 emoji rounds. No question text, no labels. Pick the
// emoji that hits. The clock learns your pace. Picks aggregate into 5 axes.

// Each round: 6 emojis, no text. Each emoji has axis (0..4) + value [0,1]
// where 0 = left pole of the axis, 1 = right pole. 2 rounds per axis × 5 = 10.
//
// Axes:
//   0  Practical  ←→  Adventurous
//   1  Selfish    ←→  Altruist
//   2  Logic      ←→  Feeling
//   3  Bold       ←→  Cautious
//   4  Present    ←→  Future

const ROUNDS = [
  // R1 — axis 0: morning vibe
  { axis: 0, emojis: [
    { e: "🛏️", v: 0.05 },
    { e: "☕",  v: 0.20 },
    { e: "📋", v: 0.35 },
    { e: "🚶", v: 0.55 },
    { e: "🚲", v: 0.80 },
    { e: "✈️", v: 0.98 },
  ]},
  // R2 — axis 1: found money
  { axis: 1, emojis: [
    { e: "💰", v: 0.05 },
    { e: "🛍️", v: 0.20 },
    { e: "🍰", v: 0.40 },
    { e: "🎁", v: 0.65 },
    { e: "💝", v: 0.85 },
    { e: "🤝", v: 0.98 },
  ]},
  // R3 — axis 2: how you decide
  { axis: 2, emojis: [
    { e: "📊", v: 0.05 },
    { e: "🧮", v: 0.18 },
    { e: "🤔", v: 0.40 },
    { e: "💭", v: 0.60 },
    { e: "🫀", v: 0.82 },
    { e: "🌈", v: 0.98 },
  ]},
  // R4 — axis 3: the leap (0 = bold, 1 = cautious)
  { axis: 3, emojis: [
    { e: "🚀", v: 0.05 },
    { e: "🔥", v: 0.18 },
    { e: "🎲", v: 0.35 },
    { e: "⚖️", v: 0.55 },
    { e: "🪖", v: 0.80 },
    { e: "🛡️", v: 0.98 },
  ]},
  // R5 — axis 4: bonus cash arrives
  { axis: 4, emojis: [
    { e: "🍾", v: 0.05 },
    { e: "🍕", v: 0.20 },
    { e: "🎉", v: 0.38 },
    { e: "🪴", v: 0.60 },
    { e: "💸", v: 0.80 },
    { e: "📈", v: 0.98 },
  ]},
  // R6 — axis 0: the weekend
  { axis: 0, emojis: [
    { e: "🧹", v: 0.05 },
    { e: "📚", v: 0.20 },
    { e: "🥗", v: 0.38 },
    { e: "🎨", v: 0.58 },
    { e: "🏔️", v: 0.82 },
    { e: "🪂", v: 0.98 },
  ]},
  // R7 — axis 1: the last seat (0 = keep, 1 = give it up)
  { axis: 1, emojis: [
    { e: "💺", v: 0.05 },
    { e: "🙄", v: 0.20 },
    { e: "🤷", v: 0.38 },
    { e: "👋", v: 0.58 },
    { e: "🙋", v: 0.82 },
    { e: "💗", v: 0.98 },
  ]},
  // R8 — axis 2: the crying stranger
  { axis: 2, emojis: [
    { e: "🕐", v: 0.05 },
    { e: "🚪", v: 0.18 },
    { e: "🤨", v: 0.40 },
    { e: "❓", v: 0.58 },
    { e: "💬", v: 0.82 },
    { e: "🤗", v: 0.98 },
  ]},
  // R9 — axis 3: the meeting (0 = bold/speak, 1 = cautious/quiet)
  { axis: 3, emojis: [
    { e: "📢", v: 0.05 },
    { e: "🗣️", v: 0.20 },
    { e: "😐", v: 0.42 },
    { e: "🙊", v: 0.62 },
    { e: "🤐", v: 0.85 },
    { e: "👂", v: 0.98 },
  ]},
  // R10 — axis 4: tonight (0 = present, 1 = future)
  { axis: 4, emojis: [
    { e: "🛌", v: 0.05 },
    { e: "🍿", v: 0.20 },
    { e: "🎮", v: 0.38 },
    { e: "📖", v: 0.58 },
    { e: "📝", v: 0.80 },
    { e: "💪", v: 0.98 },
  ]},
];

const AXIS_LABELS = [
  ["Practical", "Adventurous"],
  ["Selfish",   "Altruist"],
  ["Logic",     "Feeling"],
  ["Bold",      "Cautious"],
  ["Present",   "Future"]
];

// Archetype matching: scores `s` are per-axis averages in [0,1].
const ARCHETYPES = [
  {
    name: "THE CALCULATED HEDONIST",
    desc: "You chase pleasure but always read the fine print first.",
    flavor: "You'd order the most expensive thing on the menu — after checking reviews.",
    match: s => s[0] < 0.5 && s[1] < 0.5 && s[2] < 0.5
  },
  {
    name: "THE CHAOTIC EMPATH",
    desc: "You feel everything and act before thinking. Somehow it works out.",
    flavor: "You've definitely cried at a commercial and then impulsively booked a flight.",
    match: s => s[0] > 0.5 && s[2] > 0.5 && s[3] < 0.5
  },
  {
    name: "THE RATIONAL ALTRUIST",
    desc: "You want to help people — and you have a 5-step plan to do it efficiently.",
    flavor: "Your donations are optimized. Your empathy is scheduled.",
    match: s => s[1] > 0.5 && s[2] < 0.5 && s[4] > 0.5
  },
  {
    name: "THE PRAGMATIC DRIFTER",
    desc: "You move through life efficiently but somehow end up in the most interesting places.",
    flavor: "You planned a spreadsheet trip and turned it into a spiritual experience.",
    match: s => s[0] < 0.5 && s[0] > 0.3 && s[4] < 0.5
  },
  {
    name: "THE BOLD IDEALIST",
    desc: "You take big swings for big principles. Caution is a foreign language.",
    flavor: "You've quit a job on principle and felt great about it. Twice.",
    match: s => s[3] < 0.5 && s[1] > 0.5 && s[4] > 0.5
  },
  {
    name: "THE CAUTIOUS DREAMER",
    desc: "You have grand visions but a detailed contingency plan for every one of them.",
    flavor: "You've planned adventures you'll take someday — when the time is right.",
    match: s => s[3] > 0.5 && s[0] > 0.5 && s[4] > 0.5
  },
  {
    name: "THE PRESENT-MOMENT OPPORTUNIST",
    desc: "The future is for suckers. Today has a 100% arrival rate.",
    flavor: "You'd spend your last €20 on dinner rather than the subway fare home.",
    match: s => s[4] < 0.5 && s[1] < 0.5 && s[3] < 0.5
  },
  {
    name: "THE FUTURE-FIRST ARCHITECT",
    desc: "You're living in the version of your life that's three moves ahead.",
    flavor: "You already have a retirement account and a vague plan for the planet.",
    match: s => s[4] > 0.5 && s[2] < 0.5 && s[3] > 0.5
  },
  {
    name: "THE FREELANCE MORALIST",
    desc: "You make your own rules — and they're surprisingly consistent.",
    flavor: "You've talked a stranger through a crisis and then jaywalked immediately after.",
    match: s => s[1] > 0.5 && s[3] < 0.5 && s[2] > 0.5
  },
  {
    name: "THE INTUITIVE PRAGMATIST",
    desc: "You trust your gut, but your gut has done its homework.",
    flavor: "You call it instinct. It's actually 10,000 hours of pattern recognition.",
    match: () => true // fallback
  }
];

const COMPUTING_MSGS = [
  "cross-referencing your chaos with the archives...",
  "consulting the oracle of bad decisions...",
  "mapping your soul onto the decision matrix...",
  "running your picks through the vibes engine...",
  "summoning your archetype from the void..."
];

// ── Adaptive timer config ──────────────────────────────────────────────
// Picks are emoji-only and instant — much shorter than the previous
// scenario-reading flow. Floor lives near "tap reflex" instead of "read time".
const TIMER_BASE_MS    = 2500;   // first round
const TIMER_FLOOR_MS   = 1100;   // minimum
const TIMER_CEILING_MS = 4500;   // maximum
const TIMER_BLEND      = 0.6;    // recalibration weighting
const TIMER_HEADROOM   = 1.55;   // ~55% margin above measured median

let currentQ = 0;
let picks = []; // {axis, value, hesitated, emoji, responseMs}
let axisSums = [0, 0, 0, 0, 0];   // accumulated value per axis
let axisCounts = [0, 0, 0, 0, 0];
let timerInterval = null;
let timerStart = null;
let currentTimerMs = TIMER_BASE_MS;
let recalibrated = false;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function startGame() {
  currentQ = 0;
  picks = [];
  axisSums = [0, 0, 0, 0, 0];
  axisCounts = [0, 0, 0, 0, 0];
  currentTimerMs = TIMER_BASE_MS;
  recalibrated = false;
  showScreen('screen-game');
  loadRound(0);
}

function loadRound(idx) {
  const r = ROUNDS[idx];
  document.getElementById('q-current').textContent = idx + 1;

  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';
  r.emojis.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn';
    btn.dataset.idx = String(i);
    btn.setAttribute('aria-label', 'option ' + (i + 1));
    btn.innerHTML = '<span class="emoji-glyph">' + item.e + '</span>';
    btn.addEventListener('click', () => choose(i));
    grid.appendChild(btn);
  });

  document.getElementById('hesitate-flash').classList.remove('show');
  startTimer();
}

function startTimer() {
  const bar = document.getElementById('timer-bar');
  const seconds = (currentTimerMs / 1000).toFixed(1);
  document.getElementById('timer-seconds').textContent = seconds + 's';

  bar.classList.remove('danger');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  bar.getBoundingClientRect();

  timerStart = Date.now();
  bar.style.transition = `width ${currentTimerMs}ms linear`;
  bar.style.width = '0%';

  const dangerOffset = Math.max(currentTimerMs - 600, currentTimerMs * 0.7);
  setTimeout(() => bar.classList.add('danger'), dangerOffset);

  timerInterval = setTimeout(hesitate, currentTimerMs);
}

function clearTimer() {
  clearTimeout(timerInterval);
  timerInterval = null;
}

function recalibrateTimer() {
  const actuals = picks
    .filter(p => !p.hesitated && typeof p.responseMs === 'number')
    .map(p => p.responseMs)
    .sort((a, b) => a - b);

  if (actuals.length === 0) return;

  const median = actuals.length % 2 === 1
    ? actuals[(actuals.length - 1) / 2]
    : (actuals[actuals.length / 2 - 1] + actuals[actuals.length / 2]) / 2;

  const target = median * TIMER_HEADROOM;
  let next = currentTimerMs * (1 - TIMER_BLEND) + target * TIMER_BLEND;
  next = Math.max(TIMER_FLOOR_MS, Math.min(TIMER_CEILING_MS, next));

  const meaningful = Math.abs(next - currentTimerMs) >= 250;
  currentTimerMs = next;
  if (meaningful) {
    recalibrated = true;
    flashRecalibration();
  }
}

function flashRecalibration() {
  const el = document.getElementById('timer-seconds');
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

function choose(idx) {
  if (timerInterval === null) return;
  clearTimer();

  const responseMs = Date.now() - timerStart;
  const r = ROUNDS[currentQ];
  const item = r.emojis[idx];

  picks.push({
    axis: r.axis,
    value: item.v,
    hesitated: false,
    emoji: item.e,
    responseMs
  });
  axisSums[r.axis] += item.v;
  axisCounts[r.axis]++;

  // mark all unselected; mark selected
  Array.from(document.querySelectorAll('.emoji-btn')).forEach((b, i) => {
    b.disabled = true;
    if (i === idx) b.classList.add('selected'); else b.classList.add('faded');
  });

  // Recalibrate after rounds 2, 4, 6 — early enough to help, real sample.
  if (currentQ === 1 || currentQ === 3 || currentQ === 5) {
    recalibrateTimer();
  }

  setTimeout(advance, 320);
}

function hesitate() {
  timerInterval = null;

  const r = ROUNDS[currentQ];
  picks.push({
    axis: r.axis,
    value: 0.5, // neutral when hesitating
    hesitated: true,
    emoji: '⏳',
    responseMs: currentTimerMs
  });
  axisSums[r.axis] += 0.5;
  axisCounts[r.axis]++;

  document.getElementById('hesitate-flash').classList.add('show');
  Array.from(document.querySelectorAll('.emoji-btn')).forEach(b => {
    b.disabled = true;
    b.classList.add('faded');
  });

  if (currentQ === 1 || currentQ === 3 || currentQ === 5) {
    currentTimerMs = Math.min(TIMER_CEILING_MS, currentTimerMs * 1.25);
    recalibrated = true;
    flashRecalibration();
  }

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
  const normalized = axisSums.map((sum, i) =>
    axisCounts[i] > 0 ? sum / axisCounts[i] : 0.5
  );

  const archetype = ARCHETYPES.find(a => a.match(normalized)) || ARCHETYPES[ARCHETYPES.length - 1];

  // Picked emoji strip — one row of the 10 emojis you tapped (or ⏳ for hesitations)
  const stripEl = document.getElementById('picked-strip');
  stripEl.innerHTML = '';
  picks.forEach(p => {
    const span = document.createElement('span');
    span.className = 'picked-cell' + (p.hesitated ? ' hesitated' : '');
    span.textContent = p.emoji;
    stripEl.appendChild(span);
  });

  // Build emoji-only share text (no labels — matches the app's identity)
  const stripStr = picks.map(p => p.emoji).join(' ');
  window._shareEmoji =
    `🎮 Decision Arcade — ${archetype.name}\n\n${stripStr}\n\nfind yours → ${location.href}`;

  // Render axis bars
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
  if (hesitations >= 3) {
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
