// journey.js — DOM wiring + screen flow for Ghost Receipt.
// Owns: prompt-form submission, the cashier-itemizing loading state, the
// tap-loop reveal animation, the totals stamp, share + reset CTAs, and the
// four-copy locations (loading: cashier-loading sub-line, error: prompt
// validation hint + closed-receipt wobble, pre-interaction: venue header +
// prompt-form copy, result micro-copy: stamp footer + fine-print). No
// business logic — that lives in mechanic.js / ai.js.

import { TOTAL_TAPS } from "./mechanic.js";
import {
  generateReceipt,
  saveReceiptToStore,
  loadReceiptFromStore,
  readShortIdFromUrl,
  writeShortIdToUrl,
  readSeedFromHash,
  clearUrlState,
} from "./ai.js";
import { buildReceiptFromSeed } from "./mechanic.js";

// ---- copy locations ----
// 1. Loading / computation     -> "the cashier is itemizing..." panel
// 2. Error / validation        -> prompt-form error span + closed-receipt wobble
// 3. Pre-interaction           -> venue-head + prompt-form label + foot line
// 4. Result micro-copy         -> per-receipt fine-print + closed stamp

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

const CASHIER_SUBS = [
  "running the tab. give them a second.",
  "they're squinting at the keypad. it'll be a moment.",
  "the printer's warming up. don't refresh.",
  "they're rounding things. you'll prefer it.",
];

// ---- module state ----
let receiptData = null;
let revealed = 0;
let closed = false;

// ---- DOM refs (resolved in startJourney) ----
let elPromptForm, elPromptInput, elPromptSubmit, elPromptError;
let elCashierLoading, elCashierLoadingSub;
let elCounter, elReceipt, elPaper, elLines, elTotals, elTotalsAmt, elTotalsExtras, elTotalsFine, elTotalsStamp, elTapHint, elTapCounter, elShareRow, elShareBtn, elStampMeta, elVenueSub;

// ---- public bootstrap ----
export function startJourney() {
  // Resolve all refs once
  elPromptForm = document.getElementById("promptForm");
  elPromptInput = document.getElementById("promptInput");
  elPromptSubmit = document.getElementById("promptSubmit");
  elPromptError = document.getElementById("promptError");
  elCashierLoading = document.getElementById("cashierLoading");
  elCashierLoadingSub = document.getElementById("cashierLoadingSub");
  elCounter = document.getElementById("counter");
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
  elVenueSub = document.getElementById("venueSub");

  // Prompt form submission
  elPromptForm.addEventListener("submit", onPromptSubmit);

  // Hydrate from URL or fall through to prompt
  bootFromUrl();
}

// Load any existing receipt referenced by the URL. If no ?c= and no #seed=,
// show the prompt form so the user describes their night.
async function bootFromUrl() {
  const shortId = readShortIdFromUrl();
  if (shortId) {
    showCashierLoading("loading the receipt…");
    const data = await loadReceiptFromStore(shortId);
    if (data) {
      activateReceipt(data, /* fastFill */ true);
      return;
    }
    // 404 / network failure — fall through to prompt form below.
    hideCashierLoading();
  }

  const legacySeed = readSeedFromHash();
  if (legacySeed != null) {
    // Old shareable links carried `#seed=N`. Reproduce deterministically.
    const data = buildReceiptFromSeed(legacySeed);
    activateReceipt(data, /* fastFill */ true);
    return;
  }

  showPromptForm();
}

// ---- prompt form ----
function showPromptForm() {
  elPromptForm.hidden = false;
  elCashierLoading.hidden = true;
  elCounter.hidden = true;
  elShareRow.hidden = true;
  elPromptInput.focus();
}

function showCashierLoading(headline) {
  elPromptForm.hidden = true;
  elCounter.hidden = true;
  elShareRow.hidden = true;
  elCashierLoading.hidden = false;
  // Rotate the sub-line each call so retries don't feel stuck.
  if (elCashierLoadingSub) {
    const i = Math.floor(Math.random() * CASHIER_SUBS.length);
    elCashierLoadingSub.textContent = CASHIER_SUBS[i];
  }
}

function hideCashierLoading() {
  elCashierLoading.hidden = true;
}

