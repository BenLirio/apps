// Vibe Tax Calculator — deterministic receipt generator
// Same input → same receipt. No server calls.

// -------- deterministic seeded RNG --------

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// mulberry32: tiny, fast, deterministic PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededPick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function seededFloat(rng, min, max) {
  return rng() * (max - min) + min;
}

// -------- content pools --------

// 48 line items: [noun phrase, min price, max price]
const LINE_ITEMS = [
  ['espresso martini (third of the night)', 18, 24],
  ['performative book in tote bag', 17, 34],
  ['lingering vape cloud', 2.50, 4.75],
  ['artisanal matcha, oat, extra froth', 8.50, 11.25],
  ['tiny silver hoop earring, somehow', 14, 38],
  ['"I was there first" energy surcharge', 6, 12],
  ['unexplained cigarette (never lit)', 3, 5],
  ['knowing glance across the bar', 0.75, 2.25],
  ['linen shirt, noticeably wrinkled', 42, 88],
  ['second-hand workwear jacket', 34, 71],
  ['hydrated glow (Evian mist)', 9, 15],
  ['retainer you forgot to wear', 0.25, 1],
  ['overheard podcast opinion', 0.50, 3],
  ['chipped nail polish, intentional', 2, 7],
  ['tan line from a wristwatch you sold', 1, 3],
  ['niche substack subscription', 8, 14],
  ['"I only use film" surcharge', 22, 48],
  ['one (1) unnecessary scarf', 18, 46],
  ['natural wine, slightly funky', 21, 38],
  ['tortoise-shell reading glasses (fake)', 17, 44],
  ['moleskine with one page used', 19, 26],
  ['faint smell of palo santo', 4, 9],
  ['AirPods worn indoors', 6, 18],
  ['gauche Birkenstock adjacent sandal', 45, 125],
  ['aperitif no one has heard of', 13, 19],
  ['"my friend is DJing" conviction', 0, 5],
  ['pretend disdain for the venue', 0, 4],
  ['untranslated Italian magazine', 11, 18],
  ['hand-rolled nothing in particular', 2, 6],
  ['lip balm, clearly medicinal', 3.50, 6],
  ['analog wristwatch (battery dead)', 24, 68],
  ['unread New Yorker (this week)', 8.99, 8.99],
  ['collagen powder in the water bottle', 7, 14],
  ['signet ring from an auntie', 0, 2],
  ['haircut described as "a trim"', 45, 95],
  ['trip to the bathroom, no reason', 1, 4],
  ['extremely specific fragrance', 28, 72],
  ['fluency in one (1) tarot card', 2, 6],
  ['ambient self-deprecation', 1, 3],
  ['gluten-free pastry, eaten anyway', 6.50, 9.25],
  ['tiny bag that fits a single key', 34, 88],
  ['tote bag from a gallery you didn\'t visit', 12, 25],
  ['opinion about sourdough', 0, 2],
  ['refusal to eat before 9pm', 0, 1],
  ['hand-lettered name tag', 3, 7],
  ['second cold brew, untouched', 5.50, 7],
  ['letterboxd 4.5-star rating bias', 0, 2],
  ['Labubu keychain (slightly haunted)', 12, 34],
];

// 22 sassy auditor verdicts
const VERDICTS = [
  'Your aesthetic is leveraged 4:1. File for emotional bankruptcy.',
  'Verified: you are paying rent in a persona.',
  'This vibe clears. Barely. Don\'t do it again.',
  'The auditor laughed. That\'s on the record now.',
  'Findings: cute, expensive, 30% performance art.',
  'We regret to inform you this vibe is a subscription.',
  'Recommendation: wash the linen. Rebrand.',
  'Vibe is taxable under both federal and friend-group law.',
  'You are not a lifestyle. You are a line item.',
  'Assessed and found structurally adjacent to cool.',
  'The vibe is strong. The receipt is stronger.',
  'This is less a personality and more a PO box.',
  'We need to talk about the tote bag.',
  'Your vibe passed the audit. Your wallet did not.',
  'Conclusion: charming, broke, eerily on-brand.',
  'You are a walking Venmo request. And it works.',
  'The math is bad. The aesthetic is worse. Keep going.',
  'Red-flagged for excessive ambient mystery.',
  'Filed under: expensive to know.',
  'Vibe registered. Please take your receipt and leave.',
  'You owe the culture. Installments accepted.',
  'Approved, pending one (1) haircut.',
];

// Loading sub-messages for the "thermal printer" moment
const LOADING_SUBS = [
  'isolating lingering vape clouds',
  'counting linen wrinkles',
  'weighing the tote bag',
  'sniffing for palo santo',
  'cross-referencing your Letterboxd',
  'auditing one (1) knowing glance',
  'decoding the wrinkle in your linen',
  'reading your iced coffee posture',
  'consulting the natural wine sommelier',
  'double-checking your retainer status',
];

// -------- UI wiring --------

const els = {
  form: null,
  input: null,
  intake: null,
  computing: null,
  computingSub: null,
  stage: null,
  receipt: null,
  lineItems: null,
  subtotal: null,
  tax: null,
  total: null,
  verdict: null,
  meta: null,
  refCode: null,
  error: null,
  againBtn: null,
  share: null,
  chips: null,
};

