// mechanic.js — pure logic for Ghost Receipt
// Owns: seeded RNG, the curated line-item banks (CHARGES, ITEMS, REGRETS,
// GHOSTS, MISC), the bank-rotation across taps, the totals math, and the
// stamp/footer text. No DOM. journey.js / app.js consume these.
//
// Stance: mock-bureaucratic + petty. Voice: dry, deadpan, indie-sleaze 1:47am.
// NEVER cute. NEVER zoomer slang. Think: ledger of a night that got away.

// ----------------------- seeded RNG -----------------------
// FNV-1a-ish 32-bit hash for string -> seed
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 — tiny seeded PRNG, returns [0,1)
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

// pull from array w/o repetition within a single receipt
function pickUnique(rng, arr, used) {
  // Try up to N times to find an unused entry; fall back to allowing repeats.
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
//   "$0.00"       literal zero (sums as 0)

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

// ----------------------- line-item BANKS -----------------------
// Each bank is a list of [text, price]. price can be number (cents) or string.
// ~80–120 items total across all banks (saturation rule from input-design).
//
// CHARGES = bureaucratic-feeling itemized "fees"
// ITEMS   = physical-ish props of the night
// REGRETS = inner-life line items, mostly em-dashed
// GHOSTS  = people / unsent texts / not-met
// MISC    = the offbeat / edge-case ones, including "$∞" / "see attached"

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

// Ordered list of which bank each tap pulls from, by tap index 0..11.
// Designed so the receipt feels like it has rhythm, not a category dump.
const BANK_ROTATION = [
  BANK_CHARGES, // 1: open with a charge so it reads like a receipt
  BANK_ITEMS,
  BANK_REGRETS,
  BANK_CHARGES,
  BANK_GHOSTS,
  BANK_REGRETS,
  BANK_MISC,
  BANK_ITEMS,
  BANK_REGRETS,
  BANK_GHOSTS,
  BANK_MISC,
  BANK_REGRETS, // close on a regret so the totals land hard
];

export const TOTAL_TAPS = BANK_ROTATION.length; // 12

// ----------------------- absurd extras (printed at TOTAL time) -----------------------
const EXTRA_CHARGES = [
  { text: "tax of regret (8.875%)", kind: "tax", rate: 0.08875 },
  { text: "service charge for being there", kind: "pct", rate: 0.18 },
  { text: "gratuity (mandatory)", kind: "pct", rate: 0.20 },
  { text: "cover charge (retroactive)", kind: "flat", min: 800, max: 2200 },
  { text: "convenience fee for the night itself", kind: "flat", min: 250, max: 950 },
  { text: "subtotal of small lies", kind: "lies", min: 1100, max: 4400 },
  { text: "former-self surcharge", kind: "pct", rate: 0.075 },
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

// ----------------------- buildReceipt -----------------------
// Returns the entire receipt for a seed, deterministic. The UI reveals it
// tap-by-tap; logic is fully precomputed so undo/replay is trivial.
//
// shape:
//   {
//     seed: number,
//     stampMeta: string,
//     lines:   [{ text, price, contributes, misprint }] x TOTAL_TAPS,
//     extras:  [{ text, amount }],
//     subtotal: number,                 // cents
//     total:    number,                 // cents
//     totalStr: string,                 // "$XXX.XX"
//     fine:    string,
//     stamp:   string,
//   }

export function buildReceipt(seed) {
  const rng = mulberry32(seed >>> 0);
  const used = new Set();

  // 1. accreting line items
  const lines = [];
  let subtotal = 0;
  let priced = 0;
  let unpriced = 0;

  for (let i = 0; i < TOTAL_TAPS; i++) {
    const bank = BANK_ROTATION[i];
    const [text, price] = pickUnique(rng, bank, used);
    const contributes = priceContributesNumeric(price);
    if (contributes) {
      subtotal += price;
      priced++;
    } else {
      unpriced++;
    }
    // ~1 in 9 lines gets a misprint flicker on the price/text
    const misprint = rng() < 0.11;
    lines.push({
      text,
      price,
      priceStr: priceToken(price),
      contributes,
      misprint,
    });
  }

  // Floor the subtotal so it never reads as suspiciously cheap. If the
  // numeric items happened to be light, sneak in a quiet base of $42.00 .
  if (subtotal < 4000) subtotal += 4200;

  // 2. extras at total time. Pick 3 of the absurd extras, deterministic.
  const extrasPicked = [];
  const extraIdx = new Set();
  while (extrasPicked.length < 3) {
    const i = Math.floor(rng() * EXTRA_CHARGES.length);
    if (extraIdx.has(i)) continue;
    extraIdx.add(i);
    extrasPicked.push(EXTRA_CHARGES[i]);
  }

  const extras = [];
  let extrasTotal = 0;
  for (const e of extrasPicked) {
    let amount = 0;
    if (e.kind === "tax" || e.kind === "pct") {
      amount = Math.round(subtotal * e.rate);
    } else if (e.kind === "flat") {
      amount = Math.round(e.min + rng() * (e.max - e.min));
      // round to nearest 5 cents for receipt-feel
      amount = Math.round(amount / 5) * 5;
    } else if (e.kind === "lies") {
      // scaled by how many unpriced regrets the receipt has
      const base = e.min + (unpriced * 200);
      amount = Math.min(e.max, Math.round(base + rng() * 800));
    }
    extras.push({ text: e.text, amount, amountStr: fmtUSD(amount) });
    extrasTotal += amount;
  }

  // 3. final number — round into a captionable shape (ends in .47 / .69 / .88 / .13)
  const captionableEndings = [47, 69, 88, 13, 22, 7];
  const ending = captionableEndings[Math.floor(rng() * captionableEndings.length)];
  let total = subtotal + extrasTotal;
  // round to the dollar, then add the ending
  total = Math.floor(total / 100) * 100 + ending;
  // ensure total stays >= subtotal
  if (total < subtotal + 50) total += 100;

  const fine = FINE_PRINT[Math.floor(rng() * FINE_PRINT.length)];
  const stamp = STAMP_FOOTERS[Math.floor(rng() * STAMP_FOOTERS.length)];
  const stampMeta = STAMPS_META[Math.floor(rng() * STAMPS_META.length)];

  return {
    seed,
    stampMeta,
    lines,
    extras,
    subtotal,
    total,
    totalStr: fmtUSD(total),
    fine,
    stamp,
    pricedCount: priced,
    unpricedCount: unpriced,
  };
}

// ----------------------- seed helpers -----------------------

// Generate a fresh seed (a single 32-bit unsigned int).
export function freshSeed() {
  // crypto.getRandomValues if available, else Math.random fallback
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
}

// Read seed from the URL hash. Supports `#seed=<number>` or `#<number>`.
export function readSeedFromHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return null;
  const m1 = h.match(/^seed=(\d+)$/);
  if (m1) return parseInt(m1[1], 10) >>> 0;
  if (/^\d+$/.test(h)) return parseInt(h, 10) >>> 0;
  return null;
}

export function writeSeedToHash(seed) {
  const next = `#seed=${seed >>> 0}`;
  history.replaceState(null, "", next);
}

export function clearSeedFromHash() {
  history.replaceState(null, "", location.pathname + location.search);
}
