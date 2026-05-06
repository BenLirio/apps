// loop.js — board state + canvas render + pan / zoom / target-pick input.
//
// Owns:
//   - The 200x200 Uint8Array board mirror (mutated by net.js callbacks).
//   - The off-screen draw of board → canvas via ImageData.
//   - Pan / pinch / double-tap zoom on the canvas.
//   - Tracking the user's "target" pixel (set by tap; cleared by commit).
//
// Does NOT own:
//   - Cooldown logic (app.js).
//   - Network calls (net.js).
//   - Steward-notice math (app.js).

const N = 200;          // grid side
const TOTAL = N * N;    // 40000

// 8 cursed-pastel hues, in colorIdx order. Must match style.css :root --c0..7.
export const PALETTE = [
  { idx: 0, name: 'saffron-7',     hex: '#f0c45a' },
  { idx: 1, name: 'periwinkle-7',  hex: '#c9a3d8' },
  { idx: 2, name: 'dusty-mauve-3', hex: '#b89db5' },
  { idx: 3, name: 'sage-9',        hex: '#9fb18c' },
  { idx: 4, name: 'oxblood-2',     hex: '#a9544c' },
  { idx: 5, name: 'mint-vapor',    hex: '#b4d8b6' },
  { idx: 6, name: 'butter-yellow', hex: '#f7e6a3' },
  { idx: 7, name: 'tea-rose',      hex: '#e6a8b3' },
];

const PALETTE_RGB = PALETTE.map(p => {
  const r = parseInt(p.hex.slice(1, 3), 16);
  const g = parseInt(p.hex.slice(3, 5), 16);
  const b = parseInt(p.hex.slice(5, 7), 16);
  return [r, g, b];
});
// Unowned cells get a paper-cream tint so the wall reads as paper, not white.
const UNOWNED_RGB = [255, 251, 239];

let board = new Uint8Array(TOTAL); board.fill(0xFF);
let dirty = true;

// Pan / zoom transform.
let scale = 1;
let panX = 0;
let panY = 0;

// Target pixel (set when user taps). null = no commit pending.
let target = null;

// Canvas + frame refs (set by init).
let canvas, ctx, frame;
let imageData;

// Callbacks to app.js (set via init opts).
let onTarget = () => {};

export function initBoard(opts) {
  canvas = opts.canvas;
  frame  = opts.frame;
  onTarget = opts.onTarget || (() => {});

  ctx = canvas.getContext('2d');
  imageData = ctx.createImageData(N, N);

  // Fit the canvas inside the frame at zoom=1: the canvas CSS already covers
  // the frame 100% × 100%. We scale via transform.
  applyTransform();
  attachInput();

  function rafLoop() {
    if (dirty) drawBoard();
    requestAnimationFrame(rafLoop);
  }
  requestAnimationFrame(rafLoop);
}

export function setBoard(arr) {
  if (!(arr instanceof Uint8Array) || arr.length !== TOTAL) return;
  board = arr;
  dirty = true;
}

export function setPixel(x, y, colorIdx) {
  if (x < 0 || x >= N || y < 0 || y >= N) return;
  const idx = y * N + x;
  const prev = board[idx];
  board[idx] = colorIdx & 0xFF;
  dirty = true;
  return prev; // returns previous color byte (0xFF if unowned)
}

export function getPixel(x, y) {
  if (x < 0 || x >= N || y < 0 || y >= N) return 0xFF;
  return board[y * N + x];
}

export function getBoard() {
  return board;
}

export function clearTarget() {
  target = null;
  onTarget(null);
  updateCrosshair();
}

export function getTarget() {
  return target;
}

// Set the target programmatically (used by the nudge dpad in app.js so users
// can fine-tune the exact pixel after a rough tap — at scale=1 each cell is
// only ~2.8px wide, smaller than a fingertip).
export function setTarget(x, y) {
  const cx = Math.max(0, Math.min(N - 1, x));
  const cy = Math.max(0, Math.min(N - 1, y));
  target = { x: cx, y: cy };
  onTarget(target);
  updateCrosshair();
}

// — Render —

