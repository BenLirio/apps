// The FOBO Simulator — pre-tech labor bureau processes the automation of your job.
// Real 2025-2026 AI model releases periodically reopen the case file.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';

// ---- Real 2025-2026 AI events. Used as the ticking shock-events of the game. ----
// Curated for being widely-reported, real, and easy to verify. Order is rough chronology.
const REAL_AI_EVENTS = [
  {
    date: 'JAN 2025',
    headline: 'OPENAI INTRODUCES "OPERATOR" AGENT',
    body: 'OpenAI unveils Operator, an autonomous browser-using agent capable of completing tasks online without supervision.',
    impact_phrase: 'White-collar tasks suddenly delegable',
    actor: 'OpenAI Operator',
    severity: 0.55
  },
  {
    date: 'JAN 2025',
    headline: 'DEEPSEEK R1 RELEASED OPEN-WEIGHT',
    body: 'DeepSeek publishes R1, an open-weight reasoning model competitive with frontier closed models, sending markets into a brief panic.',
    impact_phrase: 'Frontier reasoning, now self-hostable',
    actor: 'DeepSeek R1',
    severity: 0.5
  },
  {
    date: 'FEB 2025',
    headline: 'ANTHROPIC SHIPS CLAUDE 3.7 SONNET',
    body: 'Anthropic releases Claude 3.7 Sonnet with extended thinking, raising the bar on long-horizon coding and analysis.',
    impact_phrase: 'Software & analysis work compresses',
    actor: 'Claude 3.7 Sonnet',
    severity: 0.55
  },
  {
    date: 'FEB 2025',
    headline: 'XAI UNVEILS GROK 3',
    body: 'xAI debuts Grok 3, claimed as its most capable model to date, with a dedicated "DeepSearch" research mode.',
    impact_phrase: 'Always-on research labor automated',
    actor: 'Grok 3',
    severity: 0.5
  },
  {
    date: 'MAR 2025',
    headline: 'OPENAI "GPT-4o IMAGE" UPENDS DESIGN',
    body: 'OpenAI bakes native image generation into GPT-4o; the "Studio Ghibli style" trend overruns social feeds for weeks.',
    impact_phrase: 'Illustration & design pipelines disrupted',
    actor: 'GPT-4o Image',
    severity: 0.6
  },
  {
    date: 'APR 2025',
    headline: 'META RELEASES LLAMA 4',
    body: 'Meta releases the Llama 4 family (Scout, Maverick) with a long-promised mixture-of-experts architecture.',
    impact_phrase: 'Open-weights catch closed leaders',
    actor: 'Llama 4',
    severity: 0.45
  },
  {
    date: 'MAY 2025',
    headline: 'ANTHROPIC SHIPS CLAUDE 4 (OPUS & SONNET)',
    body: 'Anthropic introduces Claude Opus 4 and Sonnet 4, claiming sustained agentic coding for hours at a time.',
    impact_phrase: 'Multi-hour agent workflows now feasible',
    actor: 'Claude Opus 4',
    severity: 0.65
  },
  {
    date: 'MAY 2025',
    headline: 'GOOGLE I/O: GEMINI 2.5 PRO + DEEP THINK',
    body: 'Google launches Gemini 2.5 Pro with a "Deep Think" mode and integrates it across Search, Workspace, and Android.',
    impact_phrase: 'AI shipped to a billion seats overnight',
    actor: 'Gemini 2.5 Pro',
    severity: 0.65
  },
  {
    date: 'JUL 2025',
    headline: 'XAI ANNOUNCES GROK 4',
    body: 'xAI releases Grok 4 with claimed top-tier benchmark performance, alongside a higher-tier "Heavy" multi-agent variant.',
    impact_phrase: 'Multi-agent reasoning goes mainstream',
    actor: 'Grok 4',
    severity: 0.55
  },
  {
    date: 'AUG 2025',
    headline: 'GPT-5 RELEASED',
    body: 'OpenAI rolls out GPT-5 to ChatGPT users and developers with a unified router across reasoning depths and modalities.',
    impact_phrase: 'The default chatbot is now smarter than you',
    actor: 'GPT-5',
    severity: 0.85
  },
  {
    date: 'AUG 2025',
    headline: 'ANTHROPIC OPUS 4.1 RAISES THE BAR',
    body: 'Anthropic ships Claude Opus 4.1, posting state-of-the-art agentic coding benchmarks within weeks of GPT-5.',
    impact_phrase: 'Coding labor compressed again',
    actor: 'Claude Opus 4.1',
    severity: 0.6
  },
  {
    date: 'SEP 2025',
    headline: 'CLAUDE SONNET 4.5 ANNOUNCED',
    body: 'Anthropic releases Claude Sonnet 4.5, billing it as the most capable model in the world for coding and computer use.',
    impact_phrase: 'Computer-use agents go production',
    actor: 'Claude Sonnet 4.5',
    severity: 0.7
  },
  {
    date: 'OCT 2025',
    headline: 'OPENAI LAUNCHES "CHATGPT ATLAS" BROWSER',
    body: 'OpenAI ships Atlas, an AI-native web browser meant to replace conventional browsing with agentic navigation.',
    impact_phrase: 'The browser itself becomes an agent',
    actor: 'ChatGPT Atlas',
    severity: 0.6
  },
  {
    date: 'NOV 2025',
    headline: 'GEMINI 3 LANDS WITH "DEEP THINK"',
    body: 'Google launches Gemini 3 across Search, Workspace, and a new "Antigravity" agent IDE, claiming top reasoning marks.',
    impact_phrase: 'Search, docs, and code under one agent',
    actor: 'Gemini 3',
    severity: 0.75
  },
  {
    date: 'NOV 2025',
    headline: 'CLAUDE OPUS 4.5 SHIPS',
    body: 'Anthropic releases Claude Opus 4.5, advertising long-horizon agent runs that complete multi-day projects unattended.',
    impact_phrase: 'A week of work done overnight',
    actor: 'Claude Opus 4.5',
    severity: 0.8
  },
  {
    date: 'DEC 2025',
    headline: 'GROK 4.1 FAST RELEASED',
    body: 'xAI rolls out Grok 4.1 Fast, prioritizing tool-use latency for live agentic workflows.',
    impact_phrase: 'Real-time AI assistants get faster',
    actor: 'Grok 4.1 Fast',
    severity: 0.45
  },
  {
    date: 'JAN 2026',
    headline: 'DEEPSEEK V3.2 GOES VIRAL',
    body: 'DeepSeek publishes V3.2 with an aggressive price-to-performance ratio, pulling enterprise pilots away from frontier APIs.',
    impact_phrase: 'AI labor cost falls another order of magnitude',
    actor: 'DeepSeek V3.2',
    severity: 0.5
  },
  {
    date: 'FEB 2026',
    headline: 'OPENAI PREVIEWS GPT-5.1 CODEX-MAX',
    body: 'OpenAI previews GPT-5.1 Codex-Max, a coding-tuned successor optimized for sustained autonomous engineering tasks.',
    impact_phrase: 'Engineering teams rethink staffing',
    actor: 'GPT-5.1 Codex-Max',
    severity: 0.7
  },
  {
    date: 'MAR 2026',
    headline: 'ANTHROPIC RELEASES CLAUDE OPUS 4.6',
    body: 'Anthropic ships Claude Opus 4.6, advertising a 1M-token context window and longer agentic horizons.',
    impact_phrase: 'No more "too much context" excuses',
    actor: 'Claude Opus 4.6',
    severity: 0.7
  },
  {
    date: 'APR 2026',
    headline: 'CLAUDE OPUS 4.7 (1M CONTEXT) ANNOUNCED',
    body: 'Anthropic announces Claude Opus 4.7 with a 1M-token context window in general availability — the model writing this very page.',
    impact_phrase: 'The simulation acknowledges itself',
    actor: 'Claude Opus 4.7',
    severity: 0.85
  },
];

