// The Standing Ovation Audit — clap-tap a faux awards ceremony, get judged.

const SLUG = 'the-standing-ovation-audit';
const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

const CATEGORIES = [
  "Best Apology Heard At Brunch",
  "Most Aggressive Iced Coffee Order",
  "Lifetime Achievement in Reply-All",
  "Best Use of 'Per My Last Email'",
  "Most Convincing Fake Phone Call",
  "Outstanding Achievement in Avoiding a Group Chat",
  "Best Performance as 'Just Five More Minutes'",
  "Lifetime Disappointment in Loading the Dishwasher"
];

const CATEGORY_DURATION_MS = 6000;

// Archetypes — deterministic mapping from clap profile.
// Each archetype: { name, blurb (deterministic fallback flourish line) }
const ARCHETYPES = [
  { name: "The Selective Approver",          fallback: "You hoarded your applause for the few categories you deemed worthy. The Academy admires the discipline; the categories do not." },
  { name: "The Indiscriminate Hand-Pounder", fallback: "You applauded with the unflinching enthusiasm of someone who has never once read a contract." },
  { name: "The Polite Phantom",              fallback: "You produced sound, technically. The committee is unsure whether it counted." },
  { name: "The Standing Ovation Defector",   fallback: "You began with thunder and ended with a slow, polite clearing of the throat." },
  { name: "The Late Bloomer",                fallback: "You warmed up reluctantly, then peaked just as the Academy was preparing to leave." },
  { name: "The Front-Loaded Enthusiast",     fallback: "You spent your applause early. By the final category you were emotionally bankrupt." },
  { name: "The Steady Civil Servant",        fallback: "Your applause never wavered, never surged, and never quite arrived." },
  { name: "The Reluctant Witness",           fallback: "You clapped only when watched, and never when it counted." },
  { name: "The Thunderclap Specialist",      fallback: "You delivered exactly one ovation of biblical scale and considered the matter closed." },
  { name: "The Golf-Clap Aristocrat",        fallback: "You applauded with the bored distinction of someone whose family has owned several drawers." },
  { name: "The Erratic Patron",              fallback: "Your applause pattern resembles a graph of someone's pulse during tax season." },
  { name: "The Audit Refusenik",             fallback: "You declined to participate in roughly the way one declines a wedding invitation." },
  { name: "The Polite Insurgent",            fallback: "Your selective claps formed, in retrospect, a coded message. The Academy chose not to translate it." },
  { name: "The Earnest Believer",            fallback: "You applauded each category with the earnest hope of a person new to disappointment." },
  { name: "The Festival Ovationist",         fallback: "You applauded so consistently the Academy filed a noise complaint against itself." },
  { name: "The Quietly Devastating Critic",  fallback: "Your restraint was the loudest thing in the room." }
];

