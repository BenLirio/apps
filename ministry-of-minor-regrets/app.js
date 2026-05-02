// Ministry of Minor Regrets — bureaucratic-audit calculator.
// One declaration at a time (no scrolling form). 10 questions chosen to feel
// peculiar and lived-in rather than generic. Core arithmetic is fully
// deterministic; an LLM generates only the closing signature line. Inputs +
// signature are encoded into the URL fragment so shared links re-hydrate the
// exact receipt without spending an LLM call.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'ministry-of-minor-regrets';

// ---------- Ministry benchmarks & per-line metadata ----------

const BENCHMARKS = {
  sleep:     { benchmark: 8,  unitLabel: 'hrs',  code: 'RST-404', itemName: 'Insufficient Rest Penalty' },
  unread:    { benchmark: 10, unitLabel: 'msg',  code: 'COM-219', itemName: 'Correspondence Neglect Fee' },
  tabs:      { benchmark: 8,  unitLabel: 'tabs', code: 'TAB-882', itemName: 'Open-Tab Sediment Levy' },
  coffees:   { benchmark: 2,  unitLabel: 'cups', code: 'CAF-611', itemName: 'Excess Stimulant Surcharge' },
  beverages: { benchmark: 0,  unitLabel: 'cup',  code: 'BEV-330', itemName: 'Hydration Backlog Penalty' },
  forgot:    { benchmark: 0,  unitLabel: 'time', code: 'AMN-117', itemName: 'Threshold Amnesia Citation' },
  called:    { benchmark: 7,  unitLabel: 'days', code: 'FAM-027', itemName: 'Filial Delay Assessment' },
  lol:       { benchmark: 3,  unitLabel: 'msg',  code: 'LOL-505', itemName: 'Conversational Garnish Surcharge' },
  scroll:    { benchmark: 30, unitLabel: 'min',  code: 'SCR-808', itemName: 'Aimless Drift Levy' },
  photos:    { benchmark: 2,  unitLabel: 'img',  code: 'PHO-714', itemName: 'Camera-Roll Sediment Fee' },
};

// ---------- Step (declaration) configuration ----------

const STEPS = [
  {
    key: 'sleep',
    label: 'Hours slept last night',
    hint: 'Ministry benchmark: 8.0 hrs',
    placeholder: 'e.g. 6.5',
    step: 0.5, min: 0, max: 24,
    inputmode: 'decimal',
  },
  {
    key: 'unread',
    label: 'Unread messages across all inboxes (estimate)',
    hint: 'Ministry benchmark: 10',
    placeholder: 'e.g. 184',
    step: 1, min: 0, max: 99999,
    inputmode: 'numeric',
  },
  {
    key: 'tabs',
    label: 'Browser tabs currently open (all windows, all devices)',
    hint: 'Ministry benchmark: 8',
    placeholder: 'e.g. 27',
    step: 1, min: 0, max: 9999,
    inputmode: 'numeric',
  },
  {
    key: 'coffees',
    label: 'Coffees consumed today',
    hint: 'Ministry benchmark: 2',
    placeholder: 'e.g. 4',
    step: 1, min: 0, max: 99,
    inputmode: 'numeric',
  },
  {
    key: 'beverages',
    label: "Half-finished beverages within arm's reach right now",
    hint: 'Ministry benchmark: 0 — kindly drink it or remove it',
    placeholder: 'e.g. 3',
    step: 1, min: 0, max: 99,
    inputmode: 'numeric',
  },
  {
    key: 'forgot',
    label: 'Times you walked into a room and forgot why (today)',
    hint: 'Ministry benchmark: 0',
    placeholder: 'e.g. 2',
    step: 1, min: 0, max: 99,
    inputmode: 'numeric',
  },
  {
    key: 'called',
    label: 'Days since you called home',
    hint: 'Ministry benchmark: 7',
    placeholder: 'e.g. 22',
    step: 1, min: 0, max: 9999,
    inputmode: 'numeric',
  },
  {
    key: 'lol',
    label: 'Outgoing messages today ending in "lol" or "lmao"',
    hint: 'Ministry benchmark: 3',
    placeholder: 'e.g. 9',
    step: 1, min: 0, max: 9999,
    inputmode: 'numeric',
  },
  {
    key: 'scroll',
    label: 'Minutes the thumb wandered (aimless scrolling)',
    hint: 'Ministry benchmark: 30 min',
    placeholder: 'e.g. 140',
    step: 1, min: 0, max: 9999,
    inputmode: 'numeric',
  },
  {
    key: 'photos',
    label: 'Photos taken today you will never look at again',
    hint: 'Ministry benchmark: 2',
    placeholder: 'e.g. 14',
    step: 1, min: 0, max: 999,
    inputmode: 'numeric',
  },
];

