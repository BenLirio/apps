// Heirloom Key-Cutter — pixel-art locksmith bench
// Six brass dials carve a key tooth-by-tooth. The day-seeded catalog of 30 fictional
// historic locks is matched against the user's single key profile.

const NUM_TEETH = 6;
const TEETH_STEPS = 10;        // dial 0..9
const NUM_LOCKS = 30;
const MATCH_THRESHOLD = 6;     // sum-of-absolute-distance must be <= this to "open"

// ===== DAILY SEED =====
function todayUtcKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayHumanLabel() {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// Mulberry32 — deterministic seedable PRNG
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickIdx(rng, n) { return Math.floor(rng() * n); }

// ===== LOCK NAME / PROVENANCE GENERATOR =====
// Building blocks for fictional historic lock names. The full universe is large enough
// that 30 picks/day for many days won't exhaust before novelty kicks in.

const PLACES = [
  "Pearl's Speakeasy", "the Lighthouse Keeper's Cabinet", "the Sealed Diplomatic Pouch",
  "Madame Volkova's Dressing Room", "the Dockmaster's Strongbox", "the Cartographer's Drawer",
  "the Rectory Wine Cellar", "the Apothecary's Poison Cabinet", "the Stationmaster's Safe",
  "the Magician's Trick Trunk", "the Editor's Locked Desk", "the Mortician's Side Room",
  "Hotel Esperance Suite 14", "the Conservatory Harpsichord Bench", "the Watchmaker's Lower Drawer",
  "the Foundling Hospital Records Room", "the Engraver's Plate Vault", "the Society of Skeptics' Ballot Box",
  "the Forger's False Mantle", "the Boatswain's Sea Chest", "the Confessor's Reliquary",
  "the Sleeping Car of the Silver Crescent Express", "the Telegrapher's Coded Drawer",
  "the Astronomer's Eyepiece Case", "the Smuggler's Floor Panel", "the Choirmaster's Robing Room",
  "the Embassy Cipher Cabinet", "the Sanitorium Pharmacy", "the Auctioneer's Ledger Box",
  "the Diving Bell Tool Locker", "the Cartomancer's Velvet Case", "the Court Stenographer's Drawer",
  "the Submarine Captain's Chart Tube", "the Newsroom Slush Drawer", "the Archduke's Hunting Lodge",
  "the Notary's Sealed Will Drawer", "the Curator's Cold Storage", "the Gambler's Hollow Heel",
  "the Headmistress's Punishment Book", "the Aviator's Goggle Case", "the Gravedigger's Tool Shed",
  "the Locksmith's Apprentice Drawer", "the Convent Almoner's Coffer", "the Detective's Evidence Locker",
  "the Tobacconist's Humidor", "the Vintner's Cellar Gate", "the Pawnbroker's Inner Vault",
  "the Sculptor's Plaster Mold Box", "the Falconer's Whistle Case", "the Painter's Pigment Cabinet"
];

const YEARS = [
  1842, 1857, 1863, 1871, 1879, 1884, 1887, 1891, 1895, 1899,
  1901, 1907, 1912, 1918, 1922, 1924, 1927, 1931, 1934, 1939,
  1942, 1947, 1953, 1958, 1962, 1966, 1971, 1976, 1981, 1989
];

const PROVENANCE_TEMPLATES = [
  "Sealed by ${owner} after ${event}; never opened in life.",
  "The original key was tossed into ${water} the morning of ${event}.",
  "${owner} swore on the registry it held nothing of value. The registry disagreed.",
  "Last opened the night ${event}; the room beyond has been quiet since.",
  "Rumored to contain ${contents}, though ${owner} would not confirm it.",
  "Cut from ${alloy} after the previous mechanism failed during ${event}.",
  "Catalogued by ${owner} as 'sentimental,' which the inventory clerk underlined twice.",
  "The mechanism was reversed in ${year2} on the orders of ${owner}.",
  "Said to whistle faintly when the wind comes off ${water}.",
  "Inherited by three generations and opened by none of them.",
  "Traded in lieu of a debt by ${owner}; the debt was never settled.",
  "Hidden behind ${hidden} until the renovation of ${year2}.",
  "Filed as evidence in the ${event}, then quietly returned.",
  "Built in ${year2} by an apprentice who signed the cylinder, then vanished.",
  "Said to hold ${contents} ${owner} could not bring themselves to discard.",
  "Misattributed to ${owner} for forty years; the real owner has not been named."
];

const OWNERS = [
  "the proprietor", "an unnamed cousin", "a junior clerk", "the night manager",
  "Madame Volkova", "the dowager", "the harbor priest", "an itinerant tutor",
  "the under-secretary", "the second-floor tenant", "an estate executor",
  "the youngest sister", "the disgraced auctioneer", "the choir's only contralto"
];
const EVENTS = [
  "the great fire", "the inquest", "the strike of '13", "the centenary banquet",
  "the diplomatic recall", "the typhoid quarantine", "the eviction notice",
  "the closure of the line", "the first telegraph delivery", "the false armistice",
  "the silent auction", "the funeral procession", "the hailstorm", "the elopement"
];
const WATERS = [
  "the harbor", "the millrace", "the bay", "the canal", "the cold tarn",
  "the river under the bridge", "the boatyard slip"
];
const CONTENTS = [
  "a single pressed marigold", "two letters in cipher", "a velvet pouch of teeth",
  "a phonograph cylinder, unlabeled", "a child's drawing of a horse", "a brass token from a closed lodge",
  "a single playing card", "a list of names with one struck through", "a bone-handled knife",
  "a betrothal ring with no inscription", "a passport in two names", "a cracked spectacles lens",
  "an unsent telegram", "a length of red ribbon"
];
const ALLOYS = ["heat-treated brass", "naval bronze", "low-carbon steel", "blackened iron", "soft pewter", "Sheffield silver"];
const HIDDENS = ["the wallpaper", "a false ledger", "a panel of trompe-l'oeil oak", "the loose floorboard", "the cistern lid", "a hollow Bible"];

function pickPlace(rng, used) {
  // Use without replacement within the day's catalog so no two locks share a name.
  let idx;
  let tries = 0;
  do {
    idx = pickIdx(rng, PLACES.length);
    tries++;
  } while (used.has(idx) && tries < 1000);
  used.add(idx);
  return PLACES[idx];
}

function fillTemplate(t, rng, year) {
  const year2 = YEARS[pickIdx(rng, YEARS.length)];
  return t
    .replace("${owner}", pick(rng, OWNERS))
    .replace("${event}", pick(rng, EVENTS))
    .replace("${water}", pick(rng, WATERS))
    .replace("${contents}", pick(rng, CONTENTS))
    .replace("${alloy}", pick(rng, ALLOYS))
    .replace("${hidden}", pick(rng, HIDDENS))
    .replace("${year2}", year2);
}

function generateCatalog(seedKey) {
  const rng = mulberry32(hashStr("catalog::" + seedKey));
  const used = new Set();
  const locks = [];
  for (let i = 0; i < NUM_LOCKS; i++) {
    const place = pickPlace(rng, used);
    const year = YEARS[pickIdx(rng, YEARS.length)];
    const template = pick(rng, PROVENANCE_TEMPLATES);
    const provenance = fillTemplate(template, rng, year);
    const teeth = Array.from({length: NUM_TEETH}, () => pickIdx(rng, TEETH_STEPS));
    locks.push({
      id: i,
      name: `${place}, ${year}`,
      year,
      provenance,
      teeth
    });
  }
  return locks;
}

// ===== MATCHING =====
function matchScore(keyTeeth, lockTeeth) {
  let s = 0;
  for (let i = 0; i < NUM_TEETH; i++) s += Math.abs(keyTeeth[i] - lockTeeth[i]);
  return s;
}

function testKey(keyTeeth, catalog) {
  return catalog.filter(lock => matchScore(keyTeeth, lock.teeth) <= MATCH_THRESHOLD);
}

// ===== STATE =====
const state = {
  teeth: Array(NUM_TEETH).fill(0),
  catalog: [],
  seedKey: todayUtcKey(),
  hasResult: false,
  opened: []
};

// ===== URL STATE =====
function teethToHash(teeth) {
  return "k" + teeth.join("");
}

function hashToTeeth(hash) {
  if (!hash || !hash.startsWith("#k")) return null;
  const digits = hash.slice(2);
  if (digits.length !== NUM_TEETH) return null;
  const out = [];
  for (let i = 0; i < NUM_TEETH; i++) {
    const d = parseInt(digits[i], 10);
    if (isNaN(d) || d < 0 || d >= TEETH_STEPS) return null;
    out.push(d);
  }
  return out;
}

// ===== KEY RENDERING (pixel art) =====
let canvas, ctx;

function renderKey() {
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  // Pixel-art logical canvas
  const PX_W = 160;
  const PX_H = 50;
  const SCALE = Math.min(W / PX_W, H / PX_H);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0d0904";
  ctx.fillRect(0, 0, W, H);

  const offX = (W - PX_W * SCALE) / 2;
  const offY = (H - PX_H * SCALE) / 2;

  function px(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(offX + x * SCALE, offY + y * SCALE, SCALE, SCALE);
  }
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(offX + x * SCALE, offY + y * SCALE, w * SCALE, h * SCALE);
  }

  const BRASS_LIGHT = "#f3d27a";
  const BRASS = "#c9963a";
  const BRASS_DARK = "#8a6418";
  const BRASS_SHADOW = "#5a3f0a";

  // Bow (round head of the key) on the left
  const bowCX = 22, bowCY = 25, bowR = 14;
  for (let y = -bowR; y <= bowR; y++) {
    for (let x = -bowR; x <= bowR; x++) {
      const d = Math.sqrt(x*x + y*y);
      if (d <= bowR && d >= bowR - 4) {
        const lx = bowCX + x, ly = bowCY + y;
        let color = BRASS;
        if (x < -2 && y < -2) color = BRASS_LIGHT;
        else if (x > 3 || y > 3) color = BRASS_DARK;
        if (d > bowR - 0.6) color = BRASS_SHADOW;
        px(lx, ly, color);
      }
    }
  }
  // Bow inner hole (decorative trefoil)
  for (let y = -3; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      if (x*x + y*y <= 9) {
        px(bowCX + x, bowCY + y, "#1a1208");
      }
    }
  }

  // Shaft of the key (top edge, blade body, bottom is teeth)
  const shaftStart = bowCX + bowR - 1;
  const shaftEnd = 152;
  const shaftLen = shaftEnd - shaftStart;
  const teethCount = NUM_TEETH;
  const teethStart = shaftStart + 8;
  const teethEnd = shaftEnd - 4;
  const toothW = Math.floor((teethEnd - teethStart) / teethCount);
  const shaftTopY = 22;
  const shaftBaseY = 28; // top of teeth row
  const teethMaxDepth = 14; // max downward extent in pixels

  // Top edge (smooth top spine)
  for (let x = shaftStart; x <= shaftEnd; x++) {
    rect(x, shaftTopY, 1, 1, BRASS_LIGHT);
    rect(x, shaftTopY + 1, 1, 1, BRASS);
    rect(x, shaftTopY + 2, 1, 1, BRASS);
    rect(x, shaftTopY + 3, 1, 1, BRASS);
    rect(x, shaftTopY + 4, 1, 1, BRASS_DARK);
    rect(x, shaftTopY + 5, 1, 1, BRASS_SHADOW);
  }

  // Decorative collar where bow meets shaft
  for (let y = 18; y <= 32; y++) {
    px(shaftStart + 1, y, BRASS_DARK);
    px(shaftStart + 2, y, BRASS_LIGHT);
    px(shaftStart + 3, y, BRASS_DARK);
  }

  // Tip
  for (let y = shaftTopY; y <= shaftTopY + 5; y++) {
    px(shaftEnd, y, BRASS_SHADOW);
  }

  // Teeth
  for (let i = 0; i < teethCount; i++) {
    const tooth = state.teeth[i]; // 0..9
    const depth = Math.round((tooth / (TEETH_STEPS - 1)) * teethMaxDepth);
    const tx0 = teethStart + i * toothW;
    const tx1 = tx0 + toothW - 1;
    for (let x = tx0; x < tx1; x++) {
      for (let dy = 0; dy < depth; dy++) {
        const y = shaftBaseY + dy;
        let color = BRASS;
        if (dy === 0) color = BRASS_LIGHT;
        else if (dy === depth - 1) color = BRASS_SHADOW;
        else if (x === tx0) color = BRASS_DARK;
        else if (x === tx1 - 1) color = BRASS_DARK;
        px(x, y, color);
      }
      // Inner shadow at tooth root
      if (depth > 0) px(x, shaftBaseY + depth, BRASS_SHADOW);
    }
    // Vertical separator line between teeth
    if (i > 0 && depth > 0) {
      for (let dy = 0; dy < depth; dy++) {
        px(tx0 - 1, shaftBaseY + dy, "#0d0904");
      }
    }
  }

  // Faint sparkle on bow
  px(bowCX - 7, bowCY - 6, "#fff6c8");
  px(bowCX - 6, bowCY - 6, "#fff6c8");

  // Engraved date on shaft (a tiny 3-pixel "stamp" feel)
  const stampY = shaftTopY + 2;
  for (let x = shaftStart + 12; x < shaftStart + 32; x += 3) {
    px(x, stampY, BRASS_SHADOW);
  }
}

