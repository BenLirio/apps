// loop.js — game state machine + drawing canvas + render.
// Net protocol lives in net.js. Country data + scoring in their own files.
//
// Game flow (one job per screen):
//   waiting -> [ prompt -> round (draw) -> submitted -> reveal -> standings ] x3 -> match-result
// Each round both players draw on their OWN canvas, then submit their stroke
// path to the opponent. When both have submitted (or the 60s timer expires),
// scores resolve identically on both sides.

import * as net from './net.js';
import { COUNTRIES, pickCountry } from './countries.js';
import { scoreDrawing, renderOverlay } from './scoring.js';

// ── Aesthetic palette (matches style.css "cartographer's notebook") ──
const PALETTE = {
  paper: '#f6efde',
  ink: '#1c2240',
  refFill: 'rgba(180, 60, 40, 0.10)',
  refStroke: 'rgba(180, 60, 40, 0.60)',
  inkLight: 'rgba(28, 34, 64, 0.35)'
};

// ── State ────────────────────────────────────────────────────────────
const state = {
  role: null,            // 'host' | 'guest'
  playerName: '',
  opponentName: '',
  scores: [0, 0],        // [me, opponent] — display-only, indexed by perspective
  myWins: 0,
  oppWins: 0,
  round: 0,              // 0..2
  totalRounds: 3,
  currentCountry: null,  // { name, hint, poly, index }
  myStroke: [],          // [[x,y], ...] in *my* canvas pixel space
  oppStroke: null,       // received from opponent (px coords + canvas dims)
  myCanvasDims: null,    // { w, h } captured at submit time
  oppCanvasDims: null,
  myScore: null,
  oppScore: null,
  mySubmitted: false,
  oppSubmitted: false,
  timerId: null,
  roundDeadline: null,
  matchOver: false,
  drawing: false
};

const ROUND_SECONDS = 60;

// ── DOM helpers ──────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const SCREEN_IDS = [
  'screen-hero',
  'screen-create',
  'screen-join',
  'screen-waiting',
  'screen-prompt',
  'screen-round',
  'screen-submitted',
  'screen-round-result',
  'screen-standings',
  'screen-match-result'
];

function show(screenId) {
  SCREEN_IDS.forEach(id => {
    const el = $(id);
    if (el) el.hidden = (id !== screenId);
  });
  // Each phase is its own page — start it from the top.
  window.scrollTo(0, 0);
}

// ── Drawing canvas ───────────────────────────────────────────────────
let drawCtx = null;
let drawCanvas = null;
let lastDrawnPoints = 0;

