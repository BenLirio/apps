/* loop.js — Hum The Shape
 *
 * Owns: per-screen state machine, rAF-driven play loop, all canvas rendering
 * (target, user trace, confirmation preview, receipt mini-canvases, share
 * card composition), input plumbing (mic-or-finger), and the share artifact.
 *
 * Pure data + math (target shapes, pitch detection, DTW, verdict tiers,
 * mic acquisition) lives in audio.js.
 */

import {
  SHAPES, SAMPLES, ROUND_SECONDS,
  dtw, verdictFor, detectPitch, acquireMic,
} from "./audio.js";

// ── State ────────────────────────────────────────────────────────────
const state = {
  mode: null,                    // 'mic' | 'finger'
  audio: null,                   // { ctx, analyser, buf, source } from acquireMic()
  rounds: [],                    // [{ shapeId, name, target, user, pct }, x3]
  currentRound: 0,
  playing: false,
  startTime: 0,
  userSamples: [],               // y in [0,1], one per ~40ms
  fingerActive: false,
  fingerY: 0.5,
  pitchRange: { min: 100, max: 350 }, // calibrated from confirm screen
  raf: 0,
  confRaf: 0,
  confTrace: [],
};

// ── DOM refs ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
let canvas, ctx, confCanvas, confCtx;
const screens = ["intro", "confirm", "play", "result"];
function show(name) {
  for (const s of screens) $("screen-" + s).hidden = (s !== name);
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// ── Init ─────────────────────────────────────────────────────────────
export function startLoop() {
  canvas = $("canvas-stage");
  ctx = canvas.getContext("2d");
  confCanvas = $("canvas-confirm");
  confCtx = confCanvas.getContext("2d");
  drawTarget(ctx, canvas, SHAPES[0].points);

  $("btn-start").addEventListener("click", onStartMic);
  $("btn-finger").addEventListener("click", onStartFinger);
  $("btn-confirm-yes").addEventListener("click", onConfirmYes);
  $("btn-confirm-no").addEventListener("click", onConfirmNo);
  $("btn-play").addEventListener("click", onPlay);
  $("btn-replay").addEventListener("click", () => location.reload());

  canvas.addEventListener("pointerdown", onFingerDown);
  canvas.addEventListener("pointermove", onFingerMove);
  window.addEventListener("pointerup", onFingerUp);
}

// ── Mic gate + confirmation ──────────────────────────────────────────
async function onStartMic() {
  $("btn-start").disabled = true;
  try {
    state.audio = await acquireMic();
    state.mode = "mic";
    show("confirm");
    runConfirmLoop();
  } catch (e) {
    state.mode = "finger";
    show("play");
    setupFingerMode();
  }
}
function onStartFinger() {
  state.mode = "finger";
  show("play");
  setupFingerMode();
}
function setupFingerMode() {
  $("finger-hint").hidden = false;
  $("play-prompt").textContent = "// finger-trace mode — drag across the canvas. top = high pitch.";
  prepareRound(0);
}

// Confirmation gate — show live red trace, ask "did the red line move?"
function runConfirmLoop() {
  const { analyser, buf, ctx: ctxA } = state.audio;
  const t0 = performance.now();
  state.confTrace = [];
  const observed = { min: 99999, max: 0 };
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    const hz = detectPitch(buf, ctxA.sampleRate);
    if (hz > 0) {
      observed.min = Math.min(observed.min, hz);
      observed.max = Math.max(observed.max, hz);
      const span = Math.max(40, observed.max - observed.min);
      const y = (hz - observed.min) / span;
      state.confTrace.push(clamp01(1 - y));
      if (state.confTrace.length > 200) state.confTrace.shift();
    } else {
      state.confTrace.push(null);
      if (state.confTrace.length > 200) state.confTrace.shift();
    }
    drawConfirm(state.confTrace);
    if (performance.now() - t0 < 6000) {
      state.confRaf = requestAnimationFrame(tick);
    }
  };
  tick();
  // calibrate: widen observed range slightly for headroom
  setTimeout(() => {
    if (observed.max > observed.min) {
      const pad = (observed.max - observed.min) * 0.4 + 20;
      state.pitchRange = {
        min: Math.max(60, observed.min - pad),
        max: Math.min(800, observed.max + pad),
      };
    }
  }, 5500);
}
function onConfirmYes() {
  cancelAnimationFrame(state.confRaf);
  show("play");
  prepareRound(0);
}
function onConfirmNo() {
  cancelAnimationFrame(state.confRaf);
  try { state.audio?.ctx?.close(); } catch {}
  state.audio = null;
  state.mode = "finger";
  show("play");
  setupFingerMode();
}

