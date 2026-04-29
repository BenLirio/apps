// The Autopsy of My Last Situationship — app.js
// Aesthetic: Vintage government document

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'situationship-autopsy';

// ── Deterministic helpers ───────────────────────────

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickFrom(arr, seed) {
  return arr[seed % arr.length];
}

function generateCaseNumber(seed) {
  const yr = new Date().getFullYear();
  const seq = String(1000 + (seed % 8999)).padStart(4, '0');
  return `RD-${yr}-${seq}`;
}

// ── Loading messages ────────────────────────────────

const LOADING_MSGS = [
  'conducting post-mortem analysis…',
  'weighing the evidence of your feelings…',
  'reviewing the toxicology samples…',
  'consulting the grief manual…',
  'cross-referencing the text receipts…',
  'cataloguing the unspoken things…',
];

// ── Deterministic fallback report ───────────────────

const FALLBACK_CAUSES = [
  'Acute Undefined Relationship Syndrome (AURS), complicated by prolonged ambiguity and deferred conversations.',
  'Chronic Lack of Labeling, progressing to Terminal Vagueness. Secondary complications noted.',
  'Spontaneous Situational Collapse (SSC) following sustained emotional exposure without formal contract.',
  'Asymmetric Investment Disorder (AID). One party significantly more invested than the other.',
  'Gradual Erosion of Implied Promises, culminating in silent withdrawal.',
];

const FALLBACK_CONTRIBUTING = [
  'Sustained failure to have "the talk." Mutual avoidance of direct communication. Emotional proximity without commitment.',
  'Extended use of soft language ("hanging out," "seeing where it goes"). Unaddressed expectations. Late-night texting without daylight follow-through.',
  'Fear of ruining it by naming it. Selective availability. Habit formation without formal agreement.',
];

const FALLBACK_MANNERS = [
  'Undetermined — consistent with both negligent ambiguity and premeditated fading.',
  'Natural causes, accelerated by environmental conditions (other people, timing, geography).',
  'Accidental — neither party intended this outcome, yet both parties produced it.',
  'Self-inflicted by omission. No foul play confirmed, though foul play cannot be excluded.',
];

const FALLBACK_VERDICTS = [
  'This relationship did not fail. It was never officially alive. The decedent existed in a superposition of present and absent, committed and free, yours and not-yours, until observation collapsed the waveform. Cause of death: Schrödinger\'s Partnership. You may grieve.',
  'The decedent did not end. It dissolved — slowly, like sugar in warm water, until you could no longer tell where it was. This is the hardest kind of death to mourn. The examiner notes: the absence of a ceremony does not mean the loss was not real.',
  'Time of death cannot be established with precision. The relationship had been in functional arrest for some period prior to the official end. By the time it died on record, the body had been cold for weeks. This is not unusual in cases of this type.',
];

const TOX_SUBSTANCES = [
  { name: 'Unread Messages', positive: true },
  { name: 'Vague Future Plans', positive: true },
  { name: 'Breadcrumbs', positive: true },
  { name: 'Weaponized Vulnerability', positive: null },
  { name: 'Instagram Story Surveillance', positive: null },
  { name: 'Late-Night Good Intentions', positive: true },
  { name: 'Hot/Cold Cycling', positive: null },
  { name: 'Fear of Commitment', positive: true },
  { name: 'Hope', positive: true },
  { name: 'Plausible Deniability', positive: null },
  { name: 'Emotional Labor (Unpaid)', positive: true },
  { name: 'Proximity Without Presence', positive: null },
];

function buildDeterministicReport(inputs) {
  const seed = hash(inputs.duration + inputs.vibe + inputs.ending + (inputs.moment || ''));
  const now = new Date();
  const dod = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const hours = [
    '1:47 AM', '2:13 AM', '11:58 PM', '3:22 AM',
    '12:01 AM', '10:44 PM', '9:16 PM', '4:05 AM'
  ];
  return {
    caseNum: generateCaseNumber(seed),
    decedent: 'The Situationship (Unspecified)',
    dod,
    tod: pickFrom(hours, seed),
    duration: inputs.duration,
    cause: pickFrom(FALLBACK_CAUSES, seed),
    contributing: pickFrom(FALLBACK_CONTRIBUTING, seed + 1),
    toxicology: buildTox(seed),
    manner: pickFrom(FALLBACK_MANNERS, seed + 2),
    verdict: pickFrom(FALLBACK_VERDICTS, seed + 3),
  };
}

function buildTox(seed) {
  // Shuffle deterministically and pick 6
  const shuffled = [...TOX_SUBSTANCES].sort((a, b) => hash(a.name + seed) - hash(b.name + seed));
  return shuffled.slice(0, 6).map(s => ({
    name: s.name,
    positive: s.positive !== null ? s.positive : (hash(s.name + seed) % 2 === 0),
  }));
}

