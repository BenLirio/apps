// journey.js — DOM wiring + tap loop for Ghost Receipt.
// Owns: tap handler, line-by-line reveal animation, totals stamp, share +
// reset CTAs, the four-copy locations (loading-equivalent: pre-tap pulse,
// error / wobble: closed receipt, pre-interaction: venue header, result
// micro-copy: stamp footer + fine-print). No business logic — that lives
// in mechanic.js.

import {
  buildReceipt,
  TOTAL_TAPS,
  freshSeed,
  readSeedFromHash,
  writeSeedToHash,
  clearSeedFromHash,
} from "./mechanic.js";

// ---- copy locations the four-copy rule requires (per implement-deploy SKILL.md) ----
// 1. Loading / computation message  -> the pulsing "tap the receipt" hint
//    (computation IS the tap; we don't have a fetch, but the pre-tap state
//    must be voiced, not generic "Click to start")
// 2. Error / validation             -> wobble on extra taps + "RECEIPT CLOSED"
// 3. Pre-interaction                -> venue header + sub-line
// 4. Result micro-copy              -> per-receipt fine-print + closed stamp

const PRE_TAP_HINTS = [
  "tap the receipt",
  "tap to itemize",
  "tap. once for each thing the night charged you for",
];

const POST_TAP_HINTS = [
  "tap again. the night's not done",
  "the night is still itemizing",
  "more on the slip",
  "keep tapping. it grows",
  "the receipt is not finished with you",
];

const FINAL_HINTS = [
  "almost. one more line and it stamps",
  "one more. then it closes",
];

// ---- module state ----
let receiptData = null;
let revealed = 0;
let closed = false;

// ---- DOM refs (resolved in start()) ----
let elReceipt, elPaper, elLines, elTotals, elTotalsAmt, elTotalsExtras, elTotalsFine, elTotalsStamp, elTapHint, elTapCounter, elShareRow, elShareBtn, elStampMeta;

// ---- public bootstrap ----
export function startJourney() {
  elReceipt = document.getElementById("receipt");
  elPaper = document.getElementById("receiptPaper");
  elLines = document.getElementById("receiptLines");
  elTotals = document.getElementById("receiptTotals");
  elTotalsAmt = document.getElementById("totalsAmount");
  elTotalsExtras = document.getElementById("totalsExtras");
  elTotalsFine = document.getElementById("totalsFine");
  elTotalsStamp = document.getElementById("totalsStamp");
  elTapHint = document.getElementById("tapHint");
  elTapCounter = document.getElementById("tapCounter");
  elShareRow = document.getElementById("shareRow");
  elShareBtn = document.getElementById("shareBtn");
  elStampMeta = document.getElementById("stampMeta");

  // 1. Determine seed: shared link wins; otherwise generate fresh and reflect
  //    the seed into the URL so the user's own URL is shareable from tap one.
  const sharedSeed = readSeedFromHash();
  const seed = sharedSeed != null ? sharedSeed : freshSeed();

  receiptData = buildReceipt(seed);
  revealed = 0;
  closed = false;
  writeSeedToHash(seed);

  if (elStampMeta) elStampMeta.textContent = receiptData.stampMeta;

  // 2. If this is a shared link, fast-fill the entire receipt (the user
  //    landing on a friend's URL wants the artifact, not the tap loop).
  if (sharedSeed != null) {
    fastFill();
    return;
  }

  // 3. Otherwise, wire the tap loop.
  updateHint();
  updateCounter();
  attachTapHandlers();
}

// ---- tap loop ----
function attachTapHandlers() {
  const onTap = (ev) => {
    // Don't intercept clicks on share buttons / etc — but the receipt itself
    // and the surrounding counter background both count.
    handleTap();
  };

  elReceipt.addEventListener("click", onTap);
  // Counter background is also a tap surface (forgiving target per design intent)
  const counter = document.querySelector(".counter");
  if (counter) {
    counter.addEventListener("click", (ev) => {
      // only if the user hit the counter background, not the receipt itself
      if (ev.target === counter || ev.target.classList.contains("counter-grain")) {
        handleTap();
      }
    });
  }

  // keyboard: space / enter on the receipt
  elReceipt.addEventListener("keydown", (ev) => {
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      handleTap();
    }
  });
}

function handleTap() {
  if (closed) {
    // post-close: gentle wobble, no new line
    elReceipt.classList.remove("wobble");
    // force reflow so re-adding triggers the animation again
    void elReceipt.offsetWidth;
    elReceipt.classList.add("wobble");
    return;
  }

  if (revealed >= TOTAL_TAPS) return;

  printLine(receiptData.lines[revealed]);
  revealed++;
  updateHint();
  updateCounter();

  if (revealed >= TOTAL_TAPS) {
    // close after a short beat so the last line lands first
    setTimeout(closeReceipt, 320);
  }
}