// ── Round flow ───────────────────────────────────────────────────────
function prepareRound(i) {
  state.currentRound = i;
  state.userSamples = [];
  state.playing = false;
  $("round-meta").textContent = `round ${i + 1} of 3`;
  $("shape-name").textContent = `SHAPE ${i + 1} — ${SHAPES[i].name}`;
  $("timer").textContent = `${ROUND_SECONDS.toFixed(1)}s`;
  $("btn-play").disabled = false;
  $("btn-play").textContent = "// START ROUND";
  drawTarget(ctx, canvas, SHAPES[i].points);
}
function onPlay() {
  if (state.playing) return;
  state.playing = true;
  state.userSamples = [];
  state.startTime = performance.now();
  $("btn-play").disabled = true;
  $("btn-play").textContent = "// LISTENING";
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(playTick);
}
function playTick(now) {
  const elapsed = (now - state.startTime) / 1000;
  const t = Math.min(1, elapsed / ROUND_SECONDS);
  const targetCount = Math.floor(t * SAMPLES);
  while (state.userSamples.length < targetCount) {
    state.userSamples.push(sampleInput());
  }
  $("timer").textContent = `${Math.max(0, ROUND_SECONDS - elapsed).toFixed(1)}s`;
  drawPlay(SHAPES[state.currentRound].points, state.userSamples);
  if (elapsed < ROUND_SECONDS) {
    state.raf = requestAnimationFrame(playTick);
  } else {
    finishRound();
  }
}
function sampleInput() {
  if (state.mode === "mic" && state.audio) {
    const { analyser, buf, ctx: ctxA } = state.audio;
    analyser.getFloatTimeDomainData(buf);
    const hz = detectPitch(buf, ctxA.sampleRate);
    if (hz <= 0) {
      const last = state.userSamples[state.userSamples.length - 1];
      return last == null ? null : last;
    }
    const { min, max } = state.pitchRange;
    const norm = (hz - min) / Math.max(1, max - min);
    return Math.max(0.02, Math.min(0.98, 1 - norm));
  }
  return state.fingerActive ? state.fingerY : (state.userSamples.at(-1) ?? null);
}

function finishRound() {
  const target = SHAPES[state.currentRound].points;
  const user = state.userSamples.slice(0, SAMPLES);
  const userFilled = user.map((v) => (v == null ? 0.5 : v));
  const cost = dtw(target, userFilled);
  const overlap = Math.max(0, Math.min(100, Math.round((1 - cost) * 100)));
  state.rounds.push({
    shapeId: SHAPES[state.currentRound].id,
    name: SHAPES[state.currentRound].name,
    target, user: userFilled, pct: overlap,
  });
  if (state.currentRound + 1 < SHAPES.length) {
    setTimeout(() => prepareRound(state.currentRound + 1), 700);
  } else {
    showResult();
  }
}

