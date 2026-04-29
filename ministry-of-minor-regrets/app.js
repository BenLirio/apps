// Ministry of Minor Regrets — bureaucratic-audit calculator.
// Core arithmetic is fully deterministic. An LLM generates only the closing
// signature line, referencing the heaviest line item. Both inputs and the
// signature text are encoded into the URL fragment so shared links re-hydrate
// the exact receipt without spending an LLM call.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'ministry-of-minor-regrets';

// ---------- Ministry benchmarks & penalties ----------
// Each line item is computed from ONE input, visibly, with a clear formula.

const BENCHMARKS = {
  sleep:    { benchmark: 8,  unitLabel: 'hrs',  code: 'RST-404', itemName: 'Insufficient Rest Penalty' },
  unread:   { benchmark: 10, unitLabel: 'msg',  code: 'COM-219', itemName: 'Correspondence Neglect Fee' },
  coffees:  { benchmark: 2,  unitLabel: 'cups', code: 'CAF-611', itemName: 'Excess Stimulant Surcharge' },
  called:   { benchmark: 7,  unitLabel: 'days', code: 'FAM-027', itemName: 'Filial Delay Assessment' },
  scroll:   { benchmark: 30, unitLabel: 'min',  code: 'SCR-808', itemName: 'Aimless Drift Levy' },
  standing: { benchmark: 0,  unitLabel: 'meal', code: 'DIG-150', itemName: 'Dignified Dining Default' },
};

// ---------- Deterministic line-item arithmetic ----------

function computeSleep(hrs) {
  const b = BENCHMARKS.sleep.benchmark;
  const deficit = Math.max(0, b - hrs);
  // 42 units per hour below benchmark. Also small over-sleep penalty at >10.
  const excess = Math.max(0, hrs - 10);
  const units = Math.round(deficit * 42 + excess * 18);
  return {
    key: 'sleep',
    name: BENCHMARKS.sleep.itemName,
    code: BENCHMARKS.sleep.code,
    inputText: `${hrs}h sleep`,
    formula: deficit > 0
      ? `below 8h benchmark by ${stripZeros(deficit)}h × 42`
      : excess > 0
        ? `above 10h ceiling by ${stripZeros(excess)}h × 18`
        : 'within tolerance window',
    units,
  };
}

function computeUnread(n) {
  const b = BENCHMARKS.unread.benchmark;
  const excess = Math.max(0, n - b);
  // 3 units per excess message, lightly compressed on the tail.
  const units = Math.round(excess * 3 * (excess > 200 ? 0.7 : 1));
  return {
    key: 'unread',
    name: BENCHMARKS.unread.itemName,
    code: BENCHMARKS.unread.code,
    inputText: `${n} unread`,
    formula: excess > 0
      ? `${excess} msg above 10-msg allowance × 3`
      : 'inbox within allowance',
    units,
  };
}

function computeCoffees(c) {
  const b = BENCHMARKS.coffees.benchmark;
  const excess = Math.max(0, c - b);
  // 55 units per cup above benchmark.
  const units = excess * 55;
  return {
    key: 'coffees',
    name: BENCHMARKS.coffees.itemName,
    code: BENCHMARKS.coffees.code,
    inputText: `${c} coffee${c === 1 ? '' : 's'}`,
    formula: excess > 0
      ? `${excess} cup${excess === 1 ? '' : 's'} above 2-cup allowance × 55`
      : 'caffeine within allowance',
    units,
  };
}

function computeCalled(days) {
  const b = BENCHMARKS.called.benchmark;
  const excess = Math.max(0, days - b);
  // 14 units/day after benchmark, escalating at 30+.
  let units = excess * 14;
  if (days > 30) units += (days - 30) * 18;
  if (days > 90) units += (days - 90) * 22;
  units = Math.round(units);
  return {
    key: 'called',
    name: BENCHMARKS.called.itemName,
    code: BENCHMARKS.called.code,
    inputText: `${days} day${days === 1 ? '' : 's'} since call home`,
    formula: days > 90
      ? `${excess}d × 14, +escalation 30+ and 90+`
      : days > 30
        ? `${excess}d × 14, +escalation 30+`
        : excess > 0
          ? `${excess}d past 7-day benchmark × 14`
          : 'filial contact current',
    units,
  };
}

