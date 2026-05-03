// THE TUNER — six knobs, one named broadcast persona, one paragraph dispatch.
// Persona name is fully deterministic (computed locally from knob values) so a
// share URL always replays the same station even if the AI dispatch call fails.

const SLUG = 'the-tuner';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

// ─── knob spec ───────────────────────────────────────────────────────────────

const KNOBS = [
  { id: 'freq',      label: 'FREQ',      caption: ['low end · sub-bass · cellar hum',
                                                   'mid voice · narration band',
                                                   'high whistle · tin-roof shimmer'] },
  { id: 'decay',     label: 'DECAY',     caption: ['sustain · long tail · cathedral',
                                                   'natural reverb · room',
                                                   'short · dry · close-mic'] },
  { id: 'harmonics', label: 'HARMONICS', caption: ['pure tone · sine-wave restraint',
                                                   'bittersweet · 4ths and 5ths',
                                                   'dense overtones · brass-on-glass'] },
  { id: 'gloom',     label: 'GLOOM',     caption: ['noon light · uncomplicated',
                                                   'four-pm shadow · pensive',
                                                   'pre-dawn · marrow weather'] },
  { id: 'feral',     label: 'FERAL',     caption: ['domesticated · permitted · clean',
                                                   'half-tame · dogs that wander',
                                                   'unlicensed · teeth-out · uncited'] },
  { id: 'nostalgia', label: 'NOSTALGIA', caption: ['present tense · today',
                                                   'last summer · still-warm memory',
                                                   'archival · pre-cable · ghost-decade'] },
];

// ─── persona-name compositional banks (one bank per axis, sliced into 5 buckets) ─

// FREQ → BAND adjective (tonal register)
const BANK_FREQ = [
  'Sub-Bass', 'Lowband', 'Midwave', 'Uppercut', 'Hi-Frequency',
];

// DECAY → STATION-TYPE noun (the "what kind of broadcast")
const BANK_DECAY = [
  'Sustain Cathedral', 'Reverb Chapel', 'Room-Tone Bureau', 'Dry-Air Office', 'Close-Mic Booth',
];

// HARMONICS → MODIFIER prefix (texture)
const BANK_HARMONICS = [
  'Pure-Tone', 'Single-Sideband', 'Bittersweet', 'Brass-Plated', 'Overdriven',
];

// GLOOM → WEATHER NOUN (mood payload)
const BANK_GLOOM = [
  'Noon', 'Late-Afternoon', 'Dusk', 'Insomnia', 'Pre-Dawn',
];

// FERAL → AUTHORITY descriptor (institutional pose)
const BANK_FERAL = [
  'Licensed', 'Conditional', 'Half-Permitted', 'Unauthorised', 'Pirate',
];

// NOSTALGIA → PERIOD/PLACE noun (the temporal-locale)
const BANK_NOSTALGIA = [
  'the Live Hour', 'Suburban Grief', 'the Long Commute', 'the Reagan Years', 'the Lost Decade',
];

// Plus a small set of secondary "domain" nouns picked compositionally from the
// hash of all 6 values, so the same axis-bucket combo always gives the same name
// but the catalog is meaningfully larger than just the 5^6 = 15,625 base set.
const BANK_DOMAIN = [
  'Radio', 'Wire', 'Frequency', 'Signal', 'Bulletin', 'Dispatch', 'Broadcast', 'Telegraph',
];

const BANK_AFFIX = [
  '', '', '', // weighted blank — most names skip an affix
  ', After Hours',
  ', Off-Book',
  ', Re-Broadcast',
  ', On Loop',
  ', Mid-Storm',
];

// ─── deterministic helpers ───────────────────────────────────────────────────

