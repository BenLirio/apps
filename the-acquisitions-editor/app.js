// The Acquisitions Editor
// One paragraph in. A four-line letter from a jaded mid-list editor out.
// Deterministic skeleton (press, editor, verdict, ref no.) + AI-generated body, comp title, advance.

const SLUG = 'the-acquisitions-editor';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

// -------------------- Deterministic data tables --------------------

// Imagined small-press names. Should sound real-but-obscure.
const PRESSES = [
  'PALE OWL PRESS',
  'GREAT NORTHERN BOOKS',
  'KETTLEBLACK & SONS',
  'THIRD AVENUE EDITIONS',
  'CARRIAGE LANE PRESS',
  'GREYHOUND IMPRINT',
  'LOW LIGHT BOOKS',
  'MUTUAL & DAUGHTER',
  'SLATE PIGEON PRESS',
  'WINDOWBOX EDITIONS',
  'NORTH FORK & CO.',
  'TINFOIL HOUSE',
  'OAK POND PRESS',
  'HUNDRED-YEAR PRESS',
  'BACKLIT BOOKS',
  'COLD RIVER EDITIONS',
  'SMALL HOURS PRESS',
  'EVENING POST BOOKS',
  'TENTH FLOOR PRESS',
  'BROWN PAPER & CO.'
];

// Editors. Pick one; use it as the signoff.
const EDITORS = [
  { name: 'Margaret Holcombe',     title: 'Acquisitions Editor' },
  { name: 'Devin Marsh',           title: 'Senior Editor, Nonfiction' },
  { name: 'Lila Renner',           title: 'Editorial Director' },
  { name: 'Theo Pell',             title: 'Acquisitions Editor' },
  { name: 'Iris Kosko',            title: 'Editor at Large' },
  { name: 'Wesley Brand',          title: 'Acquisitions Editor' },
  { name: 'Hannah Quinn',          title: 'Senior Editor' },
  { name: 'Rafael Ocampo',         title: 'Acquisitions Editor' },
  { name: 'Pria Anand',            title: 'Editor, Original Voices' },
  { name: 'Jules Etheridge',       title: 'Acquisitions Editor' },
  { name: 'Beatrice Vorhees',      title: 'Editor, Backlist Revivals' },
  { name: 'Ned Calloway',          title: 'Acquisitions Editor' },
  { name: 'Sloan Petruska',        title: 'Senior Editor' },
  { name: 'Cordelia Fitch',        title: 'Acquisitions Editor' },
  { name: 'Olive Henson',          title: 'Editorial Director' }
];

// Verdict pool. Weighted toward "acquire" because the dollar figure makes it funnier.
const VERDICTS = [
  'acquire', 'acquire', 'acquire', 'acquire',
  'maybe', 'maybe',
  'reject'
];

// Loading messages — the desk is doing something specific and absurd.
const LOADING_MESSAGES = [
  'opening your envelope with a butter knife...',
  'the editor is finding her glasses...',
  'someone is feeding the office cat. one moment.',
  'the editor is sighing audibly...',
  'consulting the sales team. badly.',
  'a fax machine is being woken up...',
  'someone is yelling about marketing...',
  'the editor is rereading the second paragraph...',
  'pulling the comp title from a tote bag...',
  'the publisher is on a call. two minutes.',
  'the intern is photocopying your pitch sideways...',
  'the editor is making a face. it could mean anything.',
  'the radiator is louder than the discussion...',
  'someone has remembered they have your manuscript...'
];

// Fallback tables (used only if the AI call fails)
const FALLBACK_LINES = {
  acquire: [
    'I read your pitch on the train and laughed out loud, which is unprofessional but a real signal.',
    'The premise is small enough to be real and weird enough to be ours; we want it.',
    'We can move quickly. Marketing already has three terrible cover ideas, which is two more than usual.',
    'Send the full proposal by month-end and I will start clearing my desk for it.'
  ],
  maybe: [
    'There is something here. Small, but a real shape, and not yet flattened by the obvious comps.',
    'I am circulating the pitch internally; if it survives Wednesday\'s list meeting we will be in touch.',
    'The advance below is what I can defend on a slow day; it will not move much.',
    'If this lands with you we move forward; if not, no hard feelings, the radiator already has them.'
  ],
  reject: [
    'I want to be honest with you because somebody should have been by now.',
    'I love the corner of the world this lives in, but I cannot find the shelf to put it on.',
    'Our list is full of these and our sales team is tired of the look I make when I bring them in.',
    'Please pitch me again in eighteen months; the building may have collapsed, but I will still be here.'
  ]
};

