// Which Houseplant Are You Killing — five taps, one verdict, deterministic.
// All results are deterministic from the answer combo. URL fragment encodes answers
// so opening the link re-renders the same verdict.

// ----- questions -----
const QUESTIONS = [
  {
    id: 'light',
    prompt: 'The light situation where this plant will actually live:',
    options: [
      { key: 'L1', label: 'dark side of the room — it barely sees the window' },
      { key: 'L2', label: 'decent indirect light through a curtain or blind' },
      { key: 'L3', label: 'direct sun for a good chunk of the day' },
      { key: 'L4', label: 'honestly it varies — depends on the season or the room' }
    ]
  },
  {
    id: 'water',
    prompt: 'How you water, in honest terms:',
    options: [
      { key: 'W1', label: 'when it crosses my mind, which is rarely' },
      { key: 'W2', label: 'on a loose schedule I mostly forget about' },
      { key: 'W3', label: 'frequently — I find watering soothing' },
      { key: 'W4', label: 'in big bursts after long droughts — feast or famine' }
    ]
  },
  {
    id: 'schedule',
    prompt: 'Your week, described generously:',
    options: [
      { key: 'S1', label: 'I am home almost all the time' },
      { key: 'S2', label: 'in and out — errands, work, life' },
      { key: 'S3', label: 'regularly away overnight or longer' },
      { key: 'S4', label: 'wildly unpredictable — no two weeks are alike' }
    ]
  },
  {
    id: 'humidity',
    prompt: 'The air in your home is, by the plant\'s standards:',
    options: [
      { key: 'H1', label: 'dry — radiators, AC, desert vibes' },
      { key: 'H2', label: 'normal — nothing remarkable' },
      { key: 'H3', label: 'pleasantly humid — near a bathroom or kitchen' },
      { key: 'H4', label: 'I genuinely have no idea and have never thought about it' }
    ]
  },
  {
    id: 'attitude',
    prompt: 'Your plant-keeping philosophy, if forced to name it:',
    options: [
      { key: 'A1', label: 'benign neglect — they need to earn their keep' },
      { key: 'A2', label: 'anxious love — I worry but I act on the worry' },
      { key: 'A3', label: 'enthusiastic optimism — how bad can it go?' },
      { key: 'A4', label: 'guilty revisionism — I buy a new one each time' }
    ]
  }
];

// ----- result banks -----
const PLANTS = [
  { name: 'a fiddle leaf fig',                      tags: ['dramatic', 'overwater', 'underwater', 'low-light', 'bright-light', 'dry-air'] },
  { name: 'a monstera deliciosa',                   tags: ['overwater', 'bright-light', 'medium-light', 'feast-famine'] },
  { name: 'a calathea orbifolia',                   tags: ['overwater', 'underwater', 'humidity', 'medium-light', 'low-light', 'dry-air'] },
  { name: 'a ZZ plant',                             tags: ['overwater', 'low-light', 'neglect'] },
  { name: 'a peace lily',                           tags: ['underwater', 'low-light', 'medium-light', 'dry-air'] },
  { name: 'a snake plant',                          tags: ['overwater', 'low-light', 'medium-light', 'neglect'] },
  { name: 'a fern (the ill-advised one)',            tags: ['underwater', 'humidity', 'low-light', 'medium-light', 'dry-air'] },
  { name: 'a string of pearls',                     tags: ['overwater', 'underwater', 'bright-light', 'feast-famine'] },
  { name: 'a pothos that you swore was unkillable', tags: ['underwater', 'overwater', 'low-light', 'medium-light', 'bright-light', 'variable-light', 'feast-famine'] },
  { name: 'a bird of paradise',                     tags: ['underwater', 'bright-light', 'humidity', 'variable'] },
  { name: 'an air plant (somehow)',                 tags: ['underwater', 'humidity', 'dry-air', 'neglect'] },
  { name: 'a maidenhair fern',                      tags: ['underwater', 'humidity', 'medium-light', 'low-light', 'dry-air'] },
  { name: 'a philodendron pink princess',           tags: ['overwater', 'medium-light', 'bright-light', 'anxious'] },
  { name: 'an alocasia polly',                      tags: ['underwater', 'overwater', 'humidity', 'medium-light', 'dry-air'] },
  { name: 'a succulent of indeterminate species',   tags: ['overwater', 'bright-light', 'feast-famine', 'anxious'] },
  { name: 'an orchid that bloomed exactly once',    tags: ['overwater', 'underwater', 'medium-light', 'bright-light', 'anxious'] },
  { name: 'a croton',                               tags: ['variable-light', 'variable', 'dramatic', 'dry-air'] },
  { name: 'a rubber plant',                         tags: ['overwater', 'neglect', 'medium-light', 'low-light'] },
  { name: 'a prayer plant',                         tags: ['dry-air', 'humidity', 'medium-light', 'feast-famine'] }
];

