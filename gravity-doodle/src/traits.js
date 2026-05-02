// Single source of truth for engine traits.
//
// Each TRAIT entry maps a JS spec field to one byte in the traits
// texture (256 wide × 6 rows of RGBA8UI). The shaders read fixed
// (row, col) positions, so adding a trait is:
//   1. Pick an empty slot below.
//   2. Add an entry here (slot, encoder, default, doc).
//   3. Add the corresponding read in the relevant shader.
//
// Reading from this table:
//   - uploads.js packs every spec into the texture.
//   - ai/finalize.js clamps raw AI output.
//   - ai/generate.js builds the prompt schema.
//   - ui/probe.js displays non-default values.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;

// Encoders: take a JS spec value and return a byte (0-255) for the texture.
// `idRef` needs the keyToId map at upload time.
const enc = {
  byte:        (v) => clamp(Math.round(num(v) ?? 0), 0, 255),
  pct255:      (v) => clamp(Math.round((num(v) ?? 0) * 255), 0, 255),
  pct127:      (v) => clamp(Math.round((num(v) ?? 0) * 127), 0, 127),
  bool:        (v) => v ? 1 : 0,
  signed:      (v) => clamp(Math.round(num(v) ?? 0), -127, 127) + 128,
  // chargeEmit historical quirk: 128 = "no source", so an actual 0 is
  // treated as no-source. Same encoding as `signed`.
  chargeEmit:  (v) => clamp(Math.round(num(v) ?? 0), -127, 127) + 128,
  idRef:       (v, keyToId) => {
    if (typeof v !== 'string' || !v) return 0;
    const lc = v.toLowerCase();
    if (lc === 'empty') return 0;
    return keyToId[lc] || 0;
  },
};

// Clampers: normalize a raw spec value to a sane JS value to store.
const cl = {
  byte:   (v) => { const n = num(v); return n == null ? null : clamp(Math.round(n), 0, 255); },
  unit01: (v) => { const n = num(v); return n == null ? null : clamp(n, 0, 1); },
  signed8:(v) => { const n = num(v); return n == null ? null : clamp(Math.round(n), -127, 127); },
  jet:    (v) => { const n = num(v); return n == null ? null : clamp(Math.round(n), -8, 8); },
  key:    (v) => (typeof v === 'string' && v) ? v.toLowerCase() : null,
  bool:   (v) => (typeof v === 'boolean') ? v : null,
};

export const TRAITS = [
  // Row 0: thermal
  { name: 'emitTemp',        slot: [0, 0], def: 30,  enc: enc.byte,    cl: cl.byte,    doc: 'baseline temp 0-255 (fire 240, ice 10)' },
  { name: 'ignitionPoint',   slot: [0, 1], def: 255, enc: enc.byte,    cl: cl.byte,    doc: 'temperature above which it can catch fire' },
  { name: 'flammability',    slot: [0, 2], def: 0,   enc: enc.pct255,  cl: cl.unit01,  doc: '0-1 chance per frame to ignite above ignitionPoint' },
  { name: 'conductivity',    slot: [0, 3], def: 100, enc: enc.byte,    cl: cl.byte,    doc: '0-255 heat diffusion (metal 240, wood 40)' },

  // Row 1: durability
  { name: 'corrosivity',     slot: [1, 0], def: 0,   enc: enc.byte,    cl: cl.byte,    doc: '0-255 eats neighbors with lower hardness (acid 200)' },
  { name: 'hardness',        slot: [1, 1], def: 80,  enc: enc.byte,    cl: cl.byte,    doc: '0-255 corrosion resistance (sand 60, wall 200)' },
  { name: 'stickiness',      slot: [1, 2], def: 0,   enc: enc.pct127,  cl: cl.unit01,  doc: '0-1 clings to walls (tar 0.85, honey 0.7)' },

  // Row 2/3: phase transitions (paired: point + product key)
  { name: 'meltingPoint',    slot: [2, 0], def: 0,   enc: enc.byte,    cl: cl.byte,    doc: 'melts above this temp' },
  { name: 'boilingPoint',    slot: [2, 1], def: 0,   enc: enc.byte,    cl: cl.byte,    doc: 'boils above this temp' },
  { name: 'freezingPoint',   slot: [2, 2], def: 0,   enc: enc.byte,    cl: cl.byte,    doc: 'freezes below this temp' },
  { name: 'meltsTo',         slot: [3, 0], def: 0,   enc: enc.idRef,   cl: cl.key,     doc: '<key> what it melts into' },
  { name: 'boilsTo',         slot: [3, 1], def: 0,   enc: enc.idRef,   cl: cl.key,     doc: '<key> what it boils into' },
  { name: 'freezesTo',       slot: [3, 2], def: 0,   enc: enc.idRef,   cl: cl.key,     doc: '<key> what it freezes into' },

  // Row 4: electrical
  { name: 'conducts',        slot: [4, 0], def: false, enc: enc.bool,        cl: cl.bool,    doc: 'bool: charge propagates through this cell' },
  { name: 'chargeEmit',      slot: [4, 1], def: 0,     enc: enc.chargeEmit,  cl: cl.signed8, doc: '-127..127 charge forced each frame (battery 120). 0 = no source.' },
  { name: 'ignitesAtCharge', slot: [4, 2], def: 0,     enc: enc.byte,        cl: cl.byte,    doc: '0-255 |charge| above this triggers ignition (gunpowder 20)' },
  { name: 'airflowFactor',   slot: [4, 3], def: 0,     enc: enc.pct255,      cl: cl.unit01,  doc: '0-1 wind sensitivity (gas/dust 0.7-0.95)' },

  // Row 5: airflow / pressure (emitsAirflow.{vx,vy} unpacked into two slots)
  { name: 'emitsAirflow.vx', slot: [5, 0], def: 0,   enc: enc.signed,  cl: cl.jet,     doc: 'fan vx -8..8 (positive = right). Set via emitsAirflow:{vx,vy}.' },
  { name: 'emitsAirflow.vy', slot: [5, 1], def: 0,   enc: enc.signed,  cl: cl.jet,     doc: 'fan vy -8..8 (positive = up).' },
  { name: 'pressureBlast',   slot: [5, 2], def: 0,   enc: enc.byte,    cl: cl.byte,    doc: '0-255 pops at local pressure above this (balloon 180)' },
  { name: 'pressureBlastTo', slot: [5, 3], def: 0,   enc: enc.idRef,   cl: cl.key,     doc: '<key> what the pop produces' },
];

