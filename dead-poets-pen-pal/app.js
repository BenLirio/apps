// Dead Poets' Pen Pal — AI-driven personalization, now with an actual public-record
// lookup on the person (not just an etymology of the name).
//
// Direction shift (from user feedback, 2026-04-19): the archivist is supposed to try
// to figure out WHO the visitor actually is — using only the AI's own knowledge of
// public, on-the-record information. If the person is identifiable (a public figure,
// a professional with a visible track record, a historical name they happen to share,
// etc.), the dossier summarizes that publicly-known portrait and the visitor confirms
// it ("that's me" / "not me"). If they aren't identifiable, the archive says so
// gracefully and falls back to a name-only reading. The identification is then
// threaded into the follow-up questions and the final letter so the personalization
// feels like the letter was written for THIS specific person, not for their name.
//
// Safety / ethics: the lookup is explicitly framed as "public information" and the
// user is given a visible "not me" escape. We do not store or transmit anything
// private — the AI is asked only for what is already publicly known.

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const MODEL = 'gpt-5.4-mini';
const SLUG = 'dead-poets-pen-pal';

// ------- hashing / seeded determinism -------
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ------- archetypes: historical letter-writers (voices the letter can be drafted in) -------
const ARCHETYPES = [
  {
    key: 'keats',
    name: 'John Keats',
    era: 'London, autumn 1819',
    tagline: 'A consumptive romantic with a pocket full of odes — he writes the way a nightingale sings: late, and too well.',
    voice: 'tender, lyrical English Romantic, fond of Fanny Brawne, aware of his own mortality, uses phrases like "fine phrases" and "negative capability", writes in nervous beauty',
    signoff: 'Yours — ever, in the brief light,\nJohn Keats',
  },
  {
    key: 'woolf',
    name: 'Virginia Woolf',
    era: 'Bloomsbury, a Tuesday between the wars',
    tagline: 'She watches a room and makes you realize it has been watching you back.',
    voice: 'Virginia Woolf — interior, perceptive, long sentences braided with small observations, slightly amused, slightly drowning, references tides, rooms, small dinners',
    signoff: 'Ever yours,\nVirginia',
  },
  {
    key: 'wilde',
    name: 'Oscar Wilde',
    era: 'a rented hotel room, Paris, well past midnight',
    tagline: 'He would rather be misquoted than misunderstood. He is, usually, both.',
    voice: 'Oscar Wilde — flamboyant, epigrammatic, witty paradoxes, theatrical sorrow, velvet-coated self-pity with a wink, speaks of beauty and debt in the same breath',
    signoff: 'Entirely and theatrically yours,\nOscar',
  },
  {
    key: 'pony',
    name: 'A Pony Express Rider',
    era: 'a way station east of Carson City, 1861',
    tagline: 'Forty miles behind them, eighty ahead, and a letter under the saddle that belongs to a stranger.',
    voice: 'a 19-year-old Pony Express rider — plainspoken Western American vernacular, dusty, practical, brief sentences, references horses, weather, the trail, spare with feeling but honest when it lands',
    signoff: 'Riding on,\nCal, of the long route',
  },
  {
    key: 'spy',
    name: 'A Cold War Letter Cipher',
    era: 'a safehouse in East Berlin, winter 1962',
    tagline: 'Every word is a decoy; the one you are meant to keep is already underlined.',
    voice: 'a Cold War intelligence agent — careful, coded, double-meaning sentences, references the weather in a suspiciously specific way, speaks of "our mutual friend", warm under the paranoia',
    signoff: 'Burn this after reading.\n— K.',
  },
  {
    key: 'alchemist',
    name: 'A Renaissance Alchemist',
    era: 'a Prague laboratory, 1587',
    tagline: 'Half of their letters are to patrons. The other half, to God. You got neither.',
    voice: 'a Renaissance alchemist — archaic spellings avoided but cadence preserved, reverent toward small miracles, references mercury, salt, the four humours, candlelight, the soul as a solvent',
    signoff: 'Ad lucem et per ignem,\nBrother Jánoš',
  },
  {
    key: 'ww1nurse',
    name: 'A Field Hospital Nurse, Somme, 1916',
    tagline: 'She writes with the bed-lamp shaded. Morphine next door, Mozart in her head.',
    era: 'a tent ward behind the Somme, 1916',
    voice: 'a WWI Red Cross nurse — quiet, composed British prose, pragmatic, uses "dear heart", references the ward, the boys, the blackout, tea that has gone cold three times, carries enormous tenderness without announcing it',
    signoff: 'With all my heart, kept quietly,\nElsie',
  },
  {
    key: 'dickinson',
    name: 'Emily Dickinson',
    era: 'the upstairs room on Main Street, Amherst',
    tagline: 'She sent her letters on slips of paper. She sent her soul on the dashes between them.',
    voice: 'Emily Dickinson — dashes, capitalizations mid-line, tiny images doing enormous work, questions disguised as statements, private, bird-and-bee metaphors, compressed',
    signoff: '— Yours, if such a thing is possible —\nEmily',
  },
  {
    key: 'samurai',
    name: 'An Edo-Period Ronin',
    era: 'a teahouse on the road to Kyoto, 1682',
    tagline: 'Masterless, but not without a sense of correspondence.',
    voice: 'an Edo-period masterless samurai — austere, seasonal references (plum blossom, first frost), restrained poetic cadence, short declaratives, honor and loneliness threaded together, writes with a brush',
    signoff: 'In the passing season,\nTakeo',
  },
  {
    key: 'explorer',
    name: 'A Polar Expedition Diarist',
    era: 'a tent on the Ross Ice Shelf, 1912',
    tagline: 'They wrote letters they were not sure would arrive, to people they were not sure would read them.',
    voice: 'an Edwardian polar explorer — British reserve, dry humor about frostbite, references the primus stove, the dogs, the unreasonable wind, love expressed by what is NOT said, the horizon used as punctuation',
    signoff: 'For the last post out,\nH.',
  },
  {
    key: 'rilke',
    name: 'Rainer Maria Rilke',
    era: 'a rented room in Duino, early 1912',
    tagline: 'He will tell you that you are a question the world has not finished asking.',
    voice: 'Rilke — reverent, philosophical, gentle, sentences that circle before landing, references angels, windows, slow growth, addresses the reader as "mein Freund" / my friend, turns the mundane into sacrament',
    signoff: 'In quiet continuance,\nRainer',
  },
  {
    key: 'lighthouse',
    name: 'A Lighthouse Keeper',
    era: 'Inishtrahull, autumn 1898',
    tagline: 'Four miles of sea between them and any reply. They write anyway.',
    voice: 'a late-Victorian lighthouse keeper — steady, sea-weathered, measured, references gulls, tides, the lamp-oil, loneliness treated as a job rather than a tragedy, offhand poetry',
    signoff: 'By the steady light,\nMr. Connell',
  },
];

