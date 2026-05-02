// One function per simulation pass. Each runs its program, ping-pongs
// the appropriate texture pair, and returns. The orchestrator
// (sim/loop.js) decides the order they fire each frame.
//
// Adding a new pass: import the program from state, add a function here
// in the same shape (bind inputs, drawArrays, swap), then call it from
// loop.js where it belongs in the pipeline.

import { state } from '../state.js';
import { bindStateA, bindElementData, bindTraits } from '../gl/context.js';

// Swap helpers — keep the ping-pong pattern in one place.
function swapState() {
  [state.stateTexA, state.stateTexB] = [state.stateTexB, state.stateTexA];
  [state.stateFboA, state.stateFboB] = [state.stateFboB, state.stateFboA];
}
function swapTemp() {
  [state.tempTexA, state.tempTexB] = [state.tempTexB, state.tempTexA];
  [state.tempFboA, state.tempFboB] = [state.tempFboB, state.tempFboA];
}
function swapCharge() {
  [state.chargeTexA, state.chargeTexB] = [state.chargeTexB, state.chargeTexA];
  [state.chargeFboA, state.chargeFboB] = [state.chargeFboB, state.chargeFboA];
}
function swapAir() {
  [state.airTexA, state.airTexB] = [state.airTexB, state.airTexA];
  [state.airFboA, state.airFboB] = [state.airFboB, state.airFboA];
}

export function simStep() {
  const { gl, progSim, frameCounter, cols, rows, airCols, airRows } = state;
  for (let phase = 0; phase < 4; phase++) {
    gl.useProgram(progSim);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
    gl.viewport(0, 0, cols, rows);
    bindStateA(progSim, 'uState', 0);
    bindElementData(progSim, 'uElemData', 1);
    bindTraits(progSim, 'uTraits', 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, state.airTexA);
    gl.uniform1i(gl.getUniformLocation(progSim, 'uAir'), 3);
    gl.uniform1i(gl.getUniformLocation(progSim, 'uPhase'), (frameCounter * 4 + phase) & 3);
    gl.uniform1i(gl.getUniformLocation(progSim, 'uFrame'), frameCounter * 4 + phase);
    gl.uniform2i(gl.getUniformLocation(progSim, 'uSize'), cols, rows);
    gl.uniform2i(gl.getUniformLocation(progSim, 'uAirSize'), airCols, airRows);
    gl.bindVertexArray(state.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    swapState();
  }
}

export function explosionStep() {
  const { gl, progContact, progBlast, frameCounter, cols, rows, keyToId } = state;
  gl.useProgram(progContact);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progContact, 'uState', 0);
  bindElementData(progContact, 'uElemData', 1);
  gl.uniform2i(gl.getUniformLocation(progContact, 'uSize'), cols, rows);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();

  gl.useProgram(progBlast);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progBlast, 'uState', 0);
  bindElementData(progBlast, 'uElemData', 1);
  gl.uniform2i(gl.getUniformLocation(progBlast, 'uSize'), cols, rows);
  gl.uniform1ui(gl.getUniformLocation(progBlast, 'uSparkId'), (keyToId.spark || 0) >>> 0);
  gl.uniform1i(gl.getUniformLocation(progBlast, 'uFrame'), frameCounter);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();
}

export function reactStep() {
  const { gl, progReact, frameCounter, cols, rows } = state;
  gl.useProgram(progReact);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progReact, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.reactionsTex);
  gl.uniform1i(gl.getUniformLocation(progReact, 'uReactions'), 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, state.tempTexA);
  gl.uniform1i(gl.getUniformLocation(progReact, 'uTemp'), 2);
  gl.uniform2i(gl.getUniformLocation(progReact, 'uSize'), cols, rows);
  gl.uniform1i(gl.getUniformLocation(progReact, 'uFrame'), frameCounter);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();
}

export function corrosionStep() {
  const { gl, progCorrosion, frameCounter, cols, rows } = state;
  if (!progCorrosion) return;
  gl.useProgram(progCorrosion);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progCorrosion, 'uState', 0);
  bindTraits(progCorrosion, 'uTraits', 1);
  gl.uniform2i(gl.getUniformLocation(progCorrosion, 'uSize'), cols, rows);
  gl.uniform1i(gl.getUniformLocation(progCorrosion, 'uFrame'), frameCounter);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();
}

export function phaseStep() {
  const { gl, progPhase, frameCounter, cols, rows } = state;
  if (!progPhase) return;
  gl.useProgram(progPhase);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progPhase, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.tempTexA);
  gl.uniform1i(gl.getUniformLocation(progPhase, 'uTemp'), 1);
  bindTraits(progPhase, 'uTraits', 2);
  bindElementData(progPhase, 'uElemData', 3);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, state.registersTex);
  gl.uniform1i(gl.getUniformLocation(progPhase, 'uRegisters'), 4);
  gl.uniform2i(gl.getUniformLocation(progPhase, 'uSize'), cols, rows);
  gl.uniform1i(gl.getUniformLocation(progPhase, 'uFrame'), frameCounter);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();
}

export function heatStep() {
  const { gl, progHeat, cols, rows } = state;
  if (!progHeat) return;
  gl.useProgram(progHeat);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.tempFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progHeat, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.tempTexA);
  gl.uniform1i(gl.getUniformLocation(progHeat, 'uTemp'), 1);
  bindTraits(progHeat, 'uTraits', 2);
  gl.uniform2i(gl.getUniformLocation(progHeat, 'uSize'), cols, rows);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapTemp();
}