function hash(str) {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function bucketOf(v, n) {
  // v ∈ [0, 99], n buckets
  const b = Math.floor((v / 100) * n);
  return Math.min(n - 1, Math.max(0, b));
}

// Pick a deterministic value out of `bank` from the *full* knob state — used for
// the secondary slots that need >5 options (DOMAIN, AFFIX) so the name catalogue
// grows beyond 5^6.
function pickFromBank(bank, knobs, salt) {
  const seed = hash(salt + ':' + knobs.join(','));
  return bank[seed % bank.length];
}

// Compose the deterministic persona name from a knob array [freq, decay, harm, gloom, feral, nost]
function composePersona(k) {
  const freq      = BANK_FREQ      [bucketOf(k[0], BANK_FREQ.length)];
  const decay     = BANK_DECAY     [bucketOf(k[1], BANK_DECAY.length)];
  const harmonics = BANK_HARMONICS [bucketOf(k[2], BANK_HARMONICS.length)];
  const gloom     = BANK_GLOOM     [bucketOf(k[3], BANK_GLOOM.length)];
  const feral     = BANK_FERAL     [bucketOf(k[4], BANK_FERAL.length)];
  const nostalgia = BANK_NOSTALGIA [bucketOf(k[5], BANK_NOSTALGIA.length)];

  const domain = pickFromBank(BANK_DOMAIN, k, 'domain');
  const affix  = pickFromBank(BANK_AFFIX,  k, 'affix');

  // Form: "[FERAL] [HARMONICS] [DOMAIN] of [GLOOM] [NOSTALGIA][AFFIX]"
  // e.g. "Pirate Brass-Plated Radio of Suburban Grief, After Hours"
  // Subtitle (callsign-style) is built separately.
  const name = `${feral} ${harmonics} ${domain} of ${gloom} ${nostalgia}${affix}`;
  const callsign = makeCallsign(k);
  const band = makeBand(k);
  return { name, callsign, band, parts: { freq, decay, harmonics, gloom, feral, nostalgia, domain } };
}

function makeCallsign(k) {
  // Three-letter prefix (always K- or W-, the FCC pirate-pun) + 3-digit suffix.
  const seed = hash('callsign:' + k.join(','));
  const prefix = (seed & 1) ? 'K' : 'W';
  const a = String.fromCharCode(65 + ((seed >>> 4) % 26));
  const b = String.fromCharCode(65 + ((seed >>> 9) % 26));
  const num = ((seed >>> 14) % 900) + 100;
  return `${prefix}${a}${b}-${num}`;
}

function makeBand(k) {
  // Pseudo-FM band, 87.7 – 107.9 MHz, deterministic.
  const seed = hash('band:' + k.join(','));
  const tenths = (seed % 202); // 0..201
  const mhz = 87.7 + tenths * 0.1;
  return mhz.toFixed(1);
}

// ─── live readout side-units (tiny numerics that tick) ───────────────────────

function unitsFromKnobs(k) {
  return {
    khz: (10 + (k[0] / 99) * 990).toFixed(1),       // 10.0 – 1000.0 kHz
    mk:  (0.5 + (k[3] / 99) * 9.4).toFixed(2),       // 0.50 – 9.94 MK (gloom-as-temperature inverted-feel)
    kp:  Math.max(0, Math.round((k[4] / 99) * 9)),    // Kp 0..9 (FERAL → solar-storm index)
    snr: (-6 + (k[2] / 99) * 36).toFixed(1),          // -6.0 .. +30.0 dB SNR
  };
}

// ─── waveform ascii (visible signal that morphs with knobs) ─────────────────

const WAVE_W = 44;
const WAVE_H = 5;
const GLYPH = ['·', '-', '~', '=', '#'];

function renderWaveform(k) {
  const freq      = k[0] / 99;
  const decay     = k[1] / 99;
  const harmonics = k[2] / 99;
  const gloom     = k[3] / 99;
  const feral     = k[4] / 99;
  const nostalgia = k[5] / 99;

  const cols = WAVE_W;
  const rows = WAVE_H;
  const cycles = 0.6 + freq * 4.5;       // FREQ → wavelength
  const ampBase = 0.55 + harmonics * 0.4; // HARMONICS → amplitude base
  const noiseAmt = feral * 0.45;          // FERAL → noise
  const decayShape = 0.2 + (1 - decay) * 0.9; // DECAY (low) → long tail / drift
  const gloomBias = (gloom - 0.5) * 0.4;     // GLOOM → vertical bias
  const echo = nostalgia * 0.35;             // NOSTALGIA → echo/repeat structure

  // Deterministic noise (no Math.random — fragment + knobs only)
  const seed = hash('wave:' + k.join(','));
  let rng = seed >>> 0;
  function rand() {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return ((rng >>> 8) & 0xffff) / 0xffff;
  }

  const grid = [];
  for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(' '));

  for (let x = 0; x < cols; x++) {
    const t = x / cols;
    const primary = Math.sin(t * cycles * Math.PI * 2 + harmonics * 1.3);
    const overtone = Math.sin(t * cycles * Math.PI * 4 + 0.7) * harmonics * 0.5;
    const echoLine = Math.sin(t * cycles * Math.PI * 2 - 1.2) * echo;
    const drift = Math.sin(t * Math.PI * decayShape) * 0.2;
    const noise = (rand() - 0.5) * 2 * noiseAmt;
    let y = (primary + overtone + echoLine) * ampBase * 0.5 + drift + gloomBias + noise;
    // Map y (-1..1) to row index
    const yi = Math.round((1 - (y * 0.5 + 0.5)) * (rows - 1));
    const yiC = Math.max(0, Math.min(rows - 1, yi));
    // Glyph weight by intensity (|y|)
    const gIdx = Math.min(GLYPH.length - 1, Math.floor(Math.abs(y) * GLYPH.length * 0.9));
    grid[yiC][x] = GLYPH[gIdx];
  }
  // Always draw a baseline pulse on the rare flat case
  return grid.map(row => row.join('')).join('\n');
}