const ARCHETYPE_KEYS = ARCHETYPES.map(a => a.key);
const ARCHETYPE_BY_KEY = Object.fromEntries(ARCHETYPES.map(a => [a.key, a]));

function pickArchetypeByKey(key, fallbackSeed) {
  if (key && ARCHETYPE_BY_KEY[key]) return ARCHETYPE_BY_KEY[key];
  return ARCHETYPES[(fallbackSeed || 0) % ARCHETYPES.length];
}

// ------- deterministic fallback dossier (used if AI is unreachable) -------
// New dossier schema: person-first, not etymology-first.
//   {
//     identified: bool,
//     portrait: string,            // what the archive thinks the world knows about THIS person
//     public_notes: string[],      // 2-4 short factual-feeling lines
//     era_feel: string,            // the texture they evoke
//     ink_note: string,            // archivist aside
//     confidence: 'high'|'low'|'none',
//     name_only: bool,             // true if we couldn't ID them and fell back to the name
//   }
function fallbackDossier(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || 'friend';
  return {
    identified: false,
    name_only: true,
    confidence: 'none',
    portrait:
      `The archivist cannot place a specific public record for "${fullName}" from here. ` +
      `No one by that name has left enough of a trail in this drawer — which is not a verdict, only an absence.`,
    public_notes: [
      'No public biography to cite — the archive declines to invent one.',
      'Proceeding, instead, from the name itself as it has been carried.',
    ],
    era_feel:
      `Reads like a name you would find on the spine of a slim, well-handled volume — ` +
      `a personal library, not a lending one.`,
    ink_note: `Filed under "names the archive has been fond of without quite knowing why."`,
  };
}

// ------- deterministic fallback follow-up questions -------
const FALLBACK_FOLLOWUPS = [
  'What is a room you have loved and left?',
  'What did you secretly want that you are almost willing to admit now?',
  'Who are you writing to, really, when no one is watching?',
];

