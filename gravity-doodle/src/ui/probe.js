// Probe mode: tap-to-inspect tooltip that reads back the current cell's
// id, registers, temperature, charge, and pressure/wind. Each readback
// is a synchronous GL fence — fine for clicks, NOT for hover.

import { state } from '../state.js';

export function probeAt(col, row) {
  const { gl, cols, rows, airCols, airRows } = state;
  if (!gl || col < 0 || row < 0 || col >= cols || row >= rows) {
    hideProbeTooltip();
    return;
  }
  const cell = new Uint8Array(4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.stateFboA);
  gl.readPixels(col, row, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, cell);
  const tempPixel = new Uint8Array(4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.tempFboA);
  gl.readPixels(col, row, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, tempPixel);
  const chargePixel = new Uint8Array(4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.chargeFboA);
  gl.readPixels(col, row, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, chargePixel);
  const airPixel = new Uint8Array(4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.airFboA);
  const ax = Math.max(0, Math.min(airCols - 1, Math.floor(col / 4)));
  const ay = Math.max(0, Math.min(airRows - 1, Math.floor(row / 4)));
  gl.readPixels(ax, ay, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, airPixel);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  showProbeTooltip(cell[0], cell[2], cell[3], tempPixel[0], chargePixel[0], airPixel);
}

function showProbeTooltip(id, ra, rb, temp, charge, airPixel) {
  const el = document.getElementById('probe-tooltip');
  if (!el) return;
  const signedCharge = charge - 128;
  const pressure = airPixel[0] - 128;
  const airVx = airPixel[1] - 128;
  const airVy = airPixel[2] - 128;

  if (id === 0) {
    const lines = [`<span class="probe-name">empty</span>`,
      `temp     ${pad3(temp)}  ${heatBar(temp)}`,
      `charge   ${signCh(signedCharge)}  ${chargeBar(charge)}`,
      `pres     ${signNum(pressure)}  ${pressureBar(airPixel[0])}`,
      `wind     ${signNum(airVx)},${signNum(airVy)}`];
    el.innerHTML = lines.join('\n');
    el.classList.remove('hidden');
    return;
  }
  const spec = state.registry[id];
  if (!spec) { el.classList.add('hidden'); return; }
  const name = spec.displayName || spec.key || ('id ' + id);
  const lines = [`<span class="probe-name">${escapeHtml(name)}</span>`];
  lines.push(`kind     ${spec.kind}`);
  lines.push(`temp     ${pad3(temp)}  ${heatBar(temp)}`);
  if (typeof spec.density === 'number')      lines.push(`density  ${pad3(spec.density)}`);
  if (typeof spec.flow === 'number')         lines.push(`flow     ${spec.flow.toFixed(2)}  ${unitBar(spec.flow)}`);
  if (typeof spec.viscosity === 'number')    lines.push(`viscos   ${spec.viscosity.toFixed(2)}  ${unitBar(spec.viscosity)}`);
  if (typeof spec.buoyancy === 'number')     lines.push(`buoyant  ${spec.buoyancy.toFixed(2)}  ${unitBar(spec.buoyancy)}`);
  if (typeof spec.stickiness === 'number' && spec.stickiness > 0)
    lines.push(`sticky   ${spec.stickiness.toFixed(2)}  ${unitBar(spec.stickiness)}`);
  if (typeof spec.airflowFactor === 'number' && spec.airflowFactor > 0)
    lines.push(`drift    ${spec.airflowFactor.toFixed(2)}  ${unitBar(spec.airflowFactor)}`);
  lines.push(`charge   ${signCh(signedCharge)}  ${chargeBar(charge)}`);
  lines.push(`pres     ${signNum(pressure)}  ${pressureBar(airPixel[0])}`);
  lines.push(`wind     ${signNum(airVx)},${signNum(airVy)}`);
  if (spec.conducts) lines.push(`conducts yes`);
  if (typeof spec.chargeEmit === 'number' && spec.chargeEmit !== 0) lines.push(`emit-c   ${signNum(spec.chargeEmit)}`);
  if (typeof spec.ignitesAtCharge === 'number' && spec.ignitesAtCharge > 0) lines.push(`pop@chg  ${pad3(spec.ignitesAtCharge)}+`);
  if (typeof spec.emitTemp === 'number' && spec.emitTemp !== 30)
    lines.push(`emits    ${pad3(spec.emitTemp)}  ${heatBar(spec.emitTemp)}`);
  if (typeof spec.ignitionPoint === 'number' && spec.ignitionPoint < 255)
    lines.push(`ignites  ${pad3(spec.ignitionPoint)}+ flam ${(spec.flammability||0).toFixed(2)}`);
  if (typeof spec.conductivity === 'number') lines.push(`heat-k   ${pad3(spec.conductivity)}  ${valBar(spec.conductivity)}`);
  if (typeof spec.corrosivity === 'number' && spec.corrosivity > 0)
    lines.push(`corrode  ${pad3(spec.corrosivity)}  ${valBar(spec.corrosivity)}`);
  if (typeof spec.hardness === 'number')     lines.push(`hard     ${pad3(spec.hardness)}  ${valBar(spec.hardness)}`);
  if (spec.meltingPoint && spec.meltsTo)     lines.push(`melts→${spec.meltsTo} @ ${spec.meltingPoint}`);
  if (spec.boilingPoint && spec.boilsTo)     lines.push(`boils→${spec.boilsTo} @ ${spec.boilingPoint}`);
  if (spec.freezingPoint && spec.freezesTo)  lines.push(`freeze→${spec.freezesTo} @ ${spec.freezingPoint}`);
  if (spec.pressureBlast > 0)                lines.push(`pop@P    ${pad3(spec.pressureBlast)}+ → ${spec.pressureBlastTo || 'empty'}`);
  if (typeof spec.raDelta === 'number' && spec.raDelta !== 0)
    lines.push(`reg-a    ${pad3(ra)} (Δ${spec.raDelta > 0 ? '+' : ''}${spec.raDelta})`);
  else if (ra > 0)
    lines.push(`reg-a    ${pad3(ra)}`);
  el.innerHTML = lines.join('\n');
  el.classList.remove('hidden');
}