const ARCHETYPES = [
  { name: 'The Overwaterer of Monstera',               tags: ['overwater', 'home'] },
  { name: 'The Devoted Drowner',                       tags: ['overwater', 'home', 'busy'] },
  { name: 'The Daily-Mister Romantic',                 tags: ['overwater', 'home', 'humidity'] },
  { name: 'The Anxious Soil-Toucher',                  tags: ['overwater', 'anxious'] },
  { name: 'The Dry-Spell Aristocrat',                  tags: ['underwater', 'travel', 'busy'] },
  { name: 'The Out-of-Sight, Out-of-Watering Mystic',  tags: ['underwater', 'travel', 'neglect'] },
  { name: 'The Romantic Forgetter',                    tags: ['underwater', 'busy', 'travel'] },
  { name: 'The Schedule-Collapse Specialist',          tags: ['underwater', 'travel', 'busy', 'variable'] },
  { name: 'The Curator of Artistic Gloom',             tags: ['low-light'] },
  { name: 'The Sun-Scorched Optimist',                 tags: ['bright-light'] },
  { name: 'The Sheer-Curtain Idealist',                tags: ['medium-light'] },
  { name: 'The Variable-Conditions Visionary',         tags: ['variable-light', 'variable'] },
  { name: 'The Departures-Lounge Patron',              tags: ['travel'] },
  { name: 'The Errands-Era Caretaker',                 tags: ['busy'] },
  { name: 'The Home-Bound Devotee',                    tags: ['home'] },
  { name: 'The Gentle Tragedian',                      tags: ['dramatic'] },
  { name: 'The Feast-or-Famine Philosopher',           tags: ['feast-famine'] },
  { name: 'The Optimistic Replacement Theorist',       tags: ['feast-famine', 'busy'] },
  { name: 'The Humidity Denier',                       tags: ['dry-air', 'neglect'] },
  { name: 'The Silent Witness',                        tags: ['low-light', 'travel', 'neglect'] }
];

