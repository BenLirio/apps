// The Cabinet Briefing — alternate-timeline Presidential Daily Brief generator.
// Six dials → an LLM-written PDB. Per-bulletin regeneration when one dial changes.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'the-cabinet-briefing';

// ---------- Dial definitions ----------
// 5 levels per dial: 0=lowest, 4=highest. Each level has a label.
const DIALS = [
  {
    key: 'defense',
    label: 'DEFENSE POSTURE',
    levels: ['DOVE', 'CAUTIOUS', 'STANDARD', 'HAWKISH', 'DEFCON 2'],
  },
  {
    key: 'monetary',
    label: 'MONETARY TIGHTNESS',
    levels: ['ZIRP DREAM', 'EASY', 'NEUTRAL', 'TIGHT', 'CHOKEHOLD'],
  },
  {
    key: 'immigration',
    label: 'IMMIGRATION MOOD',
    levels: ['OPEN GATES', 'WELCOMING', 'AMBIVALENT', 'RESTRICTIVE', 'SEALED'],
  },
  {
    key: 'climate',
    label: 'CLIMATE COPE',
    levels: ['DENIAL', 'AVOIDANCE', 'MUDDLE-THROUGH', 'GREEN PUSH', 'WAR FOOTING'],
  },
  {
    key: 'vibes',
    label: 'VIBES ECONOMY',
    levels: ['CRYPTO BUST', 'WANING', 'STAGNANT', 'BUOYANT', 'EUPHORIC'],
  },
  {
    key: 'optimism',
    label: 'PUBLIC OPTIMISM',
    levels: ['DESPAIR', 'GLUM', 'RESIGNED', 'HOPEFUL', 'EVANGELICAL'],
  },
];

// ---------- State ----------
let state = {
  values: [2, 2, 2, 2, 2, 2], // default: middle on each dial
  bulletins: [null, null, null], // 3 bulletins
  briefDate: null,
  inFlight: false,
  lastSubmittedValues: null, // values when bulletins were last generated
};

// ---------- URL fragment encoding ----------
function encodeStateToHash(values, bulletins) {
  // values: 6 digits 0-4. bulletins: 3 objects with {tag, headline, body, source, dialIdx}
  const v = values.join('');
  if (!bulletins || bulletins.some(b => !b)) return '#v=' + v;
  // Pack bulletins as base64 JSON (compact key names)
  const compact = bulletins.map(b => ({
    t: b.tag, h: b.headline, b: b.body, s: b.source, d: b.dialIdx,
  }));
  const json = JSON.stringify({ v, b: compact, d: state.briefDate });
  let b64;
  try {
    b64 = btoa(unescape(encodeURIComponent(json)));
  } catch (_) { b64 = ''; }
  return '#s=' + b64;
}

