// app.js — ES-module entry point.
//
// Wires the journey state machine to the DOM and exposes window.share for
// the inline onclick on the share button. Module scope means inline onclick
// would not find a global — so we explicitly assign window.share here.

import { startJourney } from "./journey.js";

// Boot the screen flow.
const root = document.querySelector(".app");
if (root) startJourney(root);

// Share — uses Web Share API where available, falls back to clipboard.
window.share = async function share() {
  const v = window.__verdict || {};
  const title = "Two Octaves";
  const url = location.origin + location.pathname;
  const text = v.name
    ? `I scored "${v.name}" on Two Octaves — ${v.pct}th percentile, average ${v.avg}¢ off the octave. Try yours:`
    : `Try Two Octaves — psychoacoustic field test`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) {
      // user-cancel or unsupported — fall through to clipboard
    }
  }

  const blob = `${text} ${url}`;
  try {
    await navigator.clipboard.writeText(blob);
    flashShareBtn("LINK COPIED");
  } catch (e) {
    flashShareBtn("COPY MANUALLY");
  }
};

function flashShareBtn(label) {
  const btn = document.getElementById("btn-share");
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = orig; }, 1400);
}
