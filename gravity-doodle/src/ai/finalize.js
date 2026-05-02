// Validate / clamp / merge a raw spec from the AI into a final spec the
// engine can register. Order of precedence:
//   1. Name-based override (if the name says "fire", kind must be 'gas')
//   2. AI-provided trait
//   3. Name-based hint
//   4. Built-in default for the kind
//
// finalizeSpec is the happy path; fallbackSpec is the "AI failed, build
// something sane from the name only" path. Both end with applyTraits.

import { state } from '../state.js';
import { nextCustomId } from '../elements/registry.js';
import {
  kindOverrideFromName, namePropertyHints, traitDefaultsForName,
  isHex, fillFallbackColors, canonicalPaletteFromName,
} from './hints.js';

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
}

export function finalizeSpec(displayName, key, raw, userDesc) {
  const kinds = ['static','powder','liquid','gas','cellular'];
  let kind = (raw && typeof raw.kind === 'string') ? raw.kind.toLowerCase() : 'powder';
  if (kinds.indexOf(kind) < 0) kind = 'powder';
  const override = kindOverrideFromName(key, userDesc);
  const kindWasOverridden = !!(override && override !== kind);
  if (override) kind = override;
  const hint = namePropertyHints(key);

  let density = Number(raw && raw.density);
  if (!isFinite(density)) density = (hint && isFinite(hint.density)) ? hint.density : 5;
  if (kindWasOverridden && hint && isFinite(hint.density)) density = hint.density;
  density = Math.max(1, Math.min(9, density));

  let colorsArr = Array.isArray(raw && raw.colors) ? raw.colors.filter(isHex).slice(0, 6) : [];
  const canonicalColors = kindWasOverridden ? canonicalPaletteFromName(key) : null;
  if (canonicalColors) colorsArr = canonicalColors;
  if (colorsArr.length < 3) colorsArr = canonicalPaletteFromName(key) || fillFallbackColors(key);

  const validKeys = new Set(Object.keys(state.keyToId));
  validKeys.add(key);
  const reactions = [];
  if (Array.isArray(raw && raw.reactions)) {
    for (const rx of raw.reactions.slice(0, 3)) {
      if (!rx || typeof rx !== 'object') continue;
      const other = (typeof rx.other === 'string') ? rx.other.toLowerCase() : '';
      if (!validKeys.has(other)) continue;
      if (rx.explodes) {
        let chance = Number(rx.chance);
        if (!isFinite(chance)) chance = 0.9;
        chance = Math.max(0.1, Math.min(1, chance));
        const er = Math.max(4, Math.min(20, Math.round(Number(rx.explosionRadius)) || 8));
        const ep = Math.max(0.3, Math.min(3, Number(rx.explosionPower) || 1));
        reactions.push({ other, explodes: true, explosionRadius: er, explosionPower: ep, chance });
        continue;
      }
      let becomes = rx.becomes;
      if (becomes == null || becomes === '' || /^empty$/i.test(String(becomes))) becomes = null;
      else { becomes = String(becomes).toLowerCase(); if (!validKeys.has(becomes)) continue; }
      let chance = Number(rx.chance);
      if (!isFinite(chance)) chance = 0.05;
      chance = Math.max(0.005, Math.min(0.25, chance));
      const reaction = { other, becomes, chance };
      const sc = Number(rx.selfConsume);
      if (isFinite(sc) && sc > 0) reaction.selfConsume = Math.max(0, Math.min(1, sc));
      if (typeof rx.minTemp === 'number') reaction.minTemp = Math.max(0, Math.min(255, rx.minTemp|0));
      if (typeof rx.maxTemp === 'number') reaction.maxTemp = Math.max(0, Math.min(255, rx.maxTemp|0));
      if (rx.catalyst === true) reaction.catalyst = true;
      reactions.push(reaction);
    }
  }

  const out = {
    id: nextCustomId(),
    key,
    displayName: displayName.slice(0, 14).toLowerCase(),
    kind, density, colors: colorsArr, reactions,
    isBuiltIn: false,
    userDesc: userDesc || '',
  };

  const preferHint = kindWasOverridden && hint;
  if (kind === 'liquid') {
    let visc = Number(raw && raw.viscosity);
    if (preferHint && isFinite(hint.viscosity)) visc = hint.viscosity;
    else if (!isFinite(visc)) visc = (hint && isFinite(hint.viscosity)) ? hint.viscosity : 0;
    out.viscosity = Math.max(0, Math.min(1, visc));
    let stick = Number(raw && raw.stickiness);
    if (preferHint && isFinite(hint.stickiness)) stick = hint.stickiness;
    else if (!isFinite(stick)) stick = (hint && isFinite(hint.stickiness)) ? hint.stickiness : 0;
    out.stickiness = Math.max(0, Math.min(1, stick));
  } else if (kind === 'powder') {
    let flow = Number(raw && raw.flow);
    if (preferHint && isFinite(hint.flow)) flow = hint.flow;
    else if (!isFinite(flow)) flow = (hint && isFinite(hint.flow)) ? hint.flow : 0.55;
    out.flow = Math.max(0.05, Math.min(1, flow));
    let stick = Number(raw && raw.stickiness);
    if (preferHint && isFinite(hint.stickiness)) stick = hint.stickiness;
    else if (!isFinite(stick)) stick = (hint && isFinite(hint.stickiness)) ? hint.stickiness : 0;
    out.stickiness = Math.max(0, Math.min(1, stick));
  } else if (kind === 'gas') {
    let buoy = Number(raw && raw.buoyancy);
    if (preferHint && isFinite(hint.buoyancy)) buoy = hint.buoyancy;
    else if (!isFinite(buoy)) buoy = (hint && isFinite(hint.buoyancy)) ? hint.buoyancy : 0.9;
    out.buoyancy = Math.max(0.05, Math.min(1, buoy));
    let lifeMin = Math.round(Number(raw && raw.lifeMin));
    let lifeMax = Math.round(Number(raw && raw.lifeMax));
    if (preferHint && isFinite(hint.lifeMin)) lifeMin = hint.lifeMin;
    else if (!isFinite(lifeMin)) lifeMin = (hint && isFinite(hint.lifeMin)) ? hint.lifeMin : 60;
    if (preferHint && isFinite(hint.lifeMax)) lifeMax = hint.lifeMax;
    else if (!isFinite(lifeMax) || lifeMax < lifeMin) lifeMax = lifeMin + 40;
    lifeMin = Math.max(0, Math.min(150, lifeMin));
    lifeMax = Math.max(0, Math.min(200, lifeMax));
    if (lifeMin === 0 && lifeMax === 0) { lifeMin = 60; lifeMax = 100; }
    out.lifeMin = lifeMin; out.lifeMax = lifeMax;
  } else if (kind === 'cellular') {
    const parseIntArray = (v) => Array.isArray(v) ? v.map(Number).filter(n => isFinite(n) && n >= 0 && n <= 8).map(Math.round) : null;
    out.born    = parseIntArray(raw && raw.born)    || [3];
    out.survive = parseIntArray(raw && raw.survive) || [2,3];
    const tick = Number(raw && raw.cellularTick);
    out.cellularTick = isFinite(tick) ? Math.max(1, Math.min(30, Math.round(tick))) : 6;
    const gc = Number(raw && raw.growChance);
    out.growChance = isFinite(gc) ? Math.max(0.05, Math.min(1, gc)) : 0.45;
    const sc = Number(raw && raw.surviveChance);
    out.surviveChance = isFinite(sc) ? Math.max(0.5, Math.min(1, sc)) : 0.92;
    if (Array.isArray(raw && raw.birthFrom)) {
      out.birthFrom = raw.birthFrom.filter(k => typeof k === 'string').map(k => k.toLowerCase()).filter(k => state.keyToId[k]);
    }
    if (typeof raw.growBias === 'string' && /^(up|down|side|any)$/i.test(raw.growBias)) {
      out.growBias = raw.growBias.toLowerCase();
    }
  }

  applyTraits(out, raw, key, userDesc, hint, preferHint);
  return out;
}

