// Cryptid Sighting Report — Bureau of Anomalous Fauna, Form BAF-7

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const IMAGE_ENDPOINT = 'https://6kwpxgbgkc.execute-api.us-east-1.amazonaws.com/image';
const SLUG = 'cryptid-sighting-report';

// ─── Seeded hash for deterministic case numbers ───────────────────────────────
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── AI classification ────────────────────────────────────────────────────────
// Returns { speciesName, threatLevel, clearance, behavioralNotes }
async function classifySighting(inputs) {
  const messages = [
    {
      role: 'system',
      content: `You are the automated classification system of the Bureau of Anomalous Fauna, a secret government agency. A witness has filed a sighting report in their own words. Your job is to issue a formal cryptid classification based specifically on what they described.

IMPORTANT: Your classification must feel tailored to the witness's actual account — the species name, threat level, and behavioral notes must clearly derive from their specific description, not generic responses.

Respond with ONLY a JSON object in exactly this format:
{
  "speciesName": "a made-up Latin-sounding or government-code species name that fits what was described",
  "threatLevel": "LEVEL I — PASSIVE" | "LEVEL II — LOW" | "LEVEL III — MODERATE" | "LEVEL IV — ELEVATED" | "LEVEL V — CRITICAL",
  "clearance": "UNCLASSIFIED" | "EYES ONLY" | "SECRET" | "TOP SECRET",
  "behavioralNotes": "2-3 sentences of dry, bureaucratic field guide text that references specific details from the witness account. Use formal scientific language. No humor. No emoji.",
  "imagePrompt": "a concise visual description of the creature for generating a pixel art illustration, based on the witness description"
}`
    },
    {
      role: 'user',
      content: `WITNESS ACCOUNT:\n\nLocation: ${inputs.location}\n\nConditions: ${inputs.time}\n\nEntity description: ${inputs.description}`
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 400 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const text = (data.content || '').trim();

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no_json');
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.speciesName || !parsed.threatLevel || !parsed.clearance || !parsed.behavioralNotes) {
      throw new Error('incomplete_json');
    }
    return parsed;
  } catch (_) {
    // Deterministic fallback using hash of description
    const h = hash(inputs.description);
    const fallbackSpecies = [
      { speciesName: 'Vorthulax Obscurus', threatLevel: 'LEVEL III — MODERATE', clearance: 'EYES ONLY', behavioralNotes: 'Entity documented in prior field reports. Exhibits territorial behavior consistent with witness account. Standard protocol: maintain 40-meter distance and file within 48 hours.' },
      { speciesName: 'Hollowmaw Crepusculi', threatLevel: 'LEVEL V — CRITICAL', clearance: 'TOP SECRET', behavioralNotes: 'Critical classification. Bureau maintains active monitoring protocol for all confirmed sightings. Witness is advised to vacate the area immediately and not return within 72 hours.' },
      { speciesName: 'Duskrender Ignoti', threatLevel: 'LEVEL IV — ELEVATED', clearance: 'SECRET', behavioralNotes: 'Rare genus with limited confirmed sightings in Bureau history. Full behavioral profile is still being developed. Elevated classification is precautionary pending further analysis.' },
      { speciesName: 'Nocturid Vespera', threatLevel: 'LEVEL I — PASSIVE', clearance: 'UNCLASSIFIED', behavioralNotes: 'Passive classification. No recorded hostile incidents. Witness should note: direct eye contact during observation may cause temporary visual artifacts. This is not a cause for alarm.' },
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

const LOADING_MESSAGES = [
  'cross-referencing witness account with restricted archives...',
  'querying 1947 anomalous fauna database...',
  'running taxonomic analysis on entity characteristics...',
  'comparing account against 79 prior incident files...',
  'authenticating field classification credentials...',
];

function beginForm() {
  hide('intro-section');
  show('intake-form');
}

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
    err.textContent = 'all three fields are required before a report can be issued — the Bureau does not classify incomplete sightings.';
    document.getElementById('submit-btn').after(err);
    return;
  }

  const inputs = { location, time, description };

  // Show loading
  hide('intake-form');
  show('loading-section');

  const msgEl = document.getElementById('loading-msg');
  msgEl.textContent = LOADING_MESSAGES[hash(location + time) % LOADING_MESSAGES.length];

  // Cycle through loading messages while waiting
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
    msgEl.textContent = LOADING_MESSAGES[msgIdx];
  }, 2500);

  // Generate case number
  const caseNum = 'BAF-' + String(hash(location + time + description) % 90000 + 10000);

  // Classify and generate image (min 1200ms loading display)
  const [classification] = await Promise.all([
    classifySighting(inputs),
    new Promise(r => setTimeout(r, 1200))
  ]);

  clearInterval(msgInterval);

  // Start image generation (non-blocking — will update when ready)
  const imagePromise = getImage(classification.imagePrompt || description, classification.speciesName);

  // Populate report
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  document.getElementById('report-date').textContent = dateStr;
  document.getElementById('report-case').textContent = caseNum;
  document.getElementById('species-name').textContent = classification.speciesName;
  document.getElementById('threat-level').textContent = classification.threatLevel;
  document.getElementById('behavioral-notes').textContent = classification.behavioralNotes;
  document.getElementById('clearance-stamp').textContent = classification.clearance;

  hide('loading-section');
  show('report-section');
  show('share');
  document.getElementById('report-section').scrollIntoView({ behavior: 'smooth' });

  // Load image asynchronously (report already visible)
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
  // Reset all sections
  hide('report-section');
  hide('share');
  document.getElementById('location').value = '';
  document.getElementById('time-of-day').value = '';
  document.getElementById('description').value = '';
  const existing = document.querySelector('.validation-error');
  if (existing) existing.remove();
  // Reset image
  const imgEl = document.getElementById('cryptid-img');
  imgEl.style.display = 'none';
  imgEl.src = '';
  document.getElementById('img-placeholder').style.display = '';
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