async function onPromptSubmit(ev) {
  ev.preventDefault();
  const text = (elPromptInput.value || "").trim();
  if (text.length < 4) {
    elPromptError.textContent = "tell the cashier something. one line is plenty.";
    elPromptInput.focus();
    return;
  }
  elPromptError.textContent = "";
  elPromptSubmit.disabled = true;

  showCashierLoading("the cashier is itemizing…");

  let data;
  try {
    data = await generateReceipt(text);
  } catch (_) {
    // Belt-and-suspenders: generateReceipt itself never throws, but if any
    // import-time issue caused this branch, fall back to a deterministic
    // banks-only receipt seeded by the user's text so the user still gets
    // an artifact.
    const seed = simpleHash(text);
    data = buildReceiptFromSeed(seed);
    data.userPrompt = text.slice(0, 500);
  }

  // Save to case-store. If the store call fails the URL stays as-is and
  // sharing simply won't carry state — but the user's receipt still works.
  const shortId = await saveReceiptToStore(data);
  if (shortId) writeShortIdToUrl(shortId);

  hideCashierLoading();
  activateReceipt(data, /* fastFill */ false);
}

function simpleHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ---- activate the receipt UI ----
function activateReceipt(data, fastFill) {
  receiptData = data;
  revealed = 0;
  closed = false;

  elPromptForm.hidden = true;
  elCashierLoading.hidden = true;
  elCounter.hidden = false;

  // Reset rendered children in case we ever reactivate without a reload.
  elLines.innerHTML = "";
  elTotals.hidden = true;
  elTotalsExtras.innerHTML = "";

  if (elStampMeta) elStampMeta.textContent = data.stampMeta;

  // Once the cashier has rung up your night, the sub-line on the venue head
  // shifts from "tell the cashier..." to a tap prompt. Voice stays dry.
  if (elVenueSub) {
    elVenueSub.innerHTML = fastFill
      ? "someone's ledger of a night.<br>tap below for your own."
      : "the cashier rang it up.<br>tap to see what you owe.";
  }

  if (fastFill) {
    for (const line of data.lines) printLine(line);
    revealed = TOTAL_TAPS;
    closeReceipt();
    elTapHint.textContent = "someone's receipt — tap below for your own";
    elTapHint.style.animation = "none";
    elTapHint.style.opacity = "0.7";
    return;
  }

  updateHint();
  updateCounter();
  attachTapHandlers();
}

// ---- tap loop ----
function attachTapHandlers() {
  elReceipt.addEventListener("click", handleTap);

  // Counter background also counts as a tap (forgiving target).
  if (elCounter) {
    elCounter.addEventListener("click", (ev) => {
      if (ev.target === elCounter || ev.target.classList.contains("counter-grain")) {
        handleTap();
      }
    });
  }

  elReceipt.addEventListener("keydown", (ev) => {
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      handleTap();
    }
  });
}

function handleTap() {
  if (closed) {
    elReceipt.classList.remove("wobble");
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
  dots.textContent = " " + "·".repeat(60) + " ";

  const amt = document.createElement("span");
  amt.className = "line-amt";
  amt.textContent = line.priceStr;

  li.append(text, dots, amt);
  elLines.appendChild(li);

  try {
    li.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  } catch (e) {
    // ignore — older browsers
  }
}

function closeReceipt() {
  closed = true;

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

  elTapHint.textContent = "receipt closed";
  elTapHint.style.animation = "none";
  elTapHint.style.opacity = "0.5";
  updateCounter();

  elShareRow.hidden = false;

  if (!elShareBtn.dataset.wired) {
    elShareBtn.dataset.wired = "1";
    elShareBtn.addEventListener("click", () => {});
  }
}

// ---- copy refresh ----
function updateHint() {
  if (!elTapHint) return;
  let pool;
  if (revealed === 0) pool = PRE_TAP_HINTS;
  else if (revealed >= TOTAL_TAPS - 2) pool = FINAL_HINTS;
  else pool = POST_TAP_HINTS;
  const seedish = ((receiptData.seed || 0) ^ revealed) >>> 0;
  elTapHint.textContent = pool[seedish % pool.length];
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
  const url = location.href;
  const text = `my ghost receipt · NIGHT OUT TOTAL ${receiptData ? receiptData.totalStr : ""} · former self tavern`;

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
  // Strip every URL state form (case-id, legacy hash) and reload fresh.
  clearUrlState();
  location.reload();
}
