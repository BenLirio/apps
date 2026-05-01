// Hard Launch My Mundane — soft-launch carousel generator
// One mechanic: 4 inputs in -> 4-card polaroid carousel out, deterministic + shareable.

const AI_ENDPOINT = "https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai";
const CASE_STORE = "https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com";
const SLUG = "hard-launch-my-mundane";
const FRAGMENT_LIMIT = 100; // any longer -> use case-store

// -------- deterministic hash --------
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// stable per-card seed
function seedFor(input, idx) {
  return hash(input.toLowerCase().trim() + "::" + idx);
}

// -------- idea pools (chip suggestions) --------
const POOLS = {
  snack: [
    "costco italian funeral meatball sub",
    "trader joe's everything bagel cream cheese",
    "a single boiled egg on rice",
    "the frozen mango from aldi",
    "lukewarm celsius",
    "an extremely specific bodega sandwich",
    "babybel cheese, post-3pm only",
    "a tube of crystal light packets",
  ],
  show: [
    "early-2000s british gardening reruns",
    "the great pottery throw down",
    "a 2009 housewives season i've already seen",
    "competitive jigsaw puzzle on youtube",
    "kitchen nightmares in chronological order",
    "a 14-hour twin peaks rewatch",
    "judge judy at 2x speed",
  ],
  playlist: [
    "only songs that mention a moon",
    "songs from sephora circa 2011",
    "country, but only the sad ones",
    "music for staring out a bus window",
    "mid-tempo songs with one accordion",
    "exclusively the bridges of ariana grande tracks",
    "songs my dad would call 'fine i guess'",
  ],
  hobby: [
    "learning to identify mosses",
    "researching submarines i'll never see",
    "very, very small crochet",
    "reading wikipedia about extinct mammals",
    "calligraphy for receipts only",
    "cataloguing every tote bag i own",
    "memorizing capitals of countries i can't visit",
  ],
};

// -------- card meta (theme, photo decoration) --------
const CARD_META = [
  { num: "01", role: "the snack",          label: "snack",        emojis: ["🍝","🥯","🥖","🥨","🥪","🍟","🥐","🧁","🍫","🥟","🌮","🍩"] },
  { num: "02", role: "the show",           label: "show",         emojis: ["📺","🎬","🍿","📼","🛋️","🎞️","📻","🎭"] },
  { num: "03", role: "the playlist",       label: "playlist",     emojis: ["🎧","💿","🎵","📻","🌙","🎶","🪩","🎙️"] },
  { num: "04", role: "the hyperfixation",  label: "hyperfixation",emojis: ["🔬","📚","🧶","🧭","🔭","🪴","🧩","✒️"] },
];
const BG_CLASSES = ["bg-sage","bg-rose","bg-butter","bg-dusk","bg-clay","bg-cream","bg-plum","bg-moss"];
const CARD_TILT = ["tilt-1","tilt-2","tilt-3","tilt-4"];

// fallback caption fragments (used if AI is rate-limited / errors)
const FALLBACK_INTROS = [
  "introducing &hellip; my new",
  "soft launching my new",
  "yes, i'm seeing someone &mdash; meet my new",
  "a soft launch i guess. my new",
  "introducing my latest situationship:",
  "happy to announce: my new",
];
const FALLBACK_LABELS = {
  snack:        ["boyfriend","situationship","crush","emotional support flame"],
  show:         ["partner","standing tuesday-night plans","comfort person","reason for not texting back"],
  playlist:     ["soulmate","walk-home companion","situationship","love language"],
  hyperfixation:["lover","co-conspirator","obsession","reason to live actually"],
};
const FALLBACK_CAPS = [
  "we're keeping it casual.",
  "no, i won't be tagging.",
  "yes, it's serious.",
  "the chemistry is insane.",
  "don't ask me if it's exclusive.",
  "it just gets me, you know?",
  "we met at the 24-hour cvs.",
  "i'm not ready to label it.",
];

// -------- photo art decorator --------
function photoArt(input, meta, seed) {
  const emoji = meta.emojis[seed % meta.emojis.length];
  return `<div class="photo-art"><span class="emoji">${emoji}</span></div>
          <div class="photo-stamp">${meta.label} &middot; ${dateStamp(seed)}</div>`;
}

function dateStamp(seed) {
  // pretend-shot-on date, deterministic from seed
  const m = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const month = m[seed % 12];
  const day = (seed % 27) + 1;
  return `${day} ${month}`;
}