// Generic, non-job-specific fallback action buttons (used if AI call fails)
const GENERIC_ACTIONS = [
  { label: 'Enroll in "AI Prompting 101"', flavor: 'tuition: nonrefundable' },
  { label: 'File an HR grievance', flavor: 'forwarded to /dev/null' },
  { label: 'Add "AI-adjacent" to bio', flavor: 'six new recruiters DM you' },
  { label: 'Pivot to consulting', flavor: 'business cards being printed' },
  { label: 'Volunteer for the AI ethics committee', flavor: 'meets quarterly, no quorum' },
  { label: 'Launch a Substack about your craft', flavor: 'three subscribers, all bots' },
  { label: 'Petition the Department of Labor', flavor: 'form QD-44, in triplicate' },
  { label: 'Train the model that will replace you', flavor: '$22/hr, contract role' },
  { label: 'Acquire a second certification', flavor: 'PDF will be emailed shortly' },
  { label: 'Forward a thinkpiece to the team', flavor: '"AI Will Never Replace ___."' },
  { label: 'Schedule a strategic offsite', flavor: 'catering: tepid sandwiches' },
  { label: 'Quietly learn another industry', flavor: 'in case this one folds' },
];

// Generic fallback ticker lines while clerks "review the case"
const FILE_REPORT_LINES = [
  'A clerk is photocopying your last performance review.',
  'Your supervisor has been promoted to "Head of AI Strategy."',
  'The breakroom microwave is now an LLM endpoint.',
  'Operations notes: efficiency up, headcount down.',
  'Memo received: "We are not currently hiring humans."',
  'A junior associate is being onboarded. They are an API.',
  'Your stapler has been retrained on customer feedback.',
];