export function ignitionStep() {
  const { gl, progIgnition, frameCounter, cols, rows, keyToId } = state;
  if (!progIgnition) return;
  const fireId = keyToId.fire || 0;
  gl.useProgram(progIgnition);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progIgnition, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.tempTexA);
  gl.uniform1i(gl.getUniformLocation(progIgnition, 'uTemp'), 1);
  bindTraits(progIgnition, 'uTraits', 2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, state.chargeTexA);
  gl.uniform1i(gl.getUniformLocation(progIgnition, 'uCharge'), 3);
  gl.uniform2i(gl.getUniformLocation(progIgnition, 'uSize'), cols, rows);
  gl.uniform1i(gl.getUniformLocation(progIgnition, 'uFrame'), frameCounter);
  gl.uniform1ui(gl.getUniformLocation(progIgnition, 'uFireId'), fireId >>> 0);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();
}

export function cellularStep() {
  const { gl, progCellular, frameCounter, cols, rows, registry } = state;
  if (!progCellular) return;
  for (const idStr of Object.keys(registry)) {
    const id = +idStr;
    const spec = registry[id];
    if (!spec || spec.kind !== 'cellular') continue;
    const tick = Math.max(1, Math.min(15, Math.round(spec.cellularTick || 6)));
    if (frameCounter % tick !== 0) continue;
    gl.useProgram(progCellular);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
    gl.viewport(0, 0, cols, rows);
    bindStateA(progCellular, 'uState', 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.cellularDataTex);
    gl.uniform1i(gl.getUniformLocation(progCellular, 'uCellularData'), 1);
    gl.uniform2i(gl.getUniformLocation(progCellular, 'uSize'), cols, rows);
    gl.uniform1ui(gl.getUniformLocation(progCellular, 'uCellularId'), id >>> 0);
    gl.uniform1i(gl.getUniformLocation(progCellular, 'uFrame'), frameCounter);
    gl.bindVertexArray(state.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    swapState();
  }
}

export function registerStep() {
  const { gl, progRegister, frameCounter, cols, rows } = state;
  if (!progRegister) return;
  gl.useProgram(progRegister);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progRegister, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.registersTex);
  gl.uniform1i(gl.getUniformLocation(progRegister, 'uRegisters'), 1);
  bindElementData(progRegister, 'uElemData', 2);
  gl.uniform2i(gl.getUniformLocation(progRegister, 'uSize'), cols, rows);
  gl.uniform1i(gl.getUniformLocation(progRegister, 'uFrame'), frameCounter);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();
}

export function chargeStep() {
  const { gl, progCharge, cols, rows } = state;
  if (!progCharge) return;
  gl.useProgram(progCharge);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.chargeFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progCharge, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.chargeTexA);
  gl.uniform1i(gl.getUniformLocation(progCharge, 'uCharge'), 1);
  bindTraits(progCharge, 'uTraits', 2);
  gl.uniform2i(gl.getUniformLocation(progCharge, 'uSize'), cols, rows);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapCharge();
}

export function pressureStep() {
  const { gl, progPressure, cols, rows, airCols, airRows } = state;
  if (!progPressure) return;
  gl.useProgram(progPressure);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.airFboB);
  gl.viewport(0, 0, airCols, airRows);
  bindStateA(progPressure, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.tempTexA);
  gl.uniform1i(gl.getUniformLocation(progPressure, 'uTemp'), 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, state.airTexA);
  gl.uniform1i(gl.getUniformLocation(progPressure, 'uAir'), 2);
  bindElementData(progPressure, 'uElemData', 3);
  bindTraits(progPressure, 'uTraits', 4);
  gl.uniform2i(gl.getUniformLocation(progPressure, 'uSize'), cols, rows);
  gl.uniform2i(gl.getUniformLocation(progPressure, 'uAirSize'), airCols, airRows);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapAir();
}

export function pressureBlastStep() {
  const { gl, progPressureBlast, frameCounter, cols, rows, airCols, airRows } = state;
  if (!progPressureBlast) return;
  gl.useProgram(progPressureBlast);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  bindStateA(progPressureBlast, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.airTexA);
  gl.uniform1i(gl.getUniformLocation(progPressureBlast, 'uAir'), 1);
  bindTraits(progPressureBlast, 'uTraits', 2);
  bindElementData(progPressureBlast, 'uElemData', 3);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, state.registersTex);
  gl.uniform1i(gl.getUniformLocation(progPressureBlast, 'uRegisters'), 4);
  gl.uniform2i(gl.getUniformLocation(progPressureBlast, 'uSize'), cols, rows);
  gl.uniform2i(gl.getUniformLocation(progPressureBlast, 'uAirSize'), airCols, airRows);
  gl.uniform1i(gl.getUniformLocation(progPressureBlast, 'uFrame'), frameCounter);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  swapState();
}

export function render() {
  const { gl, progRender, frameCounter, cols, rows, canvas } = state;
  gl.useProgram(progRender);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  bindStateA(progRender, 'uState', 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.paletteTex);
  gl.uniform1i(gl.getUniformLocation(progRender, 'uPalette'), 1);
  bindElementData(progRender, 'uElemData', 2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, state.tempTexA);
  gl.uniform1i(gl.getUniformLocation(progRender, 'uTemp'), 3);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, state.chargeTexA);
  gl.uniform1i(gl.getUniformLocation(progRender, 'uCharge'), 4);
  gl.uniform2i(gl.getUniformLocation(progRender, 'uSize'), cols, rows);
  gl.uniform1i(gl.getUniformLocation(progRender, 'uFrame'), frameCounter);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
