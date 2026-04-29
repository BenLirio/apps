// Niche Hall of Fame — pompous certificates for unreasonably specific passions.
// Deterministic: same passion input always yields the same induction.

(function () {
  const form = document.getElementById('form');
  const input = document.getElementById('passion');
  const intake = document.getElementById('intake');
  const loading = document.getElementById('loading');
  const loadingMsg = document.getElementById('loadingMsg');
  const certificate = document.getElementById('certificate');
  const errorEl = document.getElementById('error');
  const againBtn = document.getElementById('againBtn');

  const subjectEl = document.getElementById('subject');
  const titleEl = document.getElementById('title');
  const eraEl = document.getElementById('era');
  const patronEl = document.getElementById('patron');
  const speechEl = document.getElementById('speech');
  const rivalEl = document.getElementById('rival');

  // ---------- helpers ----------
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function pick(arr, seed) { return arr[seed % arr.length]; }

  function normalize(s) {
    return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function titleCase(s) {
    return s.replace(/\b([a-z])([a-z]*)/g, (_, a, b) => a.toUpperCase() + b);
  }

  // Extract the most meaningful noun-ish keyword — last non-stop word, else the whole phrase.
  const STOP = new Set([
    'a','an','the','of','with','and','or','to','for','from','on','in','by','about',
    'my','your','our','their','his','her','its','is','are','was','were','be','being','been',
    'that','this','these','those','at','as','it','i','we','you','they','them','me',
    'very','really','super','just','so','all','any'
  ]);
  function keyword(raw) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) return 'the thing';
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i].replace(/[^\w'-]/g, '');
      if (w && !STOP.has(w.toLowerCase())) return w;
    }
    return words[words.length - 1];
  }

  // ---------- content banks ----------

  const TITLE_RANK = [
    'The Commissioner', 'The High Warden', 'The Grand Archivist',
    'The Provost', 'The Reverend Keeper', 'The Chief Adjudicator',
    'The First Chair', 'The Minister', 'The Hereditary Steward',
    'The Prelate', 'The Ombudsperson', 'The Viceroy',
    'The Doyen', 'The Chancellor', 'The Marquis',
    'The Arbiter', 'The Curator-in-Residence', 'The Prefect',
    'The Grand Vizier', 'The Magistrate', 'The Director Emeritus',
    'The Sub-Committee Foreperson', 'The Patron', 'The Whip'
  ];

  const TITLE_DOMAIN = [
    'Minor', 'Unserious', 'Overlooked', 'Domestic', 'Niche',
    'Forgotten', 'Municipal', 'Questionable', 'Ornamental',
    'Interior', 'Lesser', 'Provincial', 'Tertiary',
    'Mildly Illegal', 'Peripheral', 'Footnote',
    'Quietly Important', 'Emotionally Charged', 'Vaguely Cursed',
    'Unofficial', 'Under-documented', 'Incidental'
  ];

  const ERA_ADJ = [
    'Long', 'Damp', 'Shimmering', 'Unbothered', 'Drafty',
    'Fluorescent', 'Velvet', 'Second', 'Minor', 'Sleepless',
    'Post-Lunch', 'Mahogany', 'Spring-Clean', 'Off-Brand',
    'Unmarked', 'Low-Lit', 'Tuesday', 'Slightly Humid',
    'Freshly-Laundered', 'Overcast', 'Cafeteria', 'Softly-Lit'
  ];

  const ERA_NOUN = [
    'Epoch', 'Interregnum', 'Reign', 'Quarter', 'Age',
    'Tenure', 'Dynasty', 'Fiscal Year', 'Season',
    'Administration', 'Sabbatical', 'Advent', 'Interval',
    'Residency', 'Commencement', 'Semester'
  ];

  const SAINT_FIRST = [
    'Saint Agnes', 'Saint Bernard', 'Saint Clotilde', 'Saint Dymphna',
    'Saint Eulalia', 'Saint Fiacre', 'Saint Gertrude', 'Saint Hildegard',
    'Saint Isidore', 'Saint Jude', 'Saint Kevin', 'Saint Lidwina',
    'Saint Mungo', 'Saint Nestor', 'Saint Odile', 'Saint Pelagia',
    'Saint Quirinus', 'Saint Rita', 'Saint Swithun', 'Saint Thecla',
    'Saint Ursula', 'Saint Valentina', 'Saint Walburga', 'Saint Yolanda',
    'Saint Zita'
  ];

  const SAINT_OF = [
    'of Lost Receipts', 'of Small Frustrations', 'of Damp Matches',
    'of the Second Drawer', 'of Misremembered Lyrics', 'of Mild Opinions',
    'of the Unread Group Chat', 'of the Slightly-Wrong Shade',
    'of Expired Coupons', 'of the Breakroom', 'of Uneven Hems',
    'of the Final Slice', 'of Borrowed Pens', 'of Parking Geometry',
    'of the Fitted Sheet', 'of Tuesday Afternoon', 'of the Back Row',
    'of Snacks That Broke', 'of the Thermostat', 'of the Missing Lid',
    'of Quiet Feuds', 'of the Side Door', 'of the Second Attempt',
    'of Impulse Returns', 'of Perfectly Aligned Things',
    'of the Unfinished Sentence'
  ];

  // Emcee speech templates — two sentences each. {k} = keyword, {K} = Title-Cased keyword, {title} = awarded title
  const SPEECH_TEMPLATES = [
    "Ladies, gentlemen, and the rest of the Committee — at last, somebody took the matter of {k} seriously, and we are frankly relieved. By the authority vested in this drafty hall, we acknowledge {title}, and we ask the world to please keep its voice down while they work.",
    "We have waited decades for a {k} person of this caliber, and tonight, inexcusably late, we have found one. Let the minutes show that {title} arrived, nodded once, and made everyone else look like a dilettante.",
    "In a century hostile to specificity, {title} has the audacity to care — loudly, and about {k}, of all things. The Committee is moved; the Committee is also slightly embarrassed it did not notice sooner.",
    "Some are called to great causes; others are called to {k}, and we must say the latter is so much harder to sustain. To {title}: welcome, sit up front, and please do not be humble about this.",
    "The honor for {k} has historically gone unclaimed, because most people cannot be bothered. Tonight that ends, because {title} is here, and they have receipts, opinions, and a preferred chair.",
    "It is the Committee's deepest pleasure to induct a specialist in {k} — a field we admit we have long under-funded. From this moment forward, {title} holds the gavel, the archive, and, frankly, the moral high ground.",
    "We will not pretend {k} is a popular calling; we will simply note that it is now, at minimum, a credentialed one. Rise, {title}, and know that the plaque is being engraved as we speak — probably slightly off-center, as is tradition."
  ];

  // Fellow inductees for the daily rival — short absurd specialties.
  const DAILY_RIVALS = [
    "The Deputy Minister of Unevenly Folded Towels",
    "The Honorable Auditor of Elevator Silence",
    "The First Consul of Grocery Bag Origami",
    "The Inspector General of Cold Fries",
    "The Keeper of Mildly Suspicious Sounds in Old Houses",
    "The Registrar of Remote Control Button Wear",
    "The Prefect of Refrigerator Light Etiquette",
    "The Commissioner of Stairwell Posture",
    "The Arbiter of Acceptable Microwave Beep Volumes",
    "The Grand Duchess of Coat-Rack Diplomacy",
    "The Warden of the Third-Best Park Bench",
    "The Provost of Highway Exit Anxiety",
    "The Chancellor of Receipt Folding",
    "The Minister of Distantly-Heard Power Tools",
    "The Patron of Slightly-Too-Warm Drinking Water",
    "The Reverend of Predawn Bird Complaints",
    "The Steward of the Correct Number of Ice Cubes",
    "The Magistrate of Cafeteria Tray Choreography",
    "The Curator of Dishwasher Top-Rack Geography",
    "The Viceroy of Bathroom Fan Ambience",
    "The Herald of Shoes Pretending to Still Be Fine",
    "The Matron of Bus Window Condensation",
    "The Envoy of Plastic Bag Drawer Governance",
    "The Sub-Deputy of Email Subject-Line Punctuation",
    "The Prelate of Crumb Distribution at Breakfast",
    "The Doyenne of Gift Bag Reuse Ethics",
    "The Ombudsperson of the Household Tape Shortage",
    "The Brigadier of Lid-to-Container Ratios",
    "The Foreperson of Correct Blanket Weights",
    "The Quartermaster of Snack Drawer Geopolitics",
    "The Hereditary Judge of Parking Lot Body Language",
    "The Archivist of Childhood Cereal Mascots",
    "The Marquis of Mildly Incorrect Song Titles",
    "The Secretary of Pen-Cap Reunification",
    "The Patron Saint of the Almost-Finished To-Do List",
    "The Prefect of Hotel Hallway Carpet Criticism"
  ];

  const LOADING_LINES = [
    "convening the Committee...",
    "dusting the ceremonial gavel...",
    "locating an emcee who is sober enough...",
    "engraving your plaque, slightly off-center...",
    "asking the archivist to please stop crying...",
    "verifying your obsession against the ledger..."
  ];

  const ERROR_LINES = [
    "the Committee needs a specialty to consider — type something.",
    "a blank petition is grounds for a mistrial. please enter a passion.",
    "even the smallest obsession must be named. try again."
  ];

  // ---------- build the induction ----------
  function buildInduction(raw) {
    const norm = normalize(raw);
    const seed = hash(norm);
    const kwRaw = keyword(norm);
    const k = kwRaw.toLowerCase();
    const K = titleCase(kwRaw);

    const rank = pick(TITLE_RANK, seed);
    const domain = pick(TITLE_DOMAIN, Math.floor(seed / 7));
    const title = `${rank} of ${domain} ${K}`;

    // Era: "The {adj} {noun} of {YEAR}–{YEAR+span}" with deterministic dates
    const eraAdj = pick(ERA_ADJ, Math.floor(seed / 13));
    const eraNoun = pick(ERA_NOUN, Math.floor(seed / 19));
    const startYear = 1873 + (seed % 140);              // 1873..2012
    const span = 3 + (Math.floor(seed / 23) % 28);      // 3..30 years
    const endYear = startYear + span;
    const era = `The ${eraAdj} ${eraNoun} of ${startYear}–${endYear}`;

    const patron = `${pick(SAINT_FIRST, Math.floor(seed / 29))} ${pick(SAINT_OF, Math.floor(seed / 31))}`;

    const tmpl = pick(SPEECH_TEMPLATES, Math.floor(seed / 37));
    const speech = tmpl.replace(/\{k\}/g, k).replace(/\{K\}/g, K).replace(/\{title\}/g, title);

    // Daily rival — seeded by the UTC date, everyone gets the same one today
    const now = new Date();
    const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
    const rival = pick(DAILY_RIVALS, hash(dateKey));

    return { subject: raw.trim(), title, era, patron, speech, rival };
  }

  // ---------- rendering ----------
  function render(data) {
    subjectEl.textContent = `"${data.subject}"`;
    titleEl.textContent = data.title;
    eraEl.textContent = data.era;
    patronEl.textContent = data.patron;
    speechEl.textContent = data.speech;
    rivalEl.textContent = data.rival;
    document.title = `${data.title} — Niche Hall of Fame`;
  }

  function show(section) {
    intake.hidden = section !== 'intake';
    loading.hidden = section !== 'loading';
    certificate.hidden = section !== 'certificate';
  }

  function doInduction(raw) {
    const data = buildInduction(raw);

    // Encode in the URL fragment so the certificate is shareable
    try {
      const payload = btoa(unescape(encodeURIComponent(raw.trim())));
      history.replaceState(null, '', `#p=${payload}`);
    } catch (_) { /* noop */ }

    const loadSeed = hash(normalize(raw));
    loadingMsg.textContent = pick(LOADING_LINES, loadSeed);
    show('loading');

    setTimeout(() => {
      render(data);
      show('certificate');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 900);
  }

  // ---------- events ----------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value || '';
    if (!raw.trim()) {
      errorEl.textContent = pick(ERROR_LINES, hash(String(Date.now())));
      input.focus();
      return;
    }
    errorEl.textContent = '';
    doInduction(raw);
  });

  if (againBtn) {
    againBtn.addEventListener('click', () => {
      history.replaceState(null, '', location.pathname);
      input.value = '';
      show('intake');
      setTimeout(() => input.focus(), 50);
    });
  }

  // ---------- hydrate from URL fragment ----------
  function tryHydrateFromHash() {
    const m = location.hash.match(/p=([^&]+)/);
    if (!m) return false;
    try {
      const raw = decodeURIComponent(escape(atob(m[1])));
      if (!raw.trim()) return false;
      input.value = raw;
      const data = buildInduction(raw);
      render(data);
      show('certificate');
      return true;
    } catch (_) {
      return false;
    }
  }

  if (!tryHydrateFromHash()) {
    show('intake');
  }
})();

// Share API (spec requires this exact pattern)
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied!'));
  }
}