const DEATHS = [
  // overwater + low-light
  { tags: ['overwater', 'low-light'], text: 'Its roots will quietly go to soup over six unobserved weeks while you keep meaning to "let it dry out next time."' },
  { tags: ['overwater', 'low-light'], text: 'A soft black spot will appear at the base of one stem on a Tuesday, and by the weekend the whole plant will have folded like wet origami.' },
  { tags: ['overwater', 'low-light'], text: 'The leaves will yellow from the inside out in a slow, polite collapse you only notice during a video call.' },

  // overwater + medium-light
  { tags: ['overwater', 'medium-light'], text: 'It will throw one beautiful new leaf, drop two old ones in protest, and dissolve into the saucer over a long, generous month.' },
  { tags: ['overwater', 'medium-light'], text: 'You will keep adding water "just to be safe" and it will rot from the bottom up in near-total silence.' },
  { tags: ['overwater', 'medium-light'], text: 'A faint smell will arrive before the visible damage does — by the time you investigate, it is already a memorial.' },

  // overwater + bright-light
  { tags: ['overwater', 'bright-light'], text: 'It will look magnificent for eleven days and then collapse all at once, like a soufflé you opened the oven on.' },
  { tags: ['overwater', 'bright-light'], text: 'The roots will boil in their own kindness — bright sun, wet soil, a closed pot, a closed case.' },
  { tags: ['overwater', 'bright-light'], text: 'You will overwater it on a sunny Sunday and discover the consequences on a sunny Saturday.' },

  // underwater + low-light
  { tags: ['underwater', 'low-light'], text: 'Its leaves will brown from the tips inward over nine silent weeks while you remain almost certain you watered it last Thursday.' },
  { tags: ['underwater', 'low-light'], text: 'It will desiccate in slow, dignified shifts of beige until even the stem is a polite suggestion of itself.' },
  { tags: ['underwater', 'low-light'], text: 'You will return to it after a long absence and find a perfectly preserved silhouette of the plant it used to be.' },

  // underwater + medium-light
  { tags: ['underwater', 'medium-light'], text: 'It will crisp at the edges, then drop one leaf per week in mild reproach until there is only the stem and your guilt.' },
  { tags: ['underwater', 'medium-light'], text: 'You will mean to water it tomorrow for forty-seven consecutive tomorrows.' },
  { tags: ['underwater', 'medium-light'], text: 'It will go from "I should water that" to "I cannot save that" in approximately one weekend trip.' },

  // underwater + bright-light
  { tags: ['underwater', 'bright-light'], text: 'The afternoon sun will finish what your travel schedule started, and it will go to brittle hay in under a fortnight.' },
  { tags: ['underwater', 'bright-light'], text: 'You will witness, in real time, a plant deciding it would rather be a dried arrangement.' },
  { tags: ['underwater', 'bright-light'], text: 'It will roast gently in the windowsill while your watering can sits in the sink, full and accusatory.' },

  // feast-famine
  { tags: ['feast-famine', 'overwater'], text: 'It will receive a week\'s worth of water in a single enthusiastic session and spend the following month recovering from your love.' },
  { tags: ['feast-famine', 'underwater'], text: 'It will survive the drought, only to be flooded on the day you feel guilty about it. The cycle will repeat until one of you gives up.' },
  { tags: ['feast-famine'], text: 'Your watering schedule is a work of unpredictable fiction, and the plant will adapt briefly before deciding not to.' },

  // variable-light
  { tags: ['variable-light', 'dramatic'], text: 'It will throw a leaf the moment you find a good spot, then drop two when you move it. This negotiation will outlast your patience.' },
  { tags: ['variable-light'], text: 'It will adjust to one light level and then you will rearrange the room, and it will begin its quiet exit.' },

  // dry-air
  { tags: ['dry-air', 'humidity'], text: 'Every leaf will curl inward like it is keeping a secret, and within weeks the secret turns out to be that it is dead.' },
  { tags: ['dry-air'], text: 'It will spend its short life staging tiny humidity protests — crispy edges, dropped fronds, a steady papery crackle whenever you walk past.' },
  { tags: ['dry-air', 'low-light'], text: 'Without enough light or moisture, it will perform a very slow, very dignified disappearing act across your winter.' },

  // neglect
  { tags: ['neglect', 'low-light'], text: 'You will discover it on a shelf and be briefly surprised that it is still there, then less surprised when it is not.' },
  { tags: ['neglect'], text: 'It will be fine for much longer than it deserves, and then suddenly, completely, and without warning, not.' },

  // anxious
  { tags: ['anxious', 'overwater'], text: 'You will check on it so often that it will never quite dry out between visits, and your devotion will be its undoing.' },
  { tags: ['anxious'], text: 'You will read twelve articles about its care requirements, follow none of them consistently, and feel bad about it for months.' },

  // travel/schedule fallback
  { tags: ['travel'], text: 'It will perish in the gap between two trips, in the exact week you forgot to ask anyone to check on it.' },
  { tags: ['busy'],   text: 'It will not survive the week you have "too much going on," and the week you have too much going on is, generously, every week.' },
  { tags: ['home'],   text: 'You will love it to death from approximately three feet away, attentively, daily, and far too generously.' },

  // specific combos
  { tags: ['overwater', 'home'], text: 'It will be the first ZZ plant in recorded history to be truly, conclusively over-loved.' },
  { tags: ['underwater', 'travel'], text: 'It will be discovered, mid-mummification, by whoever house-sits for you next.' }
];