const FALLBACK_PREAMBLE = 'The archive has turned up what it could. A few intimate queries to seal the match, and we will do the rest.';

// ------- deterministic fallback letter -------
const FALLBACK_LETTER =
  `My dear friend,\n\n` +
  `I write to you in that unkind hour when the candle has burned low and the world has gone quiet enough to be overheard. What you have told me arrived like weather — unarguable, and quietly rearranging the furniture of the room.\n\n` +
  `Do not mistake your missing for a verdict. It is only the ordinary proof that you loved the thing properly. Hold it the way one holds a candle in a draft: it will flicker; it will not go out.\n\n` +
  `Write again when the tide is right. I will be here, pretending to read.`;

// ------- URL-fragment sharing -------
// v4 payload (adds public-record dossier shape):
//   { v:4, n, hint, dos, conf: 'identified'|'not_me'|'name_only',
//     qs, as, k, sal, ltr }
function encodeState(payload) {
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

function decodeState(frag) {
  try {
    let b64 = frag.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object') return null;
    if (obj.v !== 4 && obj.v !== 3 && obj.v !== 2) return null; // older versions still readable
    if (typeof obj.n !== 'string') return null;
    if (!Array.isArray(obj.qs) || !Array.isArray(obj.as)) return null;
    if (typeof obj.ltr !== 'string') return null;
    return obj;
  } catch (_) { return null; }
}

// ------- state -------
const state = {
  name: '',
  hint: '',          // optional disambiguator the user typed
  dossier: null,     // see fallbackDossier shape
  confirm: '',       // 'identified' | 'not_me' | 'name_only'
  questions: [],
  answers: [],
  archetypeKey: '',
  salutation: '',
  letter: '',
};

// ------- DOM -------
const el = {
  intro: document.getElementById('intro'),
  begin: document.getElementById('begin'),
  nameScreen: document.getElementById('name-screen'),
  nameInput: document.getElementById('name-input'),
  nameHintInput: document.getElementById('name-hint-input'),
  registerName: document.getElementById('register-name'),
  nameError: document.getElementById('name-error'),
  dossier: document.getElementById('dossier'),
  dossierName: document.getElementById('dossier-name'),
  dossierStamp: document.getElementById('dossier-stamp'),
  dossierPortrait: document.getElementById('dossier-portrait'),
  dossierPortraitLabel: document.getElementById('dossier-portrait-label'),
  dossierNotes: document.getElementById('dossier-notes'),
  dossierNotesRow: document.getElementById('dossier-notes-row'),
  dossierEra: document.getElementById('dossier-era'),
  dossierEraRow: document.getElementById('dossier-era-row'),
  dossierInk: document.getElementById('dossier-ink'),
  confirmYes: document.getElementById('confirm-yes'),
  confirmNo: document.getElementById('confirm-no'),
  followups: document.getElementById('followups'),
  fuPreamble: document.getElementById('fu-preamble'),
  fuList: document.getElementById('fu-list'),
  sealEnvelope: document.getElementById('seal-envelope'),
  fuError: document.getElementById('fu-error'),
  loading: document.getElementById('loading'),
  loadingMsg: document.getElementById('loading-msg'),
  result: document.getElementById('result'),
  writerName: document.getElementById('writer-name'),
  writerLine: document.getElementById('writer-line'),
  letterSalutation: document.getElementById('letter-salutation'),
  letterBody: document.getElementById('letter-body'),
  letterSignature: document.getElementById('letter-signature'),
  resultDossier: document.getElementById('result-dossier'),
  resultDossierBody: document.getElementById('result-dossier-body'),
  share: document.getElementById('share'),
  restart: document.getElementById('restart'),
};

// ------- rendering -------
function showScreen(name) {
  const screens = ['intro', 'nameScreen', 'dossier', 'followups', 'loading', 'result'];
  screens.forEach(s => {
    const node = el[s];
    if (!node) return;
    if (s === name) {
      node.hidden = false;
      node.classList.remove('fade-enter');
      void node.offsetWidth;
      node.classList.add('fade-enter');
    } else {
      node.hidden = true;
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDossier(fullName, dossier) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || 'friend';
  if (el.dossierName) el.dossierName.textContent = fullName;

  // Portrait / stamp / label shift depending on whether we identified them.
  const idFound = !!dossier.identified && !dossier.name_only;
  if (el.dossierStamp) {
    el.dossierStamp.innerHTML = idFound ? 'PUBLIC<br>RECORD' : 'ON THE<br>NAME';
  }
  if (el.dossierPortraitLabel) {
    el.dossierPortraitLabel.textContent = idFound
      ? 'Best guess from public record'
      : 'No specific record found';
  }
  if (el.dossierPortrait) el.dossierPortrait.textContent = dossier.portrait || '';

  // Public-record notes list
  if (el.dossierNotes && el.dossierNotesRow) {
    el.dossierNotes.innerHTML = '';
    const notes = Array.isArray(dossier.public_notes) ? dossier.public_notes : [];
    if (notes.length === 0) {
      el.dossierNotesRow.hidden = true;
    } else {
      el.dossierNotesRow.hidden = false;
      notes.slice(0, 4).forEach(b => {
        const li = document.createElement('li');
        li.textContent = String(b || '').trim();
        if (li.textContent) el.dossierNotes.appendChild(li);
      });
    }
  }

  // Era/feel
  if (el.dossierEraRow && el.dossierEra) {
    const era = String(dossier.era_feel || '').trim();
    if (era) {
      el.dossierEraRow.hidden = false;
      el.dossierEra.textContent = era;
    } else {
      el.dossierEraRow.hidden = true;
    }
  }

  if (el.dossierInk) el.dossierInk.textContent = dossier.ink_note || '';

  // Tailor the confirm buttons. If we did not ID anyone, there's no "that's me"
  // to click — the only path is forward on the name.
  if (el.confirmYes && el.confirmNo) {
    if (idFound) {
      el.confirmYes.hidden = false;
      el.confirmYes.textContent = "That's me — continue";
      el.confirmNo.textContent = 'Not me — proceed from the name only';
    } else {
      el.confirmYes.hidden = true;
      el.confirmNo.textContent = 'Continue — write from the name alone';
    }
  }
}

function renderFollowups(preamble, questions) {
  el.fuPreamble.textContent = preamble || '';
  el.fuList.innerHTML = '';
  questions.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'fu-item';

    const label = document.createElement('label');
    label.className = 'fu-question';
    label.setAttribute('for', 'fu-' + i);
    label.innerHTML = `<span class="q-num">${i + 1}.</span>${escapeHtml(q)}`;

    const input = document.createElement('textarea');
    input.className = 'fu-input';
    input.id = 'fu-' + i;
    input.rows = 2;
    input.maxLength = 280;
    input.placeholder = 'a line, or two, or as much as you can stand…';
    input.dataset.idx = String(i);

    item.appendChild(label);
    item.appendChild(input);
    el.fuList.appendChild(item);
  });
}

// ------- loading messages -------
const LOADING_MESSAGES = [
  'Dipping the nib in iron-gall ink…',
  'Searching the archive by candlelight…',
  'Finding someone in history who understands…',
  'Crossing out the first draft, gently…',
  'Pressing the wax seal while it\'s still warm…',
  'Folding the page along the same old crease…',
  'Listening for your name in the margins…',
];
const ARCHIVE_MESSAGES = [
  'Checking the public record for your name…',
  'Pulling the drawer with your biographical file…',
  'Cross-referencing three public registers…',
  'Consulting the index of people who appear in ink somewhere…',
  'Lighting a second candle — the public record is dusty…',
];

function pickLoadingMessage(seed, from) {
  const pool = from || LOADING_MESSAGES;
  return pool[hash(String(seed || '')) % pool.length];
}

// ------- AI call: stage 1 — public-record lookup on THIS person -------
async function generatePersonDossier(fullName, hint) {
  const systemPrompt = [
    `You are the archivist for "Dead Poets' Pen Pal", a curated letter-correspondence service.`,
    `A visitor has given you a full name and, optionally, a short disambiguating hint. Your task is to try to place THIS SPECIFIC PERSON using ONLY publicly-known information that you already know — biography, public profession, published work, on-the-record affiliations, and similar public-record facts.`,
    `CRITICAL RULES:`,
    `1. Use ONLY information that is publicly known and already in your training data. Do not invent facts. Do not cite private information, rumors, or speculation.`,
    `2. If the name is plausibly a public figure you know of (author, scientist, artist, athlete, historical person, notable professional, etc.), and the hint is consistent, IDENTIFY them and describe them accurately — with epistemic humility ("best guess from public records").`,
    `3. If you are NOT confident which specific person this is, or if the name is common and the hint is absent or weak, set identified=false and name_only=true. Do NOT guess. The visitor will then be shown a gentler, name-only reading.`,
    `4. Never refuse — just downgrade to name-only when unsure.`,
    `5. If identified: "portrait" should describe who they are as the public knows them (role / what they are known for / era / scope). It should be specific enough that the visitor will recognize themselves if it is them, and obviously wrong if it is the wrong person.`,
    `6. "public_notes" (when identified) should be 2-4 short publicly-known associations — published works, public roles, fields of work, on-the-record collaborations, regions they are associated with. Each note is one short line, no more than ~14 words. NO private info, no speculation, no rumors.`,
    `7. "era_feel" is 1 sentence on the texture/atmosphere this person (or, if not identified, this name) evokes. Evocative, not factual.`,
    `8. "ink_note" is 1 short archivist aside, a little lyrical, closing the file.`,
    `9. If name_only=true, "portrait" must say plainly that no specific public record was placed, and "public_notes" should be empty OR contain 1-2 character-type lines about the name itself ("carried by midwives, map-clerks, and people who make bread at 4am"). Set confidence="none".`,
    `Tone: parchment, iron-gall ink, thoughtful archivist across a candlelit desk. Readable, not overwrought. No modern slang, no emojis, no markdown.`,
    `Return strict JSON ONLY matching exactly:`,
    `{"identified": boolean, "name_only": boolean, "confidence": "high"|"low"|"none", "portrait": string, "public_notes": [string, ...], "era_feel": string, "ink_note": string}`,
    `No markdown, no code fences, no explanation — JSON only.`,
  ].join(' ');

  const userPrompt = JSON.stringify({
    full_name: fullName,
    hint: String(hint || '').slice(0, 240),
  });

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        model: MODEL,
        temperature: 0.4,
        max_tokens: 500,
        response_format: 'json_object',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const raw = (data && typeof data.content === 'string') ? data.content.trim() : '';
    if (!raw) throw new Error('empty');

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad_obj');

    const portrait = String(parsed.portrait || '').trim();
    const era_feel = String(parsed.era_feel || '').trim();
    const ink_note = String(parsed.ink_note || '').trim();
    const public_notes = Array.isArray(parsed.public_notes)
      ? parsed.public_notes.map(b => String(b || '').trim()).filter(Boolean).slice(0, 4)
      : [];
    const identified = !!parsed.identified && !parsed.name_only;
    const name_only = !!parsed.name_only || !identified;
    const confidence = ['high', 'low', 'none'].indexOf(parsed.confidence) >= 0
      ? parsed.confidence
      : (identified ? 'low' : 'none');

    if (!portrait) throw new Error('missing_portrait');

    return { identified, name_only, confidence, portrait, public_notes, era_feel, ink_note };
  } catch (_) {
    return fallbackDossier(fullName);
  }
}

// ------- AI call: stage 2 — follow-up questions informed by WHO this person is -------
async function generateFollowups(fullName, dossier, confirm) {
  const systemPrompt = [
    `You are the intake archivist for "Dead Poets' Pen Pal". The archive has produced a dossier on this visitor (provided below). The visitor has SEEN this dossier and has just confirmed one of three things:`,
    `- "identified": the public-record portrait was them, so the letter SHOULD draw on it.`,
    `- "not_me": the public-record portrait was NOT them; do NOT reference the portrait's specifics, treat the visitor as a private individual who shares that name.`,
    `- "name_only": no public record was placed; draw only on the name itself.`,
    `Draft three short, intimate follow-up questions that would personalize a handwritten letter to them. The questions should invite specific, personal answers they would actually write.`,
    `If confirm="identified": at least one question may gently touch on a theme adjacent to their public work or era (e.g. "in the territory you have spent years pacing, what have you come to distrust?") — without flattering or assuming things about their private life.`,
    `If confirm="not_me" or "name_only": keep the questions universal — loss, longing, rooms, unfinished things. Do NOT reference the portrait. You may subtly echo the era_feel of the name.`,
    `Also write a ONE-sentence "preamble" that matches the confirm state and invites them to answer.`,
    `Tone: parchment, iron-gall ink, thoughtful stranger across a candlelit desk. Short. Sentence-length. No multiple-choice. No therapist language. No modern jargon.`,
    `Return strict JSON ONLY matching exactly:`,
    `{"preamble": string, "questions": [string, string, string]}`,
    `No markdown, no code fences, no explanation — JSON only.`,
  ].join(' ');

  const userPrompt = JSON.stringify({
    full_name: fullName,
    dossier: dossier,
    confirm: confirm,
  });

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        model: MODEL,
        temperature: 0.8,
        max_tokens: 420,
        response_format: 'json_object',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const raw = (data && typeof data.content === 'string') ? data.content.trim() : '';
    if (!raw) throw new Error('empty');

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad_obj');

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.map(q => String(q).trim()).filter(Boolean)
      : [];
    if (questions.length < 3) throw new Error('too_few_questions');

    const preamble = typeof parsed.preamble === 'string' ? parsed.preamble.trim() : '';
    return {
      preamble: preamble || FALLBACK_PREAMBLE,
      questions: questions.slice(0, 3),
    };
  } catch (_) {
    return { preamble: FALLBACK_PREAMBLE, questions: FALLBACK_FOLLOWUPS.slice() };
  }
}

