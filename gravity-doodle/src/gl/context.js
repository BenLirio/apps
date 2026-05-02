// WebGL2 boot: compile every program, allocate every lookup texture,
// and seed them with the initial registry contents. Per-frame textures
// (state, temp, charge, air) are owned by gl/grid.js.
//
// All programs are required — there's no graceful-degrade path.

import { state } from '../state.js';
import { VS_QUAD } from './shaders/common.js';
import { FS_SIM } from './shaders/sim.js';
import { FS_PAINT } from './shaders/paint.js';
import { FS_RENDER } from './shaders/render.js';
import { FS_REACT } from './shaders/react.js';
import { FS_PRIME, FS_BLAST } from './shaders/explosion.js';
import { FS_HEAT } from './shaders/heat.js';
import { FS_TRANSFORM } from './shaders/transform.js';
import { FS_CELLULAR } from './shaders/cellular.js';
import { FS_REGISTER } from './shaders/register.js';
import { FS_CHARGE } from './shaders/charge.js';
import { FS_PRESSURE } from './shaders/pressure.js';
import { FS_PRESSURE_BLAST } from './shaders/pressure-blast.js';
import {
  uploadElementData, uploadPalette, uploadReactions,
  uploadTraits, uploadCellular, uploadRegisters,
} from './uploads.js';

const PROGRAMS = {
  sim:             FS_SIM,
  paint:           FS_PAINT,
  render:          FS_RENDER,
  react:           FS_REACT,
  explosionPrime:  FS_PRIME,
  explosionBlast:  FS_BLAST,
  heat:            FS_HEAT,
  transform:       FS_TRANSFORM,
  cellular:        FS_CELLULAR,
  register:        FS_REGISTER,
  charge:          FS_CHARGE,
  pressure:        FS_PRESSURE,
  pressureBlast:   FS_PRESSURE_BLAST,
};

export function initGL() {
  const { gl } = state;

  // Programs.
  for (const key in PROGRAMS) {
    state.programs[key] = linkProgram(VS_QUAD, PROGRAMS[key]);
  }

  // Fullscreen quad VAO.
  state.quadVao = gl.createVertexArray();
  gl.bindVertexArray(state.quadVao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1, 1,
    -1, 1,  1,-1,   1, 1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Lookup textures (256 wide, varying height).
  state.lookups.elementData = uintTex(256, 1);
  state.lookups.palette     = rgbaTex(256, 4);
  state.lookups.reactions   = uintTex(256, 6);
  state.lookups.traits      = uintTex(256, 6);
  state.lookups.cellular    = uintTex(256, 2);
  state.lookups.registers   = uintTex(256, 2);

  uploadElementData();
  uploadPalette();
  uploadReactions();
  uploadTraits();
  uploadCellular();
  uploadRegisters();
}

function uintTex(w, h) {
  const { gl } = state;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return t;
}

function rgbaTex(w, h) {
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

function linkProgram(vsSrc, fsSrc) {
  const { gl } = state;
  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

function compile(type, src) {
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