// ===== DIAL UI =====
const DIAL_LABELS = ["BOW", "STEM", "WARD", "BIT", "PIN", "TIP"];

function buildDials() {
  const dialsEl = document.getElementById("dials");
  dialsEl.innerHTML = "";
  for (let i = 0; i < NUM_TEETH; i++) {
    const dial = document.createElement("div");
    dial.className = "dial";
    dial.innerHTML = `
      <div class="dial-label">${DIAL_LABELS[i]} ${String(i+1).padStart(2,'0')}</div>
      <div class="dial-value" id="dialv${i}">${state.teeth[i]}</div>
      <div class="dial-controls">
        <button class="dial-btn" data-dial="${i}" data-dir="-1" aria-label="${DIAL_LABELS[i]} down">&minus;</button>
        <button class="dial-btn" data-dial="${i}" data-dir="1" aria-label="${DIAL_LABELS[i]} up">+</button>
      </div>
    `;
    dialsEl.appendChild(dial);
  }
  dialsEl.addEventListener("click", onDialClick);
}

function onDialClick(e) {
  const btn = e.target.closest(".dial-btn");
  if (!btn) return;
  const i = parseInt(btn.dataset.dial, 10);
  const dir = parseInt(btn.dataset.dir, 10);
  const next = (state.teeth[i] + dir + TEETH_STEPS) % TEETH_STEPS;
  state.teeth[i] = next;
  document.getElementById("dialv" + i).textContent = next;
  updateReadout();
  renderKey();
  // Re-cutting after a result invalidates it
  if (state.hasResult) {
    document.getElementById("resultSection").hidden = true;
    state.hasResult = false;
  }
  // Update URL hash live (cheap; no history pollution)
  history.replaceState(null, "", "#" + teethToHash(state.teeth).slice(1));
}

