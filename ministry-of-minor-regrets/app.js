// Ministry of Minor Regrets — bureaucratic-audit calculator.
// One declaration at a time (no scrolling form). 10 questions chosen to feel
// like things that quietly affect your health/wellbeing but you don't usually
// audit yourself for — sunlight, hydration timing, the call you didn't make,
// the breath you held, the hug you didn't ask for. Core arithmetic is fully
// deterministic; an LLM generates only the closing signature line. Inputs +
// signature are encoded into the URL fragment so shared links re-hydrate the
// exact receipt without spending an LLM call.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'ministry-of-minor-regrets';

// ---------- Ministry benchmarks & per-line metadata ----------

const BENCHMARKS = {
  sun:     { benchmark: 60, unitLabel: 'min',   code: 'SUN-038', itemName: 'Solar Deficit Citation' },
  called:  { benchmark: 7,  unitLabel: 'days',  code: 'FAM-027', itemName: 'Filial Delay Assessment' },
  water:   { benchmark: 2,  unitLabel: 'hrs',   code: 'HYD-440', itemName: 'Hydration Lapse Penalty' },
  sit:     { benchmark: 60, unitLabel: 'min',   code: 'POS-510', itemName: 'Sedentary Stretch Surcharge' },
  quiet:   { benchmark: 15, unitLabel: 'min',   code: 'QTE-303', itemName: 'Unmet Quiet Allotment' },
  bed:     { benchmark: 0,  unitLabel: 'night', code: 'SLP-309', itemName: 'Bedside Device Encroachment Fee' },
  meal:    { benchmark: 0,  unitLabel: 'meal',  code: 'NUT-180', itemName: 'Distracted Mastication Surcharge' },
  outside: { benchmark: 1,  unitLabel: 'days',  code: 'OUT-444', itemName: 'Unmediated Air Deficit' },
  breath:  { benchmark: 0,  unitLabel: 'time',  code: 'BRE-616', itemName: 'Parasympathetic Negligence' },
  hugs:    { benchmark: 4,  unitLabel: 'hug',   code: 'TCH-808', itemName: 'Touch-Quota Shortfall' },
};

// ---------- Step (declaration) configuration ----------

const STEPS = [
  {
    key: 'sun',
    label: 'Minutes of direct sunlight on your skin today',
    hint: 'Ministry benchmark: 60 min — circadian & vitamin-D allotment',
    placeholder: 'e.g. 12',
    step: 1, min: 0, max: 1440,
    inputmode: 'numeric',
  },
  {
    key: 'called',
    label: 'Days since you called someone you love',
    hint: 'Ministry benchmark: 7 days',
    placeholder: 'e.g. 22',
    step: 1, min: 0, max: 9999,
    inputmode: 'numeric',
  },
  {
    key: 'water',
    label: 'Hours since your last full glass of plain water',
    hint: 'Ministry benchmark: 2 hrs',
    placeholder: 'e.g. 5',
    step: 0.5, min: 0, max: 48,
    inputmode: 'decimal',
  },
  {
    key: 'sit',
    label: 'Longest unbroken stretch sitting today (minutes)',
    hint: 'Ministry benchmark: 60 min — kindly stand up',
    placeholder: 'e.g. 180',
    step: 5, min: 0, max: 1440,
    inputmode: 'numeric',
  },
  {
    key: 'quiet',
    label: 'Minutes today in true silence (no music, no podcast, no speech)',
    hint: 'Ministry benchmark: 15 min',
    placeholder: 'e.g. 0',
    step: 1, min: 0, max: 1440,
    inputmode: 'numeric',
  },
  {
    key: 'bed',
    label: "Nights this past week your phone slept within arm's reach",
    hint: 'Ministry benchmark: 0 nights',
    placeholder: 'e.g. 7',
    step: 1, min: 0, max: 7,
    inputmode: 'numeric',
  },
  {
    key: 'meal',
    label: 'Meals today eaten while doing something else (screen, walking, working)',
    hint: 'Ministry benchmark: 0 meals',
    placeholder: 'e.g. 2',
    step: 1, min: 0, max: 20,
    inputmode: 'numeric',
  },
  {
    key: 'outside',
    label: 'Days since you spent 30+ min outside with no earbuds in',
    hint: 'Ministry benchmark: 1 day',
    placeholder: 'e.g. 9',
    step: 1, min: 0, max: 9999,
    inputmode: 'numeric',
  },
  {
    key: 'breath',
    label: 'Times today you noticed yourself holding your breath',
    hint: 'Ministry benchmark: 0',
    placeholder: 'e.g. 3',
    step: 1, min: 0, max: 99,
    inputmode: 'numeric',
  },
  {
    key: 'hugs',
    label: 'Hugs given or received today',
    hint: 'Ministry benchmark: 4',
    placeholder: 'e.g. 1',
    step: 1, min: 0, max: 99,
    inputmode: 'numeric',
  },
];