export function applyTraits(out, raw, key, userDesc, hint, preferHint) {
  const defaults = traitDefaultsForName(key, out.kind);
  const raw255 = (v, d) => {
    const n = Number(v);
    if (!isFinite(n)) return d;
    return Math.max(0, Math.min(255, Math.round(n)));
  };
  const raw01 = (v, d) => {
    const n = Number(v);
    if (!isFinite(n)) return d;
    return Math.max(0, Math.min(1, n));
  };
  const rawSigned = (v, d) => {
    const n = Number(v);
    if (!isFinite(n)) return d;
    return Math.max(-127, Math.min(127, Math.round(n)));
  };
  const phaseKey = (v) => {
    if (typeof v !== 'string') return undefined;
    const lc = v.toLowerCase().trim();
    if (!lc) return undefined;
    return lc;
  };
  out.emitTemp      = raw255(raw && raw.emitTemp,      defaults.emitTemp);
  out.ignitionPoint = raw255(raw && raw.ignitionPoint, defaults.ignitionPoint);
  out.flammability  = raw01 (raw && raw.flammability,  defaults.flammability);
  out.conductivity  = raw255(raw && raw.conductivity,  defaults.conductivity);
  out.corrosivity   = raw255(raw && raw.corrosivity,   defaults.corrosivity);
  out.hardness      = raw255(raw && raw.hardness,      defaults.hardness);

  // Phase
  const meltAt = raw255(raw && raw.meltingPoint,  0);
  const boilAt = raw255(raw && raw.boilingPoint,  0);
  const freezeAt = raw255(raw && raw.freezingPoint, 0);
  const meltTo   = phaseKey(raw && raw.meltsTo);
  const boilTo   = phaseKey(raw && raw.boilsTo);
  const freezeTo = phaseKey(raw && raw.freezesTo);
  if (meltAt > 0 && meltTo)     { out.meltingPoint = meltAt;     out.meltsTo = meltTo; }
  if (boilAt > 0 && boilTo)     { out.boilingPoint = boilAt;     out.boilsTo = boilTo; }
  if (freezeAt > 0 && freezeTo) { out.freezingPoint = freezeAt;  out.freezesTo = freezeTo; }

  // Charge
  const conducts = (raw && typeof raw.conducts === 'boolean') ? raw.conducts
                 : (preferHint && hint && typeof hint.conducts === 'boolean') ? hint.conducts
                 : (defaults.conducts || false);
  if (conducts) out.conducts = true;
  if (raw && typeof raw.chargeEmit === 'number') out.chargeEmit = rawSigned(raw.chargeEmit, 0);
  else if (preferHint && hint && typeof hint.chargeEmit === 'number') out.chargeEmit = rawSigned(hint.chargeEmit, 0);
  else if (defaults.chargeEmit) out.chargeEmit = rawSigned(defaults.chargeEmit, 0);
  if (raw && typeof raw.ignitesAtCharge === 'number') out.ignitesAtCharge = raw255(raw.ignitesAtCharge, 0);
  else if (preferHint && hint && typeof hint.ignitesAtCharge === 'number') out.ignitesAtCharge = raw255(hint.ignitesAtCharge, 0);
  else if (defaults.ignitesAtCharge) out.ignitesAtCharge = raw255(defaults.ignitesAtCharge, 0);

  // Airflow
  if (raw && typeof raw.airflowFactor === 'number') out.airflowFactor = raw01(raw.airflowFactor, 0);
  else if (preferHint && hint && typeof hint.airflowFactor === 'number') out.airflowFactor = raw01(hint.airflowFactor, 0);
  else if (defaults.airflowFactor) out.airflowFactor = raw01(defaults.airflowFactor, 0);
  if (raw && raw.emitsAirflow && typeof raw.emitsAirflow === 'object') {
    const vx = rawSigned(raw.emitsAirflow.vx, 0);
    const vy = rawSigned(raw.emitsAirflow.vy, 0);
    if (vx || vy) out.emitsAirflow = { vx: Math.max(-8, Math.min(8, vx)), vy: Math.max(-8, Math.min(8, vy)) };
  } else if (preferHint && hint && hint.emitsAirflow) {
    out.emitsAirflow = hint.emitsAirflow;
  }
  if (raw && typeof raw.pressureBlast === 'number') {
    out.pressureBlast = raw255(raw.pressureBlast, 0);
    if (typeof raw.pressureBlastTo === 'string') out.pressureBlastTo = raw.pressureBlastTo.toLowerCase();
  } else if (preferHint && hint && hint.pressureBlast) {
    out.pressureBlast = hint.pressureBlast;
  }

  // Registers
  if (raw && typeof raw.raInit === 'number')          out.raInit = raw255(raw.raInit, 0);
  else if (preferHint && hint && typeof hint.raInit === 'number') out.raInit = raw255(hint.raInit, 0);
  if (raw && typeof raw.raDelta === 'number')         out.raDelta = rawSigned(raw.raDelta, 0);
  else if (preferHint && hint && typeof hint.raDelta === 'number') out.raDelta = rawSigned(hint.raDelta, 0);
  if (raw && typeof raw.raDiesAt === 'number')        out.raDiesAt = raw255(raw.raDiesAt, 0);
  if (raw && typeof raw.raTransformsTo === 'string')  out.raTransformsTo = raw.raTransformsTo.toLowerCase();
  else if (preferHint && hint && typeof hint.raTransformsTo === 'string') out.raTransformsTo = hint.raTransformsTo;
}

export function fallbackSpec(displayName, key, desc) {
  const kind = kindOverrideFromName(key, desc) || 'powder';
  const hint = namePropertyHints(key) || {};
  const out = {
    id: nextCustomId(), key,
    displayName: displayName.slice(0, 14).toLowerCase(),
    kind,
    density: hint.density || (kind === 'gas' ? 2 : kind === 'liquid' ? 5 : 4),
    colors: canonicalPaletteFromName(key) || fillFallbackColors(key),
    reactions: [],
    isBuiltIn: false, userDesc: desc || '',
  };
  if (kind === 'liquid') { out.viscosity = hint.viscosity || 0; out.stickiness = hint.stickiness || 0; }
  if (kind === 'powder') { out.flow = hint.flow || 0.55; out.stickiness = hint.stickiness || 0; }
  if (kind === 'gas')    { out.buoyancy = hint.buoyancy || 0.9; out.lifeMin = hint.lifeMin || 60; out.lifeMax = hint.lifeMax || 100; }
  if (kind === 'cellular') { out.born = [3]; out.survive = [2,3]; out.cellularTick = 6; out.growChance = 0.4; out.surviveChance = 0.94; }
  applyTraits(out, null, key, desc, hint, true);
  return out;
}
