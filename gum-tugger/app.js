// app.js — entry point. Wires DOM, starts the loop, exposes window.share / window.restart.
//
// The pitch is: pull a strand of gum from the top of the screen down with your
// finger; thinning + going translucent at the thinnest point; snap on excessive
// strain; three pulls per session; share a verdict + URL-fragment ghost replay.
//
// Loop physics + render lives in loop.js. ghost.js handles URL-fragment encoding
// and verdict naming.

import { startLoop, getLastSnapLength, isPulling } from './loop.js';
import { encodeRun, decodeRun, verdictFor, formatLen } from './ghost.js';

const $ = (id) => document.getElementById(id);

const state = {
  pulls: [],          // lengths in cm of completed pulls (snap or release)
  ghost: null,        // decoded run from URL fragment, if any
  finished: false,
};

function init() {
  // Decode any incoming ghost stretch from the URL fragment.
  const frag = (location.hash || '').replace(/^#/, '');
  if (frag) {
    const g = decodeRun(frag);
    if (g && g.lengths && g.lengths.length === 3) {
      state.ghost = g;
      $('ghostNote').hidden = false;
      const max = Math.max(...g.lengths);
      $('ghostText').textContent = `a friend's longest stretch: ${formatLen(max)} — pull past it`;
    }
  }

  // Start the canvas loop with our callbacks.
  startLoop({
    onSnap: handlePullEnded,    // called when strand breaks
    onRelease: handlePullEnded, // called if user lifts finger before snap
    onTickReadout: (cm, snapped) => {
      const r = $('readout');
      r.textContent = formatLen(cm);
      r.classList.toggle('snap', !!snapped);
    },
    onFirstTouch: () => $('hint').classList.add('fade'),
    ghost: state.ghost,
  });

  refreshHud();

  // window.share / window.restart for the inline onclick attrs in index.html
  window.share = share;
  window.restart = restart;
}

function refreshHud() {
  const n = state.pulls.length;
  $('pullsLabel').textContent = state.finished
    ? `DONE — 3 PULLS`
    : `PULL ${Math.min(n + 1, 3)} / 3`;
  const best = state.pulls.length ? Math.max(...state.pulls) : 0;
  $('bestLabel').textContent = `BEST: ${formatLen(best)}`;
}

function handlePullEnded({ length, snapped }) {
  // length is in centimeters (virtual). Always record — even a release counts.
  // (If the user simply tapped without pulling, ignore tiny noise.)
  if (length < 0.4) return;
  state.pulls.push(length);
  refreshHud();
  if (state.pulls.length >= 3) {
    state.finished = true;
    setTimeout(showVerdict, 600);
  }
}

function showVerdict() {
  const lengths = state.pulls.slice(0, 3);
  const longest = Math.max(...lengths);
  const v = verdictFor(lengths);

  $('rcName').textContent = v.name;
  $('rcLine').textContent = v.line;
  $('rc1').textContent = formatLen(lengths[0]);
  $('rc2').textContent = formatLen(lengths[1]);
  $('rc3').textContent = formatLen(lengths[2]);
  $('rcLongest').textContent = formatLen(longest);
  $('rcFoot').textContent = v.footer;

  $('resultCard').hidden = false;
  $('shareRow').hidden = false;
  $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function share() {
  const lengths = state.pulls.slice(0, 3);
  if (lengths.length < 3) return;
  const longest = Math.max(...lengths);
  const frag = encodeRun({ lengths });

  // Put it in our own URL bar so desktop users can just copy.
  const url = `${location.origin}${location.pathname}#${frag}`;
  history.replaceState(null, '', `#${frag}`);

  const v = verdictFor(lengths);
  const text = `I tugged ${formatLen(longest)} of artificial elongation. ${v.name}. Beat my strand:`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Gum Tugger', text, url });
      return;
    } catch (_) { /* user cancelled — fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    flashShareConfirm('link copied — paste it to a friend');
  } catch (_) {
    flashShareConfirm(url);
  }
}

function flashShareConfirm(msg) {
  const btn = $('btnShare');
  const orig = btn.textContent;
  btn.textContent = msg.length > 28 ? 'link copied' : msg;
  setTimeout(() => { btn.textContent = orig; }, 1800);
}

function restart() {
  state.pulls = [];
  state.finished = false;
  $('resultCard').hidden = true;
  $('shareRow').hidden = true;
  $('readout').classList.remove('snap');
  $('readout').textContent = '0.0 cm';
  $('hint').classList.remove('fade');
  refreshHud();
  // Loop is continuous — it will rebuild a fresh strand on next contact.
  // (No need to re-init.)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