// -------- caption composition --------
function fallbackCaption(input, meta, seed) {
  const intro = FALLBACK_INTROS[seed % FALLBACK_INTROS.length];
  const labels = FALLBACK_LABELS[meta.label];
  const label = labels[(seed >> 3) % labels.length];
  const tail  = FALLBACK_CAPS[(seed >> 6) % FALLBACK_CAPS.length];
  // reveal phrase = the actual input
  return {
    intro: `${intro} ${label},`,
    reveal: input,
    tail,
  };
}

// AI prompt: returns {captions: [{intro, reveal, tail}, ...]}
async function aiCaptions(things) {
  const prompt = [
    "You are writing the captions for a 4-card 'soft launch' Instagram carousel.",
    "Each card introduces one mundane object as the user's new romantic partner.",
    "Voice: flirty, lowercase, casual IG soft-launch energy. Self-aware, a little dry, a little horny in the harmless way. Lines should land like text-message captions, not jokes.",
    "Roast the THING (snack, show, playlist, hobby), never the user.",
    "For each card, write three short pieces, each <= 60 chars:",
    "  intro:  the soft-launch opener, ending in a comma. e.g. 'introducing... my new boyfriend,'",
    "  reveal: the EXACT thing the user typed, lowercased, no rewriting.",
    "  tail:   one short caption underneath, like 'we met at the freezer aisle.' or 'don't make it weird.'",
    "",
    "Cards:",
    `1. THE SNACK: ${things[0]}`,
    `2. THE SHOW: ${things[1]}`,
    `3. THE PLAYLIST: ${things[2]}`,
    `4. THE HYPERFIXATION: ${things[3]}`,
    "",
    "Return ONLY a JSON array of 4 objects with keys intro, reveal, tail. No markdown.",
  ].join("\n");

  const seedStr = things.map(t => t.toLowerCase().trim()).join("|");
  const cacheKey = "hlmm:caps:" + seedStr;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: SLUG,
        model: "gpt-5.4-mini",
        prompt,
        max_tokens: 600,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error("ai " + r.status);
    const data = await r.json();
    const txt = data.text || data.completion || data.output || "";
    const m = txt.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("no array");
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length !== 4) throw new Error("bad shape");
    const cleaned = arr.map((c, i) => ({
      intro: clamp(c.intro || "", 70),
      reveal: things[i], // never let AI replace the actual thing
      tail: clamp(c.tail || "", 80),
    }));
    try { localStorage.setItem(cacheKey, JSON.stringify(cleaned)); } catch(e){}
    return cleaned;
  } catch (e) {
    clearTimeout(t);
    return null;
  }
}
function clamp(s, n) { s = String(s).trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// -------- render --------
function renderCarousel(things, captions) {
  const container = document.getElementById("carousel");
  container.innerHTML = "";
  things.forEach((thing, i) => {
    const meta = CARD_META[i];
    const seed = seedFor(thing, i);
    const cap  = captions[i] || fallbackCaption(thing, meta, seed);
    const bg   = BG_CLASSES[seed % BG_CLASSES.length];
    const tilt = CARD_TILT[i];

    const el = document.createElement("article");
    el.className = `card ${tilt}`;
    el.innerHTML = `
      <span class="tape left"></span>
      <span class="tape right"></span>
      <div class="photo ${bg}">
        ${photoArt(thing, meta, seed)}
      </div>
      <div class="caption-block">
        <span class="card-num">${meta.num} &middot; ${meta.role}</span>
        <p class="card-caption">
          ${escapeHtml(cap.intro)} <span class="reveal">${escapeHtml(cap.reveal)}</span>.
          <br><em>${escapeHtml(cap.tail)}</em>
        </p>
      </div>
    `;
    container.appendChild(el);
  });

  const dots = document.getElementById("dots");
  dots.innerHTML = "";
  for (let i = 0; i < things.length; i++) {
    const p = document.createElement("span");
    p.className = "pip" + (i === 0 ? " active" : "");
    dots.appendChild(p);
  }
  // update active pip on scroll
  container.onscroll = () => {
    const w = container.clientWidth;
    const idx = Math.round(container.scrollLeft / w);
    [...dots.children].forEach((p, i) => p.classList.toggle("active", i === idx));
  };

  document.getElementById("receipt").textContent =
    `carousel id #${(seedFor(things.join("|"),99)).toString(36).slice(0,6)} · screenshot worthy`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

// -------- screen flow --------
const screens = {
  intro: document.getElementById("intro"),
  loading: document.getElementById("loading"),
  result: document.getElementById("result"),
};
function show(name) {
  for (const k in screens) screens[k].hidden = (k !== name);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const LOADING_LINES = [
  "putting the soft on the launch&hellip;",
  "developing the polaroids&hellip;",
  "crafting captions you'll regret posting&hellip;",
  "getting the lighting right&hellip;",
  "asking the group chat for permission&hellip;",
];

async function generate(things) {
  show("loading");
  const line = LOADING_LINES[hash(things.join("|")) % LOADING_LINES.length];
  document.getElementById("loading-line").innerHTML = line;

  const minDelay = new Promise(res => setTimeout(res, 800));
  const ai = aiCaptions(things);
  const [aiResult] = await Promise.all([ai, minDelay]);

  // build captions: AI for all if available, else fallback per-card
  let captions;
  if (aiResult && aiResult.length === 4) {
    captions = aiResult;
  } else {
    captions = things.map((t, i) => fallbackCaption(t, CARD_META[i], seedFor(t, i)));
  }

  renderCarousel(things, captions);
  show("result");
}

// -------- form --------
function readForm() {
  const t = id => document.getElementById(id).value.trim();
  return [t("thing1"), t("thing2"), t("thing3"), t("thing4")];
}
function setForm(things) {
  ["thing1","thing2","thing3","thing4"].forEach((id, i) => {
    document.getElementById(id).value = things[i] || "";
  });
}
function showError(msg) {
  const e = document.getElementById("error");
  e.textContent = msg;
  e.hidden = false;
  setTimeout(() => { e.hidden = true; }, 3500);
}

document.getElementById("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const things = readForm();
  if (things.some(t => !t)) {
    showError("hmm — give me all four. even the tiny one.");
    return;
  }
  await generate(things);
  await persistShare(things);
});

document.getElementById("reset").addEventListener("click", () => {
  // clear url
  history.replaceState(null, "", location.pathname);
  show("intro");
});

// chip suggestions
document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    const pool = POOLS[btn.dataset.pool] || [];
    if (!pool.length) return;
    const input = document.getElementById(target);
    const cur = input.value.trim();
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick === cur && pool.length > 1) pick = pool[(pool.indexOf(cur) + 1) % pool.length];
    input.value = pick;
    input.focus();
  });
});

