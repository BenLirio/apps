// Decision Arcade — 10 lightning-fast binary dilemmas, 3 seconds each
// Axes: practical(0) | adventurous, selfish(1) | altruist, logic(2) | feeling, bold(3) | cautious, present(4) | future

const SCENARIOS = [
  {
    axis: 0, // practical vs adventurous
    text: "You have one free afternoon. What calls to you?",
    left:  { emoji: "📋", label: "Fix everything on your to-do list", side: 0 },
    right: { emoji: "🎲", label: "Drive somewhere you've never been", side: 1 }
  },
  {
    axis: 1, // selfish vs altruist
    text: "You find $200 in an unmarked envelope on the street.",
    left:  { emoji: "💸", label: "Keep it — finders keepers", side: 0 },
    right: { emoji: "🏥", label: "Donate it to a shelter", side: 1 }
  },
  {
    axis: 2, // logic vs feeling
    text: "Your gut says one thing. The spreadsheet says another.",
    left:  { emoji: "📊", label: "Trust the numbers, ignore the gut", side: 0 },
    right: { emoji: "🫀", label: "Go with the feeling, ignore the data", side: 1 }
  },
  {
    axis: 3, // bold vs cautious
    text: "Big opportunity — but 40% chance it blows up badly.",
    left:  { emoji: "🚀", label: "Take the shot, regret nothing", side: 0 },
    right: { emoji: "🛡️", label: "Play it safe, protect what you have", side: 1 }
  },
  {
    axis: 4, // present vs future
    text: "Bonus cash arrives. What do you do instantly?",
    left:  { emoji: "🍾", label: "Spend it on an experience tonight", side: 0 },
    right: { emoji: "📈", label: "Invest it and forget it exists", side: 1 }
  },
  {
    axis: 0, // practical vs adventurous
    text: "Your friend proposes a trip starting in 48 hours.",
    left:  { emoji: "📅", label: "Pass — zero time to plan properly", side: 0 },
    right: { emoji: "✈️", label: "Pack a bag. You'll figure it out.", side: 1 }
  },
  {
    axis: 1, // selfish vs altruist
    text: "You get the last seat on the train. Someone else just missed it.",
    left:  { emoji: "💺", label: "Keep the seat — I earned it", side: 0 },
    right: { emoji: "🤝", label: "Offer it to them", side: 1 }
  },
  {
    axis: 2, // logic vs feeling
    text: "A stranger on the street is crying. You're running late.",
    left:  { emoji: "🕐", label: "Keep walking — late is late", side: 0 },
    right: { emoji: "💬", label: "Stop and ask if they're okay", side: 1 }
  },
  {
    axis: 3, // bold vs cautious
    text: "You can speak up at the meeting. It might offend someone.",
    left:  { emoji: "📢", label: "Say it — truth matters more", side: 0 },
    right: { emoji: "🤐", label: "Stay quiet — not worth the friction", side: 1 }
  },
  {
    axis: 4, // present vs future
    text: "You can work late and get ahead, or log off and rest.",
    left:  { emoji: "🛋️", label: "Log off. Rest now, grind later.", side: 0 },
    right: { emoji: "💻", label: "Push through — future-you will thank you", side: 1 }
  }
];

// Axis labels: [left pole, right pole]
const AXIS_LABELS = [
  ["Practical", "Adventurous"],
  ["Selfish", "Altruist"],
  ["Logic", "Feeling"],
  ["Bold", "Cautious"],
  ["Present", "Future"]
];

// Each axis: left choice = side 0, right choice = side 1
// score per axis: 0-2 questions per axis, value 0 = full left, 1 = right
// We track count of "right side" choices per axis

// Archetypes: defined by combinations of dominant axes
// Format: { name, desc, flavor, match: fn(scores) } where scores[i] = 0..1 fraction of right-side picks
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

// Emoji pairs for each scenario result
const SCENARIO_EMOJIS = [
  ["📋", "🎲"],
  ["💸", "🏥"],
  ["📊", "🫀"],
  ["🚀", "🛡️"],
  ["🍾", "📈"],
  ["📅", "✈️"],
  ["💺", "🤝"],
  ["🕐", "💬"],
  ["📢", "🤐"],
  ["🛋️", "💻"]
];

const COMPUTING_MSGS = [
  "cross-referencing your chaos with the archives...",
  "consulting the oracle of bad decisions...",
  "mapping your soul onto the decision matrix...",
  "running your choices through the vibes engine...",
  "summoning your archetype from the void..."
];

// Game state
let currentQ = 0;
let choices = []; // array of 'left'|'right'|'hesitate' per question
let axisScores = [0, 0, 0, 0, 0]; // count of right-side picks per axis
let axisCounts = [0, 0, 0, 0, 0]; // total questions per axis
let timerInterval = null;
let timerStart = null;
const TIMER_DURATION = 3000;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  el.classList.add('active');
  // Scroll to top on mobile
  window.scrollTo(0, 0);
}