// ─── persona morph (word-by-word reveal as knobs change) ─────────────────────

let lastPersonaName = '';
function setPersonaLine(el, newName) {
  if (newName === lastPersonaName) return;
  lastPersonaName = newName;
  // word-level diff: keep words that didn't change, flicker the ones that did
  const oldWords = (el.dataset.words || '').split('|');
  const newWords = newName.split(' ');
  el.innerHTML = '';
  newWords.forEach((w, i) => {
    const span = document.createElement('span');
    span.className = 'morph';
    span.textContent = w + (i < newWords.length - 1 ? ' ' : '');
    if (oldWords[i] !== w) {
      span.classList.add('flick');
      requestAnimationFrame(() => requestAnimationFrame(() => span.classList.remove('flick')));
    }
    el.appendChild(span);
  });
  el.dataset.words = newWords.join('|');
}

// ─── DOM wiring ──────────────────────────────────────────────────────────────

const state = {
  knobs: [50, 50, 50, 50, 50, 50],  // default centred
  committed: false,
};

const els = {};

function readKnobsFromInputs() {
  return KNOBS.map((k, i) => {
    const inp = els['range-' + k.id];
    return inp ? Number(inp.value) : state.knobs[i];
  });
}

function buildKnobs() {
  const dialsRoot = document.querySelector('.dials');
  dialsRoot.innerHTML = '';
  KNOBS.forEach((k, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'knob';
    wrap.innerHTML = `
      <div class="knob-row">
        <span class="knob-label">${k.label}</span>
        <span class="knob-value" id="value-${k.id}">${state.knobs[i].toString().padStart(2,'0')}</span>
      </div>
      <input type="range" min="0" max="99" step="1" value="${state.knobs[i]}" id="range-${k.id}" aria-label="${k.label} knob">
      <div class="knob-cap" id="cap-${k.id}">${k.caption[1]}</div>
    `;
    dialsRoot.appendChild(wrap);
    els['range-' + k.id] = wrap.querySelector('#range-' + k.id);
    els['value-' + k.id] = wrap.querySelector('#value-' + k.id);
    els['cap-' + k.id]   = wrap.querySelector('#cap-' + k.id);
  });
}

function captionFor(knobIndex, value) {
  const captions = KNOBS[knobIndex].caption;
  const i = bucketOf(value, captions.length);
  return captions[i];
}

function refreshLiveReadout() {
  const k = readKnobsFromInputs();
  state.knobs = k;

  // Knob value labels + captions
  KNOBS.forEach((K, i) => {
    if (els['value-' + K.id]) els['value-' + K.id].textContent = String(k[i]).padStart(2,'0');
    if (els['cap-' + K.id])   els['cap-' + K.id].textContent   = captionFor(i, k[i]);
  });

  // Compose persona + units
  const persona = composePersona(k);
  const units = unitsFromKnobs(k);

  setPersonaLine(els.persona, persona.name);

  // Chip strip (small numerics)
  els.chipFreq.querySelector('b').textContent       = String(k[0]).padStart(2,'0');
  els.chipDecay.querySelector('b').textContent      = String(k[1]).padStart(2,'0');
  els.chipHarmonics.querySelector('b').textContent  = String(k[2]).padStart(2,'0');
  els.chipGloom.querySelector('b').textContent      = String(k[3]).padStart(2,'0');
  els.chipFeral.querySelector('b').textContent      = String(k[4]).padStart(2,'0');
  els.chipNostalgia.querySelector('b').textContent  = String(k[5]).padStart(2,'0');

  // Side-unit numerics
  els.unitKhz.textContent = `${units.khz} kHz`;
  els.unitMk.textContent  = `${units.mk} MK`;
  els.unitKp.textContent  = `Kp ${units.kp}`;
  els.unitSnr.textContent = `SNR ${units.snr} dB`;

  // Waveform
  els.wave.textContent = renderWaveform(k);

  // Header meta (callsign band)
  els.headMeta.textContent = `unit ${persona.callsign} · band ${persona.band} MHz`;

  // Persist to URL fragment so refresh restores
  writeFragment(k);
}