function updateReadout() {
  document.getElementById("readout").textContent = state.teeth.join(" · ");
}

// ===== TEST FLOW =====
function testTheKey() {
  document.body.classList.add("testing");
  // Personality loading delay so the cut feels considered
  setTimeout(() => {
    document.body.classList.remove("testing");
    state.opened = testKey(state.teeth, state.catalog);
    state.hasResult = true;
    renderResult();
    const resultSection = document.getElementById("resultSection");
    resultSection.hidden = false;
    resultSection.scrollIntoView({behavior: "smooth", block: "start"});
  }, 850);
}

function scoreLabel(n) {
  if (n === 0) return "Not a single tumbler stirred.";
  if (n === 1) return "One lock surrendered. Just one.";
  if (n <= 3) return "A modest evening at the bench.";
  if (n <= 7) return "A keysmith's quiet pride.";
  if (n <= 14) return "An uncomfortably useful key.";
  if (n <= 22) return "Half the catalog fell silent.";
  if (n < 30) return "The custodians will have questions.";
  return "Every lock. Every one. Burn this key.";
}

function renderResult() {
  document.getElementById("provCuts").textContent = state.teeth.join(" · ");
  document.getElementById("provDate").textContent = `Catalog of ${todayHumanLabel()} (UTC)`;
  document.getElementById("provDate2").textContent = todayHumanLabel();
  document.getElementById("openedCount").textContent = state.opened.length;
  document.getElementById("scoreLabel").textContent = scoreLabel(state.opened.length);

  const list = document.getElementById("openedList");
  list.innerHTML = "";
  if (state.opened.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-row";
    li.textContent = "Nothing opened. Try a deeper bit, a softer pin. The brass is patient.";
    list.appendChild(li);
  } else {
    state.opened
      .slice()
      .sort((a, b) => a.year - b.year)
      .forEach(lock => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "lock-name";
        name.textContent = lock.name;
        const prov = document.createElement("span");
        prov.className = "lock-prov";
        prov.textContent = lock.provenance;
        li.appendChild(name);
        li.appendChild(prov);
        list.appendChild(li);
      });
  }
}

