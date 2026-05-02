// Boot sequence:
//   1. Grab the canvas + WebGL2 context.
//   2. Seed the element registry with built-ins.
//   3. Build discovery rules and render the palette.
//   4. Compile shaders + create lookup textures (initGL).
//   5. Size the canvas and create ping-pong textures (resizeCanvas).
//   6. Wire up DOM event handlers.
//   7. Kick off the render loop.

import { state } from './state.js';
import { initBuiltIns } from './elements/builtins.js';
import { initGL } from './gl/context.js';
import { resizeCanvas } from './gl/grid.js';
import { rebuildPalette, setMaterial, syncActionLabel } from './ui/palette.js';
import { bindCanvasInput, toggleProbe } from './ui/input.js';
import { showOverlay } from './ui/overlay.js';
import { rebuildDiscoveryRules } from './discovery.js';
import { startDrop } from './sim/pours.js';
import { loop } from './sim/loop.js';
import { bindInventModal, bindElementFeedbackModal, openInvent } from './ui/modals.js';

function clearAll() {
  state.pours = [];
  if (state.gl) {
    const { gl, cols, rows, airCols, airRows } = state;
    const clear = (fbo, w, h, r, g, b, a) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([r, g, b, a]));
    };
    clear(state.stateFboA,  cols, rows,    0, 0, 0, 0);
    clear(state.stateFboB,  cols, rows,    0, 0, 0, 0);
    clear(state.tempFboA,   cols, rows,    30, 0, 0, 0);
    clear(state.tempFboB,   cols, rows,    30, 0, 0, 0);
    clear(state.chargeFboA, cols, rows,    128, 0, 0, 0);
    clear(state.chargeFboB, cols, rows,    128, 0, 0, 0);
    clear(state.airFboA,    airCols, airRows, 128, 128, 128, 30);
    clear(state.airFboB,    airCols, airRows, 128, 128, 128, 30);
  }
  setMaterial('wall');
  state.discoveredKeys.clear();
  state.discoveryToastQueue = [];
  showOverlay('paint walls or any element on the canvas.\npour from the top.\n\ntry: drop a battery onto copper, or paint lightning\non gunpowder. open invent for endless physics.');
}

function init() {
  state.canvas = document.getElementById('main-canvas');
  state.gl = state.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
  if (!state.gl) {
    showOverlay('this browser doesn\'t support webgl2.\ntry a recent chrome/firefox/safari.');
    return;
  }

  initBuiltIns();
  rebuildDiscoveryRules();
  rebuildPalette();
  try {
    initGL();
  } catch (err) {
    console.error('initGL failed:', err);
    showOverlay('webgl init failed:\n' + (err && err.message ? err.message : err)
      + '\n\nopen the console for the full shader log.');
    return;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  bindCanvasInput();

  // Toolbar buttons.
  document.getElementById('btn-drop').addEventListener('click', startDrop);
  document.getElementById('btn-probe').addEventListener('click', toggleProbe);
  document.getElementById('btn-reset').addEventListener('click', clearAll);
  document.getElementById('btn-invent').addEventListener('click', openInvent);

  // Modals.
  bindInventModal();
  bindElementFeedbackModal();

  showOverlay('paint walls or any element on the canvas.\npour from the top.\n\ntry: drop a battery onto copper, or paint lightning\non gunpowder. open invent for endless physics.');
  syncActionLabel();

  state.animId = requestAnimationFrame(loop);
}

// `<script type="module">` is deferred — DOM is parsed by the time we run.
init();
