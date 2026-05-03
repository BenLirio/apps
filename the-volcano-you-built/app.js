// app.js — entry point. Wires the three stages (pre / play / result),
// generates the per-session seed, hands the loop a UI updater, and on end
// drives the reveal module.

import { startLoop } from './loop.js';
import { reveal } from './reveal.js';

const $ = (id) => document.getElementById(id);

// per-session seed — visible on the HUD and in the result so users can compare
const SEED = (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 4))
  .toUpperCase().slice(0, 6);
$('seed-display').textContent = SEED;

// stage transitions
const stagePre = $('stage-pre');
const stagePlay = $('stage-play');
const stageResult = $('stage-result');

$('begin-btn').addEventListener('click', begin);

function begin() {
  stagePre.hidden = true;
  stagePlay.hidden = false;

  startLoop({
    onUI: {
      taps: (n) => { $('taps-chip').textContent = `TAPS: ${n}`; },
      time: (rem) => { $('time-chip').textContent = `T-MINUS ${Math.ceil(rem)}s`; },
      heat: (peak) => { $('heat-chip').textContent = `PEAK HEAT: ${(peak * 100) | 0}%`; },
    },
    onEnd: () => {
      // 800ms beat for the camera-pull-back feel even on instant calc
      $('time-chip').textContent = '// PULLING TO ORBITAL...';
      setTimeout(showResult, 850);
    },
  });
}

function showResult() {
  stagePlay.hidden = true;
  stageResult.hidden = false;
  reveal({
    name: $('volcano-name'),
    blurb: $('volcano-blurb'),
    satCanvas: $('sat'),
    satLat: $('sat-lat'),
    satLon: $('sat-lon'),
    satElev: $('sat-elev'),
    satVents: $('sat-vents'),
    statCones: $('stat-cones'),
    statRidge: $('stat-ridge'),
    statHeat: $('stat-heat'),
    statTaps: $('stat-taps'),
    resultSeedChip: $('result-seed-chip'),
  });
  // scroll the result into view on small screens
  stageResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// share — onclick="share()" on the share button needs window.share
window.share = async function share() {
  const v = window.__volcano || {};
  const url = window.location.href.split('#')[0].split('?')[0];
  const text = `${v.name || 'My volcano'} — built in 60 seconds. ${v.vents || 0} vents · seed ${v.seed || ''}\n${url}`;
  // Web Share API (mobile primarily)
  if (navigator.share) {
    try { await navigator.share({ title: v.name || 'The Volcano You Built', text, url }); return; }
    catch (_) { /* user cancelled — fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    flashShareBtn('copied to clipboard');
  } catch (_) {
    flashShareBtn('copy failed — long-press the URL bar');
  }
};

function flashShareBtn(msg) {
  const btn = document.querySelector('#stage-result .share-row .primary-btn');
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = msg.toUpperCase();
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1600);
}
