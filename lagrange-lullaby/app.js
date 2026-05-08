// app.js — entry point. Imports loop, wires window.share, kicks off simulation.
import { startLoop } from './loop.js';

const $ = (id) => document.getElementById(id);

window.share = async function share() {
  const v = window.__lastVerdict;
  const url = location.href.split('#')[0];
  const text = v
    ? `i got ${v.tier} on lagrange lullaby (${v.day}). place your moon — same binary today.`
    : 'lagrange lullaby — one moon, two stars, sixty seconds.';
  const btn = $('share-btn');

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Lagrange Lullaby', text, url });
      return;
    } catch (_) { /* fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '> copied · paste anywhere';
      setTimeout(() => { btn.textContent = orig; }, 1800);
    }
  } catch (_) {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '> copy failed — long-press the url';
      setTimeout(() => { btn.textContent = orig; }, 2200);
    }
  }
};

startLoop({
  canvas: $('sky'),
  badgeEl: $('badge'),
  briefEl: $('brief'),
  metaEl: $('binary-meta'),
  verdictEl: $('verdict'),
  tierNameEl: $('tier-name'),
  tierDescEl: $('tier-desc'),
  telemetryEl: $('telemetry'),
  againBtn: $('again-btn'),
});
