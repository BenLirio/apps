// Pointer + touch handling. Translates pointer coords to canvas cells,
// dispatches paints, and runs a timer that re-paints at the held
// position so a stationary brush continues to deposit material.

import { state } from '../state.js';
import { brushRadiusFor, paintAtFrag, paintLineFrag } from '../sim/paint.js';
import { hideOverlay } from './overlay.js';
import { probeAt, hideProbeTooltip } from './probe.js';

function canvasCell(e) {
  const { canvas, cols, rows } = state;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const fx = Math.floor(x * cols / rect.width);
  const fyRow = Math.floor(y * rows / rect.height);
  const fy = (rows - 1 - fyRow);
  return { c: fx, r: fy };
}

function startHoldPaint() {
  stopHoldPaint();
  state.holdPaintTimer = setInterval(() => {
    if (!state.isPointerDown || !state.lastPointer) return;
    paintAtFrag(state.lastPointer.c, state.lastPointer.r, brushRadiusFor(state.selectedKey));
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
  paintAtFrag(cell.c, cell.r, brushRadiusFor(state.selectedKey));
  hideOverlay();
  startHoldPaint();
}
function onPointerMove(e) {
  if (state.probeMode) {
    if (e.buttons || (e.pointerType === 'touch')) {
      e.preventDefault();
      const cell = canvasCell(e);
      probeAt(cell.c, cell.r);
    }
    return;
  }
  if (!state.isPointerDown) return;
  e.preventDefault();
  const cell = canvasCell(e);
  if (state.lastCell) paintLineFrag(state.lastCell.c, state.lastCell.r, cell.c, cell.r, brushRadiusFor(state.selectedKey));
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
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup',   onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  // Suppress double-tap zoom and pinch on the canvas.
  const swallowTouch = (e) => { if (e.cancelable) e.preventDefault(); };
  canvas.addEventListener('touchstart',  swallowTouch, { passive: false });
  canvas.addEventListener('touchmove',   swallowTouch, { passive: false });
  canvas.addEventListener('touchend',    swallowTouch, { passive: false });
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
  if (state.canvas) state.canvas.style.cursor = state.probeMode ? 'crosshair' : 'crosshair';
  if (!state.probeMode) hideProbeTooltip();
}
