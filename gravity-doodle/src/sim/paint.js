// Painting cells onto the state texture.
//
// `paintAt` is the entry point that the input layer (ui/input.js) calls.
// It picks an appropriate brush radius and ra register seed for the
// selected element (e.g., randomized lifespan for gases, settle window
// for explosives), then dispatches one FS_PAINT pass.

import { state } from '../state.js';
import { kindCode } from '../elements.js';

export function brushRadiusFor(key) {
  if (key === 'erase') return 3;
  const spec = state.registry[state.keyToId[key]];
  if (!spec) return 2;
  if (spec.isExplosive) return 3;
  if (spec.kind === 'static') return 4;
  if (spec.kind === 'gas') return ((spec.buoyancy ?? 0.9) >= 0.9) ? 2 : 3;
  if (spec.kind === 'liquid') return ((spec.stickiness ?? 0) >= 0.7) ? 1 : 2;
  if (spec.kind === 'powder') return ((spec.flow ?? 0.55) >= 0.9) ? 3 : 2;
  return 2;
}

export function paintAt(cx, cy, brushR) {
  const key = state.selectedKey;
  if (key === 'erase') { paintPass(cx, cy, brushR, 0, null); return; }
  const id = state.keyToId[key] || 0;
  if (!id) return;
  paintPass(cx, cy, brushR, id, state.registry[id]);
}

export function paintPass(cx, cy, brushR, id, spec) {
  const { gl } = state;
  const prog = state.programs.paint;

  let raOverride = 256;
  if (spec && spec.kind === 'gas' && spec.lifeMin) {
    const lo = spec.lifeMin;
    const hi = spec.lifeMax || (lo + 40);
    raOverride = Math.min(255, lo + Math.floor(Math.random() * Math.max(1, hi - lo)));
  }
  if (spec && spec.isExplosive) raOverride = 28;
  const kind = spec ? kindCode(spec.kind) : 0;

  gl.useProgram(prog);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.state.write());
  gl.viewport(0, 0, state.cols, state.rows);

  bind(prog, 'uState',     state.state.read(),         0);
  bind(prog, 'uElemData',  state.lookups.elementData,  1);
  bind(prog, 'uRegisters', state.lookups.registers,    2);

  gl.uniform2i (gl.getUniformLocation(prog, 'uSize'),   state.cols, state.rows);
  gl.uniform2i (gl.getUniformLocation(prog, 'uCenter'), cx, cy);
  gl.uniform1i (gl.getUniformLocation(prog, 'uRadius'), brushR);
  gl.uniform1ui(gl.getUniformLocation(prog, 'uPaintId'), id >>> 0);
  gl.uniform1ui(gl.getUniformLocation(prog, 'uVariantSeed'), (state.frame * 2654435761) >>> 0);
  gl.uniform1ui(gl.getUniformLocation(prog, 'uPaintRaOverride'), raOverride >>> 0);
  gl.uniform1ui(gl.getUniformLocation(prog, 'uPaintRb'), 0);
  gl.uniform1ui(gl.getUniformLocation(prog, 'uPaintKind'), kind);

  gl.bindVertexArray(state.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  state.state.swap();
}

function bind(prog, name, tex, unit) {
  const { gl } = state;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(prog, name), unit);
}

export function paintLine(c0, r0, c1, r1, brushR) {
  let dx = Math.abs(c1 - c0), sx = c0 < c1 ? 1 : -1;
  let dy = -Math.abs(r1 - r0), sy = r0 < r1 ? 1 : -1;
  let err = dx + dy;
  let c = c0, r = r0;
  while (true) {
    paintAt(c, r, brushR);
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; c += sx; }
    if (e2 <= dx) { err += dx; r += sy; }
  }
}
