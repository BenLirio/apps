// Pointer + touch handling. Translates pointer coordinates to canvas
// cells, dispatches paint, and runs a timer that re-paints at the held
// position so a stationary brush continues to deposit material.

import { state } from '../state.js';
import { brushRadiusFor, paintAt, paintLine } from '../sim/paint.js';
import { hideOverlay } from './overlay.js';
import { probeAt, hideProbeTooltip } from './probe.js';

function canvasCell(e) {
  const { canvas, cols, rows } = state;
  const rect = canvas.getBoundingClientRect();
  const fx = Math.floor((e.clientX - rect.left) * cols / rect.width);
  const fyRow = Math.floor((e.clientY - rect.top) * rows / rect.height);
  return { c: fx, r: rows - 1 - fyRow };
}

function startHoldPaint() {
  stopHoldPaint();
  state.holdPaintTimer = setInterval(() => {
    if (!state.isPointerDown || !state.lastPointer) return;
    paintAt(state.lastPointer.c, state.lastPointer.r, brushRadiusFor(state.selectedKey));
  }, 33);
}
function stopHoldPaint() {
  if (state.holdPaintTimer) { clearInterval(state.holdPaintTimer); state.holdPaintTimer = null; }
}

function onPointerDown(e) {
  e.preventDefault();
  state.canvas.setPointerCapture(e.pointerId);
  const cell = canvasCell(e);
  if (state.probeMode) { probeAt(cell.c, cell.r); return; }
  state.isPointerDown = true;
  state.lastCell = cell;
  state.lastPointer = cell;
  paintAt(cell.c, cell.r, brushRadiusFor(state.selectedKey));
  hideOverlay();
  startHoldPaint();
}
function onPointerMove(e) {
  if (state.probeMode) {
    if (e.buttons || e.pointerType === 'touch') {
      e.preventDefault();
      const cell = canvasCell(e);
      probeAt(cell.c, cell.r);
    }
    return;
  }
  if (!state.isPointerDown) return;
  e.preventDefault();
  const cell = canvasCell(e);
  if (state.lastCell) paintLine(state.lastCell.c, state.lastCell.r, cell.c, cell.r, brushRadiusFor(state.selectedKey));
  state.lastCell = cell;
  state.lastPointer = cell;
}
function onPointerUp() {
  state.isPointerDown = false;
  state.lastCell = null;
  state.lastPointer = null;
  stopHoldPaint();
}

export function bindCanvasInput() {
  const { canvas } = state;
  canvas.addEventListener('pointerdown',  onPointerDown);
  canvas.addEventListener('pointermove',  onPointerMove);
  canvas.addEventListener('pointerup',    onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  // Suppress double-tap zoom and pinch.
  const swallow = (e) => { if (e.cancelable) e.preventDefault(); };
  canvas.addEventListener('touchstart', swallow, { passive: false });
  canvas.addEventListener('touchmove',  swallow, { passive: false });
  canvas.addEventListener('touchend',   swallow, { passive: false });
  canvas.addEventListener('gesturestart',  (e) => e.preventDefault());
  canvas.addEventListener('gesturechange', (e) => e.preventDefault());
  canvas.addEventListener('gestureend',    (e) => e.preventDefault());
  canvas.addEventListener('contextmenu',   (e) => e.preventDefault());
  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 350 && e.cancelable) e.preventDefault();
    lastTap = now;
  }, { passive: false });
}

export function toggleProbe() {
  state.probeMode = !state.probeMode;
  const btn = document.getElementById('btn-probe');
  if (btn) btn.setAttribute('aria-pressed', state.probeMode ? 'true' : 'false');
  if (!state.probeMode) hideProbeTooltip();
}
