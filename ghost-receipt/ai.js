// ai.js — network-bound side of Ghost Receipt.
// Owns: (1) calling the AI proxy to turn a user's one-line description of
// the night into a 12-line themed receipt, (2) saving / loading the resulting
// receipt blob via the case-store short-URL service, (3) the URL state
// helpers (`?c=<id>` short-link plus legacy `#seed=N` reader). Everything
// has a deterministic fallback so the app NEVER dead-ends if the network is
// down — fall through to mechanic.buildReceiptFromSeed and the user still
// gets a receipt.

import {
  hashStr,
  mulberry32,
  buildReceiptFromSeed,
  computeTotals,
  pickFineStampMeta,
  normalizePrice,
  decorateLine,
  fmtUSD,
  TOTAL_TAPS,
} from "./mechanic.js";

const SLUG = "ghost-receipt";
const AI_ENDPOINT = "https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai";
const CASE_STORE_BASE = "https://rrun6q1lfk.execute-api.us-east-1.amazonaws.com";

// ----------------------- AI prompt -----------------------
const SYSTEM_PROMPT = `You are the cashier at the Former Self Tavern at 1:47 AM. The user describes the night they had in one or two lines. You print a 12-line itemized receipt of what THE NIGHT charged them — petty, mock-bureaucratic, dry, deadpan, indie-sleaze, ledger-of-a-night-that-got-away. Never cute. Never zoomer slang. Never corporate snark. The receipt should feel inevitable, a little mean, a little funny, and specific to what the user told you.

Output strict JSON. Schema:
{
  "lines": [{"text": "1x cover charge to a venue that wasn't checking", "price": 800}, ... exactly 12 items],
  "extras": [{"text": "tax of regret (8.875%)", "amount": 950}, ... exactly 3 items],
  "fine": "all items final.\\nno refunds on the night.",
  "stamp": "RECEIPT CLOSED · keep it",
  "stamp_meta": "1:47 AM · TABLE NIL · srv: NOBODY"
}

Rules:
- Each line.text starts with "1x " (lowercase). No emojis, no hashtags, no quotes around the whole text.
- line.price is one of:
  • integer cents in [0, 9999] for petty real charges
  • "—" for an unpriced regret (most common for inner-life lines)
  • "$∞" for an off-the-books cosmic cost (use 0–1 times)
  • "see attached" for filed-elsewhere (use 0–1 times)
  • "cheap" or "gone" for symbolic (use rarely)
- Aim for 4–5 numeric prices, the rest "—" or symbolic. Never make every line numeric — that kills the joke.
- 4–6 lines must reference SPECIFIC details from the user's description (names, places, hours, objects, decisions they mentioned). The other 6–8 should be universal night-out regrets that earn the stamp. Order them so the receipt opens with a real charge and closes on an em-dashed regret.
- Vary categories across the 12 lines: real charges (cabs / cover / drinks / late-night food), kept-or-mistaken objects, inner regrets ("sentence i never finished"), ghosts (people / unsent texts / strangers), miscellaneous odd moments. Don't dump 12 of one type.
- extras: 3 absurd surcharges, integer cents in [0, 9999]. Examples: "tax of regret (8.875%)", "former-self surcharge", "convenience fee for the night itself", "subtotal of small lies", "service charge for being there".
- fine: two short lines separated by "\\n". Mock legal-deadpan.
- stamp: pattern "WORD · short phrase". Examples: "RECEIPT CLOSED · keep it", "PAID · sort of", "FILED · with the night", "BALANCE: complicated".
- stamp_meta: pattern "TIME AM · LOCATION · srv: PERSON". Examples: "1:47 AM · TABLE NIL · srv: NOBODY", "2:09 AM · BACK BOOTH · srv: ME APPARENTLY".`;

// ----------------------- text cleanup -----------------------
// We don't trust raw model output to be free of stray newlines, control
// chars, or runaway whitespace. Two cleanup helpers:
//   cleanText        - single-line fields. Collapse all whitespace to one space.
//   cleanMultiline   - allow newlines (only used by `fine`); strip controls.
function cleanText(s, maxLen) {
  if (typeof s !== "string") return "";
  // \s collapses spaces, tabs, newlines — anything whitespace-y.
  let out = s.replace(/\s+/g, " ").trim();
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

function cleanMultiline(s, fallback, maxLen) {
  if (typeof s !== "string" || !s.trim()) return fallback;
  // Convert any literal backslash-n the model emitted into real newline.
  let out = s.replace(/\\n/g, "\n");
  // Process line-by-line so single newlines survive but control chars don't.
  out = out
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, i, arr) => !(line === "" && i === arr.length - 1))
    .join("\n");
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

// ----------------------- AI generation -----------------------
// Returns a fully-built receipt object, ready for journey.js to render.
// Falls back to deterministic banks on any failure.
export async function generateReceipt(userText) {
  const text = (userText || "").trim();
  const seed = hashStr(text || String(Date.now())) >>> 0;

  let aiPayload = null;
  try {
    aiPayload = await callAI(text);
  } catch (_) {
    aiPayload = null;
  }

  if (!aiPayload || !Array.isArray(aiPayload.lines)) {
    // Deterministic fallback. Seeded by the user's input so two users typing
    // the same description get the same fallback (consistency over surprise
    // when AI is down).
    const r = buildReceiptFromSeed(seed);
    r.userPrompt = text.slice(0, 500);
    return r;
  }

  return assembleReceipt(seed, aiPayload, text);
}

async function callAI(userText) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user",   content: userText || "(the user did not describe the night)" },
  ];
  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: SLUG,
      messages,
      max_tokens: 800,
      response_format: "json_object",
    }),
  });
  if (!res.ok) throw new Error("ai_http_" + res.status);
  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.content);
  } catch (_) {
    return null;
  }
  return parsed;
}

