// The Probate of an Imaginary Stranger — fully deterministic, no LLM.
// Slug: probate-imaginary-stranger

// ---------- DETERMINISTIC HASH ----------
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---------- 20 OBJECTS ----------
// Each item: id, icon (emoji), shortName (used in lists/clerk note),
// fullName (used as lot description on the document), appraisal (the absurd appraisal line),
// room (kitchen|living|bedroom|bath|hallway), x, y (position in apartment, px)
const ITEMS = [
  { id: "tin",       icon: "🍬", shortName: "tin of mints",            fullName: "One (1) Tin, Decorative, Containing Six (6) Mints, Petrified",                  appraisal: "est. value $0.18, mints non-edible per Statute 9.4(a)",                                  room: "kitchen",  x: 64,  y: 70 },
  { id: "crossword", icon: "📰", shortName: "half-finished crossword", fullName: "One (1) Crossword Puzzle, 56% Complete, Pen-Marked, Stained",                  appraisal: "est. value $0.05, decedent erred at 14-Across",                                          room: "kitchen",  x: 200, y: 60 },
  { id: "sock",      icon: "🧦", shortName: "velvet sock",             fullName: "One (1) Sock, Velvet, Burgundy, Size Indeterminate, Unmatched",               appraisal: "est. value $0.40, suspected sentimental significance",                                   room: "bedroom",  x: 460, y: 80 },
  { id: "cassette",  icon: "📼", shortName: "cassette labeled 'DO NOT'", fullName: "One (1) Audio Cassette, Side A Labeled \"DO NOT,\" Side B Blank",            appraisal: "est. value $1.00, contents unplayed pending court order",                                room: "living",   x: 290, y: 200 },
  { id: "owl",       icon: "🦉", shortName: "brass owl",               fullName: "One (1) Figurine, Brass, Owl, Heavy at the Base",                              appraisal: "est. value $7.50, eyes do appear to follow the appraiser",                               room: "living",   x: 380, y: 260 },
  { id: "novels",    icon: "📚", shortName: "stack of romance novels", fullName: "Twelve (12) Mass-Market Novels, Genre: Romance, All Bookmarks at Page 73",     appraisal: "est. value $4.00, none read past the cliffhanger",                                       room: "bedroom",  x: 540, y: 230 },
  { id: "compass",   icon: "🧭", shortName: "broken compass",          fullName: "One (1) Compass, Brass, Needle Affixed Permanently to NORTH-NORTHWEST",        appraisal: "est. value $2.25, deemed sentimental, navigationally invalid",                           room: "living",   x: 220, y: 280 },
  { id: "key",       icon: "🔑", shortName: "single unlabeled key",    fullName: "One (1) Key, Brass, Worn, Bearing No Identifying Mark or Lock-of-Origin",     appraisal: "est. value $0.10, lock of origin unknown to the State",                                  room: "hallway",  x: 305, y: 110 },
  { id: "kettle",    icon: "🫖", shortName: "copper kettle",           fullName: "One (1) Kettle, Copper, Polished, Spout Slightly Bent",                        appraisal: "est. value $14.00, shows a face when held at correct angle",                             room: "kitchen",  x: 130, y: 140 },
  { id: "letter",    icon: "✉️", shortName: "unmailed letter",         fullName: "One (1) Letter, Sealed, Addressee \"M.,\" Stamp Unaffixed",                    appraisal: "est. value $0.05, addressee never identified, may not exist",                            room: "bedroom",  x: 580, y: 130 },
  { id: "ferret",    icon: "🐾", shortName: "ferret figurine",         fullName: "One (1) Figurine, Ceramic, Ferret, Glazed Mid-Lunge",                          appraisal: "est. value $3.20, alarm-inducing per junior clerk's note",                               room: "living",   x: 460, y: 320 },
  { id: "lamp",      icon: "🪔", shortName: "lamp with mismatched bulb", fullName: "One (1) Table Lamp, Original Bulb Replaced With One (1) Refrigerator Bulb", appraisal: "est. value $11.00, fixture functions; legality of bulb pending review",                  room: "living",   x: 140, y: 220 },
  { id: "stamps",    icon: "📮", shortName: "album of foreign stamps", fullName: "One (1) Album, Postage Stamps, Foreign, Eight (8) Nations, Three (3) Defunct", appraisal: "est. value $22.00, three nations no longer recognized by the State",                     room: "bedroom",  x: 470, y: 180 },
  { id: "teeth",     icon: "🦷", shortName: "spare set of dentures",   fullName: "One (1) Dental Prosthetic, Upper, Stored in Cup Marked \"WORLD'S OKAYEST DAD\"", appraisal: "est. value $40.00, cup is also part of estate, sold separately",                         room: "bath",     x: 80,  y: 380 },
  { id: "almanac",   icon: "📖", shortName: "1987 farmer's almanac",   fullName: "One (1) Farmer's Almanac, 1987, Annotations in Three (3) Distinct Hands",     appraisal: "est. value $1.75, predictions verified at 31% accuracy",                                 room: "living",   x: 240, y: 360 },
  { id: "mug",       icon: "☕", shortName: "mug of fossilized tea",   fullName: "One (1) Ceramic Mug, Contents: Tea, Estimated 11 Months Old, Now Solid",      appraisal: "est. value $0.75, contents reclassified as flooring",                                    room: "kitchen",  x: 70,  y: 220 },
  { id: "moth",      icon: "🦋", shortName: "shadowbox of moths",      fullName: "One (1) Shadowbox, Glass, Containing Six (6) Mounted Moths, Two Unidentified",appraisal: "est. value $18.00, two specimens unknown to lepidopterists consulted",                   room: "hallway",  x: 410, y: 130 },
  { id: "razor",     icon: "🪒", shortName: "ivory-handled razor",     fullName: "One (1) Straight Razor, Ivory Handle, Initials \"J.W.\" Not Decedent's",      appraisal: "est. value $30.00, initials suggest second party of interest",                           room: "bath",     x: 175, y: 410 },
  { id: "ticket",    icon: "🎟️", shortName: "1973 ferry stub",        fullName: "One (1) Ferry Ticket Stub, Dated 04-AUG-1973, Route Discontinued",            appraisal: "est. value $0.10, ferry route abandoned, cause: indifference",                           room: "bedroom",  x: 395, y: 200 },
  { id: "harmonica", icon: "🎵", shortName: "rusted harmonica",        fullName: "One (1) Harmonica, Key of C, Three (3) Reeds Inoperable",                     appraisal: "est. value $5.00, plays only the saddest four (4) notes",                                room: "living",   x: 350, y: 360 }
];