const FALLBACK_COMPS = [
  '"Dust on the Rim" by Hollis Tanner',
  '"The Late Onion" by P.M. Crewe',
  '"Marginalia for the Bored" by Joan Skerritt',
  '"Soft Inventory" by Devin Marsh',
  '"Lower Manhattan, Bored" by Quill Ostrander',
  '"The Receipts" by Mara Velo',
  '"Close Reading the Vending Machine" by Asa Penberthy',
  '"Notes from the Annex" by Rufus Plover',
  '"Quiet Hobbies, Loud Failures" by Honora Beltz',
  '"A Field Guide to Grudges" by Calder Imm'
];

// Salutation bank — small flavor variation
const SALUTATIONS = [
  'Re: your submission.',
  'Re: the pitch you sent yesterday.',
  'Re: thank you for the pages.',
  'Re: your unsolicited query.',
  'Re: your pitch (forwarded by an assistant).'
];

// Starter pitches — the fix for "idk what to write". These are concrete,
// absurd, and pre-baked. User picks one, can send as-is or edit. Each one
// shows the user what "a pitch" looks like without forcing them to invent.
const STARTERS = [
  {
    label: 'Squirrel feud memoir',
    text: 'A 280-page memoir about my decade-long feud with the squirrels who live in my mother-in-law\'s attic, including the color-coded spreadsheet where I rank them by malice and the three I\'ve given names to.'
  },
  {
    label: 'Gas station coffee',
    text: 'A field guide to gas station coffee at exits 12-47 on I-90 west. I have been rating them on a 14-point rubric since 2019. There is a villain (exit 31) and a quiet hero (exit 22, unmarked pot).'
  },
  {
    label: 'Elevator small talk',
    text: 'A taxonomy of elevator small talk in my 47-story office building, compiled from 600 rides. Includes the six recurring archetypes, the two lines that always work, and the one floor where nobody ever speaks.'
  },
  {
    label: 'Grocery list archive',
    text: 'I have kept every grocery list I\'ve written since 2011. Four hundred and twelve lists. A book about what they add up to — a slow, accidental portrait of a life in onions, regret, and paper towels.'
  },
  {
    label: 'Vending machine',
    text: 'Close reading of the vending machine on the third floor of my office: its patterns, its betrayals, the one slot (B4) that has held the same pack of peanut butter crackers since 2022.'
  },
  {
    label: 'Neighbor cats',
    text: 'A year-long observational study of the 11 cats on my block, told through the lens of their rivalries, their routes, and one slow-moving turf war over a single sunny porch on Elm Street.'
  },
  {
    label: 'Laundromat regulars',
    text: 'Portraits of the six regulars at the 24-hour laundromat on Oak Ave, including the man who only comes at 3am and the woman who folds her sheets like she is making an apology to someone.'
  },
  {
    label: 'DMV dispatch',
    text: 'Field dispatches from 46 visits to the DMV over three years, including the unspoken seating hierarchy, the two employees everyone is quietly in love with, and a theory about the ficus.'
  },
  {
    label: 'Library book smell',
    text: 'An essay collection on the smell of specific library books, cross-referenced by decade and binding glue, with a long chapter on the 1978 Funk & Wagnalls that ruined an entire summer for me.'
  },
  {
    label: 'Thermostat war',
    text: 'A marriage told through the thermostat: 14 years, 68 degrees, 47 undocumented adjustments, and the notebook I started keeping in 2021 without telling him.'
  },
  {
    label: 'Bodega cats',
    text: 'A census of every bodega cat in a 14-block radius of my apartment, their names (real and assigned), their politics, and the one cat (Mister, on 84th) who I believe is running something.'
  },
  {
    label: 'Wrong number texts',
    text: 'Every wrong number text I\'ve received in the last six years, organized by vibe, with a long chapter on "Brenda," who texted me seven times in 2022 to coordinate a funeral I had no part in.'
  },
  {
    label: 'Office coffee maker',
    text: 'A 200-page biography of the Mr. Coffee on the 4th floor of my office: its three previous stewards, the Great Spill of 2019, and the unspoken rule about who is allowed to change the filter.'
  },
  {
    label: 'Parking lot rules',
    text: 'The unwritten rules of my apartment complex\'s parking lot, in a 12-chapter treatise, including the lore of space 14 (cursed), the pickup truck that has not moved since October, and the quiet mayor.'
  },
  {
    label: 'Cereal box shrinkage',
    text: 'A forensic accounting of cereal box shrinkage, 2008-present, with photos, grams, and a chapter on the box that got so small it now fits in the silverware drawer, for sociological reasons.'
  },
  {
    label: 'Hold music',
    text: 'A listener\'s guide to corporate hold music. 200+ hours logged. There are recurring motifs, a handful of genuine compositions, and one insurance company whose hold music I think about at night.'
  },
  {
    label: 'Receipt archive',
    text: 'Fifteen years of receipts, taped into notebooks, annotated. A memoir told sideways — through gas, gum, and the one CVS trip in 2016 where everything changed and nothing was itemized.'
  },
  {
    label: 'Airport chairs',
    text: 'A 14-airport survey of the chairs in Terminal B, ranked by comfort, proximity to outlets, and the strange mood they impart at 4am. Includes two chairs I consider friends.'
  }
];

