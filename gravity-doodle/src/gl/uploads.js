// Lookup-texture uploaders. Each function packs the JS element registry
// into one of the 256-wide texture strips. registerElement runs them all
// after a new element joins; initGL runs them once at boot.
//
// Texture layouts:
//   elementData   256×1 — (kind, density, paramA, paramB)
//                         paramA: powder=flow, liquid=viscosity, gas=buoyancy
//                         paramB: low7=stickiness×127, high1=isExplosive
//   palette       256×4 — RGB swatches (4 variants per element)
//   reactions     256×6 — 3 slots × 2 rows
//                         row0: (otherId, becomesId, chance, selfConsume)
//                         row1: (minTemp, maxTemp, conditionFlags, _)
//   traits        256×6 — laid out by src/traits.js (TRAITS table)
//   cellular      256×2 — (bornLo, surviveLo, growChance, surviveChance) +
//                         (extras, birthFrom0, birthFrom1, birthFrom2)
//   registers     256×2 — (raInit, raDelta+128, raDiesAt, raTransformsTo)
//                         raDelta: 128 = no tick (sentinel)

import { state } from '../state.js';
import { kindCode } from '../elements.js';
import { TRAITS_TEX_ROWS, packTraits } from '../traits.js';

const clamp255 = (v, def) => {
  if (typeof v !== 'number' || !isFinite(v)) return def;
  return Math.max(0, Math.min(255, Math.round(v)));
};

export function uploadElementData() {
  const { gl, registry, lookups } = state;
  const buf = new Uint8Array(256 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec) continue;
    buf[id * 4 + 0] = kindCode(spec.kind);
    buf[id * 4 + 1] = clamp(spec.density || 1, 1, 15);
    let paramA = 128;
    if (spec.kind === 'powder')      paramA = pct255(spec.flow,      0.55);
    else if (spec.kind === 'liquid') paramA = pct255(spec.viscosity, 0);
    else if (spec.kind === 'gas')    paramA = pct255(spec.buoyancy,  0.9);
    buf[id * 4 + 2] = paramA;
    let paramB = pct127(spec.stickiness, 0);
    if (spec.isExplosive) paramB |= 0x80;
    buf[id * 4 + 3] = paramB;
  }
  gl.bindTexture(gl.TEXTURE_2D, lookups.elementData);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

export function uploadPalette() {
  const { gl, registry, lookups } = state;
  const buf = new Uint8Array(256 * 4 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec || !spec.colors || !spec.colors.length) continue;
    for (let v = 0; v < 4; v++) {
      const c = parseHex(spec.colors[v % spec.colors.length]);
      const o = (v * 256 + id) * 4;
      buf[o + 0] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      buf[o + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, lookups.palette);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 4, gl.RGBA, gl.UNSIGNED_BYTE, buf);
}

