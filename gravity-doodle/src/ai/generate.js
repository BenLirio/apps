// Calls the AI endpoint to invent an element. The prompt is the most
// load-bearing thing in the file: it teaches the LLM the engine's trait
// schema. Keep it close to the engine — when you add a new trait to the
// simulation, also document it here so the AI starts using it.
//
// Returns the raw JSON object from the model. Validation/clamping is
// done downstream in finalize.js so the same logic also catches
// hand-written specs.

import { state } from '../state.js';
import { AI_ENDPOINT, SLUG } from '../constants.js';

export async function generateElement(name, desc) {
  const existing = Object.keys(state.keyToId);
  const otherList = existing.join(', ');
  const SYSTEM_PROMPT = [
    'You design elements for a falling-sand physics sandbox with rich emergent physics. Output ONE strict JSON object, no prose, no code fence.',
    '',
    'KIND determines movement: static (immobile), powder (falls, piles), liquid (flows, density-stacks), gas (rises, drifts in wind, finite life), cellular (Conway-like growth).',
    'DENSITY 1-9 orders stacking; heavier sinks under lighter (helium 1, oil 2, water 5, blood 6, mercury 9).',
    '',
    'PHYSICS AXES — each unlocks dozens of element ideas:',
    '',
    '1. HEAT / PHASE — emitTemp 0-255 (fire 240, ice 10), ignitionPoint, flammability 0-1, conductivity 0-255 (metal 240). meltingPoint+meltsTo, boilingPoint+boilsTo, freezingPoint+freezesTo for cascades like ice→water→steam.',
    '',
    '2. CORROSION — corrosivity (acid 200, lava 80) eats neighbors with lower hardness (sand 60, wall 200, diamond 255).',
    '',
    '3. STICKINESS 0-1 — cells cling to walls. tar 0.85, honey 0.7.',
    '',
    '4. CHARGE — invisible electrical field through conductors:',
    '   conducts: bool — charge propagates through this element',
    '   chargeEmit: -127..127 — sets charge here every frame (battery 120, ground -60)',
    '   ignitesAtCharge: 0-255 — |charge| above this triggers ignition (gunpowder 20)',
    '   Examples: copper conducts; battery emits +120; lightning emits +110 and ignites at 1; saltwater conducts weakly.',
    '',
    '5. AIRFLOW / PRESSURE — coarse velocity field:',
    '   airflowFactor: 0-1 — how much wind pushes this cell (gas/dust)',
    '   emitsAirflow: { vx: -8..8, vy: -8..8 } — fan or jet (positive vy = upward push)',
    '   pressureBlast: 0-255 — cell pops at local pressure above this (balloon 180)',
    '   pressureBlastTo: "<key>" — what pop produces (balloon→fire, glass→empty)',
    '',
    '6. REGISTERS — per-cell stateful behavior. Engine ticks ra each frame:',
    '   raInit: 0-255 starting value',
    '   raDelta: -127..127 per-frame change',
    '   raDiesAt: value that triggers death/transform',
    '   raTransformsTo: "<key>" — what it becomes; omit = die (empty)',
    '   Examples:',
    '     ember:    raInit 80, raDelta -1, raDiesAt 0 → dies in 80 frames',
    '     uranium:  raInit 250, raDelta -1, raDiesAt 0, raTransformsTo "lead"',
    '     wine:     raInit 200, raDelta -1, raDiesAt 0, raTransformsTo "vinegar"',
    '     ripening: raInit 0, raDelta +1, raDiesAt 200, raTransformsTo "rot"',
    '',
    '7. ANISOTROPIC GROWTH — for cellular elements: growBias "up"|"down"|"side"|"any". Vines grow up, roots grow down, mold spreads anywhere.',
    '',
    'REACTIONS — pair-events with optional gates: { other, becomes, chance 0.005-0.25, selfConsume? 0-1, minTemp? 0-255, maxTemp? 0-255, catalyst? bool, explodes? }. Use catalyst:true for true catalysts (self stays).',
    '',
    'The engine handles heat, phase changes, corrosion, charge, airflow, pressure, registers, and growth bias automatically. Use reactions[] only for genuinely unique chemical events (e.g., yeast + sugar → alcohol; iron + acid → rust).',
    '',
    'Existing keys: ' + otherList + '.',
    '',
    'Pick traits based on physical intuition. Schema:',
    '{ "kind":..., "density":1-9, "viscosity":0-1, "flow":0-1, "stickiness":0-1, "buoyancy":0-1, "lifeMin":int, "lifeMax":int, "born":[0-8], "survive":[0-8], "growBias":"up|down|side|any", "growChance":0.05-1, "surviveChance":0.5-1, "birthFrom":[key], "cellularTick":1-30, "colors":["#hex"], "emitTemp":0-255, "ignitionPoint":0-255, "flammability":0-1, "conductivity":0-255, "corrosivity":0-255, "hardness":0-255, "meltingPoint":1-255, "meltsTo":"<key>", "boilingPoint":1-255, "boilsTo":"<key>", "freezingPoint":1-255, "freezesTo":"<key>", "conducts":bool, "chargeEmit":-127..127, "ignitesAtCharge":0-255, "airflowFactor":0-1, "emitsAirflow":{"vx":-8..8,"vy":-8..8}, "pressureBlast":0-255, "pressureBlastTo":"<key>", "raInit":0-255, "raDelta":-127..127, "raDiesAt":0-255, "raTransformsTo":"<key>", "reactions":[...] }',
    '',
    'Output JSON only.',
  ].join('\n');

  const userPrompt = desc ? `Name: ${name}\nDescription: ${desc}` : `Name: ${name}`;
  const body = {
    slug: SLUG, model: 'gpt-5.4', temperature: 0.75, max_tokens: 900,
    response_format: 'json_object',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
  };
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('http_' + res.status);
  const data = await res.json();
  if (!data || typeof data.content !== 'string') throw new Error('bad_shape');
  return JSON.parse(data.content);
}
