// Decision Arcade — 5 picture rounds. Pick whichever picture hits.
// The clock keeps you honest. Picks aggregate into 3 personality axes.
//
// Each round: 2 image options, no text. Pictures are intentionally
// concrete-but-evocative — vibe-picks rather than morality prompts.
// First 3 pairs each carry a strong, distinct visual world (interior cozy /
// open road, sharp geometry / soft watercolor, single chair / shared table)
// so the contrast lands at a glance instead of all reading as "small bright
// thing in the dark."
//
// Axes (each gets multiple rounds for finer scoring):
//   0  Practical  ←→  Adventurous   (steaming-mug/open-road, papermap/paperplane)
//   1  Logic      ←→  Feeling       (blueprint/watercolor-bleed, cairn/redthread)
//   2  Solitary   ←→  Connected     (empty-chair/string-lights)

const ROUNDS = [
  { axis: 0, options: [
    { img: 'images/steaming-mug.webp',     alt: 'a steaming ceramic mug on a wooden table by a rainy window', v: 0.05 },
    { img: 'images/open-road.webp',        alt: 'an empty winding road vanishing into misty mountains at dawn', v: 0.95 },
  ]},
  { axis: 1, options: [
    { img: 'images/blueprint.webp',        alt: 'an architectural blueprint with a brass drafting compass', v: 0.05 },
    { img: 'images/watercolor-bleed.webp', alt: 'warm watercolor pigments bleeding across white paper', v: 0.95 },
  ]},
  { axis: 2, options: [
    { img: 'images/empty-chair.webp',      alt: 'a single empty armchair facing a sunlit window', v: 0.05 },
    { img: 'images/string-lights.webp',    alt: 'an outdoor dinner table lit by crisscrossing string lights', v: 0.95 },
  ]},
  { axis: 0, options: [
    { img: 'images/papermap.webp',         alt: 'a folded paper map on a wooden table', v: 0.05 },
    { img: 'images/paperplane.webp',       alt: 'a paper airplane mid-flight at dusk', v: 0.95 },
  ]},
  { axis: 1, options: [
    { img: 'images/cairn.webp',            alt: 'a balanced stack of river stones', v: 0.05 },
    { img: 'images/redthread.webp',        alt: 'a tangled knot of red thread', v: 0.95 },
  ]},
];

const AXIS_LABELS = [
  ["Practical", "Adventurous"],
  ["Logic",     "Feeling"],
  ["Solitary",  "Connected"]
];

function archetypeFor(scores) {
  const a0 = scores[0] >= 0.5 ? 1 : 0;
  const a1 = scores[1] >= 0.5 ? 1 : 0;
  const a2 = scores[2] >= 0.5 ? 1 : 0;
  const key = (a0 << 2) | (a1 << 1) | a2;
  return ARCHETYPES[key];
}

const ARCHETYPES = [
  // 000 — practical, logic, solitary
  { name: "The Quiet Architect",
    desc: "You move through life efficiently, decide with data, and you build mostly in private.",
    flavor: "You have a colour-coded spreadsheet for things you've never told anyone about." },
  // 001 — practical, logic, connected
  { name: "The Steady Anchor",
    desc: "You're the measured one — calm under pressure, and the friend everyone calls when something breaks.",
    flavor: "Your group chat ranks you the steadiest hand in a crisis." },
  // 010 — practical, feeling, solitary
  { name: "The Soft Hermit",
    desc: "You feel deeply, mostly inside the safety of your own four walls.",
    flavor: "You've cried at a candle commercial and then made yourself a small dinner." },
  // 011 — practical, feeling, connected
  { name: "The Warm Hearth",
    desc: "Your home is the safe place where everyone ends up — and you keep it that way on purpose.",
    flavor: "You've talked three friends through a crisis without leaving your couch." },
  // 100 — adventurous, logic, solitary
  { name: "The Lone Strategist",
    desc: "You take big swings — but only after you've run the numbers, and you take them alone.",
    flavor: "You called it a calculated risk. You'd seen the spreadsheet weeks ago — you didn't tell anyone." },
  // 101 — adventurous, logic, connected
  { name: "The Expedition Leader",
    desc: "You take the group somewhere far on purpose, with a plan and a packing list.",
    flavor: "You've turned a vacation into a logistical operation and everyone thanked you for it." },
  // 110 — adventurous, feeling, solitary
  { name: "The Wandering Romantic",
    desc: "You chase the next intense moment — and the moment is almost always about you in it.",
    flavor: "You've impulse-booked a flight to recover from a feeling. It worked." },
  // 111 — adventurous, feeling, connected
  { name: "The Passionate Pilgrim",
    desc: "Big heart, big map — and you take the people you love along for the ride.",
    flavor: "You've thrown a party that became a road trip that became a story everyone retells." },
];

const COMPUTING_MSGS = [
  "Cross-referencing your reactions…",
  "Reading between your picks…",
  "Consulting the case file…",
  "Filing your verdict with the Bureau…",
  "Decoding your unconscious…"
];

const TIMER_BASE_MS = 3500;