// ─── URL fragment encode/decode ───────────────────────────────────────────────

function writeFragment(k) {
  // 6 two-digit numbers, dot-separated. Short. SMS-safe.
  const f = k.map(v => String(v).padStart(2, '0')).join('.');
  // Avoid spamming history; replaceState only if changed.
  const target = '#k=' + f;
  if (location.hash !== target) {
    history.replaceState(null, '', target);
  }
}

function readFragment() {
  const m = location.hash.match(/k=([0-9.]+)/);
  if (!m) return null;
  const parts = m[1].split('.').map(s => parseInt(s, 10));
  if (parts.length !== 6 || parts.some(n => Number.isNaN(n) || n < 0 || n > 99)) return null;
  return parts;
}

// ─── AI dispatch (one personalized sentence) ─────────────────────────────────

const FALLBACK_DISPATCHES = [
  'transmission live: the station holds steady at the wavelength only it can hear, and the rest of the dial pretends not to notice.',
  'broadcasting now: a single voice describing weather no map records, repeating until someone tunes in.',
  'on the air: a familiar room you have never been in, lit by the kind of lamp that hums when no one is listening.',
  'live feed: a slow, certain narration of small disturbances, framed as the news of the day.',
  'streaming: a frequency reserved for the things you almost said before deciding not to.',
];

function deterministicDispatch(persona, k) {
  const i = hash('fb:' + k.join(',')) % FALLBACK_DISPATCHES.length;
  return FALLBACK_DISPATCHES[i];
}

async function generateDispatch(persona, k) {
  const sys =
`You are the announcer of a fictional pirate radio station with a very specific name. You write ONE sentence — never more — that is the on-air dispatch from this station, in the voice of the station itself.

Hard rules:
- Output ONLY the sentence. No quote marks. No hashtags. No emojis. No "Here is your dispatch" preface.
- Under 32 words.
- Lowercase except proper nouns.
- Do NOT include the station name in the sentence (it is already on screen).
- Voice: deadpan-mystical AM-radio late-night host, like a weather report for an interior region of the listener that does not appear on any official map.
- Be specific: name a small concrete object, a time of day, a kind of weather, or a household sound. Avoid "cosmic," "soul," "vibe," "energy," "journey."`;

  const user =
`STATION: ${persona.name}
CALLSIGN: ${persona.callsign} · ${persona.band} MHz
DIAL STATE — six knobs each 0–99:
  FREQ      ${k[0]}   (${captionFor(0, k[0])})
  DECAY     ${k[1]}   (${captionFor(1, k[1])})
  HARMONICS ${k[2]}   (${captionFor(2, k[2])})
  GLOOM     ${k[3]}   (${captionFor(3, k[3])})
  FERAL     ${k[4]}   (${captionFor(4, k[4])})
  NOSTALGIA ${k[5]}   (${captionFor(5, k[5])})

Write the on-air sentence now.`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: [
          { role: 'system', content: sys },
          { role: 'user',   content: user },
        ],
        max_tokens: 90,
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let txt = (data.content || '').trim();
    // strip surrounding quotes if model added them despite instructions
    txt = txt.replace(/^["“”'`]+/, '').replace(/["“”'`]+$/, '').trim();
    if (!txt) throw new Error('empty');
    return txt;
  } catch (_) {
    return deterministicDispatch(persona, k);
  }
}

// ─── commit / lock the licence ───────────────────────────────────────────────

async function commit() {
  const k = readKnobsFromInputs();
  state.knobs = k;
  state.committed = true;

  const persona = composePersona(k);
  const units = unitsFromKnobs(k);

  // Stamp date (UTC, station-log style)
  const now = new Date();
  const issued = `issued ${now.toUTCString().slice(0, 16)} UTC`;

  // Render the licence with placeholder dispatch + loading state, then await the AI
  els.licence.hidden = false;
  els.licence.setAttribute('aria-hidden', 'false');
  els.licenceName.textContent = persona.name;
  els.licenceMeta.textContent = `callsign ${persona.callsign} · band ${persona.band} MHz · operator: anonymous`;
  els.licenceStamp.textContent = 'PROVISIONAL';
  els.licenceDispatch.textContent = 'station tuning… handing the mic to the announcer…';
  els.licenceIssued.textContent = issued;
  els.licenceGrid.innerHTML = `
    <div class="row"><span class="k">FREQ</span><span class="v">${String(k[0]).padStart(2,'0')}</span></div>
    <div class="row"><span class="k">DECAY</span><span class="v">${String(k[1]).padStart(2,'0')}</span></div>
    <div class="row"><span class="k">HARMONICS</span><span class="v">${String(k[2]).padStart(2,'0')}</span></div>
    <div class="row"><span class="k">GLOOM</span><span class="v">${String(k[3]).padStart(2,'0')}</span></div>
    <div class="row"><span class="k">FERAL</span><span class="v">${String(k[4]).padStart(2,'0')}</span></div>
    <div class="row"><span class="k">NOSTALGIA</span><span class="v">${String(k[5]).padStart(2,'0')}</span></div>
    <div class="row"><span class="k">SNR</span><span class="v">${units.snr} dB</span></div>
    <div class="row"><span class="k">PEAK</span><span class="v">${units.mk} MK</span></div>
    <div class="row"><span class="k">Kp</span><span class="v">${units.kp}</span></div>
  `;

  // Status flips to LIVE
  els.readoutStatus.textContent = 'LIVE';
  els.readoutStatus.classList.add('live');

  // Scroll the licence into view (gentle)
  els.licence.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Reveal the share row immediately so users always have an out
  els.share.style.display = 'flex';

  // AI flourish
  const sentence = await generateDispatch(persona, k);
  els.licenceDispatch.textContent = sentence;
  els.licenceStamp.textContent = 'LICENSED';
}

function retune() {
  state.committed = false;
  els.licence.hidden = true;
  els.licence.setAttribute('aria-hidden', 'true');
  els.share.style.display = 'none';
  els.readoutStatus.textContent = 'SCANNING';
  els.readoutStatus.classList.remove('live');
  // Scroll back to the dials
  document.querySelector('.dials').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── share() — global so the inline onclick in HTML can find it ──────────────

function share() {
  const url = location.href;
  if (navigator.share) {
    navigator.share({
      title: document.title,
      text: lastPersonaName ? `tune in: ${lastPersonaName}` : document.title,
      url,
    }).catch(() => {/* user cancelled — fine */});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      // brief inline ack
      const btn = els.shareBtn;
      if (!btn) return alert('Link copied!');
      const orig = btn.textContent;
      btn.textContent = '// LINK COPIED';
      setTimeout(() => { btn.textContent = orig; }, 1400);
    }).catch(() => alert(url));
  } else {
    alert(url);
  }
}
window.share = share;

