// Sim-grid sizing + ping-pong texture management.
//
// PingPong wraps a pair of (texture, fbo) and the swap that keeps the
// "read from A, write to B, then commit" pattern coherent. Every full-
// canvas-sized texture in the app uses one.

import { state } from '../state.js';
import { CELL } from '../constants.js';

export class PingPong {
  constructor(gl, w, h, clearVal) {
    this.gl = gl;
    this.w = w;
    this.h = h;
    this.tex = [createUI8Texture(gl, w, h), createUI8Texture(gl, w, h)];
    this.fbo = [makeFbo(gl, this.tex[0]), makeFbo(gl, this.tex[1])];
    if (clearVal) this.clear(...clearVal);
  }
  read()    { return this.tex[0]; }
  readFbo() { return this.fbo[0]; }
  write()   { return this.fbo[1]; }
  swap() {
    const t = this.tex; this.tex = [t[1], t[0]];
    const f = this.fbo; this.fbo = [f[1], f[0]];
  }
  clear(r, g, b, a) {
    const v = new Uint32Array([r|0, g|0, b|0, a|0]);
    for (let i = 0; i < 2; i++) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo[i]);
      this.gl.clearBufferuiv(this.gl.COLOR, 0, v);
    }
  }
  destroy() {
    this.tex.forEach(t => this.gl.deleteTexture(t));
    this.fbo.forEach(f => this.gl.deleteFramebuffer(f));
  }
}

export function createUI8Texture(gl, w, h) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function makeFbo(gl, tex) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('FBO incomplete');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return f;
}

export function resizeCanvas() {
  const { canvas, gl } = state;
  const rect = canvas.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  canvas.width  = w;
  canvas.height = h;
  let cols = Math.floor(w / CELL);
  let rows = Math.floor(h / CELL);
  if (cols & 1) cols--;
  if (rows & 1) rows--;
  state.cols = cols;
  state.rows = rows;
  state.airCols = Math.max(2, Math.floor(cols / 4));
  state.airRows = Math.max(2, Math.floor(rows / 4));
  if (gl) initGrid();
}

function initGrid() {
  const { gl, cols, rows, airCols, airRows } = state;
  if (state.state)  state.state.destroy();
  if (state.temp)   state.temp.destroy();
  if (state.charge) state.charge.destroy();
  if (state.air)    state.air.destroy();
  state.state  = new PingPong(gl, cols, rows,    [0, 0, 0, 0]);
  state.temp   = new PingPong(gl, cols, rows,    [30, 0, 0, 0]);
  state.charge = new PingPong(gl, cols, rows,    [128, 0, 0, 0]);
  state.air    = new PingPong(gl, airCols, airRows, [128, 128, 128, 30]);
}