// ---------- 24 ARCHETYPES ----------
const ARCHETYPES = [
  { name: "The Lapsed Watercolorist",        flavor: "Painted seven good Tuesdays, then twelve bad ones, then never again." },
  { name: "The Nautical Insurance Agent",    flavor: "Insured boats. Did not own, ride, or trust boats. Filed paperwork by lamplight." },
  { name: "The Reluctant Confidant",         flavor: "Knew everyone's secrets. Kept them. Resented being chosen as the keeper." },
  { name: "The Almanac Skeptic",             flavor: "Read predictions. Disagreed with them. Wrote angry rebuttals in the margins." },
  { name: "The Off-Season Lighthouse Keeper", flavor: "Tended a light no boat used anymore. Made tea. Read romance. Thought about it." },
  { name: "The Failed Saxophonist",          flavor: "Owned the wrong instruments and the right kind of regret." },
  { name: "The Suburban Cryptographer",      flavor: "Wrote in a code only the deceased understood. Did not leave the key." },
  { name: "The Disinherited Heir",           flavor: "Was supposed to inherit something. Did not. Kept the receipts of nearly-having." },
  { name: "The Provincial Cartographer",     flavor: "Mapped a six-block radius with cathedral precision. Refused to leave it." },
  { name: "The Apothecary's Widow",          flavor: "Outlived a chemist. Kept their handwriting. Threw out their tinctures." },
  { name: "The Civic-Minded Recluse",        flavor: "Voted in every local election. Did not speak to neighbors. Disapproved of all of them." },
  { name: "The Retired Foley Artist",        flavor: "Made the sounds of footsteps for films. Walked very softly themselves." },
  { name: "The Amateur Lepidopterist",       flavor: "Loved moths better than people. Was, for the record, correct to." },
  { name: "The Devout Crossword Solver",     flavor: "Believed clues and answers should be a kind of prayer. Skipped Wednesdays." },
  { name: "The Estranged Twin",              flavor: "Half of a pair. Carried two sets of everything. Had not seen the other in years." },
  { name: "The Failed Innkeeper",            flavor: "Bought a house with too many rooms. Filled them with strangers' belongings, then left." },
  { name: "The Postman's Pen-Pal",           flavor: "Corresponded for thirty years with someone they never met. Filed it under 'M.'" },
  { name: "The Forgetful Locksmith",         flavor: "Made keys for a living. Lost the one to their own life by a different door." },
  { name: "The Off-Duty Cartomancer",        flavor: "Read futures professionally; refused to read their own. Believed it was rude." },
  { name: "The Disgraced Choirmaster",       flavor: "Knew every hymn. Was politely uninvited from singing them in public." },
  { name: "The Subletter of Subletters",     flavor: "Lived in a long chain of borrowed rooms. Owned almost nothing. Kept the receipts." },
  { name: "The Quiet Inventor of Nothing",   flavor: "Spent decades perfecting a device. Refused to specify its purpose. Did not finish." },
  { name: "The Patron Saint of Returns",     flavor: "Brought everything back. Books, gifts, decisions. Kept only what could not be returned." },
  { name: "The Lifelong Amateur",            flavor: "Practiced many crafts; mastered none. Was at peace about it on most Sundays." }
];

