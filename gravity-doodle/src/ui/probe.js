// Probe mode: tap-to-inspect tooltip. Reads back one pixel from each
// per-frame texture (a synchronous GPU→CPU fence — fine for taps,
// not for hover) and shows the basic facts about that cell.

import { state } from '../state.js';

export function probeAt(col, row) {
  const { gl, cols, rows, airCols, airRows } = state;
  if (!gl || col < 0 || row < 0 || col >= cols || row >= rows) {
    hideProbeTooltip(); return;
  }
  const cell  = readPixel(state.state.readFbo(),  col, row);
  const tempP = readPixel(state.temp.readFbo(),   col, row);
  const chP   = readPixel(state.charge.readFbo(), col, row);
  const ax = clamp(Math.floor(col / 4), 0, airCols - 1);
  const ay = clamp(Math.floor(row / 4), 0, airRows - 1);
  const airP  = readPixel(state.air.readFbo(),    ax, ay);
  showProbeTooltip(cell[0], tempP[0], chP[0], airP[0]);
}

export function hideProbeTooltip() {
  const el = document.getElementById('probe-tooltip');
  if (el) el.classList.add('hidden');
}

function showProbeTooltip(id, temp, chargeRaw, pressureRaw) {
  const el = document.getElementById('probe-tooltip');
  if (!el) return;
  const charge = chargeRaw - 128;
  const pressure = pressureRaw - 128;
  const spec = id ? state.registry[id] : null;
  const name = spec ? (spec.displayName || spec.key) : 'empty';

  const lines = [
    `<span class="probe-name">${escapeHtml(name)}</span>`,
    spec ? `kind     ${spec.kind}` : '',
    spec ? `density  ${pad3(spec.density || 0)}` : '',
    `temp     ${pad3(temp)}     ${heatBar(temp)}`,
    `charge   ${signed(charge)}     ${signedBar(charge, 'charge')}`,
    `pres     ${signed(pressure)}     ${signedBar(pressure, 'pres')}`,
  ].filter(Boolean);
  el.innerHTML = lines.join('\n');
  el.classList.remove('hidden');
}

function readPixel(fbo, x, y) {
  const { gl } = state;
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
  const buf = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  return buf;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pad3(n)          { return ('  ' + (n|0)).slice(-3); }
function signed(n)        { const x = n|0; return (x >= 0 ? '+' : '') + x; }
function bar(w, cls)      { return `<span class="probe-bar ${cls}"><span style="width:${w}px"></span></span>`; }
function heatBar(t)       { return bar(clamp(Math.round(t / 255 * 60), 0, 60), 'heat'); }
function signedBar(v, k)  { return bar(clamp(Math.round(Math.abs(v) / 127 * 60), 0, 60), k + ' ' + (v >= 0 ? 'pos' : 'neg')); }
function escapeHtml(s)    { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
