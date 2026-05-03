// mechanic.js — pure logic for Ghost Receipt.
// Owns: seeded RNG, the curated line-item banks (CHARGES, ITEMS, REGRETS,
// GHOSTS, MISC), the totals math (subtotal floor + captionable ending),
// price formatting, and `buildReceiptFromSeed(seed)` — the deterministic
// fallback used when AI generation fails or when a legacy `#seed=N` link is
// loaded. The AI-driven primary path lives in ai.js. No DOM here.
//
// Stance: mock-bureaucratic + petty. Voice: dry, deadpan, indie-sleaze 1:47am.
// NEVER cute. NEVER zoomer slang. Think: ledger of a night that got away.

// ----------------------- seeded RNG -----------------------
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique(rng, arr, used) {
  for (let i = 0; i < 32; i++) {
    const x = arr[Math.floor(rng() * arr.length)];
    if (!used.has(x)) {
      used.add(x);
      return x;
    }
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ----------------------- price formatting -----------------------
// Prices: numeric in cents (-> rendered as $X.XX) OR a literal string token:
//   "—"           unpriced regret (ledger lists it but no $ added)
//   "$∞"          off-the-books, doesn't sum
//   "see attached" filed under another section, doesn't sum
//   "cheap"       symbolic, doesn't sum
//   "gone"        symbolic, doesn't sum

function fmtUSD(cents) {
  const sign = cents < 0 ? "-" : "";
  const a = Math.abs(cents);
  const d = Math.floor(a / 100);
  const c = (a % 100).toString().padStart(2, "0");
  return `${sign}$${d}.${c}`;
}

function priceToken(p) {
  if (typeof p === "number") return fmtUSD(p);
  return p;
}

function priceContributesNumeric(p) {
  return typeof p === "number";
}

export { fmtUSD, priceToken, priceContributesNumeric };

// ----------------------- line-item BANKS (deterministic fallback) -----------------------

const BANK_CHARGES = [
  ["1x cover charge to a venue that wasn't checking", 800],
  ["1x split bill that didn't split", 4400],
  ["1x cab i waved off and then re-hailed", 1850],
  ["1x mandatory gratuity for nobody in particular", 700],
  ["1x re-up at the cash-only place", 6000],
  ["1x ATM fee i felt bad about", 350],
  ["1x cloakroom ticket i lost in fifteen minutes", 200],
  ["1x late-night pizza i forgot to eat", 1175],
  ["1x cab home that took a longer way", 2240],
  ["1x extra round, table's idea, my problem", 5800],
  ["1x rideshare surge for being out at all", 1490],
  ["1x bottle of water that was four dollars", 400],
  ["1x phone charger from a bodega", 1200],
  ["1x venue minimum we narrowly cleared", 9000],
  ["1x service charge for the chair i didn't sit in", 250],
  ["1x oat milk surcharge at 1am", 75],
  ["1x venmo request from a name i don't recognize", 1900],
  ["1x replacement headphone i regret buying", 2599],
];

const BANK_ITEMS = [
  ["1x lighter that wasn't mine, kept anyway", 200],
  ["1x napkin with a number i won't text", "—"],
  ["1x coat check tag, traded for a different coat", "—"],
  ["1x book of matches from a bar that closed in 2017", "—"],
  ["1x receipt from somewhere i have no memory of being", "see attached"],
  ["1x parking ticket photographed but unaddressed", 4500],
  ["1x glass i kept", 0],
  ["1x sticker peeled from somebody's laptop", "—"],
  ["1x hand stamp, faded by the next morning", "—"],
  ["1x stranger's umbrella, taken in error", "—"],
  ["1x drink i ordered as a prop and finished anyway", 1200],
  ["1x hat i did not start the night with", "—"],
  ["1x set of keys, briefly, that were not mine", "—"],
  ["1x business card from someone in 'consulting'", "—"],
  ["1x earring, just the one", "—"],
  ["1x flier for an event that already happened", "—"],
];

const BANK_REGRETS = [
  ["1x sentence i never finished", "—"],
  ["1x apology i owed myself", 4400],
  ["1x bathroom mirror affirmation", "cheap"],
  ["1x extra hour somehow", "gone"],
  ["1x friend i almost called", 0],
  ["1x text i drafted and didn't send", "—"],
  ["1x time i said 'i'm fine' to a stranger", "—"],
  ["1x time i said 'i love this song' about something playing in another room", "—"],
  ["1x compliment i absorbed wrong", "—"],
  ["1x decision i made on the way to the bathroom", 1700],
  ["1x cigarette accepted out of politeness", 0],
  ["1x existential pivot, smaller than it felt", "—"],
  ["1x time i checked my phone and pretended i didn't", "—"],
  ["1x reflexive 'sorry' to a chair", "—"],
  ["1x feeling i mistook for a personality", "—"],
  ["1x conversation about the bridge", "—"],
  ["1x quiet panic in line for the bathroom", "$∞"],
  ["1x 'i should be writing' thought, fully ignored", "—"],
  ["1x time i agreed to brunch i won't make", 0],
  ["1x time i said 'we should do this more often'", "—"],
  ["1x boundary i set, didn't enforce", "—"],
];

const BANK_GHOSTS = [
  ["1x text from someone i swore i wouldn't text back", "—"],
  ["1x conversation with a friend who left forty minutes ago", "—"],
  ["1x ex who's not on the bill but on the bill", "see attached"],
  ["1x stranger who looked exactly like a friend", "—"],
  ["1x missed call i'll return next week, twice", "—"],
  ["1x someone i called by the wrong name twice", "—"],
  ["1x person i hugged like we knew each other", 0],
  ["1x former roommate of a former roommate", "—"],
  ["1x guy named dave i've now met four times", "—"],
  ["1x bartender who deserved a raise i can't authorize", 1000],
  ["1x voice memo to no one", "—"],
  ["1x DM from 2019, finally read", "—"],
  ["1x birthday i forgot to mention i remembered", "—"],
  ["1x former version of myself, briefly visible", "$∞"],
  ["1x someone's parent, on speakerphone, on the curb", "—"],
];

const BANK_MISC = [
  ["1x interaction at a hot dog stand i'll think about for years", 700],
  ["1x argument about a movie nobody had seen", "—"],
  ["1x unsolicited recommendation, accepted", 0],
  ["1x vibe shift, table-wide", "—"],
  ["1x photograph i'll never look at again", "—"],
  ["1x stairwell summit", "—"],
  ["1x impromptu plan, undone by a text", "—"],
  ["1x dance i committed to for one chorus", "—"],
  ["1x running tab i thought was settled", 3300],
  ["1x bench i sat on for longer than expected", 0],
  ["1x near-miss with a scooter", "—"],
  ["1x convenience store hot food item, regretted", 525],
  ["1x sincere question deflected with a joke", "—"],
  ["1x order placed by committee, eaten by one", 1850],
  ["1x cathedral feeling at a 7-11", "$∞"],
  ["1x perfectly fine song ruined by the context", "—"],
  ["1x weather event, briefly fashionable", "—"],
];

// Bank rotation across the 12 taps — opens with a charge so it reads like a
// receipt, closes with a regret so the totals stamp lands hard.
const BANK_ROTATION = [
  BANK_CHARGES, BANK_ITEMS, BANK_REGRETS, BANK_CHARGES,
  BANK_GHOSTS,  BANK_REGRETS, BANK_MISC,    BANK_ITEMS,
  BANK_REGRETS, BANK_GHOSTS,  BANK_MISC,    BANK_REGRETS,
];

export const TOTAL_TAPS = BANK_ROTATION.length; // 12

const EXTRA_CHARGES = [
  { text: "tax of regret (8.875%)",                kind: "tax",  rate: 0.08875 },
  { text: "service charge for being there",        kind: "pct",  rate: 0.18 },
  { text: "gratuity (mandatory)",                  kind: "pct",  rate: 0.20 },
  { text: "cover charge (retroactive)",            kind: "flat", min: 800,  max: 2200 },
  { text: "convenience fee for the night itself",  kind: "flat", min: 250,  max: 950 },
  { text: "subtotal of small lies",                kind: "lies", min: 1100, max: 4400 },
  { text: "former-self surcharge",                 kind: "pct",  rate: 0.075 },
  { text: "house pour for a stranger you nodded at", kind: "flat", min: 700, max: 1400 },
];

const STAMP_FOOTERS = [
  "RECEIPT CLOSED · keep it",
  "PAID · sort of",
  "SETTLED · in spirit",
  "BALANCE: complicated",
  "FILED · with the night",
  "RECEIPT CLOSED · don't audit",
];

const FINE_PRINT = [
  "all items final.\nno refunds on the night.",
  "this is not a tax document.\nthis is not not a tax document.",
  "thank you for being out.\nthe room remembers.",
  "service was rendered.\nyou were rendered.",
  "kept on file at the\nformer self tavern, table nil.",
];

const STAMPS_META = [
  "1:47 AM · TABLE NIL · srv: NOBODY",
  "2:09 AM · TABLE NIL · srv: WHOEVER",
  "1:31 AM · BAR · srv: THE GUY",
  "2:44 AM · BACK BOOTH · srv: ME APPARENTLY",
  "12:58 AM · WINDOW · srv: ROTATING",
  "1:18 AM · COUNTER · srv: NEW PERSON",
];

// ----------------------- totals computation -----------------------
// Two callers: buildReceiptFromSeed (banks-only) and ai.js (after AI lines
// land). Centralizing keeps the captionable-ending discipline in one place.
export function computeTotals(rng, lines, extras) {
  let subtotal = 0;
  for (const l of lines) {
    if (priceContributesNumeric(l.price)) subtotal += l.price;
  }
  // Floor: never read suspiciously cheap.
  if (subtotal < 4000) subtotal += 4200;

  const extrasTotal = extras.reduce((s, e) => s + (typeof e.amount === "number" ? e.amount : 0), 0);

  const captionableEndings = [47, 69, 88, 13, 22, 7];
  const ending = captionableEndings[Math.floor(rng() * captionableEndings.length)];
  let total = subtotal + extrasTotal;
  total = Math.floor(total / 100) * 100 + ending;
  if (total < subtotal + 50) total += 100;

  return { subtotal, total };
}

export function pickFineStampMeta(rng) {
  return {
    fine: FINE_PRINT[Math.floor(rng() * FINE_PRINT.length)],
    stamp: STAMP_FOOTERS[Math.floor(rng() * STAMP_FOOTERS.length)],
    stampMeta: STAMPS_META[Math.floor(rng() * STAMPS_META.length)],
  };
}

// ----------------------- buildReceiptFromSeed (banks-only fallback) -----------------------
// Used for: (a) AI failure on a fresh prompt, (b) old `#seed=N` legacy share
// links — those URLs are still in the wild and must hydrate to the same
// receipt they originally produced.
export function buildReceiptFromSeed(seed) {
  const rng = mulberry32(seed >>> 0);
  const used = new Set();

  const lines = [];
  for (let i = 0; i < TOTAL_TAPS; i++) {
    const bank = BANK_ROTATION[i];
    const [text, price] = pickUnique(rng, bank, used);
    lines.push({
      text,
      price,
      priceStr: priceToken(price),
      contributes: priceContributesNumeric(price),
      misprint: rng() < 0.11,
    });
  }

  // Pick 3 extras
  const extrasPicked = [];
  const extraIdx = new Set();
  while (extrasPicked.length < 3) {
    const i = Math.floor(rng() * EXTRA_CHARGES.length);
    if (extraIdx.has(i)) continue;
    extraIdx.add(i);
    extrasPicked.push(EXTRA_CHARGES[i]);
  }

  const subtotalNumeric = lines.reduce((s, l) => s + (l.contributes ? l.price : 0), 0);
  const unpriced = lines.filter((l) => !l.contributes).length;

  const extras = [];
  for (const e of extrasPicked) {
    let amount = 0;
    if (e.kind === "tax" || e.kind === "pct") {
      amount = Math.round(Math.max(subtotalNumeric, 4200) * e.rate);
    } else if (e.kind === "flat") {
      amount = Math.round(e.min + rng() * (e.max - e.min));
      amount = Math.round(amount / 5) * 5;
    } else if (e.kind === "lies") {
      const base = e.min + (unpriced * 200);
      amount = Math.min(e.max, Math.round(base + rng() * 800));
    }
    extras.push({ text: e.text, amount, amountStr: fmtUSD(amount) });
  }

  const { subtotal, total } = computeTotals(rng, lines, extras);
  const meta = pickFineStampMeta(rng);

  return {
    seed,
    source: "banks",
    stampMeta: meta.stampMeta,
    lines,
    extras,
    subtotal,
    total,
    totalStr: fmtUSD(total),
    fine: meta.fine,
    stamp: meta.stamp,
  };
}

// ----------------------- normalization helpers (used by ai.js) -----------------------
// Allowed price tokens (post-normalization). Anything else collapses to "—".
const ALLOWED_PRICE_TOKENS = new Set(["—", "$∞", "see attached", "cheap", "gone"]);

export function normalizePrice(p) {
  if (typeof p === "number" && Number.isFinite(p)) {
    return Math.max(0, Math.min(99999, Math.round(p)));
  }
  if (typeof p === "string") {
    const t = p.trim();
    if (ALLOWED_PRICE_TOKENS.has(t)) return t;
    if (t === "-" || t === "--" || t === "—") return "—";
    // Try "$8.00" / "$12" / "8.00" forms
    const m = t.match(/^\$?(\d+)(?:\.(\d{1,2}))?$/);
    if (m) {
      const dollars = parseInt(m[1], 10);
      const cents = m[2] ? parseInt(m[2].padEnd(2, "0"), 10) : 0;
      return Math.max(0, Math.min(99999, dollars * 100 + cents));
    }
    return "—";
  }
  return "—";
}

export function decorateLine(line, misprintRoll) {
  return {
    text: line.text,
    price: line.price,
    priceStr: priceToken(line.price),
    contributes: priceContributesNumeric(line.price),
    misprint: misprintRoll < 0.11,
  };
}