// -------------------- Helpers --------------------

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function refNumber(seed) {
  // AQ·#### format
  const n = (seed % 9000) + 1000;
  return 'ref / AQ\u00b7' + n;
}

function todayLabel() {
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const d = new Date();
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function pickLoadingMessage(seed) {
  return LOADING_MESSAGES[seed % LOADING_MESSAGES.length];
}

// Format an absurd advance figure.
function formatAdvance(amount) {
  // amount is a number in dollars (may have cents)
  const fixed = Number(amount).toFixed(2);
  // commas for thousands
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + parts.join('.');
}

function deterministicAdvance(seed, verdict) {
  // Range: $1.18 to $9,840.00
  // Use seed to make absurd-feeling numbers (often with cents)
  const min = 118;          // 1.18 in cents
  const max = 984000;       // 9840.00 in cents
  // Bias rejection-leaning verdicts to lower numbers, acquire toward middle/high
  let raw = (seed * 2654435761) >>> 0;
  let cents;
  if (verdict === 'reject') {
    // smaller — under $200
    cents = min + (raw % 19880);
  } else if (verdict === 'maybe') {
    // mid — under $1500
    cents = min + (raw % 149800);
  } else {
    // acquire — full spread
    cents = min + (raw % (max - min));
  }
  // Round to a "weird" number — keep cents most of the time
  return cents / 100;
}

function clampAdvance(n) {
  if (typeof n !== 'number' || isNaN(n)) return null;
  if (n < 1.18) return 1.18;
  if (n > 9840) return 9840;
  return Math.round(n * 100) / 100;
}

// -------------------- DOM refs --------------------

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  els.intro     = document.getElementById('intro');
  els.loading   = document.getElementById('loading');
  els.result    = document.getElementById('result');
  els.pitch     = document.getElementById('pitch');
  els.counter   = document.getElementById('counter');
  els.submit    = document.getElementById('submit');
  els.error     = document.getElementById('error');
  els.loadMsg   = document.getElementById('loading-msg');
  els.letter    = document.getElementById('letter-card');
  els.pressName = document.getElementById('press-name');
  els.date      = document.getElementById('letter-date');
  els.ref       = document.getElementById('letter-ref');
  els.salute    = document.getElementById('salutation');
  els.line1     = document.getElementById('line1');
  els.line2     = document.getElementById('line2');
  els.line3     = document.getElementById('line3');
  els.line4     = document.getElementById('line4');
  els.advance   = document.getElementById('advance');
  els.comp      = document.getElementById('comp');
  els.verdict   = document.getElementById('verdict');
  els.signed    = document.getElementById('signed-name');
  els.signedTitle = document.getElementById('signed-title');
  els.signature = document.getElementById('signature');
  els.stamp     = document.getElementById('stamp');
  els.share     = document.getElementById('share');
  els.restart   = document.getElementById('restart');
  els.starters  = document.getElementById('starters');
  els.surprise  = document.getElementById('surprise');

  els.pitch.addEventListener('input', updateCounter);
  els.submit.addEventListener('click', onSubmit);
  els.restart.addEventListener('click', onRestart);
  els.surprise.addEventListener('click', onSurprise);
  // cmd/ctrl+enter to submit
  els.pitch.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  });

  renderStarters();
  updateCounter();
});