// ─── boot ────────────────────────────────────────────────────────────────────

function init() {
  // Pre-fill from URL fragment if present (so the share-link UX is byte-faithful)
  const fragment = readFragment();
  if (fragment) state.knobs = fragment;

  buildKnobs();

  // cache DOM lookups
  els.persona       = document.getElementById('persona-line');
  els.wave          = document.getElementById('waveform');
  els.headMeta      = document.getElementById('head-meta');
  els.readoutStatus = document.getElementById('readout-status');
  els.chipFreq      = document.getElementById('chip-freq');
  els.chipDecay     = document.getElementById('chip-decay');
  els.chipHarmonics = document.getElementById('chip-harmonics');
  els.chipGloom     = document.getElementById('chip-gloom');
  els.chipFeral     = document.getElementById('chip-feral');
  els.chipNostalgia = document.getElementById('chip-nostalgia');
  els.unitKhz       = document.getElementById('unit-khz');
  els.unitMk        = document.getElementById('unit-mk');
  els.unitKp        = document.getElementById('unit-kp');
  els.unitSnr       = document.getElementById('unit-snr');
  els.licence       = document.getElementById('licence');
  els.licenceName   = document.getElementById('licence-name');
  els.licenceMeta   = document.getElementById('licence-meta');
  els.licenceStamp  = document.getElementById('licence-stamp');
  els.licenceDispatch = document.getElementById('licence-dispatch');
  els.licenceGrid   = document.getElementById('licence-grid');
  els.licenceIssued = document.getElementById('licence-issued');
  els.share         = document.getElementById('share');
  els.shareBtn      = els.share.querySelector('button');

  // Bind input events on each range
  KNOBS.forEach(k => {
    const inp = document.getElementById('range-' + k.id);
    inp.addEventListener('input', refreshLiveReadout);
  });

  document.getElementById('commit-btn').addEventListener('click', commit);
  document.getElementById('retune-btn').addEventListener('click', retune);

  refreshLiveReadout();

  // If the user landed via a shared committed link, auto-commit so they see
  // the same licence card the sender saw — but allow retuning.
  const hadFragment = !!fragment;
  const wasShared = location.hash.includes('locked=1');
  if (hadFragment && wasShared) {
    // strip locked flag from the hash, keep the knob state
    history.replaceState(null, '', '#k=' + state.knobs.map(v => String(v).padStart(2,'0')).join('.'));
    commit();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