// ---------- Deterministic line-item arithmetic ----------

function computeSun(min) {
  // Below 60 min = solar deficit. Above 240 min = excess (peeling clerk).
  const deficit = Math.max(0, 60 - min);
  const excess = Math.max(0, min - 240);
  const units = Math.round(deficit * 0.9 + excess * 0.4);
  return {
    key: 'sun',
    name: BENCHMARKS.sun.itemName,
    code: BENCHMARKS.sun.code,
    inputText: `${min} min sun`,
    formula: deficit > 0
      ? `${deficit} min below 60-min daily allotment × 0.9`
      : excess > 0
        ? `${excess} min above 240-min ceiling × 0.4`
        : 'within solar tolerance',
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
    inputText: `${days} day${days === 1 ? '' : 's'} since calling`,
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

function computeWater(hrs) {
  const b = BENCHMARKS.water.benchmark;
  const excess = Math.max(0, hrs - b);
  // 38 units per hour past 2-hour reach window.
  const units = Math.round(excess * 38);
  return {
    key: 'water',
    name: BENCHMARKS.water.itemName,
    code: BENCHMARKS.water.code,
    inputText: `${stripZeros(hrs)}h since glass`,
    formula: excess > 0
      ? `${stripZeros(excess)}h past 2-hour reach window × 38`
      : 'hydration current',
    units,
  };
}

function computeSit(min) {
  const b = BENCHMARKS.sit.benchmark;
  const excess = Math.max(0, min - b);
  let raw = excess * 1.6;
  if (min > 120) raw += (min - 120) * 1.2;
  const units = Math.min(Math.round(raw), 280);
  return {
    key: 'sit',
    name: BENCHMARKS.sit.itemName,
    code: BENCHMARKS.sit.code,
    inputText: `${min} min unbroken sit`,
    formula: excess > 0
      ? min > 120
        ? `${excess} min past 60 × 1.6, +escalation 120+`
        : `${excess} min past 60 × 1.6`
      : 'posture rotation acceptable',
    units,
  };
}

function computeQuiet(min) {
  // Reverse — fewer minutes of silence = more regret.
  const deficit = Math.max(0, BENCHMARKS.quiet.benchmark - min);
  const units = Math.round(deficit * 8);
  return {
    key: 'quiet',
    name: BENCHMARKS.quiet.itemName,
    code: BENCHMARKS.quiet.code,
    inputText: `${min} min silence`,
    formula: deficit > 0
      ? `${deficit} min below 15-min daily quiet allotment × 8`
      : 'sufficient ambient quiet logged',
    units,
  };
}

function computeBed(nights) {
  // Each phone-at-pillow night: 26 units, +12 escalation past 3 nights.
  let raw = nights * 26;
  if (nights > 3) raw += (nights - 3) * 12;
  const units = Math.round(raw);
  return {
    key: 'bed',
    name: BENCHMARKS.bed.itemName,
    code: BENCHMARKS.bed.code,
    inputText: `${nights} night${nights === 1 ? '' : 's'} phone-at-pillow`,
    formula: nights > 3
      ? `${nights} × 26, +escalation past 3 nights`
      : nights > 0
        ? `${nights} × 26`
        : 'bedside device-free',
    units,
  };
}

function computeMeal(n) {
  // Each distracted meal: 35 units flat.
  const units = Math.round(n * 35);
  return {
    key: 'meal',
    name: BENCHMARKS.meal.itemName,
    code: BENCHMARKS.meal.code,
    inputText: `${n} distracted meal${n === 1 ? '' : 's'}`,
    formula: n > 0
      ? `${n} meal${n === 1 ? '' : 's'} eaten distracted × 35`
      : 'mealtime attention undivided',
    units,
  };
}

function computeOutside(days) {
  const b = BENCHMARKS.outside.benchmark;
  const excess = Math.max(0, days - b);
  let raw = excess * 22;
  if (days > 7) raw += (days - 7) * 16;
  const units = Math.round(raw);
  return {
    key: 'outside',
    name: BENCHMARKS.outside.itemName,
    code: BENCHMARKS.outside.code,
    inputText: `${days} day${days === 1 ? '' : 's'} unmediated air`,
    formula: days > 7
      ? `${excess}d past 1-day allowance × 22, +escalation 7+`
      : excess > 0
        ? `${excess}d past 1-day allowance × 22`
        : 'outdoor exposure current',
    units,
  };
}

function computeBreath(n) {
  // Each noticed held breath: 24 units, log escalation past 4.
  let raw = n * 24;
  if (n > 4) raw += 30 * Math.log10(1 + (n - 4));
  const units = Math.min(Math.round(raw), 240);
  return {
    key: 'breath',
    name: BENCHMARKS.breath.itemName,
    code: BENCHMARKS.breath.code,
    inputText: `${n} held breath${n === 1 ? '' : 's'}`,
    formula: n > 0
      ? n > 4
        ? `${n} × 24, +escalation past 4`
        : `${n} × 24`
      : 'autonomic equilibrium maintained',
    units,
  };
}

function computeHugs(n) {
  // Reverse — fewer hugs = more regret. Benchmark 4.
  const deficit = Math.max(0, BENCHMARKS.hugs.benchmark - n);
  const units = Math.round(deficit * 28);
  return {
    key: 'hugs',
    name: BENCHMARKS.hugs.itemName,
    code: BENCHMARKS.hugs.code,
    inputText: `${n} hug${n === 1 ? '' : 's'}`,
    formula: deficit > 0
      ? `${deficit} short of 4-hug daily allotment × 28`
      : 'tactile quota satisfied',
    units,
  };
}

const FIELD_COMPUTE = {
  sun:     computeSun,
  called:  computeCalled,
  water:   computeWater,
  sit:     computeSit,
  quiet:   computeQuiet,
  bed:     computeBed,
  meal:    computeMeal,
  outside: computeOutside,
  breath:  computeBreath,
  hugs:    computeHugs,
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
    sun: [
      'The Pale Cartographer of the Inner Office',
      'The Reluctant Subject of the Lampshade Sun',
      'The Vitamin-D Refugee of Sub-Basement 4',
    ],
    called: [
      "The Estranged Attaché of Somebody Else's Landline",
      'The Distant Nephew of a Neglected Rotary',
      'The Reluctant Correspondent to Mothers Everywhere',
    ],
    water: [
      'The Parched Notary of the Desk Drawer',
      'The Salted Clerk of the Late Afternoon',
      'The Dried-Throat Diplomat of the Standing Pitcher',
    ],
    sit: [
      'The Petrified Archivist of the Adjustable Chair',
      'The Stationary Envoy of Hour Three',
      'The Calcified Steward of the Lumbar Cushion',
    ],
    quiet: [
      'The Sound-Saturated Magistrate of the Always-On Headphone',
      'The Unsoothed Custodian of the Background Hum',
      'The Audio Refugee of the Permanent Podcast',
    ],
    bed: [
      'The Bedside Vigil-Keeper of the Sleeping Phone',
      'The Pillow-Adjacent Sentry of the Notification Glow',
      'The Nocturnal Diplomat to a Charging Cable',
    ],
    meal: [
      'The Multitasking Mastication Specialist',
      'The Inattentive Diner of the Lit Screen',
      'The Distracted Forkkeeper of the Lunchtime Tab',
    ],
    outside: [
      'The Soundproofed Pilgrim of the Sidewalk',
      'The Earbudded Observer of the Untouched Park',
      'The Indoor Plant of Sub-Basement 4',
    ],
    breath: [
      'The Caught-Breath Bureaucrat of the Daily Inbox',
      'The Held-Lung Notary of the Unread Memo',
      'The Stilled-Diaphragm Diplomat of the Group Chat',
    ],
    hugs: [
      'The Touch-Starved Undersecretary of the Side Hug',
      'The Embrace-Deficient Magistrate of Tuesday',
      'The Tactile Refugee of the Remote Office',
    ],
  };

  const PAIR_OVERRIDES = {
    'called+hugs':    'The Estranged Embrace-Keeper of an Unmade Phone Call',
    'sit+sun':        'The Petrified Pale Magistrate of the Inner Window',
    'bed+breath':     'The Caught-Breath Bedside Sentry of the Notification Glow',
    'outside+quiet':  'The Indoor Plant of the Always-On Soundtrack',
    'meal+sit':       'The Stationary Diner of the Lit Lunchtime Screen',
    'breath+water':   'The Parched, Held-Lung Clerk of the Late Memo',
    'called+outside': 'The Estranged Indoor Diplomat of the Long Silence',
    'hugs+quiet':     'The Touch-Starved Audio Refugee of the Always-On Headphone',
    'breath+sit':     'The Held-Breath Stationary Steward of the Forgotten Posture',
    'sun+water':      'The Pale, Parched Cartographer of the Inner Office',
    'bed+meal':       'The Bedside Diner of the Glowing Late Snack',
    'hugs+outside':   'The Touch-Starved Indoor Observer of the Untouched Park',
    'called+meal':    'The Distracted Forkkeeper of an Unmade Phone Call',
    'sun+outside':    'The Pale Indoor Plant of Sub-Basement 4',
  };

  if (PAIR_OVERRIDES[pair] && top.units > 0 && second.units > 0) {
    return {
      name: PAIR_OVERRIDES[pair],
      stampLine: 'ASSESSED: PENALTIES APPLIED',
      heaviest: top,
    };
  }

  const magnitude = Math.abs(Math.round(top.units)) % 3;
  const name = (ARCHETYPES[top.key] || ARCHETYPES.sun)[magnitude];

  return {
    name,
    stampLine: 'ASSESSED: PENALTIES APPLIED',
    heaviest: top,
  };
}

// ---------- URL fragment encode/decode ----------
// v=3 schema: one short key per line item + sig.
//   sn=sun, cl=called, wt=water, st=sit, qt=quiet, bd=bed,
//   ml=meal, ot=outside, br=breath, hg=hugs, sig=base64(signature)
// (v=2 was the previous question set — incompatible, intentionally not parsed.)

const FRAG_KEYS = {
  sun: 'sn', called: 'cl', water: 'wt', sit: 'st', quiet: 'qt',
  bed: 'bd', meal: 'ml', outside: 'ot', breath: 'br', hugs: 'hg',
};

function encodeFragment(inputs, signature) {
  const p = new URLSearchParams();
  p.set('v', '3');
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
  if (p.get('v') !== '3') return null;
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
  sun:     'A small portion of light has been requisitioned in your name today, and the Ministry has filed the deficit on parchment.',
  called:  'Somewhere a phone rings in a kitchen you used to know the smell of, and nobody has logged the silence.',
  water:   'The Ministry observed your throat and finds it dry; a memo to the kitchen has been issued in triplicate.',
  sit:     'The chair has begun to mistake you for furniture, and the Ministry will not contradict the chair.',
  quiet:   'The Ministry has registered a backlog of unmet quiet, and recommends one (1) unaccompanied minute before bed.',
  bed:     'Your phone slept beside you again, and now both of you are tired in slightly different ways.',
  meal:    'A meal occurred, the Ministry confirms, but no one in the room can describe the flavor.',
  outside: 'The doorway has filed a missing-person report on your behalf; please respond to the open air at your earliest.',
  breath:  'You held a breath today and forgot to release it on the proper form, and the Ministry has noticed.',
  hugs:    'A small backlog of unembraced hellos has accumulated; the Ministry recommends gentle correction.',
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