// ---- Game state ----
const state = {
  jobTitle: '',
  caseNo: '',
  humanPct: 100,    // human labor remaining
  robotPct: 0,      // machine encroachment
  running: false,
  baselineTimer: null,
  eventTimer: null,
  wireTimer: null,
  actions: GENERIC_ACTIONS.slice(),
  actionsCooldown: [], // sized to actions.length on render
  eventsQueue: [],
  triggeringEvent: null,  // the AI release that finally seals the file
  finalAiName: null,
  finalCause: null,
  finalEvent: null,
};

// Cooldown per individual button after it's filed. Long enough to push players
// to scan the whole board, short enough that the rack feels alive.
const ACTION_COOLDOWN_MS = 3200;

// ---- Wiring ----
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('job-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startGame();
  });
  document.getElementById('play-again-btn').addEventListener('click', resetToIntro);
  const wireDismiss = document.getElementById('wire-dismiss');
  if (wireDismiss) wireDismiss.addEventListener('click', hideWire);
});

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function resetToIntro() {
  stopGame();
  showScreen('intro');
  document.getElementById('job-input').value = '';
  document.getElementById('job-input').placeholder = 'Senior Synergy Manager';
}

// ---- Start ----
async function startGame() {
  const input = document.getElementById('job-input');
  const job = input.value.trim();
  if (!job) {
    input.placeholder = "your job title, please.";
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 400);
    return;
  }

  state.jobTitle = job;
  state.humanPct = 100;
  state.robotPct = 0;
  state.actions = GENERIC_ACTIONS.slice();
  state.actionsCooldown = state.actions.map(() => false);
  state.triggeringEvent = null;
  state.finalAiName = null;
  state.finalCause = null;
  state.finalEvent = null;
  state.caseNo = generateCaseNo();
  state.eventsQueue = pickEventsForGame();

  document.getElementById('case-no').textContent = 'CASE #' + state.caseNo;
  document.getElementById('case-subject-name').textContent = state.jobTitle;
  setTicker(`Case opened. A clerk is reviewing your file.`);
  updateGauges(true);
  renderActions(state.actions); // optimistic generic buttons
  showScreen('game');

  state.running = true;
  startBaselineTick();
  scheduleNextEvent();

  // Try to fetch AI-tailored countermeasures + replace generic buttons
  fetchTailoredActions(state.jobTitle).then(actions => {
    if (actions && state.running) {
      state.actions = actions;
      renderActions(state.actions);
      setTicker(`File update: countermeasures specific to ${state.jobTitle.toUpperCase()} have been authorized.`);
    }
  }).catch(() => {/* keep generics */});
}

function generateCaseNo() {
  const yr = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 8999);
  return `${yr}-FOBO-${n}`;
}