function setupDrawCanvas() {
  drawCanvas = $('draw-canvas');
  // Use ResizeObserver-ish approach: size at the moment of first round display.
  fitCanvasToParent(drawCanvas);
  drawCtx = drawCanvas.getContext('2d');
  drawCtx.lineWidth = 3;
  drawCtx.lineJoin = 'round';
  drawCtx.lineCap = 'round';
  drawCtx.strokeStyle = PALETTE.ink;

  // Pointer events for unified mouse + touch + pen
  drawCanvas.addEventListener('pointerdown', onPointerDown);
  drawCanvas.addEventListener('pointermove', onPointerMove);
  drawCanvas.addEventListener('pointerup', onPointerUp);
  drawCanvas.addEventListener('pointercancel', onPointerUp);
  drawCanvas.addEventListener('pointerleave', onPointerUp);
  // Suppress default touch behaviors that fight a drawing canvas
  drawCanvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  drawCanvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  drawCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function fitCanvasToParent(canvas) {
  // Square canvas sized to the smaller of (parent width, available height budget).
  const parent = canvas.parentElement;
  const rect = parent.getBoundingClientRect();
  // Reserve room for prompt + buttons below
  const maxH = Math.min(window.innerHeight * 0.55, 520);
  const size = Math.max(180, Math.min(rect.width - 4, maxH));
  canvas.width = Math.floor(size);
  canvas.height = Math.floor(size);
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
}

function pointerXY(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (drawCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (drawCanvas.height / rect.height);
  return [x, y];
}

function onPointerDown(e) {
  if (state.mySubmitted) return;
  state.drawing = true;
  drawCanvas.setPointerCapture(e.pointerId);
  state.myStroke = [pointerXY(e)];
  redrawMyCanvas();
}

function onPointerMove(e) {
  if (!state.drawing || state.mySubmitted) return;
  state.myStroke.push(pointerXY(e));
  // Incremental draw (cheaper than full redraw)
  const ctx = drawCtx;
  const pts = state.myStroke;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  lastDrawnPoints = pts.length;
  updateSubmitState();
}

function onPointerUp() {
  state.drawing = false;
  updateSubmitState();
}

function clearDrawing() {
  state.myStroke = [];
  redrawMyCanvas();
  updateSubmitState();
}

function redrawMyCanvas() {
  const ctx = drawCtx;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  // subtle grid
  ctx.strokeStyle = 'rgba(28,34,64,0.08)';
  ctx.lineWidth = 1;
  const step = drawCanvas.width / 8;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(i*step,0); ctx.lineTo(i*step,drawCanvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i*step); ctx.lineTo(drawCanvas.width,i*step); ctx.stroke();
  }
  // stroke
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  if (state.myStroke.length > 1) {
    ctx.beginPath();
    state.myStroke.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();
  }
  lastDrawnPoints = state.myStroke.length;
}

function updateSubmitState() {
  const submitBtn = $('submit-btn');
  const clearBtn = $('clear-btn');
  if (state.mySubmitted) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'submitted — waiting on the rival';
    clearBtn.disabled = true;
  } else {
    const canSubmit = state.myStroke.length > 8;
    submitBtn.disabled = !canSubmit;
    submitBtn.textContent = canSubmit ? 'lock it in' : 'draw the outline first';
    clearBtn.disabled = state.myStroke.length === 0;
  }
}

// ── Round flow ───────────────────────────────────────────────────────
function startMatch() {
  state.myWins = 0;
  state.oppWins = 0;
  state.round = 0;
  state.matchOver = false;
  startRound();
}

function startRound() {
  state.currentCountry = pickCountry(net.getRoomCode(), state.round);
  state.myStroke = [];
  state.oppStroke = null;
  state.mySubmitted = false;
  state.oppSubmitted = false;
  state.myScore = null;
  state.oppScore = null;
  state.myCanvasDims = null;
  state.oppCanvasDims = null;

  showPrompt();
}

// 60s clock does NOT start here — only after the player taps "begin drawing".
function showPrompt() {
  show('screen-prompt');
  $('prompt-round-label').textContent = `round ${state.round + 1} of ${state.totalRounds}`;
  $('prompt-country-name').textContent = state.currentCountry.name;
  $('prompt-country-hint').textContent = state.currentCountry.hint;
}

// Round timer starts here — exiting the prompt page is what kicks the clock.
function enterDrawingPhase() {
  show('screen-round');
  $('round-country-label').textContent = `drawing ${state.currentCountry.name.toLowerCase()}`;

  // Re-fit canvas in case the viewport changed (or this is the first time it's visible)
  requestAnimationFrame(() => {
    fitCanvasToParent(drawCanvas);
    redrawMyCanvas();
    updateSubmitState();
    startTimer();
  });
}

function startTimer() {
  clearInterval(state.timerId);
  state.roundDeadline = Date.now() + ROUND_SECONDS * 1000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((state.roundDeadline - Date.now()) / 1000));
    $('timer').textContent = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(state.timerId);
      // Auto-submit whatever we've got
      if (!state.mySubmitted) submitDrawing();
    }
  };
  tick();
  state.timerId = setInterval(tick, 250);
}

