// Main animation loop. Order matters: motion first (sim/explosion),
// then chemistry (react/corrosion/heat/ignition/phase/cellular/register),
// then fields (charge, pressure, pressure-blast), then render.
//
// Discovery readback is throttled because it's a synchronous GPU→CPU
// fence and would tank framerate if run every frame.

import { state } from '../state.js';
import { DISCOVERY_INTERVAL } from '../constants.js';
import { spawnFromPours } from './pours.js';
import {
  simStep, explosionStep, reactStep, corrosionStep, heatStep,
  ignitionStep, phaseStep, cellularStep, registerStep,
  chargeStep, pressureStep, pressureBlastStep, render,
} from './passes.js';
import { discoveryReadback } from '../discovery.js';

export function loop() {
  spawnFromPours();
  simStep();
  explosionStep();
  reactStep();
  corrosionStep();
  heatStep();
  ignitionStep();
  phaseStep();
  cellularStep();
  registerStep();
  chargeStep();
  pressureStep();
  pressureBlastStep();
  render();
  if (state.frameCounter % DISCOVERY_INTERVAL === 0) discoveryReadback();
  state.frameCounter++;
  state.animId = requestAnimationFrame(loop);
}
