// Cryptid Sighting Report — Bureau of Anomalous Fauna, Form BAF-7
// Two-stage flow: Initial intake → AI-generated follow-up interrogation → enriched report

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const IMAGE_ENDPOINT = 'https://6kwpxgbgkc.execute-api.us-east-1.amazonaws.com/image';
const SLUG = 'cryptid-sighting-report';

let initialAnswers = null;
let followupQuestions = null;

// ─── Seeded hash for deterministic case numbers ───────────────────────────────
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── AI call: generate follow-up interrogation questions ──────────────────────
// Returns [{ id, label, placeholder }, { id, label, placeholder }]
async function generateFollowupQuestions(inputs) {
  const messages = [
    {
      role: 'system',
      content: `You are an interrogation officer for the Bureau of Anomalous Fauna, a secret government agency. A witness has just submitted their initial sighting account. Generate exactly 2 follow-up questions that probe specific details from THEIR account — not generic. Each question should ask for information that would help classify the cryptid (behavior, witness state, environmental anomalies, encounter outcome). Tone: deadpan, formal, bureaucratic.

Respond with ONLY a JSON object in exactly this format:
{
  "questions": [
    {
      "label": "Q4. THE QUESTION IN ALL CAPS, REFERENCING SPECIFIC DETAILS FROM THE WITNESS ACCOUNT (10-25 words)",
      "placeholder": "A short hint about what the Bureau is looking for in this answer..."
    },
    {
      "label": "Q5. THE SECOND QUESTION IN ALL CAPS, ALSO REFERENCING SPECIFICS FROM THE ACCOUNT (10-25 words)",
      "placeholder": "Another short hint..."
    }
  ]
}`
    },
    {
      role: 'user',
      content: `INITIAL WITNESS ACCOUNT:\n\nLocation: ${inputs.location}\n\nConditions: ${inputs.time}\n\nEntity description: ${inputs.description}`
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 280 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const text = (data.content || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no_json');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 2) throw new Error('bad_shape');
    return parsed.questions.slice(0, 2).map((q, i) => ({
      id: 'followup-' + (i + 1),
      label: String(q.label || '').slice(0, 250),
      placeholder: String(q.placeholder || '').slice(0, 200)
    }));
  } catch (_) {
    return [
      { id: 'followup-1', label: 'Q4. DID THE ENTITY APPEAR TO REGISTER YOUR PRESENCE? IF SO, HOW DID IT REACT?', placeholder: 'Eye contact, vocalization, change in posture, pursuit, etc.' },
      { id: 'followup-2', label: 'Q5. WERE THERE ANY ENVIRONMENTAL ANOMALIES — SOUNDS, SMELLS, LIGHT, SILENCE — DURING OR AFTER THE ENCOUNTER?', placeholder: 'The Bureau places significant weight on ambient irregularities.' }
    ];
  }
}

// ─── AI call: full classification with enriched fields ────────────────────────
async function classifySighting(inputs) {
  const followupBlock = inputs.followups
    .map((f, i) => `${f.label.replace(/^Q\d+\.\s*/, '')}\nWITNESS: ${f.answer}`)
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content: `You are the automated classification system of the Bureau of Anomalous Fauna, a secret government agency. A witness has filed a sighting report and answered follow-up interrogation. Issue a formal cryptid classification.

IMPORTANT: Every field must feel TAILORED to this specific witness — quote or paraphrase concrete details from their answers. No generic responses. No humor. No emoji.

Respond with ONLY a JSON object in exactly this format:
{
  "speciesName": "made-up Latin-sounding or government-code species name fitting what was described",
  "threatLevel": "LEVEL I — PASSIVE" | "LEVEL II — LOW" | "LEVEL III — MODERATE" | "LEVEL IV — ELEVATED" | "LEVEL V — CRITICAL",
  "clearance": "UNCLASSIFIED" | "EYES ONLY" | "SECRET" | "TOP SECRET",
  "behavioralNotes": "2-3 sentences of dry, bureaucratic field-guide text. Reference specific details from the witness account. Formal scientific language.",
  "containmentProtocol": [
    "Imperative directive 1 — a specific action the witness should take, derived from their account.",
    "Imperative directive 2 — also tied to specifics.",
    "Imperative directive 3 — also tied to specifics.",
    "Imperative directive 4 (optional)."
  ],
  "priorIncidents": "2-3 sentences citing 1-2 fictional prior Bureau case files (with case numbers like BAF-####, dates between 1953-2012, geographic locations). The cited incidents must thematically resemble what this witness reported. Treat these as classified historical record.",
  "imagePrompt": "concise visual description of the creature for pixel-art illustration, based on witness description"
}`
    },
    {
      role: 'user',
      content: `INITIAL WITNESS ACCOUNT:

Location: ${inputs.location}

Conditions: ${inputs.time}

Entity description: ${inputs.description}

FOLLOW-UP INTERROGATION:

${followupBlock}`
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 700 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const text = (data.content || '').trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no_json');
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.speciesName || !parsed.threatLevel || !parsed.clearance || !parsed.behavioralNotes) {
      throw new Error('incomplete_json');
    }
    if (!Array.isArray(parsed.containmentProtocol) || parsed.containmentProtocol.length === 0) {
      parsed.containmentProtocol = [
        'Maintain a minimum 40-meter exclusion radius from the sighting location for 72 hours.',
        'Do not discuss the encounter with any unauthorized individual — Class III infraction.',
        'Report any recurring dreams, electrical disturbances, or auditory artifacts to the Bureau within 24 hours.',
      ];
    }
    if (!parsed.priorIncidents) {
      parsed.priorIncidents = 'Limited corroborating record. Cross-reference with case BAF-3214 (Driftwood Marsh, OR — 1973) is partial at best.';
    }
    return parsed;
  } catch (_) {
    // Deterministic fallback using hash of description
    const h = hash(inputs.description);
    const fallbackSpecies = [
      {
        speciesName: 'Vorthulax Obscurus',
        threatLevel: 'LEVEL III — MODERATE',
        clearance: 'EYES ONLY',
        behavioralNotes: 'Entity documented in prior field reports. Exhibits territorial behavior consistent with witness account. Standard protocol: maintain 40-meter distance and file within 48 hours.',
        containmentProtocol: [
          'Avoid the sighting location for a minimum of 14 days.',
          'Do not photograph or attempt to record the entity should it return.',
          'Refrain from discussing the sighting with friends, family, or media for 30 days.',
          'If you experience repeated nightmares involving the entity, contact the Bureau directly.'
        ],
        priorIncidents: 'See case BAF-2841 (Pine Hollow, MT — 1987) and BAF-4019 (Lower Salt Marsh, GA — 2003) for behaviorally similar engagements. In both cases the entity returned within 60 days of initial sighting. Prophylactic relocation was advised.'
      },
      {
        speciesName: 'Hollowmaw Crepusculi',
        threatLevel: 'LEVEL V — CRITICAL',
        clearance: 'TOP SECRET',
        behavioralNotes: 'Critical classification. Bureau maintains active monitoring protocol for all confirmed sightings. Witness is advised to vacate the area immediately and not return within 72 hours.',
        containmentProtocol: [
          'Vacate the sighting location immediately. Do not return for 72 hours minimum.',
          'Burn or destroy any clothing worn during the encounter.',
          'Submit to a Bureau debriefing within 12 hours of filing this report.',
          'You may be contacted by Field Recovery. Comply fully.'
        ],
        priorIncidents: 'See case BAF-5103 (Roan County, TN — 1991) — a Level V incident with closely matching auditory phenomena. The witness was relocated by the Bureau and remains under benign observation.'
      },
      {
        speciesName: 'Duskrender Ignoti',
        threatLevel: 'LEVEL IV — ELEVATED',
        clearance: 'SECRET',
        behavioralNotes: 'Rare genus with limited confirmed sightings in Bureau history. Full behavioral profile is still being developed. Elevated classification is precautionary pending further analysis.',
        containmentProtocol: [
          'Do not return to the encounter location after dusk for any reason.',
          'Note any rapid temperature drops in the days following the sighting.',
          'Avoid open bodies of water within 2km for 7 days.'
        ],
        priorIncidents: 'Fewer than nine confirmed sightings in Bureau records. The closest precedent is case BAF-1117 (unmarked location, 1962) which produced inconsistent witness testimony but matching environmental data.'
      },
      {
        speciesName: 'Nocturid Vespera',
        threatLevel: 'LEVEL I — PASSIVE',
        clearance: 'UNCLASSIFIED',
        behavioralNotes: 'Passive classification. No recorded hostile incidents. Witness should note: direct eye contact during observation may cause temporary visual artifacts. This is not a cause for alarm.',
        containmentProtocol: [
          'No special precautions required. Standard observation protocol applies.',
          'Should the entity be sighted again, attempt to note the duration of presence.',
          'Visual artifacts (afterimages, mild halos) lasting under 48 hours are within normal parameters.'
        ],
        priorIncidents: 'Common entry. Cross-reference with case files BAF-0844 (Salt Flats, NM — 1968) and BAF-7290 (Coastal Maine, 2009). Both encounters concluded without further consequence.'
      },
    ];
    const fallback = fallbackSpecies[h % fallbackSpecies.length];
    return { ...fallback, imagePrompt: inputs.description };
  }
}