function computeScroll(min) {
  const b = BENCHMARKS.scroll.benchmark;
  const excess = Math.max(0, min - b);
  // 1.1 units per excess minute.
  const units = Math.round(excess * 1.1);
  return {
    key: 'scroll',
    name: BENCHMARKS.scroll.itemName,
    code: BENCHMARKS.scroll.code,
    inputText: `${min} min scroll`,
    formula: excess > 0
      ? `${excess} min past 30-min allotment × 1.1`
      : 'attention within allotment',
    units,
  };
}

function computeStanding(n) {
  // Every standing meal costs flat 38 units, escalating per meal.
  const units = n > 0 ? Math.round(n * 38 + (n > 1 ? (n - 1) * 12 : 0)) : 0;
  return {
    key: 'standing',
    name: BENCHMARKS.standing.itemName,
    code: BENCHMARKS.standing.code,
    inputText: `${n} standing meal${n === 1 ? '' : 's'}`,
    formula: n > 0
      ? `${n} × 38, +escalation past the first`
      : 'meals duly seated',
    units,
  };
}

function computeAll(inputs) {
  return [
    computeSleep(inputs.sleep),
    computeUnread(inputs.unread),
    computeCoffees(inputs.coffees),
    computeCalled(inputs.called),
    computeScroll(inputs.scroll),
    computeStanding(inputs.standing),
  ];
}

function stripZeros(n) {
  return Number(n.toFixed(2)).toString();
}

// ---------- Deterministic archetype from the input pattern ----------

function pickArchetype(items, inputs) {
  // Sort by units desc, pick the top two categories as the personality profile.
  const sorted = [...items].sort((a, b) => b.units - a.units);
  const total = items.reduce((s, x) => s + x.units, 0);
  const top = sorted[0];

  // If everyone is within tolerance, handle separately.
  if (total < 40) {
    return {
      name: 'The Exemplary Citizen of Tuesday Nights',
      stampLine: 'ASSESSED: COMMENDATION ISSUED',
      heaviest: top,
    };
  }

  const second = sorted[1];
  const pair = [top.key, second.key].sort().join('+');

  // Pattern-map: top category (and occasionally the pair) produces a named verdict.
  // The verdicts intentionally reference a day-of-week flavor for texture.
  const ARCHETYPES = {
    sleep: [
      'The Insomniac Bureaucrat of Thursday Small Hours',
      'The Twilight Clerk of Unfinished Evenings',
      'The Diplomatic Hermit of Tuesday Nights',
    ],
    unread: [
      'The Unreachable Correspondent of the Inner Office',
      'The Unanswered Prelate of the Open Tab',
      'The Ghost Commissioner of Read Receipts',
    ],
    coffees: [
      'The Perpetual Understudy of Monday Mornings',
      'The Over-Caffeinated Notary of the Printer Room',
      'The Trembling Envoy of the Second Refill',
    ],
    called: [
      'The Estranged Attaché of Somebody Else\'s Landline',
      'The Distant Nephew of a Neglected Rotary',
      'The Reluctant Correspondent to Mothers Everywhere',
    ],
    scroll: [
      'The Vagrant Ambassador of the Feed',
      'The Drifting Undersecretary of Nothing In Particular',
      'The Thumb-Weary Emissary of the Small Rectangle',
    ],
    standing: [
      'The Sovereign of the Kitchen Counter',
      'The Standing Magistrate of the Fridge Door',
      'The Vertical Diner of the Hallway Bowl',
    ],
  };

  // Secondary pair overrides for extra specificity
  const PAIR_OVERRIDES = {
    'coffees+sleep':    'The Trembling Insomniac of the Fourth Cup',
    'scroll+sleep':     'The Doom-scrolling Night Clerk',
    'called+unread':    'The Patron Saint of the Unanswered Message',
    'coffees+scroll':   'The Jittery Archivist of the Infinite Feed',
    'standing+coffees': 'The Standing Understudy of the Second Espresso',
    'called+scroll':    'The Estranged Scroll-Keeper of Lost Relations',
  };

  if (PAIR_OVERRIDES[pair] && top.units > 0 && second.units > 0) {
    return {
      name: PAIR_OVERRIDES[pair],
      stampLine: 'ASSESSED: PENALTIES APPLIED',
      heaviest: top,
    };
  }

  // Deterministic sub-pick within the category (based on integer input magnitude)
  const magnitude = Math.abs(Math.round(top.units)) % 3;
  const name = ARCHETYPES[top.key][magnitude];

  return {
    name,
    stampLine: 'ASSESSED: PENALTIES APPLIED',
    heaviest: top,
  };
}