// ---------- ROOMS (apartment 640x480) ----------
// Layout sketch:
//  ┌────────────────────────────────┐
//  │   KITCHEN  │  HALLWAY │ BEDROOM│
//  ├────────────┴──────────┴────────┤
//  │  BATHROOM  │      LIVING ROOM  │
//  └────────────────────────────────┘
const ROOMS = [
  { id: "kitchen", label: "KITCHEN",     x:   0, y:   0, w: 280, h: 180, a: "#b8a070", b: "#a08858" },
  { id: "hallway", label: "HALLWAY",     x: 280, y:   0, w: 100, h: 180, a: "#a89a78", b: "#988866" },
  { id: "bedroom", label: "BEDROOM",     x: 380, y:   0, w: 260, h: 280, a: "#a89070", b: "#907858" },
  { id: "bath",    label: "BATHROOM",    x:   0, y: 320, w: 200, h: 160, a: "#90a098", b: "#7a8a82" },
  { id: "living",  label: "LIVING ROOM", x: 100, y: 180, w: 540, h: 300, a: "#b09870", b: "#988058" }
];

// ---------- STATE ----------
const MAX_PICKS = 7;
let picks = []; // array of item ids in order picked

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

// ---------- APARTMENT RENDER ----------
function renderApartment() {
  const apt = $("apartment");
  apt.innerHTML = "";

  // rooms
  for (const r of ROOMS) {
    const el = document.createElement("div");
    el.className = "room";
    el.style.left = r.x + "px";
    el.style.top = r.y + "px";
    el.style.width = r.w + "px";
    el.style.height = r.h + "px";
    el.style.setProperty("--room-a", r.a);
    el.style.setProperty("--room-b", r.b);
    apt.appendChild(el);

    const lbl = document.createElement("div");
    lbl.className = "room-label";
    lbl.textContent = r.label;
    lbl.style.left = (r.x + 6) + "px";
    lbl.style.top = (r.y + 6) + "px";
    apt.appendChild(lbl);
  }

  // items
  for (const item of ITEMS) {
    const el = document.createElement("button");
    el.className = "item";
    el.type = "button";
    el.dataset.id = item.id;
    el.style.left = item.x + "px";
    el.style.top = item.y + "px";
    el.title = item.shortName;
    el.setAttribute("aria-label", "Pick " + item.shortName);
    el.textContent = item.icon;
    el.addEventListener("click", () => togglePick(item.id));
    apt.appendChild(el);
  }
}

// ---------- PICK MGMT ----------
function togglePick(id) {
  const idx = picks.indexOf(id);
  if (idx >= 0) {
    picks.splice(idx, 1);
  } else {
    if (picks.length >= MAX_PICKS) {
      flashMessage("Only seven (7) items, by statute.");
      return;
    }
    picks.push(id);
  }
  refreshPicks();
}

function refreshPicks() {
  $("picks-count").textContent = picks.length;
  // update item visuals
  document.querySelectorAll(".item").forEach((el) => {
    const id = el.dataset.id;
    const idx = picks.indexOf(id);
    el.classList.toggle("picked", idx >= 0);
    // remove existing badge
    const oldBadge = el.querySelector(".num-badge");
    if (oldBadge) oldBadge.remove();
    if (idx >= 0) {
      const badge = document.createElement("span");
      badge.className = "num-badge";
      badge.textContent = String(idx + 1);
      el.appendChild(badge);
    }
  });

  // list
  const list = $("picks-list");
  list.innerHTML = "";
  picks.forEach((id) => {
    const item = ITEMS.find((x) => x.id === id);
    if (!item) return;
    const li = document.createElement("li");
    li.textContent = item.icon + " " + item.shortName + " — tap to remove";
    li.addEventListener("click", () => togglePick(id));
    list.appendChild(li);
  });

  $("file-btn").disabled = picks.length !== MAX_PICKS;
}