// Take the AI's raw payload + a seed and produce a render-ready receipt that
// matches the same shape buildReceiptFromSeed returns. This is where we
// enforce the captionable-ending discipline and the misprint sprinkle.
function assembleReceipt(seed, payload, userText) {
  const rng = mulberry32(seed);

  // ---- lines (pad / clamp to 12) ----
  const rawLines = (payload.lines || []).slice(0, TOTAL_TAPS);
  const lines = rawLines.map((l) => ({
    text: cleanText((l && l.text) || "1x something the night charged me for", 140),
    price: normalizePrice(l && l.price),
  }));
  if (lines.length < TOTAL_TAPS) {
    // Pad with deterministic fallback lines from the seed.
    const pad = buildReceiptFromSeed(seed).lines.slice(lines.length);
    for (const p of pad) lines.push({ text: p.text, price: p.price });
  }
  const decoratedLines = lines.slice(0, TOTAL_TAPS).map((l) => decorateLine(l, rng()));

  // ---- extras (pad / clamp to 3) ----
  const rawExtras = (payload.extras || []).slice(0, 3);
  const extras = rawExtras.map((e) => {
    const amt = parseInt(e && e.amount, 10);
    return {
      text: cleanText((e && e.text) || "former-self surcharge", 80),
      amount: Number.isFinite(amt) ? Math.max(0, Math.min(99999, amt)) : 450,
    };
  });
  const extraFallbacks = [
    { text: "tax of regret (8.875%)",              amount: 950 },
    { text: "former-self surcharge",                amount: 450 },
    { text: "convenience fee for the night itself", amount: 600 },
  ];
  while (extras.length < 3) extras.push(extraFallbacks[extras.length]);

  const decoratedExtras = extras.map((e) => ({
    text: e.text,
    amount: e.amount,
    amountStr: fmtUSD(e.amount),
  }));

  // ---- totals ----
  const { subtotal, total } = computeTotals(rng, decoratedLines, decoratedExtras);

  // ---- fine / stamp / meta ----
  const meta = pickFineStampMeta(rng);
  const fine = cleanMultiline(payload.fine, meta.fine, 120);
  const stamp = cleanText(payload.stamp || meta.stamp, 60);
  const stampMeta = cleanText(payload.stamp_meta || meta.stampMeta, 80);

  return {
    seed,
    source: "ai",
    userPrompt: (userText || "").slice(0, 500),
    stampMeta,
    lines: decoratedLines,
    extras: decoratedExtras,
    subtotal,
    total,
    totalStr: fmtUSD(total),
    fine,
    stamp,
  };
}

// ----------------------- case-store wiring -----------------------
// Compact only the fields that drive rendering — strip derived fields the
// renderer recomputes (priceStr, contributes, amountStr, totalStr) so we
// stay well under the 8000-char data limit.
function compactReceipt(r) {
  return {
    v: 1,
    s: r.seed >>> 0,
    src: r.source || "ai",
    p: r.userPrompt || "",
    sm: r.stampMeta,
    l: r.lines.map((x) => ({ t: x.text, p: x.price, m: x.misprint ? 1 : 0 })),
    e: r.extras.map((x) => ({ t: x.text, a: x.amount })),
    st: r.subtotal,
    to: r.total,
    f: r.fine,
    sf: r.stamp,
  };
}

function expandReceipt(c) {
  if (!c || typeof c !== "object") return null;
  const lines = (c.l || []).map((x) => ({
    text: x.t,
    price: x.p,
    priceStr: typeof x.p === "number" ? fmtUSD(x.p) : x.p,
    contributes: typeof x.p === "number",
    misprint: !!x.m,
  }));
  const extras = (c.e || []).map((x) => ({
    text: x.t,
    amount: x.a,
    amountStr: fmtUSD(x.a),
  }));
  return {
    seed: c.s >>> 0,
    source: c.src || "ai",
    userPrompt: c.p || "",
    stampMeta: c.sm,
    lines,
    extras,
    subtotal: c.st,
    total: c.to,
    totalStr: fmtUSD(c.to),
    fine: c.f,
    stamp: c.sf,
  };
}

// POST /case → 8-char id, or null on failure.
export async function saveReceiptToStore(receipt) {
  try {
    const data = JSON.stringify(compactReceipt(receipt));
    if (data.length > 7800) return null;
    const res = await fetch(CASE_STORE_BASE + "/case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, data }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j && j.id ? j.id : null;
  } catch (_) {
    return null;
  }
}

// GET /case/{id} → expanded receipt object, or null.
export async function loadReceiptFromStore(id) {
  try {
    const res = await fetch(CASE_STORE_BASE + "/case/" + encodeURIComponent(id));
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || !j.data) return null;
    let parsed;
    try { parsed = JSON.parse(j.data); } catch (_) { return null; }
    return expandReceipt(parsed);
  } catch (_) {
    return null;
  }
}

// ----------------------- URL state -----------------------

export function readShortIdFromUrl() {
  const v = new URLSearchParams(location.search).get("c");
  return v && /^[A-Za-z0-9_-]{4,16}$/.test(v) ? v : null;
}

export function writeShortIdToUrl(id) {
  const next = location.pathname + "?c=" + encodeURIComponent(id);
  history.replaceState(null, "", next);
}

// Legacy `#seed=N` reader. New runs never write to the hash; we only read it
// to hydrate share-links generated before the AI rewrite.
export function readSeedFromHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return null;
  const m1 = h.match(/^seed=(\d+)$/);
  if (m1) return parseInt(m1[1], 10) >>> 0;
  if (/^\d+$/.test(h)) return parseInt(h, 10) >>> 0;
  return null;
}

export function clearUrlState() {
  history.replaceState(null, "", location.pathname);
}