// ----- helpers -----
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickBy(arr, tags, seed) {
  let best = [];
  let bestScore = -1;
  for (const item of arr) {
    let score = 0;
    for (const t of tags) if (item.tags.includes(t)) score++;
    if (score > bestScore) { bestScore = score; best = [item]; }
    else if (score === bestScore) best.push(item);
  }
  if (best.length === 0) best = arr.slice();
  return best[seed % best.length];
}

function tagsFromAnswers(a) {
  // a = { light, water, schedule, humidity, attitude }
  const tags = [];

  // Light
  if (a.light === 'L1') tags.push('low-light');
  if (a.light === 'L2') tags.push('medium-light');
  if (a.light === 'L3') tags.push('bright-light');
  if (a.light === 'L4') tags.push('variable-light');

  // Watering tendency
  if (a.water === 'W1') tags.push('underwater');
  if (a.water === 'W2') tags.push('underwater'); // loose schedule leans under
  if (a.water === 'W3') tags.push('overwater');
  if (a.water === 'W4') tags.push('feast-famine', 'underwater');

  // Schedule
  if (a.schedule === 'S1') tags.push('home');
  if (a.schedule === 'S2') tags.push('busy');
  if (a.schedule === 'S3') tags.push('travel');
  if (a.schedule === 'S4') tags.push('variable', 'busy', 'travel');

  // Cross-signal refinements
  if (a.water === 'W2' && a.schedule === 'S1') {
    // Home all the time + loose schedule = likely tips toward overwater
    tags.splice(tags.indexOf('underwater'), 1);
    tags.push('overwater');
  }

  // Humidity / environment
  if (a.humidity === 'H1') tags.push('dry-air');
  if (a.humidity === 'H2') { /* neutral — no tag */ }
  if (a.humidity === 'H3') tags.push('humidity');
  if (a.humidity === 'H4') tags.push('dry-air'); // unaware of humidity = probably dry

  // Attitude
  if (a.attitude === 'A1') tags.push('neglect');
  if (a.attitude === 'A2') tags.push('anxious', 'overwater');
  if (a.attitude === 'A3') tags.push('feast-famine');
  if (a.attitude === 'A4') tags.push('feast-famine', 'neglect');

  // Dramatic flag for highest-stakes combos
  if (a.water === 'W3' && a.light === 'L1') tags.push('dramatic');
  if (a.water === 'W1' && a.schedule === 'S3') tags.push('dramatic');
  if (a.light === 'L4' && a.attitude === 'A3') tags.push('dramatic');

  return tags;
}

function bareName(plantName) {
  return plantName.replace(/^(a |an |the )/i, '');
}

function compute(a) {
  const seedStr = `${a.light}|${a.water}|${a.schedule}|${a.humidity}|${a.attitude}`;
  const seed = hash(seedStr);
  const tags = tagsFromAnswers(a);

  const plant     = pickBy(PLANTS,     tags, seed);
  const archetype = pickBy(ARCHETYPES, tags, seed >> 3);
  const death     = pickBy(DEATHS,     tags, seed >> 6);
  const caseNo    = String(1000 + (seed % 8999));

  return {
    plant: plant.name,
    archetype: archetype.name,
    death: death.text.replace('{plant}', bareName(plant.name)),
    caseNo
  };
}

// ----- loading messages -----
const LOADING_LINES = [
  'consulting the windowsill morgue\u2026',
  'cross-referencing your light against the obituary index\u2026',
  'measuring the dust on your watering can\u2026',
  'pressing a thumb to the soil of probability\u2026',
  'thumbing through the catalogue of well-meant murders\u2026',
  'weighing your humidity against the historical record\u2026',
  'cross-filing your attitude under "contributing factors"\u2026'
];