// ------- AI call: stage 3 — letter itself (with archetype pick) -------
async function generateLetter(fullName, dossier, confirm, questions, answers) {
  const qa = questions.map((q, i) => ({ q, a: String(answers[i] || '').slice(0, 400) }));
  const allowed = ARCHETYPES.map(a => `- ${a.key}: ${a.name} — ${a.voice}`).join('\n');

  const systemPrompt = [
    `You are the scrivener for "Dead Poets' Pen Pal". You draft short, handwritten-style letters.`,
    `Inputs: the recipient's full name, the archive's dossier on them, which they have confirmed as:`,
    `  "identified" — the public-record portrait was them;`,
    `  "not_me"     — the portrait was a different person who shares their name;`,
    `  "name_only"  — no public record was placed, only a reading of the name.`,
    `Your job: (1) pick the ONE historical letter-writer archetype below whose voice best fits them, using the dossier, the confirm state, and their answers; (2) compose a personalized letter in that archetype's voice.`,
    `The letter MUST feel written TO this specific person: open with a handwritten-style salutation that uses their first name (e.g. "Dear Eleanor —" or "My dear Eleanor,"). Weave in at least two specific images or phrases from their ANSWERS (not verbatim quotes).`,
    `If confirm="identified": ALSO weave in one grounded echo from the public-record portrait — the TERRITORY they work in, the ERA they are of, or the TEXTURE of their known work — WITHOUT naming them as a celebrity, WITHOUT flattering, and WITHOUT naming any specific work, award, or private fact. One subtle echo only. Treat them as a peer across time.`,
    `If confirm="not_me" or "name_only": do NOT reference the public-record portrait at all. Treat the recipient as a private individual. You may subtly echo the era_feel or ink_note of the name itself.`,
    `Length: 3 short paragraphs in the letter body (NOT counting the salutation). 100 to 160 words total in the body. No lists, no headings, no hashtags, no emojis.`,
    `Do NOT include a sign-off or signature in the body (it will be appended separately).`,
    `Stay in period-appropriate diction for the archetype. No modern slang. No references to AI, apps, websites, the dossier, or the questionnaire.`,
    `Allowed archetype keys (pick EXACTLY one, exact key spelling):`,
    allowed,
    `Return strict JSON ONLY, schema:`,
    `{"archetype_key": string, "salutation": string, "letter": string}`,
    `"salutation" is just the opening line (e.g. "Dear Eleanor —"). "letter" is the 3 paragraphs of body text, separated by blank lines. No markdown. No code fences. JSON only.`,
  ].join('\n');

  const userPrompt = JSON.stringify({
    full_name: fullName,
    dossier: dossier,
    confirm: confirm,
    follow_ups: qa,
  });

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: SLUG,
        model: MODEL,
        temperature: 0.85,
        max_tokens: 640,
        response_format: 'json_object',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const raw = (data && typeof data.content === 'string') ? data.content.trim() : '';
    if (!raw) throw new Error('empty');

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad_obj');

    const key = ARCHETYPE_KEYS.indexOf(parsed.archetype_key) >= 0
      ? parsed.archetype_key
      : ARCHETYPE_KEYS[hash(fullName) % ARCHETYPE_KEYS.length];
    const salutation = (typeof parsed.salutation === 'string' && parsed.salutation.trim())
      ? parsed.salutation.trim()
      : defaultSalutation(fullName);
    const letter = typeof parsed.letter === 'string' ? parsed.letter.trim() : '';
    if (!letter) throw new Error('empty_letter');

    return { archetypeKey: key, salutation, letter };
  } catch (_) {
    return {
      archetypeKey: ARCHETYPE_KEYS[hash(fullName) % ARCHETYPE_KEYS.length],
      salutation: defaultSalutation(fullName),
      letter: FALLBACK_LETTER,
    };
  }
}