// ---- printing ----
function printLine(line) {
  const li = document.createElement("li");
  li.className = "receipt-line" + (line.misprint ? " misprint" : "");

  const text = document.createElement("span");
  text.className = "line-text";
  text.textContent = line.text;

  const dots = document.createElement("span");
  dots.className = "line-dots";
  // dot leader fills the gap; we let CSS clip overflow
  dots.textContent = " " + "·".repeat(60) + " ";

  const amt = document.createElement("span");
  amt.className = "line-amt";
  amt.textContent = line.priceStr;

  li.append(text, dots, amt);
  elLines.appendChild(li);

  // scroll the just-printed line into view so accreting receipt feels right
  // (we use scrollIntoView on the line itself; smooth on user systems that allow)
  try {
    li.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  } catch (e) {
    // ignore — older browsers
  }
}

function closeReceipt() {
  closed = true;

  // render extras
  elTotalsExtras.innerHTML = "";
  for (const ex of receiptData.extras) {
    const row = document.createElement("div");
    row.className = "receipt-line";
    const t = document.createElement("span");
    t.className = "line-text";
    t.textContent = ex.text;
    const d = document.createElement("span");
    d.className = "line-dots";
    d.textContent = " " + "·".repeat(60) + " ";
    const a = document.createElement("span");
    a.className = "line-amt";
    a.textContent = ex.amountStr;
    row.append(t, d, a);
    elTotalsExtras.appendChild(row);
  }

  elTotalsAmt.textContent = receiptData.totalStr;
  elTotalsFine.textContent = receiptData.fine;
  elTotalsStamp.textContent = receiptData.stamp;

  elTotals.hidden = false;

  // hide the pulsing hint, switch counter to a closed-receipt label
  elTapHint.textContent = "receipt closed";
  elTapHint.style.animation = "none";
  elTapHint.style.opacity = "0.5";
  updateCounter();

  // reveal the share row
  elShareRow.hidden = false;

  // wire the share button (idempotent — repeat calls are harmless)
  if (!elShareBtn.dataset.wired) {
    elShareBtn.dataset.wired = "1";
    elShareBtn.addEventListener("click", () => {});
  }
}

// ---- fast-fill (when arriving via a shared seed link) ----
function fastFill() {
  for (const line of receiptData.lines) {
    printLine(line);
  }
  revealed = TOTAL_TAPS;
  closeReceipt();
  // Override the tap-hint to acknowledge this is someone's shared receipt
  elTapHint.textContent = "someone's receipt — tap below for your own";
  elTapHint.style.animation = "none";
  elTapHint.style.opacity = "0.7";
}

// ---- copy refresh ----
function updateHint() {
  if (!elTapHint) return;
  let pool;
  if (revealed === 0) pool = PRE_TAP_HINTS;
  else if (revealed >= TOTAL_TAPS - 2) pool = FINAL_HINTS;
  else pool = POST_TAP_HINTS;
  // deterministic hint pick: hash by (seed XOR revealed) so it doesn't strobe
  const seed = (receiptData.seed ^ revealed) >>> 0;
  elTapHint.textContent = pool[seed % pool.length];
}

function updateCounter() {
  if (!elTapCounter) return;
  if (closed) {
    elTapCounter.textContent = "receipt closed";
    return;
  }
  elTapCounter.textContent = `${revealed} / ${TOTAL_TAPS}`;
}

// ---- share ----
export async function share() {
  // Always re-pin the URL to the current seed before sharing (defensive).
  if (receiptData) writeSeedToHash(receiptData.seed);

  const url = location.href;
  const text = `my ghost receipt · NIGHT OUT TOTAL ${receiptData ? receiptData.totalStr : ""} · former self tavern`;

  // Prefer the Web Share sheet on mobile; fall back to clipboard.
  try {
    if (navigator.share) {
      await navigator.share({ title: "Ghost Receipt", text, url });
      return;
    }
  } catch (e) {
    // user cancelled or share failed — fall through to clipboard
  }

  try {
    await navigator.clipboard.writeText(url);
    flashCopied("link copied");
  } catch (e) {
    // last resort: prompt the user
    window.prompt("copy this receipt link:", url);
  }
}

function flashCopied(label) {
  const btn = elShareBtn;
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = label;
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1400);
}

// ---- start a fresh different night ----
export function newReceipt() {
  // strip seed; reload to get a brand new receipt. Reload is intentional —
  // it guarantees a clean state across the (intentionally simple) DOM.
  clearSeedFromHash();
  location.reload();
}