function submitDrawing() {
  if (state.mySubmitted) return;
  state.mySubmitted = true;
  state.myCanvasDims = { w: drawCanvas.width, h: drawCanvas.height };
  // Compute and cache my own score immediately (deterministic)
  state.myScore = scoreDrawing(
    state.myStroke, state.myCanvasDims.w, state.myCanvasDims.h, state.currentCountry.poly
  );
  updateSubmitState();

  net.sendUpdate({
    kind: 'round_submit',
    round: state.round,
    countryIndex: state.currentCountry.index,
    stroke: state.myStroke,
    canvasW: state.myCanvasDims.w,
    canvasH: state.myCanvasDims.h
  });

  show('screen-submitted');

  tryResolveRound();
}

function onPeerSubmit(s) {
  // Ignore submissions for a different round (e.g. lag from previous round)
  if (s.round !== state.round) return;
  state.oppSubmitted = true;
  state.oppStroke = s.stroke;
  state.oppCanvasDims = { w: s.canvasW, h: s.canvasH };
  state.oppScore = scoreDrawing(
    s.stroke, s.canvasW, s.canvasH, state.currentCountry.poly
  );
  tryResolveRound();
}

function tryResolveRound() {
  if (!state.mySubmitted || !state.oppSubmitted) return;
  clearInterval(state.timerId);
  if (state.myScore > state.oppScore) state.myWins++;
  else if (state.oppScore > state.myScore) state.oppWins++;
  // ties → no point either way (rare with continuous IoU score)

  showRoundResult();
}

// Reveal-only — running match score and "next" CTA live on the standings page.
function showRoundResult() {
  show('screen-round-result');
  $('rr-country').textContent = state.currentCountry.name;
  $('rr-my-name').textContent = state.playerName || 'you';
  $('rr-opp-name').textContent = state.opponentName || 'rival';
  $('rr-my-score').textContent = state.myScore + '%';
  $('rr-opp-score').textContent = state.oppScore + '%';

  let verdict;
  if (state.myScore > state.oppScore) verdict = 'YOU WIN THE ROUND';
  else if (state.oppScore > state.myScore) verdict = 'YOU LOSE THE ROUND';
  else verdict = "DEAD HEAT";
  $('rr-verdict').textContent = verdict;

  // Render overlays
  const myOverlay = $('rr-my-overlay');
  const oppOverlay = $('rr-opp-overlay');
  fitOverlayCanvas(myOverlay);
  fitOverlayCanvas(oppOverlay);
  renderOverlay(myOverlay, state.myStroke, state.myCanvasDims.w, state.myCanvasDims.h, state.currentCountry.poly, PALETTE);
  if (state.oppStroke) {
    renderOverlay(oppOverlay, state.oppStroke, state.oppCanvasDims.w, state.oppCanvasDims.h, state.currentCountry.poly, PALETTE);
  }

  $('rr-next-btn').onclick = showStandings;
}

function showStandings() {
  show('screen-standings');
  $('standings-round-label').textContent = `after round ${state.round + 1} of ${state.totalRounds}`;
  $('st-my-name').textContent = state.playerName || 'you';
  $('st-opp-name').textContent = state.opponentName || 'rival';
  $('st-my-wins').textContent = state.myWins;
  $('st-opp-wins').textContent = state.oppWins;

  const isMatchOver = (state.round + 1) >= state.totalRounds || state.myWins > state.totalRounds/2 || state.oppWins > state.totalRounds/2;

  let flavor;
  if (isMatchOver) {
    flavor = 'all rounds are in. one final verdict awaits.';
  } else if (state.myWins > state.oppWins) {
    flavor = 'you lead. press the advantage on the next country.';
  } else if (state.oppWins > state.myWins) {
    flavor = `${state.opponentName || 'they'} lead. answer back on the next country.`;
  } else {
    flavor = 'level pegging. the next country breaks the tie.';
  }
  $('standings-flavor').textContent = flavor;

  const btn = $('standings-next-btn');
  btn.textContent = isMatchOver ? 'see the verdict' : 'next country';
  btn.onclick = () => {
    if (isMatchOver) {
      showMatchResult();
    } else {
      state.round++;
      startRound();
    }
  };
}

function fitOverlayCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const size = Math.max(120, Math.min(rect.width, 220));
  canvas.width = Math.floor(size);
  canvas.height = Math.floor(size);
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
}

function showMatchResult() {
  state.matchOver = true;
  show('screen-match-result');
  let headline;
  if (state.myWins > state.oppWins) headline = 'CARTOGRAPHER LAUREATE';
  else if (state.oppWins > state.myWins) headline = 'OUTDRAWN';
  else headline = "EVENLY MEMORISED";
  $('mr-headline').textContent = headline;
  $('mr-detail').textContent = state.myWins > state.oppWins
    ? `${state.myWins}–${state.oppWins} over ${state.opponentName || 'your rival'}. The atlas in your head is sharper than theirs.`
    : state.oppWins > state.myWins
      ? `${state.opponentName || 'They'} took it ${state.oppWins}–${state.myWins}. Re-study the boot, the hexagon, and the long thin sliver.`
      : `${state.myWins}–${state.oppWins}. A pair of cartographers who have read the same maps.`;
  $('mr-final-score').textContent = `you ${state.myWins} · ${state.oppWins} ${state.opponentName || 'rival'}`;
}

// ── Net wiring ───────────────────────────────────────────────────────
function startGame(opponent) {
  state.opponentName = opponent || 'rival';
  startMatch();
}

// Rematch handshake — symmetric per multiplayer.md "Rematch handshake on the relay"
let rematchPending = false;

function resetForRematch() {
  state.myWins = 0;
  state.oppWins = 0;
  state.round = 0;
  state.matchOver = false;
  rematchPending = false;
}

function onRematchSignal() {
  if (rematchPending) {
    // We already asked → this is the peer's confirmation. Host kicks off.
    if (state.role === 'host') {
      resetForRematch();
      net.sendUpdate({ kind: 'rematch_start' });
      startRound();
    }
  } else {
    // Peer asked first. Mirror + echo. Host kicks off after confirming.
    rematchPending = true;
    net.sendUpdate({ kind: 'rematch' });
    if (state.role === 'host') {
      resetForRematch();
      net.sendUpdate({ kind: 'rematch_start' });
      startRound();
    }
  }
}

function requestRematch() {
  if (rematchPending) return;
  rematchPending = true;
  net.sendUpdate({ kind: 'rematch' });
  // Wait for peer's echo before starting (host) / starting (guest on rematch_start)
}

net.on('peer_update', ({ state: s }) => {
  if (!s) return;
  if (s.kind === 'round_submit') onPeerSubmit(s);
  else if (s.kind === 'rematch') onRematchSignal();
  else if (s.kind === 'rematch_start' && state.role === 'guest') {
    resetForRematch();
    startRound();
  }
});

net.on('opponent_disconnected', () => {
  if (state.matchOver) return;
  show('screen-match-result');
  $('mr-headline').textContent = 'RIVAL VANISHED';
  $('mr-detail').textContent = 'Their tab closed mid-round. Refresh and challenge someone with better wifi.';
  $('mr-final-score').textContent = '';
  $('rematch-btn').hidden = true;
});

// ── Entry from app.js ────────────────────────────────────────────────
export function init({ role, playerName, opponentName, roomCode }) {
  state.role = role;
  state.playerName = playerName;
  state.opponentName = opponentName || '';
  net.setRoomCode(roomCode);
  setupDrawCanvas();

  $('clear-btn').onclick = clearDrawing;
  $('submit-btn').onclick = submitDrawing;
  $('begin-drawing-btn').onclick = enterDrawingPhase;
  $('rematch-btn').onclick = requestRematch;
  $('share-btn').onclick = window.share;

  // Begin
  startGame(opponentName);
}

export { show };