export function hideProbeTooltip() {
  const el = document.getElementById('probe-tooltip');
  if (el) el.classList.add('hidden');
}

// --- Tooltip-line formatters (kept here since they're only used by the probe). ---
function pad3(n) { return ('  ' + (n|0)).slice(-3); }
function signNum(n) { const x = (n|0); return (x >= 0 ? '+' : '') + x; }
function signCh(n) { const x = (n|0); return (x >= 0 ? '+' : '') + pad3(Math.abs(x)).trim(); }
function unitBar(v) {
  const w = Math.max(0, Math.min(60, Math.round(v * 60)));
  return `<span class="probe-bar"><span style="width:${w}px"></span></span>`;
}
function valBar(v) {
  const w = Math.max(0, Math.min(60, Math.round((v / 255) * 60)));
  return `<span class="probe-bar"><span style="width:${w}px"></span></span>`;
}
function heatBar(t) {
  const w = Math.max(0, Math.min(60, Math.round((t / 255) * 60)));
  return `<span class="probe-bar heat"><span style="width:${w}px"></span></span>`;
}
function chargeBar(c) {
  const mag = Math.abs(c - 128);
  const w = Math.max(0, Math.min(60, Math.round((mag / 127) * 60)));
  const cls = c >= 128 ? 'pos' : 'neg';
  return `<span class="probe-bar charge ${cls}"><span style="width:${w}px"></span></span>`;
}
function pressureBar(p) {
  const mag = Math.abs(p - 128);
  const w = Math.max(0, Math.min(60, Math.round((mag / 127) * 60)));
  const cls = p >= 128 ? 'pos' : 'neg';
  return `<span class="probe-bar pres ${cls}"><span style="width:${w}px"></span></span>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
