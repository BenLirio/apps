// The Library of Returned Books — pick 4 books off the cart,
// the librarian hands you the letter the previous patron left tucked inside.
// Deterministic: the same 4 books always produce the same patron + letter on share-replay.

const SLUG = 'library-of-returned-books';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const CASE_STORE_BASE = 'https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com';

// ---------- Twelve spine titles, weirdly specific ----------
const BOOKS = [
  { id: 0,  t: "Field Guide to Wrong Turns",                bg: "#3a4574", fg: "#f3e8c7" },
  { id: 1,  t: "Cookbook for Funerals",                     bg: "#b13a2a", fg: "#f3e8c7" },
  { id: 2,  t: "How to Lose at Cards on Purpose",           bg: "#1c2a52", fg: "#f3e8c7" },
  { id: 3,  t: "Atlas of Empty Hotel Pools",                bg: "#7a5a2e", fg: "#f3e8c7" },
  { id: 4,  t: "A Short History of Other People's Porches", bg: "#2a221a", fg: "#e7d8a8" },
  { id: 5,  t: "Letters Never Mailed, Vol. III",            bg: "#5b4a36", fg: "#f3e8c7" },
  { id: 6,  t: "Catalog of Sounds the House Made at 3 AM",  bg: "#3b6e6a", fg: "#f3e8c7" },
  { id: 7,  t: "Knots You Will Forget by Morning",          bg: "#8b3a55", fg: "#f3e8c7" },
  { id: 8,  t: "The Phonebook of People Who Owe Me",        bg: "#d8634d", fg: "#1c2a52" },
  { id: 9,  t: "What to Say at the Hardware Store",         bg: "#445e2a", fg: "#f3e8c7" },
  { id:10,  t: "Birdwatching for the Recently Divorced",    bg: "#62528b", fg: "#f3e8c7" },
  { id:11,  t: "An Inventory of My Father's Pockets",       bg: "#1c2a52", fg: "#d8634d" },
];

// ---------- Deterministic helpers ----------
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function seededRng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0;
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function comboKey(picks) {
  return picks.slice().sort((a,b)=>a-b).join(',');
}