// ---------- URL fragment encode/decode ----------
// Fragment = v=1&s=...&u=...&c=...&d=...&sc=...&st=...&sig=<base64 ministry line>

function encodeFragment(inputs, signature) {
  const p = new URLSearchParams();
  p.set('v', '1');
  p.set('s', String(inputs.sleep));
  p.set('u', String(inputs.unread));
  p.set('c', String(inputs.coffees));
  p.set('d', String(inputs.called));
  p.set('sc', String(inputs.scroll));
  p.set('st', String(inputs.standing));
  if (signature) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(signature))).replace(/=+$/, '');
      p.set('sig', b64);
    } catch (_) {}
  }
  return p.toString();
}

function decodeFragment(frag) {
  if (!frag || frag.length < 2) return null;
  const raw = frag.startsWith('#') ? frag.slice(1) : frag;
  const p = new URLSearchParams(raw);
  if (p.get('v') !== '1') return null;
  const num = (k, def) => {
    const v = p.get(k);
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const inputs = {
    sleep:    num('s'),
    unread:   num('u'),
    coffees:  num('c'),
    called:   num('d'),
    scroll:   num('sc'),
    standing: num('st'),
  };
  for (const k of Object.keys(inputs)) {
    if (inputs[k] === null) return null;
  }
  let signature = null;
  const sig = p.get('sig');
  if (sig) {
    try {
      signature = decodeURIComponent(escape(atob(sig)));
    } catch (_) { signature = null; }
  }
  return { inputs, signature };
}

// ---------- Deterministic fallback signatures (if LLM fails) ----------

const FALLBACK_SIG = {
  sleep:    'In the margin where rest should have been, you signed instead — and the Ministry has filed the difference.',
  unread:   'The unread column grew taller than the read, and somewhere a notification curled up and gave up waiting.',
  coffees:  'Your hands are warm, your pulse is a memo, and the kettle has filed a complaint on its own behalf.',
  called:   'Somewhere a phone rings in a kitchen you used to know the smell of, and nobody has logged the silence.',
  scroll:   'Your thumb made a small pilgrimage today, and arrived nowhere in particular, and filed no report.',
  standing: 'You ate with one foot already leaving the room; even the plate considered this a formality.',
};

function buildFallbackSignature(heaviest) {
  return FALLBACK_SIG[heaviest.key]
    || 'Your regrets have been quantified and filed in good standing. Kindly return tomorrow.';
}

// ---------- LLM call for the signature line ----------

async function generateSignature(archetype, heaviest, total, inputs) {
  const system =
    "You write ONE closing line for a fictional bureaucratic audit receipt from the 'Ministry of Minor Regrets'. " +
    "The tone is dry, slightly theatrical, faintly absurd — bureaucratic prose with a literary edge. " +
    "Hard rules: ONE sentence, under 30 words, no emojis, no hashtags, no quotation marks, no meta-commentary. " +
    "You MUST naturally reference the heaviest line item by its NAME (not its code). " +
    "Do not start with 'The Ministry'. Write as if a weary civil servant sealed the document.";

  const userMsg =
    `Archetype verdict: ${archetype.name}\n` +
    `Heaviest line item name: ${heaviest.name}\n` +
    `Heaviest input context: ${heaviest.inputText} (${heaviest.units} regret units)\n` +
    `Total regret units: ${total}\n` +
    `All inputs: sleep=${inputs.sleep}h, unread=${inputs.unread}, coffees=${inputs.coffees}, days_since_called_home=${inputs.called}, scroll_min=${inputs.scroll}, standing_meals=${inputs.standing}\n` +
    `Write the closing sentence now. Reference "${heaviest.name}" in your sentence.`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 90,
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let text = (data && data.content || '').trim();
    // Clean up stray quotes/newlines
    text = text.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0];
    if (!text || text.length < 8) throw new Error('empty');
    return text;
  } catch (_) {
    return buildFallbackSignature(heaviest);
  }
}