// ---------- Deterministic line-item arithmetic ----------

function computeSleep(hrs) {
  const b = BENCHMARKS.sleep.benchmark;
  const deficit = Math.max(0, b - hrs);
  const excess = Math.max(0, hrs - 10);
  const units = Math.round(deficit * 42 + excess * 18);
  return {
    key: 'sleep',
    name: BENCHMARKS.sleep.itemName,
    code: BENCHMARKS.sleep.code,
    inputText: `${stripZeros(hrs)}h sleep`,
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
  // Log curve so 50 vs 50,000 unread can't dominate the audit. Hard cap
  // keeps this line item in range with the others.
  const raw = excess > 0 ? 60 * Math.log10(1 + excess / 10) : 0;
  const units = Math.min(Math.round(raw), 250);
  return {
    key: 'unread',
    name: BENCHMARKS.unread.itemName,
    code: BENCHMARKS.unread.code,
    inputText: `${n} unread`,
    formula: excess > 0
      ? `${excess} msg above 10-msg allowance — eased curve`
      : 'inbox within allowance',
    units,
  };
}

function computeTabs(n) {
  const b = BENCHMARKS.tabs.benchmark;
  const excess = Math.max(0, n - b);
  // 6 units per tab past benchmark, log escalation past 30, cap at 240.
  let raw = excess * 6;
  if (n > 30) raw += 80 * Math.log10(1 + (n - 30) / 5);
  const units = Math.min(Math.round(raw), 240);
  return {
    key: 'tabs',
    name: BENCHMARKS.tabs.itemName,
    code: BENCHMARKS.tabs.code,
    inputText: `${n} tab${n === 1 ? '' : 's'} open`,
    formula: excess > 0
      ? n > 30
        ? `${excess} past 8-tab budget × 6, +escalation 30+`
        : `${excess} past 8-tab budget × 6`
      : 'tabs within budget',
    units,
  };
}

function computeCoffees(c) {
  const b = BENCHMARKS.coffees.benchmark;
  const excess = Math.max(0, c - b);
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

function computeBeverages(n) {
  // 32 units each, +18 escalation per beverage past the first.
  const units = n > 0 ? Math.round(n * 32 + (n > 1 ? (n - 1) * 18 : 0)) : 0;
  return {
    key: 'beverages',
    name: BENCHMARKS.beverages.itemName,
    code: BENCHMARKS.beverages.code,
    inputText: `${n} half-finished beverage${n === 1 ? '' : 's'}`,
    formula: n > 0
      ? `${n} × 32, +escalation past the first`
      : 'no abandoned cups detected',
    units,
  };
}

function computeForgot(n) {
  // Each doorway lapse: 28 units flat.
  const units = Math.round(n * 28);
  return {
    key: 'forgot',
    name: BENCHMARKS.forgot.itemName,
    code: BENCHMARKS.forgot.code,
    inputText: `${n} doorway lapse${n === 1 ? '' : 's'}`,
    formula: n > 0
      ? `${n} doorway lapse${n === 1 ? '' : 's'} × 28`
      : 'memory holding the line',
    units,
  };
}

function computeCalled(days) {
  const b = BENCHMARKS.called.benchmark;
  const excess = Math.max(0, days - b);
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

function computeLol(n) {
  const b = BENCHMARKS.lol.benchmark;
  const excess = Math.max(0, n - b);
  // 18 units each past the 3-msg garnish allowance.
  const units = Math.round(excess * 18);
  return {
    key: 'lol',
    name: BENCHMARKS.lol.itemName,
    code: BENCHMARKS.lol.code,
    inputText: `${n} message${n === 1 ? '' : 's'} ending in "lol"`,
    formula: excess > 0
      ? `${excess} past 3-msg garnish allowance × 18`
      : 'sincerity within tolerance',
    units,
  };
}

function computeScroll(min) {
  const b = BENCHMARKS.scroll.benchmark;
  const excess = Math.max(0, min - b);
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

function computePhotos(n) {
  const b = BENCHMARKS.photos.benchmark;
  const excess = Math.max(0, n - b);
  // 22 units each past benchmark.
  const units = Math.round(excess * 22);
  return {
    key: 'photos',
    name: BENCHMARKS.photos.itemName,
    code: BENCHMARKS.photos.code,
    inputText: `${n} disposable photo${n === 1 ? '' : 's'}`,
    formula: excess > 0
      ? `${excess} past 2-photo allowance × 22`
      : 'photo intake disciplined',
    units,
  };
}

const FIELD_COMPUTE = {
  sleep:     computeSleep,
  unread:    computeUnread,
  tabs:      computeTabs,
  coffees:   computeCoffees,
  beverages: computeBeverages,
  forgot:    computeForgot,
  called:    computeCalled,
  lol:       computeLol,
  scroll:    computeScroll,
  photos:    computePhotos,
};

function computeAll(inputs) {
  return STEPS.map(s => FIELD_COMPUTE[s.key](inputs[s.key]));
}

function stripZeros(n) {
  return Number(n.toFixed(2)).toString();
}

// ---------- Deterministic archetype from the input pattern ----------

function pickArchetype(items) {
  const sorted = [...items].sort((a, b) => b.units - a.units);
  const total = items.reduce((s, x) => s + x.units, 0);
  const top = sorted[0];

  if (total < 60) {
    return {
      name: 'The Exemplary Citizen of Tuesday Nights',
      stampLine: 'ASSESSED: COMMENDATION ISSUED',
      heaviest: top,
    };
  }

  const second = sorted[1];
  const pair = [top.key, second.key].sort().join('+');

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
    tabs: [
      'The Provisional Custodian of Forty-Seven Open Tabs',
      'The Sediment-Browser of Last Tuesday\'s Search',
      'The Unsorted Archivist of the Bookmark Bar',
    ],
    coffees: [
      'The Perpetual Understudy of Monday Mornings',
      'The Over-Caffeinated Notary of the Printer Room',
      'The Trembling Envoy of the Second Refill',
    ],
    beverages: [
      'The Curator of Unfinished Cups',
      'The Steward of the Half-Drunk Glass',
      'The Quartermaster of Cold Coffee Rings',
    ],
    forgot: [
      'The Itinerant Pilgrim of Forgotten Errands',
      'The Doorway Amnesiac of the Hallway Closet',
      'The Threshold Wanderer of the Empty Hand',
    ],
    called: [
      'The Estranged Attaché of Somebody Else\'s Landline',
      'The Distant Nephew of a Neglected Rotary',
      'The Reluctant Correspondent to Mothers Everywhere',
    ],
    lol: [
      'The Reluctant Garnisher of Sincerity',
      'The Notary of the Trailing "lol"',
      'The Soft-Tongued Diplomat of Group Chats',
    ],
    scroll: [
      'The Vagrant Ambassador of the Feed',
      'The Drifting Undersecretary of Nothing In Particular',
      'The Thumb-Weary Emissary of the Small Rectangle',
    ],
    photos: [
      'The Custodian of the Forty-Image Burst',
      'The Reluctant Archivist of Unremarkable Wednesdays',
      'The Unsorted Photographer of the Empty Hour',
    ],
  };

  const PAIR_OVERRIDES = {
    'coffees+sleep':     'The Trembling Insomniac of the Fourth Cup',
    'scroll+sleep':      'The Doom-scrolling Night Clerk',
    'called+unread':     'The Patron Saint of the Unanswered Message',
    'coffees+scroll':    'The Jittery Archivist of the Infinite Feed',
    'beverages+coffees': 'The Sediment-Cup Connoisseur of the Late Refill',
    'called+scroll':     'The Estranged Scroll-Keeper of Lost Relations',
    'forgot+tabs':       'The Threshold Amnesiac of Forty Open Tabs',
    'lol+scroll':        'The "Lol" Drifter of the Group Chat Feed',
    'photos+scroll':     'The Unsorted Curator of the Lost Tuesday',
    'beverages+sleep':   'The Cold-Coffee Insomniac of the Late Desk',
    'forgot+sleep':      'The Threshold Hermit of the Foggy Morning',
    'tabs+scroll':       'The Sediment-Tabbed Drifter of the Second Pane',
    'lol+unread':        'The Garnisher of Unread Group Chats',
    'photos+forgot':     'The Burst-Snapper of Forgotten Errands',
    'beverages+tabs':    'The Cold-Cup Custodian of Forty Open Tabs',
  };

  if (PAIR_OVERRIDES[pair] && top.units > 0 && second.units > 0) {
    return {
      name: PAIR_OVERRIDES[pair],
      stampLine: 'ASSESSED: PENALTIES APPLIED',
      heaviest: top,
    };
  }

  const magnitude = Math.abs(Math.round(top.units)) % 3;
  const name = (ARCHETYPES[top.key] || ARCHETYPES.sleep)[magnitude];

  return {
    name,
    stampLine: 'ASSESSED: PENALTIES APPLIED',
    heaviest: top,
  };
}

// ---------- URL fragment encode/decode ----------
// v=2 schema: one short key per line item + sig.
//   s=sleep, u=unread, t=tabs, c=coffees, b=beverages, f=forgot,
//   d=called(days), l=lol, sc=scroll, p=photos, sig=base64(signature)

const FRAG_KEYS = {
  sleep: 's', unread: 'u', tabs: 't', coffees: 'c', beverages: 'b',
  forgot: 'f', called: 'd', lol: 'l', scroll: 'sc', photos: 'p',
};

function encodeFragment(inputs, signature) {
  const p = new URLSearchParams();
  p.set('v', '2');
  for (const k of Object.keys(FRAG_KEYS)) {
    p.set(FRAG_KEYS[k], String(inputs[k]));
  }
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
  if (p.get('v') !== '2') return null;
  const num = (k) => {
    const v = p.get(k);
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const inputs = {};
  for (const k of Object.keys(FRAG_KEYS)) {
    inputs[k] = num(FRAG_KEYS[k]);
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
  sleep:     'In the margin where rest should have been, you signed instead — and the Ministry has filed the difference.',
  unread:    'The unread column grew taller than the read, and somewhere a notification curled up and gave up waiting.',
  tabs:      'Each open tab is a small unkept promise; the Ministry has counted them and none have offered to close.',
  coffees:   'Your hands are warm, your pulse is a memo, and the kettle has filed a complaint on its own behalf.',
  beverages: 'A small archipelago of half-drunk cups now ratifies your day; none of them voted in your favor.',
  forgot:    'You crossed thresholds today on errands the Ministry never received in writing, and now they cannot be filed.',
  called:    'Somewhere a phone rings in a kitchen you used to know the smell of, and nobody has logged the silence.',
  lol:       'Your sincerity has been garnished into laughter; the Ministry accepts the trade but recommends a slower tongue.',
  scroll:    'Your thumb made a small pilgrimage today, and arrived nowhere in particular, and filed no report.',
  photos:    'You committed several Tuesdays to permanent record today, and the Ministry will store them with the others.',
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

  const inputDigest = STEPS
    .map(s => `${s.key}=${inputs[s.key]}`)
    .join(', ');

  const userMsg =
    `Archetype verdict: ${archetype.name}\n` +
    `Heaviest line item name: ${heaviest.name}\n` +
    `Heaviest input context: ${heaviest.inputText} (${heaviest.units} regret units)\n` +
    `Total regret units: ${total}\n` +
    `All inputs: ${inputDigest}\n` +
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

// ---------- Render the receipt ----------

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

// ---------- Stepper UX ----------

let stepIdx = 0;
const answers = {};

function renderStep(idx) {
  const step = STEPS[idx];
  const total = STEPS.length;
  const card = document.getElementById('step-card');
  const existing = answers[step.key];
  const valAttr = (existing !== undefined && existing !== null && Number.isFinite(existing))
    ? `value="${existing}"` : '';

  card.innerHTML = `
    <div class="step-num">DECLARATION ${String(idx + 1).padStart(2, '0')} OF ${String(total).padStart(2, '0')}</div>
    <label class="step-q-label" for="step-input">${escapeHTML(step.label)}</label>
    <div class="step-hint">${escapeHTML(step.hint)}</div>
    <input
      type="number"
      class="step-input"
      id="step-input"
      inputmode="${step.inputmode}"
      step="${step.step}"
      min="${step.min}"
      max="${step.max}"
      placeholder="${escapeHTML(step.placeholder)}"
      autocomplete="off"
      ${valAttr}
    >
    <div class="step-stamp" id="step-stamp" aria-live="polite"></div>
  `;

  document.getElementById('step-counter').textContent =
    `DECLARATION ${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  const prog = document.getElementById('step-progress');
  prog.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    dot.className = 'progress-dot';
    if (i < idx) dot.classList.add('done');
    else if (i === idx) dot.classList.add('current');
    prog.appendChild(dot);
  }

  document.getElementById('back-btn').disabled = idx === 0;
  document.getElementById('next-btn').textContent =
    idx === total - 1 ? 'SUBMIT FOR ASSESSMENT' : 'FILE & CONTINUE →';
  document.getElementById('error-line').textContent = '';

  const inputEl = document.getElementById('step-input');
  inputEl.addEventListener('input', () => {
    refreshStepStamp();
    refreshCumulative();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextStep();
    }
  });

  refreshStepStamp();
  refreshCumulative();

  // Focus on desktop only — autofocus on mobile pops the keyboard which can
  // jitter the layout. Browsers without matchMedia get the desktop path.
  try {
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!isCoarse) setTimeout(() => inputEl.focus(), 0);
  } catch (_) {
    setTimeout(() => inputEl.focus(), 0);
  }
}

function readStepValue() {
  const inputEl = document.getElementById('step-input');
  if (!inputEl) return null;
  const raw = inputEl.value;
  if (raw === '' || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

function refreshStepStamp() {
  const step = STEPS[stepIdx];
  const stampEl = document.getElementById('step-stamp');
  if (!stampEl) return;
  const v = readStepValue();
  if (v === null) {
    stampEl.className = 'step-stamp';
    stampEl.textContent = '';
    return;
  }
  const item = FIELD_COMPUTE[step.key](v);
  if (item.units > 0) {
    stampEl.className = 'step-stamp heavy';
    stampEl.textContent = '+ ' + item.units.toLocaleString('en-US') + ' REGRET — ' + item.formula;
  } else {
    stampEl.className = 'step-stamp within';
    stampEl.textContent = 'WITHIN TOLERANCE — ' + item.formula;
  }
}

function refreshCumulative() {
  let total = 0;
  let filled = 0;
  for (const s of STEPS) {
    let v;
    if (s.key === STEPS[stepIdx].key) {
      v = readStepValue();
    } else if (answers[s.key] !== undefined && answers[s.key] !== null && Number.isFinite(answers[s.key])) {
      v = answers[s.key];
    }
    if (v !== undefined && v !== null) {
      total += FIELD_COMPUTE[s.key](v).units;
      filled++;
    }
  }
  const el = document.getElementById('cumulative');
  if (!el) return;
  el.textContent = filled === 0
    ? 'RUNNING TOTAL: 0 REGRET'
    : `RUNNING TOTAL: ${total.toLocaleString('en-US')} REGRET (${filled}/${STEPS.length} declared)`;
  el.classList.toggle('hot', total >= 400);
}

function nextStep() {
  const step = STEPS[stepIdx];
  const v = readStepValue();
  if (v === null || v < step.min || v > step.max) {
    document.getElementById('error-line').textContent =
      `the Ministry requires a number between ${step.min} and ${step.max}.`;
    return;
  }
  answers[step.key] = v;
  if (stepIdx === STEPS.length - 1) {
    runAssessment(answers, null);
    return;
  }
  stepIdx++;
  renderStep(stepIdx);
  scrollAppToTop();
}

function backStep() {
  if (stepIdx === 0) return;
  const v = readStepValue();
  if (v !== null) answers[STEPS[stepIdx].key] = v;
  stepIdx--;
  renderStep(stepIdx);
  scrollAppToTop();
}

function scrollAppToTop() {
  try {
    document.getElementById('intake').scrollIntoView({ block: 'start', behavior: 'instant' });
  } catch (_) {
    window.scrollTo(0, 0);
  }
}

// ---------- Orchestration ----------

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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showIntake(resetIdx) {
  document.getElementById('receipt-wrap').hidden = true;
  document.getElementById('loading').hidden = true;
  document.getElementById('intake').hidden = false;
  const share = document.getElementById('share');
  if (share) share.style.display = 'none';
  if (resetIdx) stepIdx = 0;
  renderStep(stepIdx);
  scrollAppToTop();
}

function inputsAllValid(inputs) {
  for (const s of STEPS) {
    const v = inputs[s.key];
    if (!Number.isFinite(v) || v < s.min || v > s.max) return false;
  }
  return true;
}

async function runAssessment(inputs, providedSignature) {
  const items = computeAll(inputs);
  const total = items.reduce((s, x) => s + x.units, 0);
  const archetype = pickArchetype(items);

  showLoading(pickLoadingMsg(JSON.stringify(inputs)));

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

  const frag = encodeFragment(inputs, signature);
  try {
    history.replaceState(null, '', '#' + frag);
  } catch (_) {
    location.hash = frag;
  }
}

// ---------- Boot ----------

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('next-btn').addEventListener('click', nextStep);
  document.getElementById('back-btn').addEventListener('click', backStep);
  document.getElementById('redo-btn').addEventListener('click', () => {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    for (const k of Object.keys(answers)) delete answers[k];
    showIntake(true);
  });

  // Re-hydrate from fragment if present (skips stepper entirely).
  const hydrated = decodeFragment(location.hash);
  if (hydrated && inputsAllValid(hydrated.inputs)) {
    Object.assign(answers, hydrated.inputs);
    runAssessment(hydrated.inputs, hydrated.signature);
    return;
  }

  renderStep(0);
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
