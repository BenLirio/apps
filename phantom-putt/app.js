// app.js — entry point. Wires the splash → game → result flow, manages the
// daily best, and exposes window.share for the inline share button.

import { Course, todaysHole } from "./loop.js";
import { verdictFor, gridEmoji, shareText } from "./verdict.js";
import { TiltControls } from "./controls.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  board: $("#board"),
  canvas: $("#course"),
  splash: $("#splash"),
  splashName: $("#splash-name"),
  splashPar: $("#splash-par"),
  splashHowto: $("#splash-howto"),
  splashFallback: $("#splash-fallback"),
  startBtn: $("#start-btn"),
  result: $("#result"),
  strokesBig: $("#strokes-big"),
  strokesHud: $("#strokes"),
  bestPill: $("#best-pill"),
  bestEl: $("#best"),
  verdictName: $("#verdict-name"),
  verdictLine: $("#verdict-line"),
  gridEl: $("#grid"),
  shareBtn: $("#share-btn"),
  replayBtn: $("#replay-btn"),
  holeNumber: $("#hole-number"),
  holeName: $("#hole-name"),
  holePar: $("#hole-par"),
};

const { layout, dayNumber } = todaysHole();
const STORAGE_KEY = `phantom-putt:best:${dayNumber}`;

// ─── populate header + splash from today's hole ────────────────────────────
els.holeNumber.textContent = `Hole #${dayNumber}`;
els.holeName.textContent = `"${layout.name}"`;
els.holePar.textContent = `Par ${layout.par}`;
els.splashName.textContent = layout.name;
els.splashPar.textContent = `Par ${layout.par}`;

// Show desktop hint when there's no orientation sensor at all (likely
// laptop / desktop). On mobile-ish browsers we wait for permission to fail
// before showing the fallback.
if (!TiltControls.hasOrientation() || !isTouchPrimary()) {
  els.splashFallback.hidden = false;
  els.splashHowto.textContent = "Tilt your phone (or use arrow keys / drag) to roll the ball.";
}

let course = null;
let lastResult = null; // for share text

// ─── start round (must run inside user gesture for iOS permission) ─────────
els.startBtn.addEventListener("click", async () => {
  els.startBtn.disabled = true;
  els.startBtn.textContent = "rolling…";

  course = new Course(els.canvas, layout, onSunk);
  course.attachDesktopControls(els.board);

  const orient = await course.attachOrientation();
  if (orient === "denied") {
    els.splashFallback.hidden = false;
    els.splashFallback.textContent = "Tilt was denied — use finger-drag on the board to nudge gravity.";
  } else if (orient === "unsupported") {
    // desktop already wired
  }

  els.splash.hidden = true;
  course.start();
  syncHud();
});

// ─── HUD sync (strokes counter) ───────────────────────────────────────────
function syncHud() {
  const tick = () => {
    if (!course) return;
    if (course.strokes !== Number(els.strokesHud.textContent)) {
      els.strokesHud.textContent = String(course.strokes);
    }
    if (!course.sunk) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // Also surface today's best, if any.
  const best = readBest();
  if (best != null) {
    els.bestPill.hidden = false;
    els.bestEl.textContent = String(best);
  }
}

// ─── on sunk: compute verdict, render result card, persist best ───────────
function onSunk({ strokes, distances }) {
  const v = verdictFor(strokes, layout.par);
  const grid = gridEmoji(distances);

  els.strokesBig.textContent = String(strokes);
  els.verdictName.textContent = v.name;
  els.verdictLine.textContent = v.line;
  els.gridEl.textContent = grid;

  lastResult = {
    holeNum: dayNumber,
    holeName: layout.name,
    par: layout.par,
    strokes,
    verdict: v,
    grid,
  };

  // Persist best, then surface it next round.
  const prevBest = readBest();
  if (prevBest == null || strokes < prevBest) {
    writeBest(strokes);
  }
  const newBest = readBest();
  if (newBest != null) {
    els.bestPill.hidden = false;
    els.bestEl.textContent = String(newBest);
  }

  els.result.hidden = false;
}

// ─── replay same hole ─────────────────────────────────────────────────────
els.replayBtn.addEventListener("click", () => {
  if (!course) return;
  course.stop();
  course = new Course(els.canvas, layout, onSunk);
  course.attachDesktopControls(els.board);
  course.attachOrientation(); // re-attach silently; permission already granted
  els.result.hidden = true;
  els.strokesHud.textContent = "0";
  course.start();
  syncHud();
});

// ─── share (inline onclick="share()" reaches this) ────────────────────────
window.share = async function share() {
  if (!lastResult) return;
  const text = shareText(lastResult);
  let copied = false;

  if (navigator.share) {
    try {
      await navigator.share({ title: "Phantom Putt", text });
      copied = true;
    } catch (_) { /* user cancelled — fall through to clipboard */ }
  }
  if (!copied && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (_) { /* swallow */ }
  }
  if (copied) {
    flashCopied();
  } else {
    // last-resort: select text in a hidden textarea
    fallbackCopy(text);
    flashCopied();
  }
};

function flashCopied() {
  const btn = els.shareBtn;
  const prev = btn.textContent;
  btn.textContent = "copied!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = prev;
    btn.classList.remove("copied");
  }, 1600);
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (_) {}
  document.body.removeChild(ta);
}

// ─── localStorage helpers ─────────────────────────────────────────────────
function readBest() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v == null ? null : Number(v);
  } catch (_) { return null; }
}
function writeBest(n) {
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
}

function isTouchPrimary() {
  return window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

// ─── canvas touch hygiene (Pitfall 10 bundle) ─────────────────────────────
els.canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
els.canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
els.canvas.addEventListener("touchend", (e) => e.preventDefault(), { passive: false });
els.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