// ---------- Loading messages ----------

const LOADING_MSGS = [
  'sharpening the regret pencil...',
  'stamping in triplicate...',
  'locating the correct form...',
  'routing your file to Sub-Basement 4...',
  'consulting the schedule of minor offenses...',
  'inking the fiscal seal...',
  'shuffling carbon copies...',
  'waking the night clerk...',
];

function pickLoadingMsg(seed) {
  const h = hashStr(String(seed || Date.now()));
  return LOADING_MSGS[h % LOADING_MSGS.length];
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---------- Render ----------

function fmtUnits(n) {
  return n.toLocaleString('en-US') + ' REGRET';
}

function renderReceipt(inputs, items, archetype, total, signatureText) {
  const heaviest = archetype.heaviest;
  const now = new Date();
  const stamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  const fileId =
    'MR-' + stamp + '-' + String(hashStr(JSON.stringify(inputs)) % 100000).padStart(5, '0');

  const lines = items.map((it) => {
    const isHeavy = it.key === heaviest.key && heaviest.units > 0;
    return `
      <div class="r-line${isHeavy ? ' heavy' : ''}">
        <div class="lbl">
          <span>[${it.code}] ${it.name}</span>
          <small>${escapeHTML(it.inputText)} · ${escapeHTML(it.formula)}</small>
        </div>
        <div class="val">${fmtUnits(it.units)}</div>
      </div>
    `;
  }).join('');

  const sigSafe = escapeHTML(signatureText);

  const html = `
    <div class="corner-stamp">FILED ${stamp}</div>
    <header class="r-header">
      <div class="r-title">Ministry of Minor Regrets</div>
      <div class="r-sub">Daily Audit · Form MR-17/B</div>
      <div class="r-id">FILE № ${fileId}</div>
    </header>

    <section class="r-section">
      <div class="r-section-title">Itemized Penalties</div>
      ${lines}
    </section>

    <div class="r-total">
      <div>TOTAL REGRET UNITS</div>
      <div>${total.toLocaleString('en-US')}</div>
    </div>

    <div class="r-archetype">
      <div class="stamp-verdict">
        <small>${escapeHTML(archetype.stampLine)}</small>
        ${escapeHTML(archetype.name)}
      </div>
    </div>

    <div class="r-signature">
      <span class="sig-caret">§</span>${sigSafe}
      <span class="sig-line">Dep. Undersecretary, Minor Regrets Division</span>
    </div>

    <div class="r-footer">
      <div class="r-barcode" aria-hidden="true"></div>
      Retain this audit for your records. This is the only copy.<br>
      Appeals accepted: Tue/Thu, by candlelight only.
    </div>
  `;

  document.getElementById('receipt').innerHTML = html;
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Orchestration ----------

function readInputs() {
  const g = (id) => Number(document.getElementById(id).value);
  const inputs = {
    sleep:    g('f-sleep'),
    unread:   g('f-unread'),
    coffees:  g('f-coffees'),
    called:   g('f-called'),
    scroll:   g('f-scroll'),
    standing: g('f-standing'),
  };
  return inputs;
}

function validInputs(inputs) {
  const okNum = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  return (
    okNum(inputs.sleep, 0, 24) &&
    okNum(inputs.unread, 0, 99999) &&
    okNum(inputs.coffees, 0, 99) &&
    okNum(inputs.called, 0, 9999) &&
    okNum(inputs.scroll, 0, 9999) &&
    okNum(inputs.standing, 0, 20)
  );
}

function showLoading(msg) {
  document.getElementById('intake').hidden = true;
  document.getElementById('receipt-wrap').hidden = true;
  const l = document.getElementById('loading');
  l.hidden = false;
  document.getElementById('loading-msg').textContent = msg;
}

function showReceipt() {
  document.getElementById('intake').hidden = true;
  document.getElementById('loading').hidden = true;
  document.getElementById('receipt-wrap').hidden = false;
  const share = document.getElementById('share');
  if (share) share.style.display = 'flex';
  // scroll to top so result is above the fold
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showIntake() {
  document.getElementById('receipt-wrap').hidden = true;
  document.getElementById('loading').hidden = true;
  document.getElementById('intake').hidden = false;
  const share = document.getElementById('share');
  if (share) share.style.display = 'none';
  document.getElementById('error-line').textContent = '';
}

async function runAssessment(inputs, providedSignature) {
  const items = computeAll(inputs);
  const total = items.reduce((s, x) => s + x.units, 0);
  const archetype = pickArchetype(items, inputs);

  showLoading(pickLoadingMsg(JSON.stringify(inputs)));

  // min 800ms of loading drama even if signature is cached/instant
  const minDelay = new Promise((r) => setTimeout(r, 800));

  let signature;
  if (providedSignature && providedSignature.length > 4) {
    signature = providedSignature;
    await minDelay;
  } else {
    const [sig] = await Promise.all([
      generateSignature(archetype, archetype.heaviest, total, inputs),
      minDelay,
    ]);
    signature = sig;
  }

  renderReceipt(inputs, items, archetype, total, signature);
  showReceipt();

  // Write the shareable fragment (idempotent — safe if rehydrated)
  const frag = encodeFragment(inputs, signature);
  try {
    history.replaceState(null, '', '#' + frag);
  } catch (_) {
    location.hash = frag;
  }
}

// ---------- Boot ----------

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('audit-form');
  const errEl = document.getElementById('error-line');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = readInputs();
    if (!validInputs(inputs)) {
      errEl.textContent = 'hmm — the Ministry requires a number in each field.';
      return;
    }
    errEl.textContent = '';
    runAssessment(inputs, null);
  });

  document.getElementById('redo-btn').addEventListener('click', () => {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    showIntake();
  });

  // Re-hydrate from fragment if present
  const hydrated = decodeFragment(location.hash);
  if (hydrated && validInputs(hydrated.inputs)) {
    // Fill the form so "redo" still makes sense
    document.getElementById('f-sleep').value = hydrated.inputs.sleep;
    document.getElementById('f-unread').value = hydrated.inputs.unread;
    document.getElementById('f-coffees').value = hydrated.inputs.coffees;
    document.getElementById('f-called').value = hydrated.inputs.called;
    document.getElementById('f-scroll').value = hydrated.inputs.scroll;
    document.getElementById('f-standing').value = hydrated.inputs.standing;
    runAssessment(hydrated.inputs, hydrated.signature);
  }
});

// ---------- Share (required) ----------

function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Audit link copied. The Ministry thanks you.'))
      .catch(() => alert(location.href));
  }
}
