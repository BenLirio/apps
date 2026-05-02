// Boot sequence:
//   1. Grab the canvas + WebGL2 context.
//   2. Seed the element registry with built-ins.
//   3. Compile shaders + create lookup textures (initGL).
//   4. Render the palette toolbar.
//   5. Size the canvas and create ping-pong textures (resizeCanvas).
//   6. Wire up DOM event handlers.
//   7. Start the render loop.

import { state } from './state.js';
import { initBuiltIns } from './elements.js';
import { initGL } from './gl/context.js';
import { resizeCanvas } from './gl/grid.js';
import { rebuildPalette, setMaterial } from './ui/palette.js';
import { bindCanvasInput, toggleProbe } from './ui/input.js';
import { showOverlay } from './ui/overlay.js';
import { loop } from './sim/loop.js';
import { bindInventModal, bindElementFeedbackModal, openInvent } from './ui/modals.js';

const HINT = 'paint walls or any element on the canvas.\n'
           + 'try: drop a battery onto copper, or paint lightning\n'
           + 'on gunpowder. open invent for endless physics.';

function clearAll() {
  state.state.clear (0, 0, 0, 0);
  state.temp.clear  (30, 0, 0, 0);
  state.charge.clear(128, 0, 0, 0);
  state.air.clear   (128, 128, 128, 30);
  setMaterial('wall');
  showOverlay(HINT);
}

function init() {
  state.canvas = document.getElementById('main-canvas');
  state.gl = state.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
  if (!state.gl) {
    showOverlay('this browser doesn\'t support webgl2.\ntry a recent chrome/firefox/safari.');
    return;
  }

  initBuiltIns();
  rebuildPalette();
  try {
    initGL();
  } catch (err) {
    console.error('initGL failed:', err);
    showOverlay('webgl init failed:\n' + (err?.message ?? err)
      + '\n\nopen the console for the full shader log.');
    return;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  bindCanvasInput();
  document.getElementById('btn-probe').addEventListener('click', toggleProbe);
  document.getElementById('btn-reset').addEventListener('click', clearAll);
  document.getElementById('btn-invent').addEventListener('click', openInvent);
  bindInventModal();
  bindElementFeedbackModal();

  showOverlay(HINT);
  state.animId = requestAnimationFrame(loop);
}

// `<script type="module">` is deferred — DOM is parsed by the time we run.
init();