// ── AI report generation ────────────────────────────

async function generateAIReport(inputs) {
  const systemPrompt = `You are the County Medical Examiner, Relationship Decedent Division. You write official-sounding mock autopsy reports for failed situationships. Your tone is clinical, dry, and faintly tragic — like a real government form crossed with a late-night journal entry.

Output strict JSON with exactly these keys:
- cause: string (1-2 sentences, clinical cause of death for the relationship — e.g. "Acute Undefined Relationship Syndrome complicated by...")
- contributing: string (1-2 sentences, contributing factors)
- manner: string (1 sentence, manner of death — choose from: Natural, Accidental, Undetermined, or a unique clinical variant)
- verdict: string (2-3 sentences, the examiner's final verdict — the most literary, screenshot-worthy part)

The content must reference the specific inputs. No emojis. No hashtags. Write as an official document.`;

  const userPrompt = `Duration: ${inputs.duration}
Defining vibe: ${inputs.vibe}
How it ended: ${inputs.ending}
Defining moment: ${inputs.moment || 'Not reported'}`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        response_format: 'json_object',
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    let parsed = null;
    try { parsed = JSON.parse(data.content); } catch (_) {}
    if (parsed && parsed.cause && parsed.verdict) return parsed;
    return null;
  } catch (_) {
    return null;
  }
}

// ── Render report ───────────────────────────────────

function renderReport(reportData) {
  document.getElementById('rpt-case-num').textContent = reportData.caseNum;
  document.getElementById('rpt-decedent').textContent = reportData.decedent;
  document.getElementById('rpt-dod').textContent = reportData.dod;
  document.getElementById('rpt-tod').textContent = reportData.tod;
  document.getElementById('rpt-duration').textContent = reportData.duration;
  document.getElementById('rpt-cause').textContent = reportData.cause;
  document.getElementById('rpt-contributing').textContent = reportData.contributing;
  document.getElementById('rpt-manner').textContent = reportData.manner;
  document.getElementById('rpt-verdict').textContent = reportData.verdict;

  // Toxicology
  const toxEl = document.getElementById('rpt-toxicology');
  toxEl.innerHTML = '';
  reportData.toxicology.forEach(item => {
    const cls = item.positive ? 'pos' : 'neg';
    const label = item.positive ? 'DETECTED' : 'NOT DETECTED';
    toxEl.innerHTML += `
      <div class="tox-item">
        <span class="tox-dot ${cls}"></span>
        <span class="tox-substance">${item.name}</span>
        <span class="tox-result ${cls}">${label}</span>
      </div>`;
  });
}

// ── Main flow ───────────────────────────────────────

function showScreen(id) {
  ['intake-screen', 'loading-screen', 'report-screen'].forEach(s => {
    document.getElementById(s).style.display = s === id ? '' : 'none';
  });
}

async function handleSubmit(e) {
  e.preventDefault();

  const inputs = {
    duration: document.getElementById('q-duration').value.trim(),
    vibe: document.getElementById('q-vibe').value.trim(),
    ending: document.getElementById('q-ending').value.trim(),
    moment: document.getElementById('q-moment').value.trim(),
  };

  if (!inputs.duration || !inputs.vibe || !inputs.ending) {
    const err = document.getElementById('error-msg');
    err.style.display = 'block';
    return;
  }

  document.getElementById('error-msg').style.display = 'none';

  // Build deterministic base report
  const base = buildDeterministicReport(inputs);

  // Show loading
  showScreen('loading-screen');
  const msgEl = document.getElementById('loading-msg');
  msgEl.textContent = pickFrom(LOADING_MSGS, hash(inputs.duration));

  // Enforce minimum loading time + AI call in parallel
  const [aiResult] = await Promise.all([
    generateAIReport(inputs),
    new Promise(r => setTimeout(r, 1200)),
  ]);

  // Merge AI result into base (AI provides the narrative fields)
  const final = { ...base };
  if (aiResult) {
    if (aiResult.cause) final.cause = aiResult.cause;
    if (aiResult.contributing) final.contributing = aiResult.contributing;
    if (aiResult.manner) final.manner = aiResult.manner;
    if (aiResult.verdict) final.verdict = aiResult.verdict;
  }

  renderReport(final);

  showScreen('report-screen');
  document.getElementById('share').style.display = 'flex';
}

function resetApp() {
  document.getElementById('intake-form').reset();
  document.getElementById('error-msg').style.display = 'none';
  document.getElementById('share').style.display = 'none';
  showScreen('intake-screen');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function share() {
  const title = 'The Autopsy of My Last Situationship';
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title, url });
  } else {
    navigator.clipboard.writeText(url)
      .then(() => alert('Link copied to clipboard!'))
      .catch(() => alert('Copy this link: ' + url));
  }
}

// ── Init ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('intake-form').addEventListener('submit', handleSubmit);
  showScreen('intake-screen');
});