// -------- share state (case-store w/ fragment fallback) --------
async function persistShare(things) {
  const payload = JSON.stringify(things);
  if (payload.length <= FRAGMENT_LIMIT) {
    history.replaceState(null, "", "#" + encodeURIComponent(payload));
    return;
  }
  // longer -> case-store
  try {
    const r = await fetch(CASE_STORE + "/case", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: SLUG, data: payload }),
    });
    if (!r.ok) throw new Error("post " + r.status);
    const { id } = await r.json();
    history.replaceState(null, "", "?c=" + id);
  } catch (e) {
    // fall back to fragment (recipient may get truncated link in iMessage)
    history.replaceState(null, "", "#" + encodeURIComponent(payload));
  }
}

async function loadCaseFromStore(id) {
  try {
    const r = await fetch(CASE_STORE + "/case/" + encodeURIComponent(id));
    if (!r.ok) return null;
    const { data } = await r.json();
    return data;
  } catch (e) { return null; }
}

async function hydrate() {
  const params = new URLSearchParams(location.search);
  const c = params.get("c");
  let payload = null;
  if (c) payload = await loadCaseFromStore(c);
  if (!payload && location.hash) {
    try { payload = decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) {}
  }
  if (!payload) return;
  let things;
  try { things = JSON.parse(payload); } catch (e) { return; }
  if (!Array.isArray(things) || things.length !== 4) return;
  if (things.some(t => typeof t !== "string" || !t.trim())) return;
  setForm(things);
  await generate(things);
}

// -------- share() handler — required by SKILL --------
function share() {
  const url = location.href;
  const title = "hard launch my mundane";
  const text = "soft-launching my four current obsessions. open it.";
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url)
      .then(() => alert("link copied — paste it where it matters."))
      .catch(() => prompt("copy this:", url));
  }
}

// boot
hydrate();