function decodeHash(hash) {
  if (!hash || hash.length < 2) return null;
  const h = hash.replace(/^#/, '');
  const params = new URLSearchParams(h);
  if (params.get('s')) {
    try {
      const json = decodeURIComponent(escape(atob(params.get('s'))));
      const obj = JSON.parse(json);
      if (!obj.v || !/^[0-4]{6}$/.test(obj.v)) return null;
      const values = obj.v.split('').map(n => parseInt(n, 10));
      const bulletins = (obj.b || []).map(b => ({
        tag: b.t, headline: b.h, body: b.b, source: b.s, dialIdx: b.d,
      }));
      return { values, bulletins, briefDate: obj.d };
    } catch (_) { return null; }
  }
  if (params.get('v') && /^[0-4]{6}$/.test(params.get('v'))) {
    const values = params.get('v').split('').map(n => parseInt(n, 10));
    return { values, bulletins: [], briefDate: null };
  }
  return null;
}

function updateHash() {
  const newHash = encodeStateToHash(state.values, state.bulletins);
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

// ---------- Dial UI ----------
function renderDials() {
  const root = document.getElementById('dials');
  root.innerHTML = '';
  DIALS.forEach((d, i) => {
    const dial = document.createElement('div');
    dial.className = 'dial';
    dial.dataset.idx = i;
    dial.innerHTML = `
      <div class="dial-label">${d.label}</div>
      <div class="tickmarks"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="knob" role="slider" tabindex="0" aria-label="${d.label}" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${state.values[i]}"></div>
      <div class="dial-value" data-value-for="${i}">${d.levels[state.values[i]]}</div>
    `;
    root.appendChild(dial);
    const knob = dial.querySelector('.knob');
    setKnobRotation(knob, state.values[i]);
    attachKnobInteractions(knob, i);
  });
}

function setKnobRotation(knob, level) {
  // level 0..4 maps to -120deg..+120deg
  const deg = -120 + (level * 60);
  knob.style.setProperty('--rot', deg + 'deg');
}

function setDialValue(idx, level) {
  level = Math.max(0, Math.min(4, level));
  const prev = state.values[idx];
  if (prev === level) return false;
  state.values[idx] = level;
  const dial = document.querySelector(`.dial[data-idx="${idx}"]`);
  if (dial) {
    const knob = dial.querySelector('.knob');
    setKnobRotation(knob, level);
    knob.setAttribute('aria-valuenow', String(level));
    dial.querySelector(`[data-value-for="${idx}"]`).textContent = DIALS[idx].levels[level];
  }
  return true;
}

function attachKnobInteractions(knob, idx) {
  let dragging = false;
  let startY = 0;
  let startLevel = 0;

  function onDown(clientY) {
    dragging = true;
    startY = clientY;
    startLevel = state.values[idx];
  }
  function onMove(clientY) {
    if (!dragging) return;
    const dy = startY - clientY; // up = increase
    const newLevel = Math.round(startLevel + dy / 22);
    const clamped = Math.max(0, Math.min(4, newLevel));
    if (clamped !== state.values[idx]) {
      const changed = setDialValue(idx, clamped);
      if (changed) handleDialChanged(idx);
    }
  }
  function onUp() { dragging = false; }

  // Mouse
  knob.addEventListener('mousedown', (e) => { e.preventDefault(); onDown(e.clientY); });
  window.addEventListener('mousemove', (e) => onMove(e.clientY));
  window.addEventListener('mouseup', onUp);

  // Touch
  knob.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e.touches[0].clientY); }, { passive: false });
  knob.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e.touches[0].clientY); }, { passive: false });
  knob.addEventListener('touchend', onUp);

  // Tap to advance one step (mobile-friendly)
  knob.addEventListener('click', (e) => {
    // Only treat as tap if we did not drag substantially. Cheap heuristic: rely on a toggle effect.
    // Skip; handled by drag.
  });

  // Keyboard
  knob.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (setDialValue(idx, state.values[idx] + 1)) handleDialChanged(idx);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (setDialValue(idx, state.values[idx] - 1)) handleDialChanged(idx);
    }
  });
}

const _dialDebounce = {};
function handleDialChanged(idx) {
  updateHash();
  if (!state.lastSubmittedValues) return; // brief hasn't been generated yet
  // Debounce so rapid dragging doesn't fire many AI calls.
  if (_dialDebounce[idx]) clearTimeout(_dialDebounce[idx]);
  _dialDebounce[idx] = setTimeout(() => {
    _dialDebounce[idx] = null;
    // Find bulletin tied to this dial
    const bulletinIdx = state.bulletins.findIndex(b => b && b.dialIdx === idx);
    if (bulletinIdx >= 0) {
      regenerateBulletin(bulletinIdx);
    } else {
      const replaceSlot = pickSlotToReplace();
      state.bulletins[replaceSlot] = null;
      regenerateBulletin(replaceSlot, idx);
    }
  }, 420);
}

let _replaceCursor = 0;
function pickSlotToReplace() {
  // Rotate which slot we replace so dial-changes that don't match a current bulletin still get visible feedback.
  const slot = _replaceCursor % 3;
  _replaceCursor++;
  return slot;
}

// ---------- Posture code (compact identifier shown on the brief) ----------
function posureCodeFromValues(values) {
  return values.map((v, i) => {
    const tag = DIALS[i].key.slice(0, 3).toUpperCase();
    return tag + v;
  }).join('-');
}