function startGame() {
  currentQ = 0;
  choices = [];
  axisScores = [0, 0, 0, 0, 0];
  axisCounts = [0, 0, 0, 0, 0];
  showScreen('screen-game');
  loadQuestion(0);
}

function loadQuestion(idx) {
  const q = SCENARIOS[idx];
  document.getElementById('q-current').textContent = idx + 1;
  document.getElementById('axis-label').textContent =
    AXIS_LABELS[q.axis][0].toUpperCase() + ' vs ' + AXIS_LABELS[q.axis][1].toUpperCase();
  document.getElementById('scenario-text').textContent = q.text;
  document.getElementById('emoji-left').textContent = q.left.emoji;
  document.getElementById('label-left').textContent = q.left.label;
  document.getElementById('emoji-right').textContent = q.right.emoji;
  document.getElementById('label-right').textContent = q.right.label;

  document.getElementById('hesitate-flash').classList.remove('show');
  document.getElementById('btn-left').classList.remove('selected');
  document.getElementById('btn-right').classList.remove('selected');
  document.getElementById('btn-left').disabled = false;
  document.getElementById('btn-right').disabled = false;

  startTimer();
}

function startTimer() {
  const bar = document.getElementById('timer-bar');
  bar.classList.remove('danger');
  bar.style.transition = 'none';
  bar.style.width = '100%';

  // Force reflow
  bar.getBoundingClientRect();

  timerStart = Date.now();

  bar.style.transition = `width ${TIMER_DURATION}ms linear`;
  bar.style.width = '0%';

  // Add danger color at ~1 second remaining
  setTimeout(() => {
    bar.classList.add('danger');
  }, TIMER_DURATION - 1000);

  timerInterval = setTimeout(() => {
    hesitate();
  }, TIMER_DURATION);
}

function clearTimer() {
  clearTimeout(timerInterval);
  timerInterval = null;
}

function choose(side) {
  clearTimer();

  const q = SCENARIOS[currentQ];
  const choiceData = side === 'left' ? q.left : q.right;

  choices.push({ side, hesitated: false, axis: q.axis, emoji: choiceData.emoji });

  // Track axis scores
  axisCounts[q.axis]++;
  if (choiceData.side === 1) {
    axisScores[q.axis]++;
  }

  // Highlight chosen button
  document.getElementById('btn-' + side).classList.add('selected');
  document.getElementById('btn-left').disabled = true;
  document.getElementById('btn-right').disabled = true;

  setTimeout(() => advance(), 350);
}

function hesitate() {
  const q = SCENARIOS[currentQ];
  choices.push({ side: 'hesitate', hesitated: true, axis: q.axis, emoji: '⏳' });
  axisCounts[q.axis]++;
  // Hesitation counts as neither side — no score increment

  const flash = document.getElementById('hesitate-flash');
  flash.classList.add('show');

  document.getElementById('btn-left').disabled = true;
  document.getElementById('btn-right').disabled = true;

  setTimeout(() => advance(), 700);
}

function advance() {
  currentQ++;
  if (currentQ >= SCENARIOS.length) {
    showResult();
  } else {
    loadQuestion(currentQ);
  }
}

function showResult() {
  // Normalize scores to 0..1
  const normalized = axisScores.map((s, i) =>
    axisCounts[i] > 0 ? s / axisCounts[i] : 0.5
  );

  // Find archetype
  const archetype = ARCHETYPES.find(a => a.match(normalized)) || ARCHETYPES[ARCHETYPES.length - 1];

  // Build emoji grid for share
  const emojiGrid = choices.map((c, i) => {
    const pair = SCENARIO_EMOJIS[i];
    if (c.hesitated) return '⏳⏳';
    if (c.side === 'left') return pair[0] + '⬛';
    return '⬛' + pair[1];
  }).join('\n');

  window._shareEmoji = `🎮 Decision Arcade\n${archetype.name}\n\n${emojiGrid}\n\nfind yours → ${location.href}`;

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

  // Count hesitations for flavor
  const hesitations = choices.filter(c => c.hesitated).length;
  let flavor = archetype.flavor;
  if (hesitations >= 3) {
    flavor += ' (You hesitated ' + hesitations + ' times — your gut has strong opinions it won\'t commit to.)';
  }
  document.getElementById('result-flavor').textContent = flavor;

  // Computing interstitial
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
    navigator.share({ title: document.title, text, url: location.href });
  } else {
    navigator.clipboard.writeText(text)
      .then(() => alert('Result copied to clipboard!'));
  }
}

// Touch/swipe support
let touchStartX = null;

document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (touchStartX === null) return;
  const screenGameActive = document.getElementById('screen-game').classList.contains('active');
  if (!screenGameActive) { touchStartX = null; return; }

  const dx = e.changedTouches[0].clientX - touchStartX;
  touchStartX = null;

  if (Math.abs(dx) < 60) return; // too small

  if (dx < 0 && !document.getElementById('btn-left').disabled) {
    choose('left');
  } else if (dx > 0 && !document.getElementById('btn-right').disabled) {
    choose('right');
  }
}, { passive: true });
