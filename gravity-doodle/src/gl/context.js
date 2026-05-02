// WebGL2 context creation and the program/texture helpers.
//
// `initGL` compiles every shader, creates the lookup textures, and
// uploads the seed data. Everything below it is a small utility shared
// by other GL files.

import { state } from '../state.js';
import { VS_QUAD } from './shaders/common.js';
import { FS_SIM } from './shaders/sim.js';
import { FS_PAINT } from './shaders/paint.js';
import { FS_RENDER } from './shaders/render.js';
import { FS_CLEAR } from './shaders/clear.js';
import { FS_REACT } from './shaders/react.js';
import { FS_CONTACT } from './shaders/contact.js';
import { FS_BLAST } from './shaders/blast.js';
import { FS_HEAT } from './shaders/heat.js';
import { FS_IGNITION } from './shaders/ignition.js';
import { FS_CELLULAR } from './shaders/cellular.js';
import { FS_CORROSION } from './shaders/corrosion.js';
import { FS_PHASE } from './shaders/phase.js';
import { FS_REGISTER } from './shaders/register.js';
import { FS_CHARGE } from './shaders/charge.js';
import { FS_PRESSURE } from './shaders/pressure.js';
import { FS_PRESSURE_BLAST } from './shaders/pressure-blast.js';
import {
  uploadElementData, uploadPalette, uploadReactions,
  uploadTraits, uploadCellular, uploadRegisters,
} from './uploads.js';

export function compileShader(type, src) {
  const { gl } = state;
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error('shader compile failed:\n' + log + '\n\n' + src);
    throw new Error('shader compile: ' + log);
  }
  return sh;
}

export function linkProgram(vsSrc, fsSrc) {
  const { gl } = state;
  const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

export function createUI8Texture(w, h) {
  const { gl } = state;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function createU8Texture2D(w, h) {
  const { gl } = state;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function makeFbo(tex) {
  const { gl } = state;
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('FBO incomplete');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return f;
}

export function clearStateTo(fbo, w, h, r, g, b, a) {
  const { gl } = state;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, w, h);
  gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([r, g, b, a]));
}

// Try to compile a shader, store on state, and warn (but not throw) if
// it fails — the simulation degrades gracefully without a given pass.
function tryProg(stateKey, fsSrc, label) {
  try {
    state[stateKey] = linkProgram(VS_QUAD, fsSrc);
  } catch (e) {
    console.warn(label + ' compile failed:', e);
  }
}

export function initGL() {
  const { gl } = state;

  state.progSim    = linkProgram(VS_QUAD, FS_SIM);
  state.progPaint  = linkProgram(VS_QUAD, FS_PAINT);
  state.progRender = linkProgram(VS_QUAD, FS_RENDER);
  state.progClear  = linkProgram(VS_QUAD, FS_CLEAR);
  state.progReact  = linkProgram(VS_QUAD, FS_REACT);
  state.progContact= linkProgram(VS_QUAD, FS_CONTACT);
  state.progBlast  = linkProgram(VS_QUAD, FS_BLAST);
  tryProg('progHeat',          FS_HEAT,           'progHeat');
  tryProg('progIgnition',      FS_IGNITION,       'progIgnition');
  tryProg('progCellular',      FS_CELLULAR,       'progCellular');
  tryProg('progCorrosion',     FS_CORROSION,      'progCorrosion');
  tryProg('progPhase',         FS_PHASE,          'progPhase');
  tryProg('progRegister',      FS_REGISTER,       'progRegister');
  tryProg('progCharge',        FS_CHARGE,         'progCharge');
  tryProg('progPressure',      FS_PRESSURE,       'progPressure');
  tryProg('progPressureBlast', FS_PRESSURE_BLAST, 'progPressureBlast');

  state.quadVao = gl.createVertexArray();
  gl.bindVertexArray(state.quadVao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1, 1,
    -1,  1,  1, -1,  1, 1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  state.elementDataTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, state.elementDataTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  state.paletteTex = createU8Texture2D(256, 4);

  state.reactionsTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, state.reactionsTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 6);   // 3 slots × 2 rows
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  state.traitsTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, state.traitsTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 6);   // 6 rows
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  state.cellularDataTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, state.cellularDataTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 2);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  state.registersTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, state.registersTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, 256, 2);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  uploadElementData();
  uploadPalette();
  uploadReactions();
  uploadTraits();
  uploadCellular();
  uploadRegisters();
}

// Tiny binders used by sim/passes.js to wire up the common samplers.
export function bindStateA(prog, name, unit) {
  const { gl } = state;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, state.stateTexA);
  gl.uniform1i(gl.getUniformLocation(prog, name), unit);
}
export function bindElementData(prog, name, unit) {
  const { gl } = state;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, state.elementDataTex);
  gl.uniform1i(gl.getUniformLocation(prog, name), unit);
}
export function bindTraits(prog, name, unit) {
  const { gl } = state;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, state.traitsTex);
  gl.uniform1i(gl.getUniformLocation(prog, name), unit);
}
