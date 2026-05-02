// Canvas-size handling. Three concerns:
//   1) Match canvas pixel resolution to its CSS size.
//   2) Compute COLS/ROWS for the full-res sim and AIR_COLS/AIR_ROWS for
//      the coarse pressure grid (1/4 res).
//   3) Allocate / reallocate ping-pong texture pairs for state, temp,
//      charge, and air, then clear them to their respective neutrals.

import { state } from '../state.js';
import { CELL } from '../constants.js';
import { createUI8Texture, makeFbo, clearStateTo } from './context.js';

export function resizeCanvas() {
  const { canvas } = state;
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
  initGrid();
}

export function initGrid() {
  const { gl } = state;
  if (!gl) return;
  // Free any previous textures/FBOs before reallocating.
  for (const k of [
    'stateTexA','stateTexB','tempTexA','tempTexB',
    'chargeTexA','chargeTexB','airTexA','airTexB',
  ]) if (state[k]) gl.deleteTexture(state[k]);
  for (const k of [
    'stateFboA','stateFboB','tempFboA','tempFboB',
    'chargeFboA','chargeFboB','airFboA','airFboB',
  ]) if (state[k]) gl.deleteFramebuffer(state[k]);

  const { cols, rows, airCols, airRows } = state;

  state.stateTexA = createUI8Texture(cols, rows);
  state.stateTexB = createUI8Texture(cols, rows);
  state.stateFboA = makeFbo(state.stateTexA);
  state.stateFboB = makeFbo(state.stateTexB);

  state.tempTexA = createUI8Texture(cols, rows);
  state.tempTexB = createUI8Texture(cols, rows);
  state.tempFboA = makeFbo(state.tempTexA);
  state.tempFboB = makeFbo(state.tempTexB);

  // Charge texture: R = signed charge in offset binary (128 = 0).
  state.chargeTexA = createUI8Texture(cols, rows);
  state.chargeTexB = createUI8Texture(cols, rows);
  state.chargeFboA = makeFbo(state.chargeTexA);
  state.chargeFboB = makeFbo(state.chargeTexB);

  // Air texture (coarse): R=pressure, G=vx_offset, B=vy_offset, A=ambient temp.
  state.airTexA = createUI8Texture(airCols, airRows);
  state.airTexB = createUI8Texture(airCols, airRows);
  state.airFboA = makeFbo(state.airTexA);
  state.airFboB = makeFbo(state.airTexB);

  clearStateTo(state.stateFboA, cols, rows, 0, 0, 0, 0);
  clearStateTo(state.stateFboB, cols, rows, 0, 0, 0, 0);
  clearStateTo(state.tempFboA, cols, rows, 30, 0, 0, 0);
  clearStateTo(state.tempFboB, cols, rows, 30, 0, 0, 0);
  clearStateTo(state.chargeFboA, cols, rows, 128, 0, 0, 0);
  clearStateTo(state.chargeFboB, cols, rows, 128, 0, 0, 0);
  clearStateTo(state.airFboA, airCols, airRows, 128, 128, 128, 30);
  clearStateTo(state.airFboB, airCols, airRows, 128, 128, 128, 30);
}