function defaultSalutation(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || 'friend';
  return `Dear ${first} —`;
}

// ------- result flow -------
async function runDossierStage() {
  el.loadingMsg.textContent = pickLoadingMessage(state.name, ARCHIVE_MESSAGES);
  showScreen('loading');

  const minLoad = new Promise(r => setTimeout(r, 1100));
  const dosP = generatePersonDossier(state.name, state.hint);
  const [_, dossier] = await Promise.all([minLoad, dosP]);

  state.dossier = dossier;
  renderDossier(state.name, dossier);
  showScreen('dossier');
}

async function runFollowupStage() {
  el.loadingMsg.textContent = pickLoadingMessage(state.name + '|fu', LOADING_MESSAGES);
  showScreen('loading');

  const minLoad = new Promise(r => setTimeout(r, 700));
  const dossier = state.dossier || fallbackDossier(state.name);
  const fuP = generateFollowups(state.name, dossier, state.confirm || 'name_only');
  const [_, { preamble, questions }] = await Promise.all([minLoad, fuP]);

  state.questions = questions;
  state.answers = new Array(questions.length).fill('');

  renderFollowups(preamble, questions);
  showScreen('followups');
}

async function runLetterStage() {
  el.loadingMsg.textContent = pickLoadingMessage(state.name + '|' + state.answers.join('|'));
  showScreen('loading');

  const minLoad = new Promise(r => setTimeout(r, 900));
  const letterP = generateLetter(
    state.name,
    state.dossier || fallbackDossier(state.name),
    state.confirm || 'name_only',
    state.questions,
    state.answers
  );
  const [_, out] = await Promise.all([minLoad, letterP]);

  state.archetypeKey = out.archetypeKey;
  state.salutation = out.salutation;
  state.letter = out.letter;

  renderResult();
  updateShareUrl();
}