// -------------------- Starter pitches (blank-page fix) --------------------

function renderStarters() {
  // Show a rotating subset of starters so the UI stays tight. Different each load.
  const shuffled = STARTERS.slice().sort(() => Math.random() - 0.5);
  const shown = shuffled.slice(0, 8);
  els.starters.innerHTML = '';
  shown.forEach((s) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'starter-chip';
    chip.textContent = s.label;
    chip.addEventListener('click', () => {
      els.pitch.value = s.text;
      updateCounter();
      els.error.hidden = true;
      // brief visual selection
      Array.from(els.starters.children).forEach((c) => c.classList.remove('picked'));
      chip.classList.add('picked');
      // scroll textarea into view so they see what got filled in
      els.pitch.focus();
      els.pitch.setSelectionRange(els.pitch.value.length, els.pitch.value.length);
    });
    els.starters.appendChild(chip);
  });
}

function onSurprise() {
  const s = STARTERS[Math.floor(Math.random() * STARTERS.length)];
  els.pitch.value = s.text;
  updateCounter();
  els.error.hidden = true;
  Array.from(els.starters.children).forEach((c) => c.classList.remove('picked'));
  els.pitch.focus();
  els.pitch.setSelectionRange(els.pitch.value.length, els.pitch.value.length);
}

function updateCounter() {
  const n = els.pitch.value.length;
  els.counter.textContent = n + ' / 900';
}

// -------------------- Submit flow --------------------

function showScreen(name) {
  els.intro.hidden   = name !== 'intro';
  els.loading.hidden = name !== 'loading';
  els.result.hidden  = name !== 'result';
}

async function onSubmit() {
  const pitch = els.pitch.value.trim();
  els.error.hidden = true;

  if (pitch.length < 20) {
    els.error.textContent = 'the editor needs more than that. try a starter pitch above, or write a few sentences.';
    els.error.hidden = false;
    return;
  }

  els.submit.disabled = true;

  // Deterministic skeleton
  const seed = hash(pitch);
  const press   = pick(PRESSES, seed);
  const editor  = pick(EDITORS, Math.floor(seed / 7));
  const verdict = pick(VERDICTS, Math.floor(seed / 13));
  const ref     = refNumber(seed);
  const salute  = pick(SALUTATIONS, Math.floor(seed / 19));
  const loadingMsg = pickLoadingMessage(Math.floor(seed / 23));

  els.loadMsg.textContent = loadingMsg;
  showScreen('loading');

  // Show loading at least 800ms
  const minLoading = new Promise(r => setTimeout(r, 800));

  let payload;
  try {
    payload = await Promise.all([
      requestLetter(pitch, press, editor, verdict),
      minLoading
    ]).then(arr => arr[0]);
  } catch (_) {
    payload = null;
  }

  if (!payload) {
    payload = deterministicLetter(seed, verdict);
  }

  renderLetter({ press, editor, verdict, ref, salute, payload });
  showScreen('result');
  els.share.style.display = '';
  els.submit.disabled = false;
}

function onRestart() {
  showScreen('intro');
  els.pitch.focus();
}

// -------------------- AI call --------------------