let flashTimer = null;
function flashMessage(msg) {
  const bar = document.querySelector(".picks-bar");
  if (!bar) return;
  const oldNote = bar.querySelector(".flash-note");
  if (oldNote) oldNote.remove();
  const span = document.createElement("span");
  span.className = "flash-note";
  span.style.cssText = "color:var(--carbon-red);margin-left:8px;font-size:11px;letter-spacing:.08em;";
  span.textContent = msg;
  bar.appendChild(span);
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => span.remove(), 1800);
}

// ---------- VERDICT (deterministic from picks) ----------
function pickKey() {
  // sorted so order doesn't matter for the verdict — same SET → same archetype
  return picks.slice().sort().join("|");
}

function chooseArchetype() {
  const key = pickKey();
  return ARCHETYPES[hash(key) % ARCHETYPES.length];
}

// ---------- CASE NUMBER ----------
function caseNumber() {
  const key = pickKey();
  if (!key) return "—";
  const h = hash(key);
  // format like "2026-OPT-04812"
  const part1 = "2026";
  const part2 = "OPT";
  const part3 = String(h % 100000).padStart(5, "0");
  return `${part1}-${part2}-${part3}`;
}

// ---------- CLERK'S NOTE ----------
// 4-line procedural note that cites 2-3 of the user's picks by name.
// All deterministic, no LLM.
const CLERK_OPENERS = [
  (a) => `The decedent kept ${a.shortName} where it could be seen on entry.`,
  (a) => `Of all things, ${a.shortName} drew the appraiser's eye first.`,
  (a) => `Per the inspecting clerk: the ${a.shortName} was not where one expects to find ${a.shortName}.`,
  (a) => `It is the opinion of this office that ${a.shortName} was the heart of the apartment.`,
  (a) => `The ${a.shortName} was not dusty. This is recorded.`,
  (a) => `One does not, in this work, often encounter ${a.shortName} so deliberately placed.`
];
const CLERK_MIDDLES = [
  (a, b) => `That it was found near ${b.shortName} is a coincidence the office declines to interpret.`,
  (a, b) => `Beside it, ${b.shortName} — kept, evidently, with equal care.`,
  (a, b) => `That ${b.shortName} sat across the room is, the office concedes, a small biography in itself.`,
  (a, b) => `Near to it, the ${b.shortName}: a second item of equivalent emotional weight.`,
  (a, b) => `The clerk notes that ${b.shortName} was found in a separate room and yet, somehow, of a piece with the first.`,
  (a, b) => `Filed alongside ${b.shortName}, which we shall not pretend to understand.`
];
const CLERK_THIRDS = [
  (c) => `The ${c.shortName} we will say nothing about, except that it was retained.`,
  (c) => `As to the ${c.shortName} — the office defers comment.`,
  (c) => `The ${c.shortName} is, we suspect, a private matter.`,
  (c) => `A ${c.shortName} was also present and is duly noted, without further remark.`,
  (c) => `The ${c.shortName} we record by name only.`,
  (c) => `Re: the ${c.shortName} — the office prefers silence.`
];
const CLERK_CLOSERS = [
  () => `The estate is hereby settled. The decedent is hereby deemed.`,
  () => `Pursuant to statute, this office has done its imagining and rests.`,
  () => `The matter is closed. Let the door be locked behind us.`,
  () => `It is, in our considered view, sufficient. It will have to be.`,
  () => `Filed without further inquiry, with all the dignity available to this office.`,
  () => `So concludes our acquaintance with the decedent, whom we never met.`
];

function clerkNote() {
  const items = picks.map((id) => ITEMS.find((x) => x.id === id));
  const key = pickKey();
  const seed = hash(key);
  const a = items[seed % items.length];
  const b = items[(seed + 3) % items.length];
  const c = items[(seed + 5) % items.length];

  const l1 = CLERK_OPENERS[seed % CLERK_OPENERS.length](a);
  const l2 = CLERK_MIDDLES[(seed >> 1) % CLERK_MIDDLES.length](a, b !== a ? b : items[(seed + 1) % items.length]);
  const l3 = CLERK_THIRDS[(seed >> 2) % CLERK_THIRDS.length](c !== a && c !== b ? c : items[(seed + 2) % items.length]);
  const l4 = CLERK_CLOSERS[(seed >> 3) % CLERK_CLOSERS.length]();
  return `${l1}\n${l2}\n${l3}\n${l4}`;
}