// ---------- state ----------
let categoryIndex = 0;
let intensities = []; // per-category mean intensity 0..255
let perCategoryPeak = []; // per-category peak instantaneous level 0..255
let perCategoryTaps = []; // count of distinct presses per category
let currentLevel = 0; // smoothed 0..1
let pressActive = false;
let pressStart = 0;
let pressCount = 0;
let levelSamples = [];
let peakInCat = 0;
let categoryStart = 0;
let timerRAF = null;
let advanceTimeout = null;
let restartingFromHash = false;

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Encode 8 bytes (intensities 0..255) into URL-safe base64
function encodeFragment(bytes) {
  const bin = String.fromCharCode.apply(null, bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeFragment(frag) {
  try {
    const b64 = frag.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const out = [];
    for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
    return out;
  } catch (_) { return null; }
}

// ---------- screens ----------
function showScreen(id) {
  ['intro', 'audit', 'verdict'].forEach(s => {
    const el = $(s);
    if (!el) return;
    el.hidden = (s !== id);
  });
}

// ---------- audit flow ----------
function startAudit() {
  categoryIndex = 0;
  intensities = [];
  perCategoryPeak = [];
  perCategoryTaps = [];
  showScreen('audit');
  beginCategory();
}

function beginCategory() {
  if (categoryIndex >= CATEGORIES.length) {
    finishAudit();
    return;
  }
  // reset per-category sampling
  pressActive = false;
  pressCount = 0;
  levelSamples = [];
  peakInCat = 0;
  currentLevel = 0;

  $('cat-counter').textContent = `Category ${categoryIndex + 1} of ${CATEGORIES.length}`;
  $('cat-name').textContent = CATEGORIES[categoryIndex];
  $('meter-fill').style.width = '0%';
  $('audience-row').classList.remove('active');
  $('clap-pad').classList.remove('pressed');

  categoryStart = performance.now();
  if (timerRAF) cancelAnimationFrame(timerRAF);
  if (advanceTimeout) clearTimeout(advanceTimeout);

  timerRAF = requestAnimationFrame(tick);
  advanceTimeout = setTimeout(advanceCategory, CATEGORY_DURATION_MS);
}

function tick(now) {
  // Smooth current level toward target (1 if pressed, decays otherwise)
  const target = pressActive ? 1 : 0;
  // Quick rise, slower decay, but decay is fast enough to feel responsive between taps.
  const rise = 0.22;
  const fall = 0.07;
  if (target > currentLevel) currentLevel += (target - currentLevel) * rise;
  else currentLevel += (target - currentLevel) * fall;

  // Tiny tremor when active for liveliness
  let display = currentLevel;
  if (pressActive) display = clamp(display + (Math.random() - 0.5) * 0.04, 0, 1);

  $('meter-fill').style.width = (display * 100).toFixed(1) + '%';
  if (display > 0.18) $('audience-row').classList.add('active');
  else $('audience-row').classList.remove('active');

  // sample for mean
  levelSamples.push(currentLevel);
  if (currentLevel > peakInCat) peakInCat = currentLevel;

  // timer display
  const elapsed = now - categoryStart;
  const remaining = Math.max(0, (CATEGORY_DURATION_MS - elapsed) / 1000);
  $('cat-timer').textContent = remaining.toFixed(1);

  if (elapsed < CATEGORY_DURATION_MS + 60) {
    timerRAF = requestAnimationFrame(tick);
  }
}

function advanceCategory() {
  if (timerRAF) cancelAnimationFrame(timerRAF);
  // Compute mean over samples
  const mean = levelSamples.length ? levelSamples.reduce((a, b) => a + b, 0) / levelSamples.length : 0;
  // Bonus weight from tap count to differentiate "many short taps" from "silence"
  const tapBoost = Math.min(0.15, pressCount * 0.025);
  const score = clamp(mean + tapBoost, 0, 1);
  intensities.push(Math.round(score * 255));
  perCategoryPeak.push(Math.round(peakInCat * 255));
  perCategoryTaps.push(pressCount);

  categoryIndex++;
  beginCategory();
}

// ---------- press handling ----------
function pressDown(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (pressActive) return;
  pressActive = true;
  pressStart = performance.now();
  pressCount++;
  $('clap-pad').classList.add('pressed');
}

function pressUp() {
  if (!pressActive) return;
  pressActive = false;
  $('clap-pad').classList.remove('pressed');
}

// ---------- archetype mapping ----------
function pickArchetype(intensitiesByte) {
  // Compute features (all from 0..255 intensities)
  const ints = intensitiesByte.slice();
  const n = ints.length;
  const mean = ints.reduce((a, b) => a + b, 0) / n;
  const max = Math.max.apply(null, ints);
  const min = Math.min.apply(null, ints);
  const variance = ints.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  const stddev = Math.sqrt(variance);
  // First half vs second half (early vs late)
  const firstHalf = ints.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const secondHalf = ints.slice(4).reduce((a, b) => a + b, 0) / 4;
  const trend = secondHalf - firstHalf; // positive = late bloomer, negative = front-loaded

  // High count: how many categories above 140
  const highCount = ints.filter(v => v >= 140).length;
  // Silence count: below 30
  const silenceCount = ints.filter(v => v < 30).length;
  // Approving: between 60 and 200 inclusive
  const moderateCount = ints.filter(v => v >= 60 && v <= 200).length;

  // Decision tree — deterministic.
  // 1) Almost no participation
  if (mean < 18 && max < 50) return ARCHETYPES[11]; // Audit Refusenik
  // 2) Very quiet across the board
  if (mean < 40 && max < 90) return ARCHETYPES[2]; // Polite Phantom
  // 3) Universally loud
  if (mean > 200 && stddev < 35) return ARCHETYPES[14]; // Festival Ovationist
  if (mean > 170 && silenceCount === 0) return ARCHETYPES[1]; // Indiscriminate Hand-Pounder
  // 4) Single thunderclap among silence
  if (highCount === 1 && silenceCount >= 5) return ARCHETYPES[8]; // Thunderclap Specialist
  // 5) Strong front-load / back-load
  if (trend < -55 && firstHalf > 130) return ARCHETYPES[5]; // Front-Loaded Enthusiast
  if (trend > 55 && secondHalf > 130) return ARCHETYPES[4]; // Late Bloomer
  // 6) Defector — high early, drops to low end
  if (firstHalf > 150 && secondHalf < 60) return ARCHETYPES[3]; // Standing Ovation Defector
  // 7) High variance with selectivity
  if (stddev > 75 && highCount >= 2 && silenceCount >= 2) return ARCHETYPES[12]; // Polite Insurgent
  if (stddev > 70 && highCount >= 1 && silenceCount >= 3) return ARCHETYPES[0]; // Selective Approver
  // 8) Erratic / chaotic
  if (stddev > 60) return ARCHETYPES[10]; // Erratic Patron
  // 9) Quiet-but-pointed: low mean but decent stddev
  if (mean < 70 && stddev > 30) return ARCHETYPES[15]; // Quietly Devastating Critic
  // 10) Mid-range steady
  if (stddev < 25 && mean >= 60 && mean <= 130) return ARCHETYPES[6]; // Steady Civil Servant
  // 11) Mid-range, all moderate, no peaks
  if (moderateCount >= 6 && max < 200) return ARCHETYPES[13]; // Earnest Believer
  // 12) Polite/golf — modest mean, no extremes
  if (mean < 110 && max < 170) return ARCHETYPES[9]; // Golf-Clap Aristocrat
  // 13) Reluctant — low mean, low peak count
  if (mean < 90 && highCount === 0) return ARCHETYPES[7]; // Reluctant Witness
  // Fallback — earnest believer
  return ARCHETYPES[13];
}

function loudestAndQuietest(ints) {
  let maxIdx = 0, minIdx = 0;
  for (let i = 1; i < ints.length; i++) {
    if (ints[i] > ints[maxIdx]) maxIdx = i;
    if (ints[i] < ints[minIdx]) minIdx = i;
  }
  return { loudest: CATEGORIES[maxIdx], loudestVal: ints[maxIdx], quietest: CATEGORIES[minIdx], quietestVal: ints[minIdx] };
}

// ---------- finish & verdict ----------
async function finishAudit() {
  showScreen('verdict');
  $('loader-line').hidden = false;
  $('letter').hidden = true;
  $('share').hidden = true;

  // Update the URL fragment with the encoded intensity vector
  const frag = encodeFragment(intensities);
  try { history.replaceState(null, '', '#' + frag); } catch (_) {}

  await renderLetterFromIntensities(intensities, /*fromShare=*/false);
}

async function renderLetterFromIntensities(ints, fromShare) {
  const archetype = pickArchetype(ints);
  const lq = loudestAndQuietest(ints);

  // Show the loader for at least 900ms even if AI returns instantly.
  const minLoaderUntil = Date.now() + 900;
  let flourish;
  try {
    flourish = await Promise.race([
      generateFlourish(archetype.name, lq, ints),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
    ]);
  } catch (_) {
    flourish = archetype.fallback;
  }
  const wait = minLoaderUntil - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));

  // Populate the letter
  const today = new Date();
  const dateLong = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateShort = today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  $('letter-date').textContent = dateLong;
  $('stamp-date').textContent = dateShort;
  $('letter-re').textContent = `Your Standing Ovation Audit, File No. ${(hash(ints.join(',')) % 90000 + 10000)}`;

  $('letter-p1').textContent =
    `Following careful review of your applause across eight categories of distinguished mediocrity, ` +
    `the Committee notes that your most enthusiastic ovation occurred during “${lq.loudest}.”`;

  $('letter-p2').textContent =
    `Your applause was conspicuously absent during “${lq.quietest},” a silence the Academy has elected to interpret generously.`;

  $('letter-flourish').textContent = flourish;

  $('archetype-line').textContent = archetype.name;

  $('loader-line').hidden = true;
  $('letter').hidden = false;
  $('share').hidden = false;
}