// ---------- Patron + date generator ----------
const FIRST_NAMES = [
  "Eleanor","Marvin","Dolores","Theo","Constance","Hank","Maeve","Wendell",
  "Iris","Bernard","Ruth","Otis","Imogen","Floyd","Sylvia","Cyrus",
  "Hazel","Roland","Beatrice","Mort","Junie","Wallace","Esme","Norbert",
];
const LAST_NAMES = [
  "Hollis","Kovach","Pemberton","Yates","Greer","Vasko","Aldridge","Dunn",
  "Thatcher","Brock","Mendelsohn","Crain","Halloran","Pike","Easton","Saito",
  "Fenwick","Coulter","Lowery","Strange","Arden","Boyle","Whitten","Fournier",
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SIGNOFFS = [
  "Yours, with the lights left on.",
  "Quietly, then,",
  "From the back of the room,",
  "Still here, still listening.",
  "Until the next quiet week,",
  "From a town you have not heard of,",
  "Yours, in the long way back,",
  "Faithfully and a little late,",
  "From the chair by the window,",
  "From whoever returns these books after me,",
  "With the dust still on my coat,",
  "Yours, between trains,",
];

function makePatron(picks) {
  const rng = seededRng(hashStr("patron|" + comboKey(picks)));
  const first = pick(rng, FIRST_NAMES);
  const last  = pick(rng, LAST_NAMES);
  // Date between 1962 and 2003, biased toward "old enough to be a stranger"
  const year  = 1962 + Math.floor(rng() * 42);
  const month = Math.floor(rng() * 12);
  const day   = 1 + Math.floor(rng() * 28);
  const sign  = pick(rng, SIGNOFFS);
  // Card numbers (just for flavor on the overdue card)
  const cardNo = 1000 + Math.floor(rng() * 8999);
  return {
    name: `${first} ${last}`,
    dateISO: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    dateHuman: `${MONTHS[month]} ${day}, ${year}`,
    dateShort: `${String(month+1).padStart(2,'0')}/${String(day).padStart(2,'0')}/${String(year).slice(-2)}`,
    signoff: sign,
    cardNo,
  };
}

// ---------- Deterministic fallback letters ----------
// Used if AI proxy fails. Stitched from seeded fragments referencing the picks.
const F_OPENERS = [
  "I checked these out the week",
  "I borrowed these in the year",
  "I took these home the autumn",
  "I asked the librarian for these the spring",
  "I found these on the cart the summer",
  "I carried these home in the dead of winter",
];
const F_REASONS = [
  "my brother left for somewhere far",
  "the house got quiet for the first time",
  "I started saying yes to things again",
  "the lease ran out and I had nowhere in particular",
  "my mother stopped writing back",
  "I learned to drive in someone else's car",
  "I was waiting for a phone call that never came",
  "the dog had been gone exactly six months",
];
const F_LINES = [
  "Each one earned its dust.",
  "I read them in the order they sat on the cart.",
  "Two I finished. The other two I just held.",
  "I underlined nothing. I wanted to remember the shape, not the sentences.",
  "I returned them late. I am sorry about that.",
  "I think I borrowed them because nobody at home asked what I was reading.",
  "I do not remember most of what they said. I remember the chair I sat in.",
  "If you find a pressed leaf in any of them — that was on purpose.",
];
function fallbackLetter(picks, patron) {
  const rng = seededRng(hashStr("letter|" + comboKey(picks)));
  const opener = pick(rng, F_OPENERS);
  const reason = pick(rng, F_REASONS);
  const l1 = pick(rng, F_LINES);
  const l2 = pick(rng, F_LINES.filter(x => x !== l1));
  const titles = picks.map(i => `“${BOOKS[i].t}”`);
  const lastTitle = titles.pop();
  const list = titles.join(", ") + ", and " + lastTitle;
  return `${patron.dateHuman}. — ${opener} ${reason}. The four were ${list}. ${l1}\n\n${l2}`;
}

// ---------- AI letter generation ----------
async function generateLetter(picks, patron) {
  const titles = picks.map(i => BOOKS[i].t);
  const system = [
    "You are a fictional library patron from a specific date in the past, writing a brief, melancholic, first-person letter explaining why you borrowed these four very specific books in this exact combination.",
    "Strict rules:",
    "- Write IN CHARACTER as the patron. Never break the fourth wall. Never address \"the user\" or \"the reader\". Never explain that this is AI-generated, or that this is a game.",
    "- The letter is left tucked inside the books. It is FROM you, the patron, to whoever borrows them next.",
    "- Open with the date in the form \"September 14, 1987. — \" then a short first-person observation.",
    "- 5 to 8 sentences total. Quiet, melancholic, specific. Not sad in a self-pitying way — just honest, a little dry, a little tender. Think Marilynne Robinson, John Berger, Mary Oliver.",
    "- Reference at least three of the four book titles, but do so naturally, as if explaining why each fit the moment.",
    "- One concrete sensory detail (a smell, a weather, an object on a counter, a small sound).",
    "- No emojis. No hashtags. No exclamation marks. No quoted dialogue. No second person.",
    "- Output ONLY the body of the letter — no signoff, no signature, no salutation. The signoff and name are added separately.",
  ].join("\n");

  const user = [
    `Patron name: ${patron.name}`,
    `Date: ${patron.dateHuman}`,
    `The four books they borrowed (in the order they grabbed them):`,
    ...titles.map((t,i) => `  ${i+1}. ${t}`),
    "",
    "Write the body of the letter the patron left tucked inside these four books.",
  ].join("\n");

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 360,
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let txt = (data && data.content || '').trim();
    // Strip stray quotes / signature lines if the model added any.
    txt = txt.replace(/^["']+|["']+$/g, '').trim();
    // Drop trailing signoff lines if the model snuck one in.
    txt = txt.replace(/\n\s*[-—–]+\s*[A-Z][a-zA-Z .'-]+\s*$/m, '').trim();
    return txt || fallbackLetter(picks_currentNormalized(picks), patron);
  } catch (_) {
    return fallbackLetter(picks_currentNormalized(picks), patron);
  }
}
function picks_currentNormalized(picks) { return picks.slice().sort((a,b)=>a-b); }

// ---------- Case store ----------
async function saveCaseToStore(data) {
  try {
    const res = await fetch(CASE_STORE_BASE + '/case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, data }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j && j.id || null;
  } catch (_) { return null; }
}
async function loadCaseFromStore(id) {
  try {
    const res = await fetch(CASE_STORE_BASE + '/case/' + encodeURIComponent(id));
    if (!res.ok) return null;
    const j = await res.json();
    return j && j.data || null;
  } catch (_) { return null; }
}

// ---------- State ----------
const state = {
  picks: [],   // ordered by tap order, length 0..4
  patron: null,
  letter: null,
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

function renderRack() {
  const rack = $('book-rack');
  rack.innerHTML = '';
  // Slight per-book tilt for that hand-shelved feel — but seeded so it's consistent.
  const rng = seededRng(0xb00c5);
  BOOKS.forEach((b) => {
    const el = document.createElement('div');
    el.className = 'book';
    el.style.setProperty('--bk-bg', b.bg);
    el.style.setProperty('--bk-fg', b.fg);
    const tilt = ((rng() - .5) * 4).toFixed(2);
    el.style.transform = `rotate(${tilt}deg)`;
    el.dataset.id = String(b.id);
    el.setAttribute('role', 'option');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-selected', 'false');
    el.innerHTML = `
      <div class="deco-band top"></div>
      <div class="spine">${escapeHtml(b.t)}</div>
      <div class="deco-band bottom"></div>
    `;
    el.addEventListener('click', () => togglePick(b.id, el));
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        togglePick(b.id, el);
      }
    });
    rack.appendChild(el);
  });
  syncRackUI();
}

function syncRackUI() {
  const items = document.querySelectorAll('#book-rack .book');
  const set = new Set(state.picks);
  items.forEach((el) => {
    const id = Number(el.dataset.id);
    const isPicked = set.has(id);
    el.classList.toggle('picked', isPicked);
    el.setAttribute('aria-selected', isPicked ? 'true' : 'false');
    if (!isPicked && state.picks.length >= 4) {
      el.classList.add('disabled');
    } else {
      el.classList.remove('disabled');
    }
  });
  $('picked-count').textContent = String(state.picks.length);
  $('check-btn').disabled = state.picks.length !== 4;
}

function togglePick(id) {
  const i = state.picks.indexOf(id);
  if (i >= 0) {
    state.picks.splice(i, 1);
  } else {
    if (state.picks.length >= 4) return;
    state.picks.push(id);
  }
  syncRackUI();
}

function showScreen(which) {
  ['cart-screen','loading-screen','result-screen'].forEach((s) => {
    $(s).classList.toggle('hidden', s !== which);
  });
  // scroll to top on screen change
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------- Loading lines ----------
const LOADING_LINES = [
  "the librarian is rummaging in the back office…",
  "checking the index cards under the brass lamp…",
  "the cat has not been moved…",
  "the typewriter is warming up — give it a moment…",
  "looking up who had these last…",
  "the date stamp is sticking again…",
  "found the slip. reading the handwriting…",
];
function rollingLoading() {
  const el = $('loading-line');
  if (!el) return null;
  let i = Math.floor(Math.random() * LOADING_LINES.length);
  el.textContent = LOADING_LINES[i];
  const t = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    el.textContent = LOADING_LINES[i];
  }, 1500);
  return t;
}

// ---------- Reveal flow ----------
async function checkSlips() {
  if (state.picks.length !== 4) return;
  showScreen('loading-screen');
  const t = rollingLoading();
  const minDelay = new Promise((r) => setTimeout(r, 1000));

  const sortedPicks = state.picks.slice().sort((a,b)=>a-b);
  state.patron = makePatron(sortedPicks);
  const [letterText] = await Promise.all([
    generateLetter(sortedPicks, state.patron),
    minDelay,
  ]);
  state.letter = letterText;

  if (t) clearInterval(t);
  renderResult();
  await persistShareLink();
}

function renderResult() {
  const sortedPicks = state.picks.slice().sort((a,b)=>a-b);
  $('oc-name').textContent = state.patron.name;
  $('oc-date').textContent = state.patron.dateShort;

  const list = $('oc-list');
  list.innerHTML = '';
  // Show in the order the user actually picked them (storytelling order).
  state.picks.forEach((id) => {
    const b = BOOKS[id];
    const li = document.createElement('li');
    li.innerHTML = `<span class="ttl">"${escapeHtml(b.t)}"</span><span class="num">CARD #${state.patron.cardNo + id}</span>`;
    list.appendChild(li);
  });

  $('letter-date').textContent = state.patron.dateHuman + '.';
  $('letter-body').textContent = state.letter;
  $('letter-signoff').textContent = state.patron.signoff;
  $('letter-name').textContent = '— ' + state.patron.name;

  showScreen('result-screen');
}

// ---------- Share / replay ----------
async function persistShareLink() {
  const sortedPicks = state.picks.slice().sort((a,b)=>a-b);
  const payload = JSON.stringify({
    v: 1,
    picks: sortedPicks,
    order: state.picks.slice(),
    letter: state.letter,
    patron: state.patron,
  });
  const id = await saveCaseToStore(payload);
  const url = new URL(location.href);
  url.search = id ? ('?c=' + id) : '';
  url.hash = '';
  history.replaceState(null, '', url.toString());
}

async function hydrateFromLink() {
  const params = new URLSearchParams(location.search);
  const id = params.get('c');
  if (!id) return false;
  const data = await loadCaseFromStore(id);
  if (!data) return false;
  let parsed;
  try { parsed = JSON.parse(data); } catch (_) { return false; }
  if (!parsed || !Array.isArray(parsed.picks) || parsed.picks.length !== 4) return false;

  state.picks = (Array.isArray(parsed.order) && parsed.order.length === 4) ? parsed.order.slice() : parsed.picks.slice();
  state.patron = parsed.patron || makePatron(parsed.picks.slice().sort((a,b)=>a-b));
  state.letter = parsed.letter || fallbackLetter(parsed.picks.slice().sort((a,b)=>a-b), state.patron);
  renderResult();
  return true;
}

// ---------- Share API ----------
function share() {
  const url = location.href;
  const text = state.patron
    ? `the library kept the slip from ${state.patron.name}, ${state.patron.dateHuman}`
    : "a letter from a stranger I never met";
  if (navigator.share) {
    navigator.share({ title: document.title, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(
      () => alert('Link copied — share to read the same letter on the other end.'),
      () => prompt('Copy this link:', url)
    );
  }
}
window.share = share;

// ---------- Misc ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function resetAndPickAgain() {
  state.picks = [];
  state.patron = null;
  state.letter = null;
  // Clear the share link
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  history.replaceState(null, '', url.toString());
  syncRackUI();
  showScreen('cart-screen');
}

// ---------- Boot ----------
(async function boot() {
  renderRack();

  // If we have a `?c=` link, hydrate to result screen instead of cart screen.
  const hydrated = await hydrateFromLink();
  if (!hydrated) {
    showScreen('cart-screen');
  }

  $('check-btn').addEventListener('click', checkSlips);
  $('redo-btn').addEventListener('click', resetAndPickAgain);
})();
