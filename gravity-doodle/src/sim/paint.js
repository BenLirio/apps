// Painting cells onto the state texture. paintAtFrag is the entry point
// that the input layer (ui/input.js) calls; it figures out registers
// (gas life randomization, explosive settle window) and dispatches a
// FS_PAINT pass.

import { state } from '../state.js';
import { kindCode } from '../elements/registry.js';

export function brushRadiusFor(key) {
  if (key === 'erase') return 3;
  const id = state.keyToId[key];
  if (!id) return 2;
  const spec = state.registry[id];
  if (!spec) return 2;
  if (spec.isExplosive) return 3;
  if (spec.kind === 'static') return 4;
  if (spec.kind === 'gas') {
    const buoy = (typeof spec.buoyancy === 'number') ? spec.buoyancy : 0.9;
    return buoy >= 0.9 ? 2 : 3;
  }
  if (spec.kind === 'liquid') {
    const stick = (typeof spec.stickiness === 'number') ? spec.stickiness : 0;
    if (stick >= 0.7) return 1;
    return 2;
  }
  if (spec.kind === 'powder') {
    const flow = (typeof spec.flow === 'number') ? spec.flow : 0.55;
    if (flow >= 0.9) return 3;
    return 2;
  }
  return 2;
}

export function paintAtFrag(cx, cy, brushR) {
  const key = state.selectedKey;
  let id = 0; let spec = null;
  if (key !== 'erase') {
    id = state.keyToId[key] || 0;
    if (!id) return;
    spec = state.registry[id];
  }
  paintPass(cx, cy, brushR, id, spec);
}

export function paintPass(cx, cy, brushR, id, spec) {
  const { gl, progPaint, cols, rows, frameCounter } = state;
  let raOverride = 256;     // 256 = use registers texture default
  let rb = 0;
  if (spec && spec.kind === 'gas' && spec.lifeMin) {
    const lifeMin = spec.lifeMin;
    const lifeMax = spec.lifeMax || (lifeMin + 40);
    raOverride = Math.min(255, lifeMin + Math.floor(Math.random() * Math.max(1, lifeMax - lifeMin)));
  }
  if (spec && spec.isExplosive) {
    raOverride = 28;        // settle window
    rb = 0;
  }
  const kind = spec ? kindCode(spec.kind) : 0;

  gl.useProgram(progPaint);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.stateFboB);
  gl.viewport(0, 0, cols, rows);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.stateTexA);
  gl.uniform1i(gl.getUniformLocation(progPaint, 'uState'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.elementDataTex);
  gl.uniform1i(gl.getUniformLocation(progPaint, 'uElemData'), 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, state.registersTex);
  gl.uniform1i(gl.getUniformLocation(progPaint, 'uRegisters'), 2);
  gl.uniform2i(gl.getUniformLocation(progPaint, 'uSize'), cols, rows);
  gl.uniform2i(gl.getUniformLocation(progPaint, 'uCenter'), cx, cy);
  gl.uniform1i(gl.getUniformLocation(progPaint, 'uRadius'), brushR);
  gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintId'), id >>> 0);
  gl.uniform1ui(gl.getUniformLocation(progPaint, 'uVariantSeed'), (frameCounter * 2654435761) >>> 0);
  gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintRaOverride'), raOverride >>> 0);
  gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintRb'), rb >>> 0);
  gl.uniform1ui(gl.getUniformLocation(progPaint, 'uPaintKind'), kind);
  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  [state.stateTexA, state.stateTexB] = [state.stateTexB, state.stateTexA];
  [state.stateFboA, state.stateFboB] = [state.stateFboB, state.stateFboA];
}

export function paintLineFrag(c0, r0, c1, r1, brushR) {
  let dx = Math.abs(c1 - c0), sx = c0 < c1 ? 1 : -1;
  let dy = -Math.abs(r1 - r0), sy = r0 < r1 ? 1 : -1;
  let err = dx + dy;
  let c = c0, r = r0;
  while (true) {
    paintAtFrag(c, r, brushR);
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; c += sx; }
    if (e2 <= dx) { err += dx; r += sy; }
  }
}