document.addEventListener('DOMContentLoaded', () => {
  els.form = document.getElementById('vibe-form');
  els.input = document.getElementById('vibe-input');
  els.intake = document.getElementById('intake');
  els.computing = document.getElementById('computing');
  els.computingSub = document.getElementById('computing-sub');
  els.stage = document.getElementById('receipt-stage');
  els.receipt = document.getElementById('receipt');
  els.lineItems = document.getElementById('line-items');
  els.subtotal = document.getElementById('subtotal');
  els.tax = document.getElementById('tax');
  els.total = document.getElementById('total');
  els.verdict = document.getElementById('verdict');
  els.meta = document.getElementById('receipt-meta');
  els.refCode = document.getElementById('ref-code');
  els.error = document.getElementById('error');
  els.againBtn = document.getElementById('again-btn');
  els.share = document.getElementById('share');
  els.chips = document.getElementById('chips');

  els.form.addEventListener('submit', onSubmit);
  els.againBtn.addEventListener('click', onReset);

  els.chips.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      els.input.value = btn.dataset.vibe;
      els.input.focus();
    });
  });

  // Allow pre-filled vibes via URL: ?vibe=foo
  const params = new URLSearchParams(location.search);
  if (params.has('vibe')) {
    els.input.value = params.get('vibe').slice(0, 80);
  }
});

function onSubmit(e) {
  e.preventDefault();
  const raw = (els.input.value || '').trim();

  if (raw.length < 2) {
    els.error.textContent = 'hmm, needs a bit more vibe — try a few words';
    return;
  }
  els.error.textContent = '';

  const normalized = raw.toLowerCase();
  const seed = hash(normalized) || 1;
  const rng = mulberry32(seed);

  // Switch to the computing state — always show for 850ms for drama
  els.intake.style.display = 'none';
  els.stage.classList.remove('on');
  els.computing.classList.add('on');
  els.computingSub.textContent = seededPick(LOADING_SUBS, mulberry32(seed + 7));

  setTimeout(() => {
    const receipt = buildReceipt(raw, rng, seed);
    renderReceipt(receipt, raw, seed);
    els.computing.classList.remove('on');
    els.stage.classList.add('on');
    els.share.style.display = 'flex';
    // Scroll receipt into view (top), in case mobile viewport is tall
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, 850);
}

function onReset() {
  els.stage.classList.remove('on');
  els.share.style.display = 'none';
  els.intake.style.display = 'block';
  els.input.value = '';
  els.input.focus();
  window.scrollTo({ top: 0 });
}

// -------- receipt construction --------

function buildReceipt(raw, rng, seed) {
  // 6-10 items based on seed
  const n = 6 + Math.floor(rng() * 5); // 6..10
  const shuffled = seededShuffle(LINE_ITEMS, rng);
  const chosen = shuffled.slice(0, n);

  const lines = chosen.map(([name, lo, hi]) => {
    const raw = seededFloat(rng, lo, hi);
    // round to .25 cents for receipt feel sometimes, .50 sometimes
    const cents = [0, 25, 50, 75, 99];
    const whole = Math.floor(raw);
    const c = seededPick(cents, rng);
    // small chance of a small whole-dollar jump for texture
    return { name, price: whole + c / 100 };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.price, 0));
  const tax = round2(subtotal * 0.185);
  const total = round2(subtotal + tax);

  const verdict = VERDICTS[hash(raw.toLowerCase() + '::verdict') % VERDICTS.length];

  return { lines, subtotal, tax, total, verdict };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmt(n) {
  return '$' + n.toFixed(2);
}

function renderReceipt(receipt, raw, seed) {
  // meta line
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);
  const ref = 'VTB-' + (seed % 100000).toString().padStart(5, '0');
  const cashier = cashierName(seed);

  els.meta.textContent =
    `VIBE: "${truncate(raw, 42)}"\n` +
    `DATE: ${dateStr}   TIME: ${timeStr}\n` +
    `AUDITOR: ${cashier}   REF: ${ref}`;

  // line items
  els.lineItems.innerHTML = '';
  receipt.lines.forEach(l => {
    const row = document.createElement('div');
    row.className = 'li-row';

    const name = document.createElement('span');
    name.className = 'li-name';
    name.textContent = l.name;

    const price = document.createElement('span');
    price.className = 'li-price';
    price.textContent = fmt(l.price);

    row.appendChild(name);
    row.appendChild(price);
    els.lineItems.appendChild(row);
  });

  els.subtotal.textContent = fmt(receipt.subtotal);
  els.tax.textContent = fmt(receipt.tax);
  els.total.textContent = fmt(receipt.total);
  els.verdict.textContent = receipt.verdict;
  els.refCode.textContent = ref;
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

// Pseudo-auditor first/last name drawn from seed
const FIRST = ['MARGAUX','DANI','RIVER','HOLLIS','THEO','INEZ','ODESSA','KAI','MILO','WREN','ANOUK','JUNO','PIPPA','CASPIAN','ROMY'];
const LAST = ['VALCOURT','FENN','DUVAL','ASTER','GRIEG','PELHAM','OSTERMAN','QUINTANA','BRINE','DELACROIX','HOLLINGS','TRUSS'];
function cashierName(seed) {
  const a = FIRST[seed % FIRST.length];
  const b = LAST[Math.floor(seed / FIRST.length) % LAST.length];
  return `${a} ${b[0]}.`;
}

// -------- share --------

function share() {
  const text = 'I just got audited by the Vibe Tax Bureau.';
  if (navigator.share) {
    navigator.share({ title: document.title, text, url: location.href })
      .catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied! Paste it into the group chat.'))
      .catch(() => alert(location.href));
  } else {
    alert(location.href);
  }
}