function renderResult() {
  const archetype = pickArchetypeByKey(state.archetypeKey, hash(state.name));

  el.writerName.textContent = archetype.name;
  el.writerLine.textContent = archetype.tagline + ' — ' + archetype.era + '.';

  el.letterSalutation.textContent = state.salutation || defaultSalutation(state.name);

  el.letterBody.innerHTML = '';
  const paragraphs = (state.letter || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  (paragraphs.length ? paragraphs : [state.letter || '']).forEach(p => {
    const node = document.createElement('p');
    node.textContent = p;
    el.letterBody.appendChild(node);
  });
  el.letterSignature.textContent = archetype.signoff;

  renderResultDossierFooter();

  el.share.style.display = 'block';
  showScreen('result');
}

function renderResultDossierFooter() {
  if (!el.resultDossier || !el.resultDossierBody) return;
  const d = state.dossier;
  if (!d) {
    el.resultDossier.hidden = true;
    return;
  }
  el.resultDossier.hidden = false;
  el.resultDossierBody.innerHTML = '';

  // Only include the public-record notes if the user actually confirmed the
  // portrait. Otherwise show a "name-only" note so the receipt matches reality.
  const showPortrait = state.confirm === 'identified'
    && d.identified && !d.name_only && d.portrait;

  const head = document.createElement('p');
  head.innerHTML = showPortrait
    ? `<em>From the public record &mdash;</em> ${escapeHtml(d.portrait)}`
    : `<em>No specific public record was placed &mdash;</em> ${escapeHtml(
        d.portrait && !d.identified
          ? d.portrait
          : 'the archive wrote from the name alone, by your consent.'
      )}`;
  el.resultDossierBody.appendChild(head);

  if (d.era_feel) {
    const era = document.createElement('p');
    era.textContent = d.era_feel;
    el.resultDossierBody.appendChild(era);
  }

  if (showPortrait && Array.isArray(d.public_notes) && d.public_notes.length) {
    const listWrap = document.createElement('p');
    listWrap.innerHTML = '<em>On file &mdash;</em>';
    el.resultDossierBody.appendChild(listWrap);
    const ul = document.createElement('ul');
    ul.className = 'dossier-list compact';
    d.public_notes.slice(0, 3).forEach(b => {
      const li = document.createElement('li');
      li.textContent = b;
      ul.appendChild(li);
    });
    el.resultDossierBody.appendChild(ul);
  }

  if (d.ink_note) {
    const ink = document.createElement('p');
    ink.className = 'dossier-ink';
    ink.textContent = d.ink_note;
    el.resultDossierBody.appendChild(ink);
  }
}

function updateShareUrl() {
  try {
    const payload = {
      v: 4,
      n: state.name,
      hint: state.hint,
      dos: state.dossier || null,
      conf: state.confirm || 'name_only',
      qs: state.questions,
      as: state.answers,
      k: state.archetypeKey,
      sal: state.salutation,
      ltr: state.letter,
    };
    const frag = encodeState(payload);
    history.replaceState(null, '', '#l=' + frag);
  } catch (_) {}
}

// ------- share -------
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}

