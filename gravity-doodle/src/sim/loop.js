// Main animation loop. The pass pipeline lives in sim/passes.js.

import { state } from '../state.js';
import { runFrame } from './passes.js';

export function loop() {
  runFrame();
  state.frame++;
  state.animId = requestAnimationFrame(loop);
}