// ---------- AI flourish ----------
async function generateFlourish(archetypeName, lq, ints) {
  const messages = [
    {
      role: 'system',
      content:
        'You are a deadpan official from "The Academy of Polite Disappointment," a faux-Victorian awards body. ' +
        'Write ONE single-sentence flourish for a stamped letter judging the recipient\'s applause pattern. ' +
        'Tone: bone-dry, mock-bureaucratic, gently devastating. ' +
        'Constraints: under 30 words; one sentence; no emojis; no hashtags; no quotation marks; ' +
        'must reference both the recipient\'s loudest and quietest categories by name; do not restate the archetype name verbatim.'
    },
    {
      role: 'user',
      content:
        `Archetype: ${archetypeName}\n` +
        `Loudest applause category: "${lq.loudest}" (intensity ${lq.loudestVal}/255)\n` +
        `Quietest applause category: "${lq.quietest}" (intensity ${lq.quietestVal}/255)\n` +
        `Full intensity vector: [${ints.join(', ')}]`
    }
  ];

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: SLUG, messages, max_tokens: 90 })
  });
  if (!res.ok) throw new Error('http_' + res.status);
  const data = await res.json();
  let text = (data.content || '').trim();
  // Strip stray surrounding quotes if the model added them
  text = text.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  if (!text) throw new Error('empty');
  return text;
}