async function requestLetter(pitch, press, editor, verdict) {
  const verdictGuide =
    verdict === 'acquire' ? 'You ARE acquiring it. The four lines should make a real, specific offer with affection-tinged condescension.' :
    verdict === 'maybe'   ? 'You are on the fence. The four lines should be conditional — "if X, then we move." Wry. Slightly evasive about money.' :
                            'You are passing on it. The four lines should be a kind, specific rejection — name what you love and why the list cannot hold it.';

  const sys =
    "You are " + editor.name + ", " + editor.title + " at " + press + ", a small-but-respected mid-list publishing house. " +
    "You are jaded, dry, observant, mildly affectionate, and quietly very tired. " +
    verdictGuide + " " +
    "You are replying to one unsolicited paragraph pitch from a stranger about their weird niche interest. " +
    "Your reply must reference at least one specific, concrete detail from the pitch (a noun, a habit, a number). " +
    "Output STRICT JSON with exactly these keys: " +
    "{\"line1\":string,\"line2\":string,\"line3\":string,\"line4\":string," +
    "\"comp_title\":string,\"comp_author\":string,\"advance\":number}. " +
    "RULES: " +
    "(1) Each line is 1-2 sentences, max ~24 words, in your voice. NO em-dashes; you prefer periods, semicolons, parentheses. " +
    "(2) Lines are the body of the letter ONLY — do NOT include a salutation (\"Dear...\") or a signoff (\"Yours,\"); those are added separately. " +
    "(3) comp_title is a plausible-sounding nonexistent book title (no quotes around it; just the title). comp_author is a plausible nonexistent author full name. " +
    "(4) advance is a NUMBER in US dollars between 1.18 and 9840 (inclusive). It MUST feel absurd and oddly specific (e.g. 47.12, 1183.50, 6.40, 2900.00, 9840.00, 88.88, 412.06). NO round thousands like 5000 or 1000. " +
    "(5) NO emojis. NO hashtags. NO markdown. NO smart quotes — use straight ASCII. " +
    "(6) Do NOT mention 'AI', 'language model', 'as an editor I' meta-talk. You are simply Margaret/Theo/etc. writing back.";

  const user = "PITCH:\n" + pitch;

  const messages = [
    { role: 'system', content: sys },
    { role: 'user',   content: user }
  ];

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: SLUG,
      messages: messages,
      max_tokens: 420,
      response_format: 'json_object'
    })
  });
  if (!res.ok) throw new Error('http_' + res.status);
  const data = await res.json();

  let parsed;
  try { parsed = JSON.parse(data.content); } catch (_) { parsed = null; }
  if (!parsed) return null;

  // Validate shape
  const line1 = String(parsed.line1 || '').trim();
  const line2 = String(parsed.line2 || '').trim();
  const line3 = String(parsed.line3 || '').trim();
  const line4 = String(parsed.line4 || '').trim();
  const compTitle  = String(parsed.comp_title  || '').trim();
  const compAuthor = String(parsed.comp_author || '').trim();
  let advance = parsed.advance;
  if (typeof advance === 'string') advance = parseFloat(advance.replace(/[^0-9.]/g, ''));
  advance = clampAdvance(advance);

  if (!line1 || !line2 || !line3 || !line4 || !compTitle || !compAuthor || advance == null) {
    return null;
  }

  return {
    lines: [line1, line2, line3, line4],
    comp: '"' + compTitle + '" by ' + compAuthor,
    advance: advance
  };
}

// -------------------- Deterministic fallback --------------------

function deterministicLetter(seed, verdict) {
  const lines = FALLBACK_LINES[verdict].slice();
  const comp  = FALLBACK_COMPS[seed % FALLBACK_COMPS.length];
  const adv   = deterministicAdvance(seed, verdict);
  return { lines: lines, comp: comp, advance: adv };
}

// -------------------- Render --------------------

function renderLetter({ press, editor, verdict, ref, salute, payload }) {
  els.pressName.textContent = press;
  els.date.textContent = todayLabel();
  els.ref.textContent  = ref;
  els.salute.textContent = salute;

  els.line1.textContent = payload.lines[0];
  els.line2.textContent = payload.lines[1];
  els.line3.textContent = payload.lines[2];
  els.line4.textContent = payload.lines[3];

  els.advance.textContent = formatAdvance(payload.advance);
  els.comp.textContent    = payload.comp;

  let verdictLabel = 'acquire';
  if (verdict === 'reject') verdictLabel = 'pass';
  if (verdict === 'maybe')  verdictLabel = 'pending';
  els.verdict.textContent = verdictLabel;
  els.verdict.setAttribute('data-verdict', verdict);
  els.letter.setAttribute('data-verdict', verdict);

  // Stamp text matches verdict
  if (verdict === 'acquire') els.stamp.textContent = 'OFFERED';
  else if (verdict === 'maybe') els.stamp.textContent = 'PENDING';
  else els.stamp.textContent = 'PASS';

  // Signature uses editor's first name (informal, like a real signoff)
  const first = editor.name.split(' ')[0];
  els.signature.textContent = first;
  els.signed.textContent    = editor.name;
  els.signedTitle.textContent = editor.title;

  // Scroll the letter into view on small screens
  setTimeout(() => {
    els.letter.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

// -------------------- Share --------------------

function share() {
  const url = location.origin + location.pathname;
  const title = document.title;
  const text  = 'I pitched my weirdest niche interest to a jaded publishing editor and they wrote back.';
  if (navigator.share) {
    navigator.share({ title: title, text: text, url: url }).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => alert('link copied. paste it somewhere literary.'))
      .catch(() => alert(url));
  } else {
    alert(url);
  }
}