// ---------- AI: build prompt ----------
function buildContext(values) {
  return DIALS.map((d, i) => `${d.label}: ${d.levels[values[i]]} (level ${values[i]} of 4)`).join('\n');
}

function pickThreeDials(values) {
  // Choose 3 dials that are "loudest" — farthest from neutral (level 2).
  // If tied, prefer different categories. Returns 3 dial indices.
  const scored = values.map((v, i) => ({ i, score: Math.abs(v - 2) }));
  scored.sort((a, b) => b.score - a.score || (Math.random() - 0.5));
  const pick = scored.slice(0, 3).map(s => s.i);
  // If all are dead-neutral (all score 0), default to first three.
  if (pick.every(i => Math.abs(values[i] - 2) === 0)) return [0, 2, 4];
  return pick;
}

const SYSTEM_PROMPT = `You are the Office of the Director of National Fabrication, drafting the President's Daily Brief in an alternate timeline.

Tone: Tight, declassified-cable register. Clipped sentences. Specific. Faintly absurd but never cartoonish. Names of programs, agencies, percentages, and figures must feel oddly plausible.

Hard rules:
- Output strict JSON only. No prose outside the JSON.
- Each bulletin must visibly reference the specific dial setting given in the user message. Name programs, agencies, or figures whose existence is plausible only at THAT setting.
- A bulletin generated when "Climate Cope = WAR FOOTING" must read fundamentally differently from one with "Climate Cope = DENIAL". Same for every dial.
- Reference specific percentages, dollar amounts, locations, agency names, or program codenames. Avoid vague statements.
- Headlines: 6-14 words. Bulletin body: 2-3 short sentences. Sources: a fake but plausible single-line source attribution.
- Do not break the fourth wall. Do not refer to "alternate timeline", "fictional", or the user. Treat the brief as real intelligence.
- No real US Presidents by name. No current real-world political slogans. No emojis. No hashtags.`;

function buildUserPromptForBulletin(values, dialIdx) {
  const d = DIALS[dialIdx];
  const setting = d.levels[values[dialIdx]];
  const context = buildContext(values);
  return `FULL POSTURE:
${context}

DRAFT ONE PRESIDENTIAL DAILY BRIEF BULLETIN whose lead implication flows DIRECTLY from this dial setting:

DRIVING DIAL: ${d.label} = ${setting}

The bulletin must name a specific program/agency/figure/percentage that only makes sense at this exact setting. Output strict JSON:

{
  "tag": "<all-caps category tag, e.g. PETROLEUM REGIME, BORDER OPS, FED MATTERS, WEATHER COMMAND, MORALE INDEX, CURRENCY DESK>",
  "headline": "<6-14 word headline in the cable register>",
  "body": "<2-3 short sentences. Specific. Must reference the dial setting concretely.>",
  "source": "<one-line fake source line, e.g. 'STATE/INR PRELIM // 14:22 EST' or 'TREASURY DESK CABLE 4477'>"
}`;
}

async function callAIForBulletin(values, dialIdx, attempt = 0) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPromptForBulletin(values, dialIdx) },
  ];
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages,
        max_tokens: 280,
        response_format: 'json_object',
        model: 'gpt-5.4',
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let parsed = null;
    try { parsed = JSON.parse(data.content); } catch (_) { parsed = null; }
    if (!parsed || !parsed.headline || !parsed.body) throw new Error('bad_json');
    return {
      tag: (parsed.tag || 'CLASSIFIED').toString().toUpperCase().slice(0, 60),
      headline: parsed.headline.toString().slice(0, 240),
      body: parsed.body.toString().slice(0, 800),
      source: (parsed.source || '[REDACTED] // CABLE').toString().slice(0, 120),
      dialIdx,
    };
  } catch (e) {
    if (attempt === 0) return callAIForBulletin(values, dialIdx, 1);
    return fallbackBulletin(values, dialIdx);
  }
}