// ---------- share ----------
function share() {
  // Make sure the URL fragment encodes the result
  if (intensities && intensities.length === 8) {
    const frag = encodeFragment(intensities);
    try { history.replaceState(null, '', '#' + frag); } catch (_) {}
  }
  if (navigator.share) {
    navigator.share({
      title: document.title,
      text: 'I was audited by The Academy of Polite Disappointment.',
      url: location.href
    }).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(location.href).then(() => alert('Link copied!'));
  } else {
    prompt('Copy this link:', location.href);
  }
}
window.share = share;

// ---------- wiring ----------
function wire() {
  $('begin-btn').addEventListener('click', startAudit);
  $('skip-btn').addEventListener('click', advanceCategory);
  $('restart-btn').addEventListener('click', () => {
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
    showScreen('intro');
  });

  const pad = $('clap-pad');
  // Touch
  pad.addEventListener('touchstart', pressDown, { passive: false });
  pad.addEventListener('touchend', pressUp, { passive: true });
  pad.addEventListener('touchcancel', pressUp, { passive: true });
  // Mouse
  pad.addEventListener('mousedown', pressDown);
  pad.addEventListener('mouseup', pressUp);
  pad.addEventListener('mouseleave', pressUp);
  // Keyboard fallback (spacebar)
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || $('audit').hidden) return;
    // ignore if focused on an input/textarea (e.g. feedback widget)
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
    if (e.repeat) return;
    e.preventDefault();
    pressDown();
  });
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
    pressUp();
  });

  // Prevent context menu on long press
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
}

function init() {
  wire();
  // If URL has a fragment, decode and render letter directly
  const frag = location.hash.slice(1);
  if (frag) {
    const decoded = decodeFragment(frag);
    if (decoded && decoded.length === 8) {
      restartingFromHash = true;
      intensities = decoded;
      showScreen('verdict');
      $('loader-line').hidden = false;
      $('letter').hidden = true;
      $('share').hidden = true;
      renderLetterFromIntensities(decoded, true);
      return;
    }
  }
  showScreen('intro');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