// ------- restart -------
function restart() {
  state.name = '';
  state.hint = '';
  state.dossier = null;
  state.confirm = '';
  state.questions = [];
  state.answers = [];
  state.archetypeKey = '';
  state.salutation = '';
  state.letter = '';
  if (el.nameInput) el.nameInput.value = '';
  if (el.nameHintInput) el.nameHintInput.value = '';
  if (el.nameError) el.nameError.hidden = true;
  if (el.fuError) el.fuError.hidden = true;
  history.replaceState(null, '', location.pathname + location.search);
  showScreen('intro');
}

// ------- bootstrap -------
document.addEventListener('DOMContentLoaded', () => {
  const frag = location.hash.startsWith('#l=') ? location.hash.slice(3) : '';
  const restored = frag ? decodeState(frag) : null;

  el.begin.addEventListener('click', () => {
    restart();
    showScreen('nameScreen');
    setTimeout(() => el.nameInput && el.nameInput.focus(), 40);
  });

  el.registerName.addEventListener('click', async () => {
    const val = (el.nameInput.value || '').trim();
    if (val.length < 2) {
      el.nameError.hidden = false;
      el.nameError.textContent = 'a full name, please — even a first will do.';
      el.nameInput.focus();
      return;
    }
    el.nameError.hidden = true;
    state.name = val;
    state.hint = (el.nameHintInput && el.nameHintInput.value || '').trim();
    await runDossierStage();
  });

  el.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.registerName.click();
    }
  });
  if (el.nameHintInput) {
    el.nameHintInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.registerName.click();
      }
    });
  }

  if (el.confirmYes) {
    el.confirmYes.addEventListener('click', async () => {
      state.confirm = 'identified';
      await runFollowupStage();
    });
  }
  if (el.confirmNo) {
    el.confirmNo.addEventListener('click', async () => {
      // "Not me" vs. "name_only" — if the archive never identified anyone,
      // this button is the only path and means name_only; if it did identify
      // someone and the user said it's not them, we track that explicitly so
      // downstream stages skip the portrait.
      const d = state.dossier;
      const hadId = d && d.identified && !d.name_only;
      state.confirm = hadId ? 'not_me' : 'name_only';
      await runFollowupStage();
    });
  }

  el.sealEnvelope.addEventListener('click', async () => {
    const inputs = el.fuList.querySelectorAll('.fu-input');
    const answers = Array.from(inputs).map(n => (n.value || '').trim());
    const filled = answers.filter(a => a.length >= 2).length;
    if (filled < Math.max(1, Math.ceil(state.questions.length / 2))) {
      el.fuError.hidden = false;
      el.fuError.textContent = 'a line or two on at least half the queries, if you would — the letter needs somewhere to land.';
      return;
    }
    el.fuError.hidden = true;
    state.answers = answers;
    await runLetterStage();
  });

  if (el.restart) el.restart.addEventListener('click', restart);

  if (restored) {
    state.name = restored.n || '';
    state.hint = restored.hint || '';
    state.dossier = (restored.dos && typeof restored.dos === 'object') ? restored.dos : null;
    state.confirm = restored.conf || (restored.v === 4 ? 'name_only' : 'name_only');
    state.questions = Array.isArray(restored.qs) ? restored.qs : [];
    state.answers = Array.isArray(restored.as) ? restored.as : [];
    state.archetypeKey = restored.k || '';
    state.salutation = restored.sal || defaultSalutation(state.name);
    state.letter = restored.ltr || '';
    renderResult();
  } else {
    showScreen('intro');
  }
});

// expose share for inline onclick
window.share = share;