export function uploadReactions() {
  const { gl, registry, keyToId, lookups } = state;
  const buf = new Uint8Array(256 * 6 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec || !Array.isArray(spec.reactions)) continue;
    let slot = 0;
    for (const rx of spec.reactions) {
      if (slot >= 3) break;
      if (!rx || rx.explodes) continue;
      const otherId = keyToId[rx.other];
      if (!otherId) continue;
      let becomesId = 0;
      if (rx.becomes != null && rx.becomes !== '' && rx.becomes !== 'empty') {
        becomesId = keyToId[rx.becomes] || 0;
        if (!becomesId) continue;
      }
      const chance = clamp255(Math.round((rx.chance || 0) * 255), 0);
      const selfConsume = clamp255(Math.round((rx.selfConsume || 0) * 255), 0);
      const minTemp = clamp255(rx.minTemp, 0);
      const maxTemp = clamp255(rx.maxTemp, 0);
      const flags = rx.catalyst ? 0x01 : 0;
      const r0 = (slot * 2 + 0) * 256 * 4 + id * 4;
      buf[r0 + 0] = otherId;
      buf[r0 + 1] = becomesId;
      buf[r0 + 2] = chance;
      buf[r0 + 3] = selfConsume;
      const r1 = (slot * 2 + 1) * 256 * 4 + id * 4;
      buf[r1 + 0] = minTemp;
      buf[r1 + 1] = maxTemp;
      buf[r1 + 2] = flags;
      slot++;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, lookups.reactions);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 6, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

// Driven entirely by TRAITS in src/traits.js. To add a trait, edit that
// table — uploads.js needs no changes.
export function uploadTraits() {
  const { gl, registry, keyToId, lookups } = state;
  const buf = new Uint8Array(256 * TRAITS_TEX_ROWS * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec) continue;
    packTraits(spec, keyToId, buf, id);
  }
  gl.bindTexture(gl.TEXTURE_2D, lookups.traits);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, TRAITS_TEX_ROWS, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

export function uploadCellular() {
  const { gl, registry, keyToId, lookups } = state;
  const buf = new Uint8Array(256 * 2 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec || spec.kind !== 'cellular') continue;
    const bornMask    = maskFromArray(spec.born);
    const surviveMask = maskFromArray(spec.survive);
    const tick = clamp(Math.round(spec.cellularTick || 6), 1, 30);
    const growChance    = pct255(spec.growChance,    0.45);
    const surviveChance = pct255(spec.surviveChance, 0.92);
    const bF = (spec.birthFrom || []).map(k => keyToId[k] || 0).slice(0, 3);
    while (bF.length < 3) bF.push(0);
    const growBias = ({ up: 1, down: 2, side: 3 })[spec.growBias] || 0;
    const extras = ((bornMask >> 8) & 1)
                 | (((surviveMask >> 8) & 1) << 1)
                 | ((tick & 0x0F) << 2)
                 | ((growBias & 0x3) << 6);
    const o0 = (0 * 256 + id) * 4;
    buf[o0+0] = bornMask & 0xff;
    buf[o0+1] = surviveMask & 0xff;
    buf[o0+2] = growChance;
    buf[o0+3] = surviveChance;
    const o1 = (1 * 256 + id) * 4;
    buf[o1+0] = extras;
    buf[o1+1] = bF[0];
    buf[o1+2] = bF[1];
    buf[o1+3] = bF[2];
  }
  gl.bindTexture(gl.TEXTURE_2D, lookups.cellular);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

export function uploadRegisters() {
  const { gl, registry, keyToId, lookups } = state;
  const buf = new Uint8Array(256 * 2 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec) continue;
    let raInit = 0, raDelta = 128, raDiesAt = 0, raTransforms = 0;
    // Implicit registers: gas lifespans + explosive settle.
    if (spec.kind === 'gas' && spec.lifeMin) {
      raInit = clamp255(spec.lifeMin, 60);
      raDelta = 127;          // -1
    }
    if (spec.isExplosive) {
      raInit = 28;
      raDelta = 127;          // -1
      raDiesAt = 255;         // never naturally hits — clamp at 0 stops the tick
    }
    // Explicit overrides from the spec.
    if (typeof spec.raInit === 'number')   raInit = clamp255(spec.raInit, 0);
    if (typeof spec.raDelta === 'number')  raDelta = clamp(Math.round(spec.raDelta) + 128, 1, 255);
    if (typeof spec.raDiesAt === 'number') raDiesAt = clamp255(spec.raDiesAt, 0);
    if (typeof spec.raTransformsTo === 'string') {
      raTransforms = keyToId[spec.raTransformsTo.toLowerCase()] || 0;
    }
    const o = id * 4;
    buf[o + 0] = raInit;
    buf[o + 1] = raDelta;
    buf[o + 2] = raDiesAt;
    buf[o + 3] = raTransforms;
  }
  gl.bindTexture(gl.TEXTURE_2D, lookups.registers);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

// ---- helpers ----

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function pct255(v, def) {
  const n = (typeof v === 'number' && isFinite(v)) ? v : def;
  return clamp(Math.round(n * 255), 0, 255);
}

function pct127(v, def) {
  const n = (typeof v === 'number' && isFinite(v)) ? v : def;
  return clamp(Math.round(n * 127), 0, 127);
}

function parseHex(h) {
  if (typeof h !== 'string') return [136, 136, 136];
  h = h.replace(/^#/, '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (h.length !== 6) return [136, 136, 136];
  return [parseInt(h.slice(0,2),16)|0, parseInt(h.slice(2,4),16)|0, parseInt(h.slice(4,6),16)|0];
}

function maskFromArray(arr) {
  let mask = 0;
  for (const n of (arr || [])) {
    const i = (n | 0);
    if (i >= 0 && i <= 8) mask |= (1 << i);
  }
  return mask;
}
