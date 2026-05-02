// Convert a raw AI spec into something the engine can register.
//
// We trust the AI's kind/density/motion choices and only clamp/sanitize.
// Trait fields (emitTemp, conductivity, …) are normalized via the trait
// table so adding a trait doesn't require editing this file.
//
// `fallbackSpec` is the offline path if the AI call fails entirely:
// generic powder + a deterministic palette derived from the name hash.

import { state } from '../state.js';
import { nextCustomId } from '../elements.js';
import { clampTraits } from '../traits.js';

const KINDS = new Set(['static', 'powder', 'liquid', 'gas', 'cellular']);
const isHex = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
}

export function finalizeSpec(displayName, key, raw, userDesc) {
  const kind = (raw && KINDS.has(raw.kind)) ? raw.kind : 'powder';
  let density = +(raw && raw.density);
  if (!isFinite(density)) density = 5;
  density = clamp(Math.round(density), 1, 9);

  let colors = Array.isArray(raw && raw.colors) ? raw.colors.filter(isHex).slice(0, 6) : [];
  if (colors.length < 1) colors = paletteFromName(key);

  const out = {
    id: nextCustomId(), key,
    displayName: displayName.slice(0, 14).toLowerCase(),
    kind, density, colors,
    isBuiltIn: false, userDesc: userDesc || '',
    reactions: validReactions(raw && raw.reactions, key),
  };

  applyKindMotion(out, raw, kind);
  applyCellular(out, raw, kind);
  clampTraits(out, raw);
  return out;
}

export function fallbackSpec(displayName, key, desc) {
  const out = {
    id: nextCustomId(), key,
    displayName: displayName.slice(0, 14).toLowerCase(),
    kind: 'powder', density: 4,
    colors: paletteFromName(key),
    isBuiltIn: false, userDesc: desc || '',
    reactions: [],
    flow: 0.55, stickiness: 0,
  };
  return out;
}

function applyKindMotion(out, raw, kind) {
  const get01 = (v, d) => {
    const n = +v;
    return isFinite(n) ? clamp(n, 0, 1) : d;
  };
  if (kind === 'liquid') {
    out.viscosity  = get01(raw && raw.viscosity, 0);
    out.stickiness = get01(raw && raw.stickiness, 0);
  } else if (kind === 'powder') {
    out.flow       = clamp(isFinite(+raw?.flow) ? +raw.flow : 0.55, 0.05, 1);
    out.stickiness = get01(raw && raw.stickiness, 0);
  } else if (kind === 'gas') {
    out.buoyancy = clamp(isFinite(+raw?.buoyancy) ? +raw.buoyancy : 0.9, 0.05, 1);
    let lifeMin = Math.round(+(raw && raw.lifeMin));
    let lifeMax = Math.round(+(raw && raw.lifeMax));
    if (!isFinite(lifeMin)) lifeMin = 60;
    if (!isFinite(lifeMax) || lifeMax < lifeMin) lifeMax = lifeMin + 40;
    out.lifeMin = clamp(lifeMin, 0, 200);
    out.lifeMax = clamp(lifeMax, 0, 250);
  }
}

function applyCellular(out, raw, kind) {
  if (kind !== 'cellular') return;
  const ints = (v) => Array.isArray(v)
    ? v.map(Number).filter(n => isFinite(n) && n >= 0 && n <= 8).map(Math.round)
    : null;
  out.born    = ints(raw && raw.born)    || [3];
  out.survive = ints(raw && raw.survive) || [2, 3];
  const tick = +(raw && raw.cellularTick);
  out.cellularTick  = isFinite(tick) ? clamp(Math.round(tick), 1, 30) : 6;
  out.growChance    = clamp(isFinite(+raw?.growChance)    ? +raw.growChance    : 0.45, 0.05, 1);
  out.surviveChance = clamp(isFinite(+raw?.surviveChance) ? +raw.surviveChance : 0.92, 0.5, 1);
  if (Array.isArray(raw && raw.birthFrom)) {
    out.birthFrom = raw.birthFrom
      .filter(k => typeof k === 'string')
      .map(k => k.toLowerCase())
      .filter(k => state.keyToId[k]);
  }
  if (typeof raw?.growBias === 'string' && /^(up|down|side|any)$/i.test(raw.growBias)) {
    out.growBias = raw.growBias.toLowerCase();
  }
}

function validReactions(arr, selfKey) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const valid = new Set([selfKey, ...Object.keys(state.keyToId)]);
  for (const rx of arr.slice(0, 3)) {
    if (!rx || typeof rx !== 'object') continue;
    const other = (typeof rx.other === 'string') ? rx.other.toLowerCase() : '';
    if (!valid.has(other)) continue;
    let becomes = rx.becomes;
    if (becomes == null || becomes === '' || /^empty$/i.test(String(becomes))) becomes = null;
    else { becomes = String(becomes).toLowerCase(); if (!valid.has(becomes)) continue; }
    const chance = clamp(+rx.chance || 0.05, 0.005, 0.25);
    const r = { other, becomes, chance };
    if (isFinite(+rx.selfConsume) && +rx.selfConsume > 0) r.selfConsume = clamp(+rx.selfConsume, 0, 1);
    if (typeof rx.minTemp === 'number') r.minTemp = clamp(rx.minTemp | 0, 0, 255);
    if (typeof rx.maxTemp === 'number') r.maxTemp = clamp(rx.maxTemp | 0, 0, 255);
    if (rx.catalyst === true) r.catalyst = true;
    out.push(r);
  }
  return out;
}

// Deterministic palette from a key — the offline fallback uses this when
// the AI omits colors entirely.
function paletteFromName(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h * 31) + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push(hslToHex((hue + i * 12) % 360, 55, 38 + i * 6));
  }
  return out;
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const col = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * col).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