// ----- DOM rendering -----
const state = {
  answers: { light: null, water: null, schedule: null, humidity: null, attitude: null },
  step: 0
};

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'className') e.className = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

function renderQuiz() {
  const root = document.getElementById('quiz');
  root.innerHTML = '';
  QUESTIONS.forEach((q, i) => {
    const screen = el('div', { className: 'q-screen' + (i === state.step ? ' active' : '') });
    screen.appendChild(el('div', { className: 'q-counter' }, `Question ${i + 1} of ${QUESTIONS.length}`));
    screen.appendChild(el('h2', { className: 'q-prompt' }, q.prompt));
    const list = el('ul', { className: 'q-options' });
    q.options.forEach((opt, j) => {
      const li = el('li');
      const btn = el('button', {
        className: 'q-opt',
        type: 'button',
        onclick: () => choose(q.id, opt.key)
      });
      btn.appendChild(el('span', { className: 'marker' }, String.fromCharCode(65 + j) + '.'));
      btn.appendChild(document.createTextNode(opt.label));
      li.appendChild(btn);
      list.appendChild(li);
    });
    screen.appendChild(list);
    root.appendChild(screen);
  });
}

function showStep(i) {
  document.querySelectorAll('.q-screen').forEach((s, idx) => {
    s.classList.toggle('active', idx === i);
  });
}

function choose(qid, key) {
  state.answers[qid] = key;
  state.step++;
  if (state.step < QUESTIONS.length) {
    showStep(state.step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    finish();
  }
}

function finish() {
  document.getElementById('quiz').classList.add('hidden');
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');
  const seed = hash(`${state.answers.light}|${state.answers.water}|${state.answers.schedule}|${state.answers.humidity}|${state.answers.attitude}`);
  document.getElementById('loading-text').textContent = LOADING_LINES[seed % LOADING_LINES.length];

  const frag = `${state.answers.light}-${state.answers.water}-${state.answers.schedule}-${state.answers.humidity}-${state.answers.attitude}`;
  history.replaceState(null, '', '#' + frag);

  setTimeout(() => {
    loading.classList.add('hidden');
    renderResult(compute(state.answers));
  }, 900);
}

function renderResult(r) {
  document.getElementById('archetype').textContent = r.archetype;
  document.getElementById('plant').textContent = r.plant;
  document.getElementById('death').textContent = r.death;
  document.getElementById('case-no').textContent = '\u2116 ' + r.caseNo;
  const result = document.getElementById('result');
  result.classList.remove('hidden');
  window.__verdict = r;
  setTimeout(() => result.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function restart() {
  state.answers = { light: null, water: null, schedule: null, humidity: null, attitude: null };
  state.step = 0;
  history.replaceState(null, '', location.pathname + location.search);
  document.getElementById('result').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('quiz').classList.remove('hidden');
  renderQuiz();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function tryRestoreFromFragment() {
  const frag = location.hash.replace(/^#/, '');
  const m = /^(L[1-4])-(W[1-4])-(S[1-4])-(H[1-4])-(A[1-4])$/.exec(frag);
  if (!m) return false;
  const [_, L, W, S, H, A] = m;
  state.answers = { light: L, water: W, schedule: S, humidity: H, attitude: A };
  state.step = QUESTIONS.length;
  document.getElementById('quiz').classList.add('hidden');
  renderResult(compute(state.answers));
  return true;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2300);
}

function share() {
  const v = window.__verdict;
  const caption = v
    ? `apparently I'm ${v.archetype} and I'm killing ${v.plant} as we speak.\n\n${location.href}`
    : location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, text: caption, url: location.href }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(caption).then(
      () => toast('confession copied'),
      () => toast('couldn\u2019t copy — long-press the link instead')
    );
  } else {
    toast('copy this link manually');
  }
}

// ----- init -----
document.addEventListener('DOMContentLoaded', () => {
  renderQuiz();
  if (!tryRestoreFromFragment()) {
    showStep(0);
  }
});