// Pick a sensible run of events: 3-4 small ones building to one decisive blow.
function pickEventsForGame() {
  // Light shuffle but keep chronological flavor: choose from earlier events for early-game,
  // later/heavier events for the finale.
  const earlier = REAL_AI_EVENTS.filter(e => e.severity < 0.7);
  const later = REAL_AI_EVENTS.filter(e => e.severity >= 0.7);
  const minor = shuffle(earlier).slice(0, 3);
  const major = shuffle(later).slice(0, 1);
  return [...minor, ...major];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Gauges & ticker ----
function updateGauges(noFlash) {
  const h = document.getElementById('humanity-bar');
  const r = document.getElementById('robot-bar');
  h.style.width = state.humanPct + '%';
  r.style.width = state.robotPct + '%';
  if (!noFlash) {
    const meters = document.querySelectorAll('.meter');
    meters.forEach(m => { m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash'); });
  }
}

function setTicker(text) {
  document.getElementById('ticker').textContent = text;
}

// ---- Actions (countermeasure buttons) ----
function renderActions(actions) {
  const list = document.getElementById('actions-list');
  list.innerHTML = '';
  state.actionsCooldown = actions.map(() => false);
  actions.forEach((a, i) => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.dataset.idx = String(i);
    const flavor = a.flavor ? `<span class="action-flavor">${escapeHtml(a.flavor)}</span>` : '';
    btn.innerHTML = `<span class="action-label">${escapeHtml(a.label)}</span>${flavor}`;
    btn.addEventListener('click', () => fileCountermeasure(i));
    list.appendChild(btn);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function fileCountermeasure(idx) {
  if (!state.running) return;
  if (state.actionsCooldown[idx]) return;

  const action = state.actions[idx];
  // Smaller per-filing push than before — there are now ~12 buttons, so the
  // game wants the player tapping a steady rhythm rather than landing one big move.
  const push = 3 + Math.random() * 3; // 3-6
  state.robotPct = Math.max(0, state.robotPct - push);
  state.humanPct = Math.min(100, 100 - state.robotPct);
  updateGauges();

  setTicker(`FILED: "${action.label}" — ${action.flavor || 'noted by the clerk.'}`);

  // Mark cooldown on this button only
  state.actionsCooldown[idx] = true;
  const list = document.getElementById('actions-list');
  const btn = list.children[idx];
  if (btn) {
    btn.disabled = true;
    btn.classList.add('filed');
  }
  setTimeout(() => {
    state.actionsCooldown[idx] = false;
    if (state.running && btn) {
      btn.disabled = false;
      btn.classList.remove('filed');
    }
  }, ACTION_COOLDOWN_MS);

  // Once any countermeasure is filed and you're below ~25% encroachment, occasional encouragement.
  if (state.robotPct < 25 && Math.random() < 0.5) {
    setTimeout(() => {
      if (state.running) setTicker(idleHopeLine());
    }, 1100);
  }
}

function idleHopeLine() {
  const lines = [
    "Memo: 'They still need humans for this kind of work.'",
    'Wire from accounting: efficiency stable. Headcount: stable.',
    'A colleague brings you a coffee. The economy holds.',
    'Bureau notes: subject is "highly defensible against automation."',
    'Your manager forwards a thinkpiece titled "AI Will Never Replace ___."',
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ---- Baseline encroachment tick (always advancing, slowly) ----
function startBaselineTick() {
  clearInterval(state.baselineTimer);
  state.baselineTimer = setInterval(() => {
    if (!state.running) return;
    // Slightly faster grind than before — the per-tap push is also smaller, so the
    // dispatch board has to be worked, not glanced at.
    const advance = 0.65 + (state.robotPct / 100) * 0.85;
    state.robotPct = Math.min(100, state.robotPct + advance);
    state.humanPct = Math.max(0, 100 - state.robotPct);
    updateGauges(true);

    if (state.robotPct >= 100) {
      // Baseline alone shouldn't seal the file — last AI event always does.
      // But just in case: trigger end with the most recent dispatched event or a default.
      sealFile(state.triggeringEvent || REAL_AI_EVENTS[REAL_AI_EVENTS.length - 1]);
    }

    // Occasional flavor update
    if (Math.random() < 0.07) {
      setTicker(FILE_REPORT_LINES[Math.floor(Math.random() * FILE_REPORT_LINES.length)]);
    }
  }, 700);
}

function scheduleNextEvent() {
  clearTimeout(state.eventTimer);
  if (!state.running || state.eventsQueue.length === 0) return;
  // First minor event: ~9s in. Subsequent: 11-15s. Final major event closes the case.
  const isFinal = state.eventsQueue.length === 1;
  const delay = isFinal
    ? 14000 + Math.random() * 4000
    : 8500 + Math.random() * 3500;
  state.eventTimer = setTimeout(() => fireNextEvent(), delay);
}

function fireNextEvent() {
  if (!state.running) return;
  const ev = state.eventsQueue.shift();
  if (!ev) return;

  const isFinal = state.eventsQueue.length === 0;
  showWire(ev, isFinal);

  // The event reverses your gains. Bigger severity = bigger blow.
  const blow = 18 + ev.severity * (isFinal ? 80 : 28);
  state.robotPct = Math.min(100, state.robotPct + blow);
  state.humanPct = Math.max(0, 100 - state.robotPct);
  updateGauges();

  // Flip the case stamp red once we've taken a real blow
  const stamp = document.querySelector('.case-stamp');
  if (stamp) {
    stamp.classList.add('stamp-redflag');
    stamp.textContent = 'REOPENED';
  }

  state.triggeringEvent = ev;

  // Wire stays visible while the player keeps filing — non-blocking.
  if (isFinal || state.robotPct >= 100) {
    // For the case-sealing event, hold the wire on screen briefly, then seal.
    setTimeout(() => sealFile(ev), 2800);
  } else {
    setTicker(`AFTERSHOCK: "${ev.actor}" lands. Public confidence in human labor falls ${Math.round(blow)}%.`);
    // Auto-tuck the wire after a few seconds; player can also dismiss it manually.
    clearTimeout(state.wireTimer);
    state.wireTimer = setTimeout(() => hideWire(), 5800);
    scheduleNextEvent();
  }
}

// ---- Inline news wire ----
function showWire(ev, isFinal) {
  document.getElementById('wire-date').textContent = ev.date;
  document.getElementById('wire-headline').textContent = ev.headline;
  document.getElementById('wire-body').textContent = ev.body;
  const impact = document.getElementById('wire-impact');
  impact.textContent = isFinal ? `IMPACT: ${ev.impact_phrase} — case sealed.` : `IMPACT: ${ev.impact_phrase}.`;

  const wire = document.getElementById('wire');
  wire.classList.remove('wire-empty');
  // Re-trigger the slide-in animation if a new wire fires while one is already up.
  wire.classList.remove('wire-in');
  void wire.offsetWidth;
  wire.classList.add('wire-in');
}

function hideWire() {
  clearTimeout(state.wireTimer);
  const wire = document.getElementById('wire');
  wire.classList.remove('wire-in');
  wire.classList.add('wire-empty');
}

// ---- End-of-game ----
function stopGame() {
  state.running = false;
  clearInterval(state.baselineTimer);
  clearTimeout(state.eventTimer);
  clearTimeout(state.wireTimer);
  hideWire();
}

function sealFile(ev) {
  if (!state.running) return; // already sealed
  state.running = false;
  clearInterval(state.baselineTimer);
  clearTimeout(state.eventTimer);
  clearTimeout(state.wireTimer);

  state.robotPct = 100;
  state.humanPct = 0;
  updateGauges(true);

  setTimeout(() => {
    hideWire();
    showScreen('cert');
    generateCertificate(ev);
  }, 1400);
}

// ---- AI integrations ----

// Tailored countermeasure list, specific to job title — a full dispatch board's worth.
async function fetchTailoredActions(jobTitle) {
  const prompt = `You are issuing real-feeling but darkly comic "countermeasures" to a worker whose
job is being automated away by AI. Their job title: "${jobTitle}".

Return EXACTLY twelve (12) short, specific actions a person with that job title might
plausibly take to avoid being replaced. Each action should be 4-9 words, witty, and
job-specific (mention tools, certifications, jargon, processes, or rituals true to the field).
Vary the register: some pragmatic upskilling, some petty bureaucratic stalling, some absurd
performative gestures, some quiet exit-ramp planning. No two actions should solve the same
problem the same way.

Each gets a one-line "flavor" — a deadpan parenthetical aside (3-10 words).

Respond with ONLY valid JSON in this exact shape (no markdown, no prose):
{
  "actions": [
    { "label": "string", "flavor": "string" }
  ]
}
The "actions" array must contain exactly 12 entries.`;

  const resp = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      system: 'You are a darkly comic mid-century labor-bureau clerk. Always respond with valid JSON only.',
      max_tokens: 800,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const text = (data.text || data.content || data.response || '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { return null; }
  if (!parsed || !Array.isArray(parsed.actions)) return null;
  const cleaned = parsed.actions
    .filter(a => a && typeof a.label === 'string')
    .map(a => ({
      label: String(a.label).slice(0, 60),
      flavor: a.flavor ? String(a.flavor).slice(0, 80) : '',
    }));
  // Accept anything from 8 to 12 — be lenient with model output.
  return cleaned.length >= 8 ? cleaned.slice(0, 12) : null;
}

// Certificate text — names the actual AI release event that sealed the file.
async function generateCertificate(ev) {
  document.getElementById('generating-msg').style.display = 'block';
  document.getElementById('certificate').style.display = 'none';
  document.getElementById('share').style.display = 'none';

  // Ensure cert reflects the triggering event
  const trigger = ev || REAL_AI_EVENTS[REAL_AI_EVENTS.length - 1];

  const prompt = `You are a mid-century labor bureau clerk filling in a "Certificate of Obsolescence."

Their job title: "${state.jobTitle}"
The AI release that sealed the case: "${trigger.actor}" — ${trigger.headline} (${trigger.date}).

Respond with ONLY valid JSON in this exact shape, no other text:
{
  "ai_name": "${trigger.actor}",
  "cause": "A single absurdly specific, deadpan, period-bureaucratic cause of displacement, 30-90 chars, no quotes, must mention something about the worker's job that this AI now does. Avoid generic 'automation' phrasing — be specific to the job."
}`;

  let aiName = trigger.actor;
  let cause = `performed the duties of ${state.jobTitle.toLowerCase()} at scale, without complaint, for $0.0002 per task`;

  try {
    const resp = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        system: 'You are a darkly comic labor-bureau clerk. Respond with valid JSON only.',
        max_tokens: 160,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = (data.text || data.content || data.response || '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.ai_name) aiName = String(parsed.ai_name).slice(0, 40);
        if (parsed.cause) cause = String(parsed.cause).slice(0, 140);
      }
    }
  } catch (_) { /* fall through to fallbacks */ }

  state.finalAiName = aiName;
  state.finalCause = cause;
  state.finalEvent = trigger;

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();

  document.getElementById('cert-no').textContent = state.caseNo;
  document.getElementById('cert-job').textContent = state.jobTitle.toUpperCase();
  document.getElementById('cert-ai').textContent = aiName.toUpperCase();
  document.getElementById('cert-event').textContent = `${trigger.actor.toUpperCase()} — ${trigger.date}`;
  document.getElementById('cert-cause').textContent = cause;
  document.getElementById('cert-date').textContent = 'DATE FILED: ' + today;

  document.getElementById('generating-msg').style.display = 'none';
  document.getElementById('certificate').style.display = 'flex';
  document.getElementById('share').style.display = 'flex';
}

// ---- Share ----
function share() {
  const aiName = state.finalAiName || 'an AI';
  const cause = state.finalCause || 'doing your entire job for nothing';
  const ev = state.finalEvent;
  const evTag = ev ? ` after ${ev.actor} (${ev.date})` : '';
  const shareText =
    `Filed for FOBO. The Bureau confirms my job as ${state.jobTitle} was assumed by ${aiName}${evTag}, citing: "${cause}". Get your Certificate of Obsolescence:`;

  if (navigator.share) {
    navigator.share({
      title: 'The FOBO Simulator — Certificate of Obsolescence',
      text: shareText,
      url: location.href,
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareText + '\n' + location.href)
      .then(() => alert('Certificate text + link copied!'))
      .catch(() => {});
  }
}
window.share = share;
