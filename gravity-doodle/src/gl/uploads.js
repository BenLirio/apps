// Lookup-texture uploaders. Each upload* function packs the JS element
// registry into the layout that the corresponding fragment shader reads
// from. Call any of these whenever the registry changes — registerElement
// runs them all automatically. The texture layouts are documented in the
// comment above each function.

import { state } from '../state.js';
import { kindCode } from '../elements/registry.js';

export function uploadElementData() {
  const { gl, registry } = state;
  const buf = new Uint8Array(256 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec) { buf[id * 4 + 0] = 0; continue; }
    buf[id * 4 + 0] = kindCode(spec.kind);
    buf[id * 4 + 1] = Math.max(1, Math.min(15, Math.round(spec.density || 1)));
    let paramA = 128;
    if (spec.kind === 'powder') paramA = Math.round(((typeof spec.flow === 'number') ? spec.flow : 0.55) * 255);
    else if (spec.kind === 'liquid') paramA = Math.round(((typeof spec.viscosity === 'number') ? spec.viscosity : 0) * 255);
    else if (spec.kind === 'gas') paramA = Math.round(((typeof spec.buoyancy === 'number') ? spec.buoyancy : 0.9) * 255);
    buf[id * 4 + 2] = paramA;
    let paramB = Math.round(((typeof spec.stickiness === 'number') ? spec.stickiness : 0) * 127) & 0x7f;
    if (spec.isExplosive) paramB |= 0x80;
    buf[id * 4 + 3] = paramB;
  }
  gl.bindTexture(gl.TEXTURE_2D, state.elementDataTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

export function uploadPalette() {
  const { gl, registry } = state;
  const buf = new Uint8Array(256 * 4 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec || !spec.colors || !spec.colors.length) continue;
    const colors = spec.colors;
    for (let v = 0; v < 4; v++) {
      const c = parseHex(colors[v % colors.length]);
      const o = (v * 256 + id) * 4;
      buf[o + 0] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      buf[o + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, state.paletteTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 4, gl.RGBA, gl.UNSIGNED_BYTE, buf);
}

function parseHex(h) {
  if (typeof h !== 'string') return [136, 136, 136];
  h = h.replace(/^#/, '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (h.length !== 6) return [136, 136, 136];
  return [parseInt(h.slice(0,2),16)|0, parseInt(h.slice(2,4),16)|0, parseInt(h.slice(4,6),16)|0];
}

// Pack reactions: 3 slots × 2 rows × 256 ids.
// Row 0 (per slot): (otherId, becomesId, chance, selfConsume)
// Row 1 (per slot): (minTemp, maxTemp, conditionFlags, _)
export function uploadReactions() {
  const { gl, registry, keyToId } = state;
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
      const chance = Math.max(0, Math.min(255, Math.round((rx.chance || 0) * 255)));
      const selfConsume = Math.max(0, Math.min(255, Math.round(((typeof rx.selfConsume === 'number') ? rx.selfConsume : 0) * 255)));
      const minTemp = clamp255(rx.minTemp, 0);
      const maxTemp = clamp255(rx.maxTemp, 0);
      let flags = 0;
      if (rx.catalyst) flags |= 0x01;
      const r0 = (slot * 2 + 0) * 256 * 4 + id * 4;
      buf[r0 + 0] = otherId;
      buf[r0 + 1] = becomesId;
      buf[r0 + 2] = chance;
      buf[r0 + 3] = selfConsume;
      const r1 = (slot * 2 + 1) * 256 * 4 + id * 4;
      buf[r1 + 0] = minTemp;
      buf[r1 + 1] = maxTemp;
      buf[r1 + 2] = flags;
      buf[r1 + 3] = 0;
      slot++;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, state.reactionsTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 6, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

// Traits: 256 wide × 6 rows.
// Row 0: (emitTemp, ignitionPoint, flammability, conductivity)
// Row 1: (corrosivity, hardness, stickiness*127, _)
// Row 2: (meltAt, boilAt, freezeAt, _)
// Row 3: (meltsToId, boilsToId, freezesToId, _)
// Row 4: (conductsBit, chargeEmit_offset, ignitesAtCharge, airflowFactor*255)
// Row 5: (airflowEmitVx_offset, airflowEmitVy_offset, pressureBlast, pressureBlastToId)
export function uploadTraits() {
  const { gl, registry, keyToId } = state;
  if (!state.traitsTex) return;
  const buf = new Uint8Array(256 * 6 * 4);
  const resolveId = (key) => {
    if (typeof key !== 'string' || !key) return 0;
    const lc = key.toLowerCase();
    if (lc === 'empty') return 0;
    return keyToId[lc] || 0;
  };
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec) continue;
    const o0 = (0 * 256 + id) * 4;
    buf[o0+0] = clamp255(spec.emitTemp,      30);
    buf[o0+1] = clamp255(spec.ignitionPoint, 255);
    buf[o0+2] = clamp255(Math.round(((typeof spec.flammability === 'number') ? spec.flammability : 0) * 255), 0);
    buf[o0+3] = clamp255(spec.conductivity,  100);
    const o1 = (1 * 256 + id) * 4;
    buf[o1+0] = clamp255(spec.corrosivity, 0);
    buf[o1+1] = clamp255(spec.hardness, 80);
    buf[o1+2] = Math.round(((typeof spec.stickiness === 'number') ? spec.stickiness : 0) * 127);
    buf[o1+3] = 0;
    const o2 = (2 * 256 + id) * 4;
    buf[o2+0] = clamp255(spec.meltingPoint,   0);
    buf[o2+1] = clamp255(spec.boilingPoint,   0);
    buf[o2+2] = clamp255(spec.freezingPoint,  0);
    buf[o2+3] = 0;
    const o3 = (3 * 256 + id) * 4;
    buf[o3+0] = resolveId(spec.meltsTo);
    buf[o3+1] = resolveId(spec.boilsTo);
    buf[o3+2] = resolveId(spec.freezesTo);
    buf[o3+3] = 0;
    const o4 = (4 * 256 + id) * 4;
    buf[o4+0] = spec.conducts ? 1 : 0;
    // chargeEmit: signed -127..127 → offset binary 1..255 (128 = no source).
    const ce = (typeof spec.chargeEmit === 'number') ? Math.max(-127, Math.min(127, spec.chargeEmit | 0)) : 0;
    buf[o4+1] = (spec.chargeEmit === undefined || spec.chargeEmit === null) ? 128 : (ce + 128);
    buf[o4+2] = clamp255(spec.ignitesAtCharge, 0);
    buf[o4+3] = Math.round(((typeof spec.airflowFactor === 'number') ? spec.airflowFactor : 0) * 255);
    const o5 = (5 * 256 + id) * 4;
    const emit = spec.emitsAirflow || null;
    if (emit && (emit.vx || emit.vy)) {
      const evx = Math.max(-127, Math.min(127, (emit.vx || 0) | 0));
      const evy = Math.max(-127, Math.min(127, (emit.vy || 0) | 0));
      buf[o5+0] = evx + 128;
      buf[o5+1] = evy + 128;
    } else {
      buf[o5+0] = 128;
      buf[o5+1] = 128;
    }
    buf[o5+2] = clamp255(spec.pressureBlast, 0);
    buf[o5+3] = resolveId(spec.pressureBlastTo);
  }
  gl.bindTexture(gl.TEXTURE_2D, state.traitsTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 6, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

function clamp255(v, def) {
  if (typeof v !== 'number' || !isFinite(v)) return def;
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function uploadCellular() {
  const { gl, registry, keyToId } = state;
  if (!state.cellularDataTex) return;
  const buf = new Uint8Array(256 * 2 * 4);
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec || spec.kind !== 'cellular') continue;
    let bornMask = 0;
    for (const n of (spec.born || [])) {
      const ni = (n | 0);
      if (ni >= 0 && ni <= 8) bornMask |= (1 << ni);
    }
    let surviveMask = 0;
    for (const n of (spec.survive || [])) {
      const ni = (n | 0);
      if (ni >= 0 && ni <= 8) surviveMask |= (1 << ni);
    }
    const tick = Math.max(1, Math.min(30, Math.round(spec.cellularTick || 6)));
    const growChance    = clamp255(Math.round((typeof spec.growChance    === 'number' ? spec.growChance    : 0.45) * 255), 115);
    const surviveChance = clamp255(Math.round((typeof spec.surviveChance === 'number' ? spec.surviveChance : 0.92) * 255), 235);
    const bF = (spec.birthFrom || []).map(k => keyToId[k] || 0).slice(0, 3);
    while (bF.length < 3) bF.push(0);
    let growBias = 0;
    if (spec.growBias === 'up') growBias = 1;
    else if (spec.growBias === 'down') growBias = 2;
    else if (spec.growBias === 'side') growBias = 3;
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
  gl.bindTexture(gl.TEXTURE_2D, state.cellularDataTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}

// Registers texture:
// Row 0: (raInit, raDelta_offset, raDiesAt, raTransformsToId)
// Row 1: reserved (rb)
// raDelta offset: 128 = no tick. <128 = negative delta. >128 = positive.
export function uploadRegisters() {
  const { gl, registry, keyToId } = state;
  if (!state.registersTex) return;
  const buf = new Uint8Array(256 * 2 * 4);
  const resolveId = (key) => {
    if (typeof key !== 'string' || !key) return 0;
    if (key.toLowerCase() === 'empty') return 0;
    return keyToId[key.toLowerCase()] || 0;
  };
  for (let id = 0; id < 256; id++) {
    const spec = registry[id];
    if (!spec) continue;
    let raInit = 0, raDelta = 128, raDiesAt = 0, raTransforms = 0;
    if (spec.kind === 'gas' && spec.lifeMin) {
      raInit = clamp255(spec.lifeMin, 60);
      raDelta = 127;             // -1
      raDiesAt = 0;
      raTransforms = 0;          // dies on hitting 0
    }
    if (spec.isExplosive) {
      raInit = 28;               // settle frames
      raDelta = 127;             // -1
      raDiesAt = 255;            // never dies (clamp at 0 stops countdown)
      raTransforms = 0;
    }
    // AI / built-in custom registers override the above defaults.
    if (typeof spec.raInit === 'number') raInit = clamp255(spec.raInit, 0);
    if (typeof spec.raDelta === 'number') {
      raDelta = Math.max(1, Math.min(255, (spec.raDelta | 0) + 128));
    }
    if (typeof spec.raDiesAt === 'number') raDiesAt = clamp255(spec.raDiesAt, 0);
    if (typeof spec.raTransformsTo === 'string') raTransforms = resolveId(spec.raTransformsTo);
    const o0 = (0 * 256 + id) * 4;
    buf[o0+0] = raInit;
    buf[o0+1] = raDelta;
    buf[o0+2] = raDiesAt;
    buf[o0+3] = raTransforms;
  }
  gl.bindTexture(gl.TEXTURE_2D, state.registersTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, buf);
}