export const TRAITS_TEX_ROWS = 6;

// Read a (possibly nested) field like 'emitsAirflow.vx' off a spec.
function readField(spec, name) {
  const dot = name.indexOf('.');
  if (dot < 0) return spec[name];
  const head = name.slice(0, dot);
  const tail = name.slice(dot + 1);
  const obj = spec[head];
  return obj ? obj[tail] : undefined;
}

function writeField(spec, name, value) {
  const dot = name.indexOf('.');
  if (dot < 0) { spec[name] = value; return; }
  const head = name.slice(0, dot);
  const tail = name.slice(dot + 1);
  if (!spec[head] || typeof spec[head] !== 'object') spec[head] = {};
  spec[head][tail] = value;
}

// Pack one element's traits into a 6×4-byte slice of the traits texture.
// Caller is responsible for placing the slice at the right column.
export function packTraits(spec, keyToId, out, idCol) {
  for (const t of TRAITS) {
    const raw = readField(spec, t.name);
    const value = (raw === undefined || raw === null) ? t.def : raw;
    const byte = (t.enc === enc.idRef) ? t.enc(value, keyToId) : t.enc(value);
    const [row, col] = t.slot;
    out[(row * 256 + idCol) * 4 + col] = byte;
  }
}

// Apply clamped raw fields to spec. `raw` is the AI's JSON object (or null).
// Used by ai/finalize.js — only writes fields that are present.
export function clampTraits(spec, raw) {
  if (!raw || typeof raw !== 'object') return;
  for (const t of TRAITS) {
    const v = readField(raw, t.name);
    if (v === undefined || v === null) continue;
    const cleaned = t.cl(v);
    if (cleaned === null) continue;
    writeField(spec, t.name, cleaned);
  }
}

// Build a one-line trait reference for the AI prompt. Skips nested-field
// duplicates by collapsing emitsAirflow.{vx,vy} into a single hint.
export function aiPromptTraitDocs() {
  const lines = [];
  const seen = new Set();
  for (const t of TRAITS) {
    if (t.name.startsWith('emitsAirflow.')) {
      if (seen.has('emitsAirflow')) continue;
      seen.add('emitsAirflow');
      lines.push(`  emitsAirflow: {vx,vy} — fan/jet (vx,vy each -8..8, positive vy = upward push)`);
      continue;
    }
    lines.push(`  ${t.name}: ${t.doc}`);
  }
  return lines.join('\n');
}