// ===== DOWNLOAD CARD =====
async function downloadCard() {
  // Render the provenance card to an offscreen canvas via a simple HTML-to-canvas approach.
  // We don't load html2canvas; instead we draw a faithful brass-and-parchment composition manually.
  const W = 1200;
  const H = 1500;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const cx = c.getContext("2d");

  // Parchment background
  const grad = cx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#ecdcb5");
  grad.addColorStop(1, "#d8c190");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, W, H);

  // Stipple
  cx.fillStyle = "rgba(60,40,15,0.04)";
  for (let i = 0; i < 4000; i++) {
    cx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  // Inner border
  cx.strokeStyle = "#2b1e10";
  cx.lineWidth = 6;
  cx.strokeRect(40, 40, W - 80, H - 80);
  cx.strokeStyle = "#4a3520";
  cx.lineWidth = 2;
  cx.strokeRect(64, 64, W - 128, H - 128);

  // Brass corner seals
  function seal(x, y) {
    const r = 44;
    const rg = cx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    rg.addColorStop(0, "#f3d27a");
    rg.addColorStop(0.5, "#c9963a");
    rg.addColorStop(1, "#5a3f0a");
    cx.fillStyle = rg;
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "#5a3f0a";
    cx.lineWidth = 3;
    cx.stroke();
    cx.fillStyle = "#5a3f0a";
    cx.font = "bold 30px serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText("❦", x, y + 2);
  }
  seal(64, 64); seal(W - 64, 64); seal(64, H - 64); seal(W - 64, H - 64);

  // Header
  cx.fillStyle = "#8a1f1c";
  cx.font = "bold 30px 'IM Fell English SC', serif";
  cx.textAlign = "center";
  cx.textBaseline = "alphabetic";
  cx.fillText("LOCKSMITH'S  PROVENANCE  CARD", W / 2, 160);

  // Cut profile
  cx.fillStyle = "#2b1e10";
  cx.font = "76px 'VT323', monospace";
  cx.fillText(state.teeth.join("  ·  "), W / 2, 250);

  // Date
  cx.fillStyle = "#4a3520";
  cx.font = "26px 'VT323', monospace";
  cx.fillText(`Catalog of ${todayHumanLabel()} (UTC)`, W / 2, 290);

  // Divider
  cx.strokeStyle = "#4a3520";
  cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(120, 320);
  cx.lineTo(W - 120, 320);
  cx.stroke();

  // Score
  cx.fillStyle = "#2b1e10";
  cx.font = "bold 140px 'IM Fell English SC', serif";
  const scoreText = String(state.opened.length);
  cx.fillText(scoreText, W / 2 - 50, 470);
  cx.fillStyle = "#4a3520";
  cx.font = "bold 70px 'IM Fell English SC', serif";
  cx.fillText("/30", W / 2 + 90, 470);
  cx.fillStyle = "#4a3520";
  cx.font = "italic 32px 'IM Fell English', serif";
  cx.fillText(scoreLabel(state.opened.length), W / 2, 520);

  // Locks list
  cx.strokeStyle = "#4a3520";
  cx.setLineDash([6, 4]);
  cx.beginPath();
  cx.moveTo(120, 560);
  cx.lineTo(W - 120, 560);
  cx.stroke();
  cx.setLineDash([]);

  let listY = 600;
  const sorted = state.opened.slice().sort((a,b) => a.year - b.year);
  if (sorted.length === 0) {
    cx.fillStyle = "#4a3520";
    cx.font = "italic 28px 'IM Fell English', serif";
    cx.fillText("Nothing opened. The brass is patient.", W / 2, listY + 40);
  } else {
    cx.textAlign = "left";
    sorted.slice(0, 18).forEach(lock => {
      cx.fillStyle = "#2b1e10";
      cx.font = "26px 'IM Fell English SC', serif";
      cx.fillText(lock.name, 130, listY);
      cx.fillStyle = "#4a3520";
      cx.font = "italic 20px 'IM Fell English', serif";
      cx.fillText(truncate(lock.provenance, 105), 130, listY + 28);
      listY += 60;
      if (listY > H - 180) return;
    });
    if (sorted.length > 18) {
      cx.fillStyle = "#4a3520";
      cx.font = "italic 22px 'IM Fell English', serif";
      cx.fillText(`...and ${sorted.length - 18} more silent locks.`, 130, listY + 10);
    }
  }

  // Footer
  cx.textAlign = "center";
  cx.fillStyle = "#4a3520";
  cx.font = "20px 'VT323', monospace";
  cx.fillText(`Engraved at the bench  ·  ${todayHumanLabel()}  ·  HEIRLOOM KEY-CUTTER`, W / 2, H - 100);
  cx.fillStyle = "#8a1f1c";
  cx.font = "30px serif";
  cx.fillText("❦  HKC  ❦", W / 2, H - 70);

  // Trigger download
  c.toBlob(blob => {
    if (!blob) { alert("Could not export card."); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heirloom-key-${todayUtcKey()}-${state.teeth.join("")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// ===== SHARE =====
function share() {
  // Make sure URL fragment reflects current cut
  if (history && history.replaceState) {
    history.replaceState(null, "", "#" + teethToHash(state.teeth).slice(1));
  }
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert("Link copied! Same key, same day's catalog."))
      .catch(() => alert("Copy this URL to share: " + location.href));
  }
}
window.share = share;

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("keyCanvas");
  ctx = canvas.getContext("2d");

  // Build today's catalog
  state.catalog = generateCatalog(state.seedKey);

  // Populate date stamp
  document.getElementById("catalogDate").textContent = todayHumanLabel();

  // Apply incoming hash (if any)
  const fromHash = hashToTeeth(location.hash);
  if (fromHash) state.teeth = fromHash;

  // Build dials, render
  buildDials();
  updateReadout();

  // Make sure canvas backing buffer matches displayed size for crispness
  requestAnimationFrame(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    renderKey();
  });

  // Wire buttons
  document.getElementById("testBtn").addEventListener("click", testTheKey);
  document.getElementById("resetBtn").addEventListener("click", () => {
    state.teeth = Array(NUM_TEETH).fill(0);
    for (let i = 0; i < NUM_TEETH; i++) {
      document.getElementById("dialv" + i).textContent = 0;
    }
    updateReadout();
    renderKey();
    if (state.hasResult) {
      document.getElementById("resultSection").hidden = true;
      state.hasResult = false;
    }
    history.replaceState(null, "", location.pathname);
  });
  document.getElementById("downloadBtn").addEventListener("click", downloadCard);
  document.getElementById("recutBtn").addEventListener("click", () => {
    document.getElementById("resultSection").hidden = true;
    state.hasResult = false;
    document.querySelector(".bench").scrollIntoView({behavior: "smooth", block: "start"});
  });

  window.addEventListener("resize", () => {
    requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      renderKey();
    });
  });

  // If user arrived via permalink, surface their key prominently but don't auto-test —
  // let them see the key, then choose to test (avoids modal-fly-in feel).
});