let currentQ = 0;
let picks = []; // {axis, value, hesitated, img, responseMs}
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
  document.getElementById('q-total').textContent = ROUNDS.length;
  loadRound(0);
}

// Belt-and-suspenders preload. <link rel="preload"> in the HTML kicks the
// fetches off as soon as the page parses; this JS call covers any image the
// preload hints didn't already start (and is a no-op once cached). Kept
// because the 3.5s round timer must never race the image fetch on slow mobile.
let _preloaded = false;
function preloadAllImages() {
  if (_preloaded) return;
  ROUNDS.forEach(r => r.options.forEach(o => { (new Image()).src = o.img; }));
  _preloaded = true;
}

document.addEventListener('DOMContentLoaded', preloadAllImages);

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

  if (idx === 0) {
    // Round-1 pre-roll: brief countdown overlay re-stating the mechanic.
    // Fixes "instructions can be missed → first round is confusing" feedback
    // by guaranteeing the rules land just-in-time, even if the intro was
    // tapped through. Subsequent rounds skip this and start immediately.
    showPreRoll(startTimer);
  } else {
    startTimer();
  }
}

function showPreRoll(then) {
  const preroll = document.getElementById('preroll');
  const cueEl = document.getElementById('preroll-cue');
  preroll.classList.add('show');
  preroll.setAttribute('aria-hidden', 'false');

  document.querySelectorAll('.pic-btn').forEach(b => { b.disabled = true; });

  // Pin the timer bar full so the player can see the lane that's about to
  // run — reinforces "3.5 seconds per round" visually before the clock starts.
  const bar = document.getElementById('timer-bar');
  bar.classList.remove('danger');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  document.getElementById('timer-seconds').textContent = '3.5s';

  let n = 3;
  cueEl.textContent = String(n);
  const tick = setInterval(() => {
    n--;
    if (n > 0) {
      cueEl.textContent = String(n);
    } else {
      clearInterval(tick);
      preroll.classList.remove('show');
      preroll.setAttribute('aria-hidden', 'true');
      document.querySelectorAll('.pic-btn').forEach(b => { b.disabled = false; });
      then();
    }
  }, 600);
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
    img: item.img,
    alt: item.alt,
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
    img: null,
    alt: 'no pick',
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
  // Hesitations land at 0.5; decisive picks pin to 0.05 or 0.95.
  const normalized = axisSums.map((sum, i) =>
    axisCounts[i] > 0 ? sum / axisCounts[i] : 0.5
  );

  const archetype = archetypeFor(normalized);

  // Filmstrip: actual chosen images, in order. Hesitations render as a blank cell.
  const stripEl = document.getElementById('picked-strip');
  stripEl.innerHTML = '';
  picks.forEach((p, idx) => {
    const cell = document.createElement('div');
    cell.className = 'film-cell' + (p.hesitated ? ' hesitated' : '');
    if (p.img) {
      cell.innerHTML = '<img class="film-img" src="' + p.img + '" alt="' + p.alt + '" draggable="false">';
    } else {
      cell.innerHTML = '<span class="film-skip">—</span>';
    }
    const num = document.createElement('span');
    num.className = 'film-num';
    num.textContent = String(idx + 1);
    cell.appendChild(num);
    stripEl.appendChild(cell);
  });

  // Per-axis verdict lines — use real dimension names, not "Axis N".
  const leansEl = document.getElementById('leans');
  leansEl.innerHTML = '';
  normalized.forEach((val, i) => {
    const verdict = leanVerdict(val, AXIS_LABELS[i]);
    const axisLabel = AXIS_LABELS[i].join(' / ');
    const row = document.createElement('div');
    row.className = 'lean-row';
    row.innerHTML = `<span class="lean-axis">${axisLabel}</span><span class="lean-verdict">${verdict}</span>`;
    leansEl.appendChild(row);
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

  window._shareText =
    `Decision Arcade — ${archetype.name}\n\nfind yours → ${location.href}`;

  const msg = COMPUTING_MSGS[Math.floor(Math.random() * COMPUTING_MSGS.length)];
  document.getElementById('computing-msg').textContent = msg;
  showScreen('screen-computing');

  setTimeout(() => {
    showScreen('screen-result');
    document.getElementById('share').style.display = 'block';
  }, 1600);
}

// Map a 0..1 axis score to a single-line vibe verdict instead of a bar.
function leanVerdict(val, labels) {
  const [low, high] = labels;
  if (val >= 0.85) return `strongly ${high.toLowerCase()}`;
  if (val >= 0.6)  return `leans ${high.toLowerCase()}`;
  if (val > 0.4)   return `right between ${low.toLowerCase()} & ${high.toLowerCase()}`;
  if (val > 0.15)  return `leans ${low.toLowerCase()}`;
  return `strongly ${low.toLowerCase()}`;
}

function restartGame() {
  showScreen('screen-intro');
}

function share() {
  const text = window._shareText || document.title;
  if (navigator.share) {
    navigator.share({ title: document.title, text, url: location.href }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => alert('Result copied to clipboard!'));
  }
}