// ---------- Deterministic fallback ----------
const FALLBACK_TAGS = {
  defense: 'DEFENSE POSTURE',
  monetary: 'TREASURY DESK',
  immigration: 'BORDER OPS',
  climate: 'WEATHER COMMAND',
  vibes: 'MORALE INDEX',
  optimism: 'PUBLIC TEMPER',
};
const FALLBACK_TEMPLATES = {
  defense: [
    ['CARRIER GROUP STAND-DOWN ORDER FILED IN TRIPLICATE', 'Pacific Fleet drills postponed indefinitely. Pentagon press shop scheduled to issue an apology haiku at 0900.'],
    ['THIRD FLEET ON ROUTINE PATROL, NOTHING SEEN', 'No incursions logged. Coffee consumption at Norfolk down 4% week-over-week.'],
    ['NEUTRAL POSTURE HOLDS ACROSS COMMANDS', 'INDOPACOM remains at standard alert. No actionable threats this cycle.'],
    ['JCS RECOMMENDS POSTURE UPGRADE PER STANDING ORDERS', 'CENTCOM requests two additional ISR sorties over the Gulf. Acoustic anomalies flagged near 24N 56E.'],
    ['DEFCON ELEVATED; CONTINUITY-OF-GOVERNMENT ROTATION ACTIVE', 'Mount Weather staff doubled. Strategic Bourbon Reserve unsealed for officer messes pending the next cycle.'],
  ],
  monetary: [
    ['FED FUNDS NEAR ZERO; ASSET PRICES FLOAT FREE', 'Cheap-money window remains open. Regional banks report record-setting paddleboard portfolio leverage.'],
    ['DOVISH HOLD; DOTS DRIFT LOWER', 'Markets read accommodation through Q3. The yield curve has assumed a decorative position.'],
    ['POLICY RATE HELD STEADY; STATEMENT UNCHANGED', 'No surprises in the SEP. Powell-era successor shop remains comfortably indecisive.'],
    ['TIGHTENING CYCLE EXTENDED; CONSUMER CREDIT THINS', 'Rate hike of 25 bps expected. Big-box retailers brace for a Halloween-candy-only Q4.'],
    ['LIQUIDITY CHOKE; DISCOUNT WINDOW DRY', 'Fed signals it will not be the buyer of last resort this week. Three regional banks forming a mutual aid co-op.'],
  ],
  immigration: [
    ['NORTHERN BORDER FORMALITIES SUSPENDED INDEFINITELY', 'Customs lanes reopened both directions. Vermont ICE staff reassigned to apple-cider quality control.'],
    ['WELCOMING CORRIDORS PROGRAM EXPANDED', 'Refugee reception centers opened in three Midwestern counties. Local PTAs report a 22% bump in volunteer hours.'],
    ['ENFORCEMENT CADENCE UNCHANGED', 'Apprehension numbers within the five-year mean. No notable policy shifts logged.'],
    ['SOUTHERN OPS POSTURE TIGHTENED', 'Sector Eight wall extension funded through emergency continuing resolution. Drone fleet up 18% over baseline.'],
    ['BORDERS SEALED; INTERIOR CHECKPOINTS ROUTINE', 'All ports of entry require Class-2 transit credential. Domestic bus routes now subject to manifest verification.'],
  ],
  climate: [
    ['NOAA RECLASSIFIED AS DEPARTMENT OF SUNNY OUTLOOKS', 'Climate models removed from federal websites pending review. Hurricane names now drawn from a pool of cheerful adjectives.'],
    ['ADAPTATION FUNDING DEFERRED TO STATES', 'Federal flood maps will be updated only every nine years. Coastal mayors taking matters into their own hands.'],
    ['INCREMENTAL EMISSIONS RULE PUBLISHED', 'EPA tightens standards 3% on heavy industry. Compliance window extended to 2034.'],
    ['STRATEGIC PELICAN RESERVE RELEASES 14% TO OFFSET DINER-COFFEE INFLATION', 'Coastal mitigation funds redirected to migratory species banking. Audubon Society on retainer with Treasury.'],
    ['CLIMATE ON WAR FOOTING; CARBON CONSCRIPTION ACT INVOKED', 'Heat pump installation classified as essential service. A new Civilian Wetlands Corps deployed to Louisiana basin.'],
  ],
  vibes: [
    ['CONSUMER CONFIDENCE COLLAPSES; MEME COIN DESK GUTTED', 'Treasury reports a 41% drop in retail crypto activity. Dogecoin shrine in Foggy Bottom under quiet renovation.'],
    ['CULTURAL OUTPUT INDEX TICKING DOWN', 'Streaming originals down 17% YoY. NEA flags "ambient malaise" as a budget-line concern.'],
    ['VIBES STABLE; PODCAST EXPORTS HOLDING', 'No notable cultural inflection. Brooklyn remains net importer of irony.'],
    ['BUOYANT MARKETS; STADIUM DEALS STACK UP', 'Three new naming-rights packages priced this week. Bartender hiring up 9%.'],
    ['EUPHORIC INDEX HITS RECORD; SECOND BREAKFAST RETURNS', 'Fitness app installs reach all-time peak. Treasury memo recommends caution; nobody is reading it.'],
  ],
  optimism: [
    ['PUBLIC MOOD INDEX ENTERS DESPAIR BAND', 'Eighty-three percent of polled adults report "the bad timeline feeling." Therapists added to essential workforce list.'],
    ['NATIONAL MOOD GLUM; MUSEUM ATTENDANCE UP 12%', 'Citizens seeking refuge in nineteenth-century landscape paintings. CDC notes a nontrivial uptick in slow-cooker purchases.'],
    ['MOOD RESIGNED; STATUS QUO CONTINUES', 'The American public has, per the latest sweep, accepted the situation. Brunch attendance unchanged.'],
    ['HOPEFULNESS INDEX RISING; WEEKEND LINE-DANCING UP 18%', 'Public participation in civic events up across all four census regions. Department of Agriculture notes a corn-bread surge.'],
    ['EVANGELICAL OPTIMISM; STREET CELEBRATIONS RECURRING', 'Citizens reportedly stopping strangers to compliment outfits. Treasury weighs whether to print a commemorative bill.'],
  ],
};