// ── Render ──────────────────────────────────────────────────────────
function drawTarget(c, can, target) {
  const w = can.width, h = can.height;
  c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(108, 255, 138, 0.10)"; c.lineWidth = 1;
  for (let g = 1; g < 4; g++) {
    c.beginPath(); c.moveTo(0, (h * g) / 4); c.lineTo(w, (h * g) / 4); c.stroke();
  }
  c.shadowBlur = 6; c.shadowColor = "rgba(255,255,255,0.35)";
  c.strokeStyle = "#f4f5f0"; c.lineWidth = 3;
  c.beginPath();
  for (let i = 0; i < target.length; i++) {
    const x = (i / (target.length - 1)) * w;
    const y = target[i] * h;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  c.shadowBlur = 0;
}
function drawPlay(target, user) {
  drawTarget(ctx, canvas, target);
  const w = canvas.width, h = canvas.height;
  ctx.shadowBlur = 14; ctx.shadowColor = "rgba(255,60,70,0.65)";
  ctx.strokeStyle = "#ff2d36"; ctx.lineWidth = 3;
  ctx.beginPath();
  let drawing = false;
  for (let i = 0; i < user.length; i++) {
    const v = user[i];
    if (v == null) { drawing = false; continue; }
    const x = (i / (SAMPLES - 1)) * w;
    const y = v * h;
    if (!drawing) { ctx.moveTo(x, y); drawing = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}
function drawConfirm(trace) {
  const w = confCanvas.width, h = confCanvas.height;
  confCtx.fillStyle = "#000"; confCtx.fillRect(0, 0, w, h);
  confCtx.strokeStyle = "rgba(255,255,255,0.35)"; confCtx.lineWidth = 1;
  confCtx.beginPath();
  confCtx.moveTo(0, h * 0.5); confCtx.lineTo(w, h * 0.5);
  confCtx.stroke();
  confCtx.shadowBlur = 12; confCtx.shadowColor = "rgba(255,60,70,0.7)";
  confCtx.strokeStyle = "#ff2d36"; confCtx.lineWidth = 2.5;
  confCtx.beginPath();
  let drawing = false;
  for (let i = 0; i < trace.length; i++) {
    const v = trace[i];
    if (v == null) { drawing = false; continue; }
    const x = (i / 200) * w;
    const y = v * h;
    if (!drawing) { confCtx.moveTo(x, y); drawing = true; }
    else confCtx.lineTo(x, y);
  }
  confCtx.stroke();
  confCtx.shadowBlur = 0;
}

// ── Finger fallback ──────────────────────────────────────────────────
function onFingerDown(e) {
  if (state.mode !== "finger") return;
  state.fingerActive = true;
  updateFingerY(e);
}
function onFingerMove(e) {
  if (state.mode !== "finger" || !state.fingerActive) return;
  updateFingerY(e);
}
function onFingerUp() { state.fingerActive = false; }
function updateFingerY(e) {
  const r = canvas.getBoundingClientRect();
  state.fingerY = clamp01((e.clientY - r.top) / r.height);
}

// ── Result + share ───────────────────────────────────────────────────
function showResult() {
  const total = Math.round(
    state.rounds.reduce((a, r) => a + r.pct, 0) / state.rounds.length
  );
  const v = verdictFor(total);
  $("verdict-name").textContent = v.name;
  $("verdict-stat").textContent = `path overlap: ${total}%`;
  $("microcopy").textContent = `${v.tone} ${roundsRecap()}`;
  for (let i = 0; i < state.rounds.length; i++) {
    const row = $("receipt-row-" + (i + 1));
    row.innerHTML = "";
    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = SHAPES[i].name.toUpperCase();
    const c = document.createElement("canvas");
    c.width = 320; c.height = 80;
    drawSmallInto(c.getContext("2d"), 0, 0, 320, 80, state.rounds[i].target, state.rounds[i].user);
    const pct = document.createElement("div");
    pct.className = "pct";
    pct.textContent = state.rounds[i].pct + "%";
    row.appendChild(lbl); row.appendChild(c); row.appendChild(pct);
  }
  show("result");
}
function roundsRecap() {
  return state.rounds.map((r, i) => `${SHAPES[i].name} ${r.pct}%`).join(" · ");
}

export async function shareResult() {
  const card = composeShareCard();
  const dataUrl = card.toDataURL("image/png");
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], "hum-the-shape.png", { type: "image/png" });
  const url = location.origin + location.pathname;
  const total = Math.round(
    state.rounds.reduce((a, r) => a + r.pct, 0) / state.rounds.length
  );
  const v = verdictFor(total);
  const text = `I'm a ${v.name} on Hum The Shape — overlap ${total}%. Try it:`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, url }); $("share-state").textContent = "// shared."; return; }
    catch { /* fallthrough */ }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    $("share-state").textContent = "// link copied to clipboard.";
  } catch {
    $("share-state").textContent = "// long-press the result image to save.";
  }
}
function composeShareCard() {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 600;
  const x = c.getContext("2d");
  x.fillStyle = "#050708"; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#6cff8a";
  x.font = 'bold 28px "Share Tech Mono", ui-monospace, monospace';
  x.fillText("// HUM THE SHAPE", 40, 56);
  const total = Math.round(
    state.rounds.reduce((a, r) => a + r.pct, 0) / state.rounds.length
  );
  const v = verdictFor(total);
  x.fillStyle = "#e8d39a";
  x.font = 'bold 86px "VT323", "Share Tech Mono", monospace';
  x.fillText(v.name, 40, 150);
  x.fillStyle = "#ff2d36";
  x.font = 'bold 38px "Share Tech Mono", monospace';
  x.fillText(`PATH OVERLAP ${total}%`, 40, 200);
  for (let i = 0; i < state.rounds.length; i++) {
    const px = 40 + i * 340, py = 250;
    x.strokeStyle = "#1c2326"; x.lineWidth = 2;
    x.strokeRect(px, py, 320, 200);
    drawSmallInto(x, px, py, 320, 200, state.rounds[i].target, state.rounds[i].user);
    x.fillStyle = "#8a7a4a";
    x.font = '18px "Share Tech Mono", monospace';
    x.fillText(SHAPES[i].name.toUpperCase(), px, py - 12);
    x.fillStyle = "#ff2d36";
    x.font = 'bold 28px "VT323", monospace';
    x.fillText(state.rounds[i].pct + "%", px + 240, py - 8);
  }
  x.fillStyle = "#8a7a4a";
  x.font = '22px "Share Tech Mono", monospace';
  x.fillText("benlirio.com/apps/hum-the-shape", 40, 560);
  return c;
}
function drawSmallInto(x, ox, oy, w, h, target, user) {
  x.fillStyle = "#000"; x.fillRect(ox, oy, w, h);
  x.strokeStyle = "#f4f5f0"; x.lineWidth = 2;
  x.beginPath();
  for (let i = 0; i < target.length; i++) {
    const px = ox + (i / (target.length - 1)) * w;
    const py = oy + target[i] * h;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.stroke();
  x.shadowBlur = 12; x.shadowColor = "rgba(255,60,70,0.7)";
  x.strokeStyle = "#ff2d36"; x.lineWidth = 2.5;
  x.beginPath();
  let drawing = false;
  for (let i = 0; i < user.length; i++) {
    const v = user[i];
    if (v == null) { drawing = false; continue; }
    const px = ox + (i / (user.length - 1)) * w;
    const py = oy + v * h;
    if (!drawing) { x.moveTo(px, py); drawing = true; }
    else x.lineTo(px, py);
  }
  x.stroke();
  x.shadowBlur = 0;
}
