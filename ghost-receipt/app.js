// app.js — entry point. Wires window.share / window.newReceipt for the inline
// onclick handlers in index.html, then starts the journey.

import { startJourney, share, newReceipt } from "./journey.js";

window.share = share;
window.newReceipt = newReceipt;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startJourney);
} else {
  startJourney();
}