function fallbackBulletin(values, dialIdx) {
  const d = DIALS[dialIdx];
  const lvl = values[dialIdx];
  const tpl = FALLBACK_TEMPLATES[d.key][lvl];
  return {
    tag: FALLBACK_TAGS[d.key],
    headline: tpl[0],
    body: tpl[1],
    source: '[REDACTED] // CABLE ' + (1000 + dialIdx * 311 + lvl * 47),
    dialIdx,
    fallback: true,
  };
}

// ---------- Render brief ----------
function renderBriefShell() {
  document.getElementById('briefDoc').style.display = 'block';
  document.getElementById('postureCode').textContent = posureCodeFromValues(state.values);
  if (!state.briefDate) state.briefDate = formatBriefDate(new Date());
  document.getElementById('briefDate').textContent = state.briefDate;
  const root = document.getElementById('bulletins');
  root.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const b = state.bulletins[i];
    root.appendChild(renderBulletinNode(i, b));
  }
}

function renderBulletinNode(idx, b) {
  const el = document.createElement('article');
  el.className = 'bulletin' + (b ? '' : ' loading');
  el.dataset.idx = idx;
  if (!b) {
    el.innerHTML = `<div class="brief-loading">DRAFTING BULLETIN ${idx + 1} OF 3...</div>`;
    return el;
  }
  const dialName = DIALS[b.dialIdx] ? DIALS[b.dialIdx].label : 'INTAKE';
  const setting = DIALS[b.dialIdx] ? DIALS[b.dialIdx].levels[state.values[b.dialIdx]] : '';
  el.innerHTML = `
    <button class="regen-btn" data-regen="${idx}" title="Regenerate this bulletin">REGEN</button>
    <p class="bulletin-tag">${escapeHtml(b.tag)} &mdash; <span style="opacity:.7">${escapeHtml(dialName)}: ${escapeHtml(setting)}</span></p>
    <h3 class="bulletin-headline">${escapeHtml(b.headline)}</h3>
    <p class="bulletin-body">${escapeHtml(b.body)}</p>
    <p class="bulletin-source">SOURCE: ${escapeHtml(b.source)} &nbsp;//&nbsp; <span class="redact-text">[REDACTED]</span> &nbsp;//&nbsp; <span class="redact-text">[REDACTED]</span></p>
  `;
  return el;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function formatBriefDate(d) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- Brief flow ----------
async function generateFullBrief() {
  if (state.inFlight) return;
  state.inFlight = true;
  const btn = document.getElementById('briefBtn');
  btn.disabled = true;
  btn.textContent = 'TRANSMITTING TO SITUATION ROOM...';

  // Pick three dials whose settings drive bulletins (loudest dials).
  const idxs = pickThreeDials(state.values);
  state.bulletins = [null, null, null];
  state.briefDate = formatBriefDate(new Date());
  renderBriefShell();
  // Scroll to brief
  document.getElementById('briefDoc').scrollIntoView({ behavior: 'smooth', block: 'start' });

  const valuesAtSubmit = state.values.slice();

  // Generate the three bulletins in parallel — but cap at three to stay within global per-IP limits per click (3 calls max).
  const promises = idxs.map(async (dialIdx, i) => {
    const result = await callAIForBulletin(valuesAtSubmit, dialIdx);
    state.bulletins[i] = result;
    // Re-render only this bulletin
    const root = document.getElementById('bulletins');
    const old = root.querySelector(`.bulletin[data-idx="${i}"]`);
    const fresh = renderBulletinNode(i, result);
    if (old) root.replaceChild(fresh, old); else root.appendChild(fresh);
    attachRegenHandlers();
    updateHash();
  });
  await Promise.all(promises);

  state.lastSubmittedValues = valuesAtSubmit;
  state.inFlight = false;
  btn.disabled = false;
  btn.textContent = 'BRIEF AGAIN (NEW POSTURE)';
}

async function regenerateBulletin(slotIdx, overrideDialIdx) {
  const root = document.getElementById('bulletins');
  const old = root.querySelector(`.bulletin[data-idx="${slotIdx}"]`);
  const dialIdx = (typeof overrideDialIdx === 'number') ? overrideDialIdx : (state.bulletins[slotIdx] ? state.bulletins[slotIdx].dialIdx : 0);

  // Replace with loading
  const loadingEl = renderBulletinNode(slotIdx, null);
  if (old) root.replaceChild(loadingEl, old);

  const valuesNow = state.values.slice();
  const result = await callAIForBulletin(valuesNow, dialIdx);
  state.bulletins[slotIdx] = result;

  const fresh = renderBulletinNode(slotIdx, result);
  fresh.classList.add('flash');
  const cur = root.querySelector(`.bulletin[data-idx="${slotIdx}"]`);
  if (cur) root.replaceChild(fresh, cur);
  attachRegenHandlers();

  // Update posture code
  document.getElementById('postureCode').textContent = posureCodeFromValues(state.values);
  updateHash();
}

function attachRegenHandlers() {
  document.querySelectorAll('[data-regen]').forEach(btn => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.regen, 10);
      btn.disabled = true;
      btn.textContent = '...';
      try { await regenerateBulletin(idx); } finally {
        // The button is recreated in the new node, so no need to restore here.
      }
    });
  });
}

// ---------- Share ----------
function share() {
  // Make sure URL reflects current state.
  updateHash();
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, text: 'EYES ONLY — Presidential Daily Brief from my alternate timeline.', url })
      .catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => alert('LINK COPIED. HAND-CARRY TO RECIPIENT.'))
      .catch(() => prompt('Copy this link:', url));
  } else {
    prompt('Copy this link:', url);
  }
}
window.share = share;

// ---------- Init ----------
function init() {
  renderDials();

  // Restore from hash if present
  const decoded = decodeHash(location.hash);
  if (decoded) {
    decoded.values.forEach((v, i) => setDialValue(i, v));
    if (decoded.bulletins && decoded.bulletins.length === 3 && decoded.bulletins.every(b => b && b.headline)) {
      state.bulletins = decoded.bulletins;
      state.briefDate = decoded.briefDate || formatBriefDate(new Date());
      state.lastSubmittedValues = decoded.values.slice();
      renderBriefShell();
      attachRegenHandlers();
      // Update CTA button label
      const btn = document.getElementById('briefBtn');
      btn.textContent = 'BRIEF AGAIN (NEW POSTURE)';
    }
  }

  document.getElementById('briefBtn').addEventListener('click', generateFullBrief);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