// ---------- RESULT RENDER ----------
function renderResult() {
  // case number
  const caseNo = caseNumber();
  $("case-no").textContent = caseNo;
  document.querySelectorAll(".case-no-out").forEach((el) => (el.textContent = caseNo));

  // lots
  const lots = $("lots-list");
  lots.innerHTML = "";
  picks.forEach((id, i) => {
    const item = ITEMS.find((x) => x.id === id);
    if (!item) return;
    const li = document.createElement("li");
    const lotNo = "LOT " + String(i + 1).padStart(2, "0");
    li.innerHTML =
      `<span class="lot-no">${lotNo} —</span>` +
      `<span class="lot-text">${escapeHtml(item.fullName)}, <em>${escapeHtml(item.appraisal)}</em>.</span>` +
      `<span class="lot-icon">${item.icon}</span>`;
    lots.appendChild(li);
  });

  // verdict
  const arch = chooseArchetype();
  $("verdict-name").textContent = arch.name;
  $("verdict-flavor").textContent = arch.flavor;

  // clerk note
  $("clerk-note").textContent = clerkNote();

  // filed date — today's date in stamp format
  const d = new Date();
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  $("filed-date").textContent = `${String(d.getDate()).padStart(2,"0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- SCREEN MGMT ----------
function showScreen(id) {
  ["briefing", "apartment-screen", "filing", "result-screen"].forEach((s) => {
    $(s).classList.toggle("hidden", s !== id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- FILING ANIMATION ----------
const FILING_LINES = [
  "verifying chain of title under Section 14(b)…",
  "stamping carbon copies in triplicate…",
  "consulting Algorithm 14-Q for identity determination…",
  "calling the appraiser back from lunch…",
  "locating a notary, any notary…",
  "folding the document into thirds, by hand…"
];

function runFilingThenResult() {
  showScreen("filing");
  const txt = $("filing-text");
  let i = 0;
  txt.textContent = FILING_LINES[0];
  const interval = setInterval(() => {
    i++;
    if (i < FILING_LINES.length) {
      txt.textContent = FILING_LINES[i];
    }
  }, 420);
  setTimeout(() => {
    clearInterval(interval);
    renderResult();
    updateUrlFragment();
    showScreen("result-screen");
  }, 2400);
}

// ---------- URL FRAGMENT ----------
// fragment encodes the picks order:  #i:tin,sock,owl,...
function updateUrlFragment() {
  const frag = "i:" + picks.join(",");
  if (location.hash !== "#" + frag) {
    history.replaceState(null, "", "#" + frag);
  }
}

function loadFromFragment() {
  const h = location.hash || "";
  if (!h.startsWith("#i:")) return false;
  const ids = h.slice(3).split(",").map(decodeURIComponent).filter(Boolean);
  const valid = ids.filter((id) => ITEMS.some((x) => x.id === id));
  // dedupe preserving order
  const seen = new Set();
  const cleaned = [];
  for (const id of valid) {
    if (!seen.has(id)) { seen.add(id); cleaned.push(id); }
  }
  if (cleaned.length === MAX_PICKS) {
    picks = cleaned;
    return true;
  }
  return false;
}

// ---------- SHARE ----------
function share() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert("Link copied! Send this case file to a witness."))
      .catch(() => prompt("Copy this case-file link:", location.href));
  }
}
window.share = share;

// ---------- INIT ----------
function init() {
  renderApartment();

  $("enter-btn").addEventListener("click", () => {
    showScreen("apartment-screen");
  });

  $("undo-btn").addEventListener("click", () => {
    if (picks.length === 0) return;
    picks.pop();
    refreshPicks();
  });

  $("file-btn").addEventListener("click", () => {
    if (picks.length !== MAX_PICKS) return;
    runFilingThenResult();
  });

  $("restart-btn").addEventListener("click", () => {
    picks = [];
    history.replaceState(null, "", location.pathname);
    refreshPicks();
    showScreen("briefing");
  });

  // Replay from URL fragment
  if (loadFromFragment()) {
    refreshPicks();
    renderResult();
    showScreen("result-screen");
    return;
  }

  refreshPicks();
  showScreen("briefing");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