// ─── Image generation ─────────────────────────────────────────────────────────
const FALLBACK_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Crect width='240' height='240' fill='%23e4d8bf'/%3E%3Crect x='100' y='60' width='40' height='50' fill='%231a1410' rx='4'/%3E%3Crect x='90' y='75' width='14' height='14' fill='%23b01c1c' rx='2'/%3E%3Crect x='136' y='75' width='14' height='14' fill='%23b01c1c' rx='2'/%3E%3Crect x='85' y='110' width='70' height='70' fill='%231a1410' rx='2'/%3E%3Crect x='65' y='120' width='22' height='50' fill='%231a1410' rx='2'/%3E%3Crect x='153' y='120' width='22' height='50' fill='%231a1410' rx='2'/%3E%3Crect x='95' y='180' width='18' height='40' fill='%231a1410' rx='2'/%3E%3Crect x='127' y='180' width='18' height='40' fill='%231a1410' rx='2'/%3E%3Ctext x='120' y='232' font-family='monospace' font-size='8' fill='%236b5840' text-anchor='middle'%3EUNIDENTIFIED ENTITY%3C/text%3E%3C/svg%3E`;

async function getImage(imagePrompt, speciesName) {
  const prompt = `Pixel art illustration of a cryptid creature called "${speciesName}". Visual description: ${imagePrompt}. Style: chunky 16-bit pixel art, limited 8-color palette, dark creature on pale parchment background, field guide sketch quality, slightly eerie. Square composition, centered subject, no text.`;

  try {
    const res = await fetch(IMAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        prompt,
        quality: 'fast',
        aspect_ratio: '1:1'
      })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    return data.image || FALLBACK_SVG;
  } catch (_) {
    return FALLBACK_SVG;
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

const LOADING_MESSAGES_INITIAL = [
  'parsing initial witness account...',
  'cross-referencing first-pass against restricted archives...',
  'compiling tailored interrogation protocol...',
  'authenticating witness clearance for follow-up...',
];

const LOADING_MESSAGES_FINAL = [
  'cross-referencing complete account with restricted archives...',
  'querying 1947 anomalous fauna database...',
  'running taxonomic analysis on entity characteristics...',
  'comparing account against 79 prior incident files...',
  'compiling field classification and containment directives...',
  'authenticating field classification credentials...',
];

function beginForm() {
  hide('intro-section');
  show('intake-form');
}

function showLoading(stamp, messages) {
  show('loading-section');
  document.getElementById('loading-stamp').textContent = stamp;
  const msgEl = document.getElementById('loading-msg');
  msgEl.textContent = messages[0];
  let i = 0;
  return setInterval(() => {
    i = (i + 1) % messages.length;
    msgEl.textContent = messages[i];
  }, 2000);
}

// ─── Stage 1: initial submit → fetch follow-ups ───────────────────────────────
async function submitForm(e) {
  e.preventDefault();

  const location = document.getElementById('location').value.trim();
  const time = document.getElementById('time-of-day').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!location || !time || !description) {
    const existing = document.querySelector('.validation-error');
    if (existing) existing.remove();
    const err = document.createElement('span');
    err.className = 'validation-error';
    err.textContent = 'all three fields are required before the Bureau can proceed.';
    document.getElementById('submit-btn').after(err);
    return;
  }

  initialAnswers = { location, time, description };

  hide('intake-form');
  const interval = showLoading('TRIAGING', LOADING_MESSAGES_INITIAL);

  const [questions] = await Promise.all([
    generateFollowupQuestions(initialAnswers),
    new Promise(r => setTimeout(r, 1500))
  ]);

  clearInterval(interval);
  followupQuestions = questions;
  renderFollowupForm();
  hide('loading-section');
  show('followup-form');
  document.getElementById('followup-form').scrollIntoView({ behavior: 'smooth' });
}

function renderFollowupForm() {
  const wrap = document.getElementById('followup-fields');
  wrap.innerHTML = '';
  followupQuestions.forEach(q => {
    const group = document.createElement('div');
    group.className = 'field-group';
    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = q.id;
    label.textContent = q.label;
    const ta = document.createElement('textarea');
    ta.id = q.id;
    ta.required = true;
    ta.maxLength = 500;
    ta.placeholder = q.placeholder;
    group.appendChild(label);
    group.appendChild(ta);
    wrap.appendChild(group);
  });
}

// ─── Stage 2: follow-up submit → final classification + image ─────────────────
async function submitFollowup(e) {
  e.preventDefault();

  const followups = followupQuestions.map(q => ({
    label: q.label,
    answer: document.getElementById(q.id).value.trim()
  }));

  if (followups.some(f => !f.answer)) {
    const existing = document.querySelector('.validation-error');
    if (existing) existing.remove();
    const err = document.createElement('span');
    err.className = 'validation-error';
    err.textContent = 'all interrogation answers are required — the Bureau does not classify partial accounts.';
    document.getElementById('followup-submit-btn').after(err);
    return;
  }

  hide('followup-form');
  const interval = showLoading('PROCESSING', LOADING_MESSAGES_FINAL);

  const inputs = { ...initialAnswers, followups };

  const caseNum = 'BAF-' + String(hash(initialAnswers.location + initialAnswers.time + initialAnswers.description) % 90000 + 10000);

  const [classification] = await Promise.all([
    classifySighting(inputs),
    new Promise(r => setTimeout(r, 1500))
  ]);

  clearInterval(interval);

  const imagePromise = getImage(classification.imagePrompt || initialAnswers.description, classification.speciesName);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  document.getElementById('report-date').textContent = dateStr;
  document.getElementById('report-case').textContent = caseNum;
  document.getElementById('species-name').textContent = classification.speciesName;
  document.getElementById('threat-level').textContent = classification.threatLevel;
  document.getElementById('behavioral-notes').textContent = classification.behavioralNotes;
  document.getElementById('clearance-stamp').textContent = classification.clearance;

  const containmentEl = document.getElementById('containment-list');
  containmentEl.innerHTML = '';
  classification.containmentProtocol.forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    containmentEl.appendChild(li);
  });

  document.getElementById('prior-incidents').textContent = classification.priorIncidents;

  hide('loading-section');
  show('report-section');
  show('share');
  document.getElementById('report-section').scrollIntoView({ behavior: 'smooth' });

  imagePromise.then(imageData => {
    const imgEl = document.getElementById('cryptid-img');
    const placeholder = document.getElementById('img-placeholder');

    imgEl.onload = () => {
      placeholder.style.display = 'none';
      imgEl.style.display = '';
    };
    imgEl.onerror = () => {
      imgEl.src = FALLBACK_SVG;
      placeholder.style.display = 'none';
      imgEl.style.display = '';
    };
    imgEl.src = imageData;
  });
}

function fileAnother() {
  hide('report-section');
  hide('share');
  hide('followup-form');
  document.getElementById('location').value = '';
  document.getElementById('time-of-day').value = '';
  document.getElementById('description').value = '';
  const existing = document.querySelector('.validation-error');
  if (existing) existing.remove();
  const imgEl = document.getElementById('cryptid-img');
  imgEl.style.display = 'none';
  imgEl.src = '';
  document.getElementById('img-placeholder').style.display = '';
  initialAnswers = null;
  followupQuestions = null;
  show('intake-form');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shareReport() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}