function drawBoard() {
  const data = imageData.data;
  for (let i = 0; i < TOTAL; i++) {
    const v = board[i];
    const off = i * 4;
    const rgb = (v < 8) ? PALETTE_RGB[v] : UNOWNED_RGB;
    data[off]     = rgb[0];
    data[off + 1] = rgb[1];
    data[off + 2] = rgb[2];
    data[off + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  dirty = false;
}

// — Transform —

function applyTransform() {
  // Clamp pan so the canvas can't slide off-screen entirely.
  const fr = frame.getBoundingClientRect();
  const W = fr.width;
  const H = fr.height;
  const drawW = W * scale;
  const drawH = H * scale;
  const minX = Math.min(0, W - drawW);
  const minY = Math.min(0, H - drawH);
  panX = Math.min(0, Math.max(minX, panX));
  panY = Math.min(0, Math.max(minY, panY));
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  updateCrosshair();
}

function updateCrosshair() {
  const ch = document.getElementById('crosshair');
  const co = document.getElementById('crosshair-coord');
  if (!ch || !co) return;
  if (!target) { ch.hidden = true; return; }
  const fr = frame.getBoundingClientRect();
  const cell = (fr.width / N) * scale;
  const cx = panX + (target.x + 0.5) * cell;
  const cy = panY + (target.y + 0.5) * cell;
  ch.hidden = false;
  ch.style.width = `${Math.max(cell, 6)}px`;
  ch.style.height = `${Math.max(cell, 6)}px`;
  ch.style.left = `${cx}px`;
  ch.style.top  = `${cy}px`;
  co.textContent = `${target.x},${target.y}`;
}

// — Input —

let pointers = new Map(); // pointerId → {x, y, startX, startY, t}
let panStart = null;
let pinchStart = null;
let lastTap = { t: 0, x: 0, y: 0 };
let didDrag = false;

function attachInput() {
  frame.addEventListener('pointerdown', onDown, { passive: false });
  frame.addEventListener('pointermove', onMove, { passive: false });
  frame.addEventListener('pointerup', onUp, { passive: false });
  frame.addEventListener('pointercancel', onUp, { passive: false });
  frame.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', () => { applyTransform(); });
}

function frameXY(e) {
  const r = frame.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function frameToCell(fx, fy) {
  // Inverse of transform: (cell + 0.5) * cellW * scale + pan = fx
  const fr = frame.getBoundingClientRect();
  const cellW = fr.width / N;
  const bx = (fx - panX) / scale;
  const by = (fy - panY) / scale;
  const x = Math.floor(bx / cellW);
  const y = Math.floor(by / cellW);
  return { x, y };
}

function onDown(e) {
  e.preventDefault();
  frame.setPointerCapture(e.pointerId);
  const p = frameXY(e);
  pointers.set(e.pointerId, { ...p, startX: p.x, startY: p.y, t: performance.now() });
  didDrag = false;

  if (pointers.size === 1) {
    panStart = { panX, panY, x: p.x, y: p.y };
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      scale,
      panX,
      panY,
    };
  }
}

function onMove(e) {
  if (!pointers.has(e.pointerId)) return;
  e.preventDefault();
  const p = frameXY(e);
  pointers.set(e.pointerId, { ...pointers.get(e.pointerId), x: p.x, y: p.y });

  if (pointers.size === 1 && panStart) {
    const dx = p.x - panStart.x;
    const dy = p.y - panStart.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag = true;
    panX = panStart.panX + dx;
    panY = panStart.panY + dy;
    applyTransform();
  } else if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = dist / pinchStart.dist;
    const newScale = Math.min(20, Math.max(1, pinchStart.scale * ratio));
    // Zoom around the pinch midpoint.
    const k = newScale / pinchStart.scale;
    panX = pinchStart.midX - (pinchStart.midX - pinchStart.panX) * k;
    panY = pinchStart.midY - (pinchStart.midY - pinchStart.panY) * k;
    scale = newScale;
    didDrag = true;
    applyTransform();
  }
}

function onUp(e) {
  e.preventDefault();
  const wasMulti = pointers.size > 1;
  const start = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 0) panStart = null;

  if (wasMulti) return;
  if (didDrag) return;
  if (!start) return;

  const p = frameXY(e);
  const dx = p.x - start.startX;
  const dy = p.y - start.startY;
  if (Math.hypot(dx, dy) > 6) return;

  const now = performance.now();
  const dblTap = (now - lastTap.t < 320) && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30;
  lastTap = { t: now, x: p.x, y: p.y };

  if (dblTap) {
    // Toggle zoom: 1 → 6 → 1 (centered on tap).
    const targetScale = scale > 2 ? 1 : 6;
    const k = targetScale / scale;
    panX = p.x - (p.x - panX) * k;
    panY = p.y - (p.y - panY) * k;
    scale = targetScale;
    applyTransform();
    return;
  }

  // Single-tap: pick a cell.
  const { x, y } = frameToCell(p.x, p.y);
  if (x < 0 || x >= N || y < 0 || y >= N) return;
  target = { x, y };
  onTarget(target);
  updateCrosshair();
}

function onWheel(e) {
  e.preventDefault();
  const p = frameXY(e);
  const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15;
  const newScale = Math.min(20, Math.max(1, scale * factor));
  const k = newScale / scale;
  panX = p.x - (p.x - panX) * k;
  panY = p.y - (p.y - panY) * k;
  scale = newScale;
  applyTransform();
}
