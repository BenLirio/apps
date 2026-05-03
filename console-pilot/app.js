// app.js — wiring & screen flow.
// Screens: preflight → calibrate → flight → recorder.
//
// Why so much wiring lives here: the loop and the controls modules don't
// know about screens. This module bridges them, and exposes window.share so
// the inline onclick on the share button finds it (modules are scoped).

import { createInput }   from './controls.js';
import { createGame, RUN_SECONDS } from './loop.js';
import { generateCallsign } from './callsign.js';

const $ = sel => document.querySelector(sel);

const screens = {
  preflight: $('#preflight'),
  calibrate: $('#calibrate'),
  flight:    $('#flight'),
  recorder:  $('#recorder'),
};

function show(name) {
  for (const k of Object.keys(screens)) {
    if (k === name) screens[k].removeAttribute('hidden');
    else screens[k].setAttribute('hidden', '');
  }
}

const canvas = $('#screen');
const game = createGame(canvas);
const input = createInput();
input.attachPointer(canvas);

// pre-flight detection: are we likely on a touch-primary device?
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
if (!isTouch) {
  $('#brief-mobile').setAttribute('hidden', '');
  $('#brief-desktop').removeAttribute('hidden');
}

// Surface a fake-stable sector hint on the pre-flight panel so the readout
// changes between runs (specificity is morale).
$('#pf-sector').textContent = randomSectorLabel();

function randomSectorLabel() {
  const a = ['G7','M2','C9','K4','N1','J3'];
  const r = a[Math.floor(Math.random() * a.length)];
  return `${r}-${String(100 + Math.floor(Math.random()*899)).padStart(3,'0')}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Engage button → permission gate → calibrate → start

$('#btn-engage').addEventListener('click', async () => {
  $('#btn-engage').disabled = true;
  $('#btn-engage').textContent = 'INITIALIZING…';

  const granted = await input.requestOrientation();
  // Note: granted=false is OK — desktop / denied users get pointer fallback
  if (!granted) {
    // skip calibration — pointer mode is implicit
    input.calibrate();
    enterFlight();
    return;
  }

  // run a 1.4s calibration where we capture pose-zero on the *current* hold
  show('calibrate');
  const t0 = performance.now();
  const bar = $('#cal-bar');
  let calibrated = false;
  function tick() {
    const dt = (performance.now() - t0) / 1400;
    bar.style.width = `${Math.min(100, dt * 100)}%`;
    if (!calibrated && dt > 0.55) {
      // capture pose-zero a hair before the bar fills, so the user is
      // settled into their hold by then
      input.calibrate();
      calibrated = true;
    }
    if (dt < 1) requestAnimationFrame(tick);
    else enterFlight();
  }
  tick();
});

function enterFlight() {
  show('flight');
  // Important: resize *after* showing — the canvas needs a layout box.
  requestAnimationFrame(() => {
    game.resize();
    game.start(Math.floor(performance.now()));
    runHudLoop();
  });
}

// HUD updater — separate cheap rAF tick, doesn't redraw the canvas
let hudTickId = 0;
function runHudLoop() {
  cancelAnimationFrame(hudTickId);
  const tickHud = () => {
    if (!game.state.running && game.state.flashTime <= 0) return;
    // input → game
    const dt = Math.min(0.05, (game.state.dt || 0.016));
    const v = input.tick(dt);
    game.setInput(v.x, v.y);
    // hud refresh
    $('#hud-g').textContent = (game.state.stats.maxG || 0).toFixed(1);
    $('#hud-sector').textContent = `G7-${String(game.state.sectorIndex).padStart(3,'0')}`;
    $('#hud-beacons').textContent = String(game.state.stats.beaconsHit);
    const remaining = Math.max(0, RUN_SECONDS - (game.state.t || 0));
    $('#hud-time').textContent = remaining.toFixed(1);
    hudTickId = requestAnimationFrame(tickHud);
  };
  hudTickId = requestAnimationFrame(tickHud);
}

// when the run ends, pop the recorder card
game.onEnd(stats => {
  // wait briefly so the hit-flash decay finishes
  setTimeout(() => fillRecorder(stats), stats.hit ? 600 : 250);
});

function fillRecorder(stats) {
  show('recorder');
  const cs = generateCallsign(stats);

  $('#rec-id').textContent = `REC // ${pad(Math.floor(Math.random() * 9999), 4)}`;
  $('#rec-callsign').textContent = cs.name;
  $('#rec-blurb').textContent    = cs.blurb;
  $('#rec-tail').textContent     = cs.tail;

  $('#rec-g').textContent      = `${(stats.maxG || 0).toFixed(1)}`;
  $('#rec-pass').textContent   = stats.closestPass === Infinity || stats.closestPass > 3
    ? '— m'
    : `${(stats.closestPass * 8).toFixed(1)} m`;
  $('#rec-sector').textContent = `G7-${pad(stats.sectorIndex, 3)}`;
  $('#rec-beacons').textContent = `${pad(stats.beaconsHit, 2)} / ${pad(Math.max(stats.beaconsTotal, stats.beaconsHit), 2)}`;

  // remember last result for share()
  window.__last = { cs, stats };
}

$('#btn-replay').addEventListener('click', () => {
  $('#btn-engage').disabled = false;
  $('#btn-engage').textContent = 'ENGAGE';
  show('preflight');
});

// share() — copies a tweet-shaped log line for the user
window.share = async function share() {
  const last = window.__last;
  if (!last) return;
  const cs = last.cs, s = last.stats;
  const passStr = (s.closestPass === Infinity || s.closestPass > 3) ? '—' : `${(s.closestPass * 8).toFixed(1)}m`;
  const txt = [
    `FLIGHT RECORDER · CONSOLE PILOT`,
    `the ship christens me ${cs.name.toUpperCase()}.`,
    `max-G ${s.maxG.toFixed(1)} · closest pass ${passStr} · sector G7-${pad(s.sectorIndex, 3)} · beacons ${s.beaconsHit}/${Math.max(s.beaconsTotal, s.beaconsHit)}`,
    location.href,
  ].join('\n');

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Console Pilot', text: txt, url: location.href });
    } else {
      await navigator.clipboard.writeText(txt);
      const c = $('#copied');
      c.removeAttribute('hidden');
      setTimeout(() => c.setAttribute('hidden', ''), 2200);
    }
  } catch (_e) {
    // user cancelled — say nothing
  }
};

function pad(n, w) {
  let s = String(Math.max(0, n | 0));
  while (s.length < w) s = '0' + s;
  return s;
}

// resize handling for the canvas
window.addEventListener('resize', () => {
  if (!screens.flight.hasAttribute('hidden')) game.resize();
});
