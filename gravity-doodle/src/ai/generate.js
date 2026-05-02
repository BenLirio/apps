// Calls the AI endpoint to invent an element. The trait schema is
// generated from src/traits.js so this prompt and the engine never drift.

import { state } from '../state.js';
import { AI_ENDPOINT, SLUG } from '../constants.js';
import { aiPromptTraitDocs } from '../traits.js';

export async function generateElement(name, desc) {
  const existing = Object.keys(state.keyToId).join(', ');
  const SYSTEM_PROMPT = [
    'You design elements for a falling-sand physics sandbox. Output ONE strict JSON object, no prose, no code fence.',
    '',
    'Required fields:',
    '  kind: "static" | "powder" | "liquid" | "gas" | "cellular"',
    '  density: 1-9 (heavier sinks under lighter; helium 1, oil 2, water 5, mercury 9)',
    '  colors: ["#hex", ...] 1-4 swatches the engine cycles through',
    '',
    'Kind-specific motion fields:',
    '  powder.flow: 0-1 fluidity (sand 0.55, dust 0.95)',
    '  liquid.viscosity: 0-1 (water 0, honey 0.92)',
    '  gas.buoyancy: 0-1, gas.lifeMin/lifeMax: lifespan in frames',
    '  cellular.born/survive: arrays of 0-8 (Conway-style)',
    '  cellular.cellularTick: 1-30 frames between updates',
    '  cellular.growChance/surviveChance: 0-1',
    '  cellular.birthFrom: ["<key>"] elements that seed birth',
    '  cellular.growBias: "up" | "down" | "side" | "any"',
    '',
    'Engine traits (omit any that don\'t apply — sensible defaults):',
    aiPromptTraitDocs(),
    '',
    'Reactions (optional — for genuinely unique chemistry only; phase change and corrosion are already automatic):',
    '  reactions: [{ other: "<key>", becomes: "<key>" | "empty", chance: 0.005-0.25,',
    '                selfConsume?: 0-1, minTemp?: 0-255, maxTemp?: 0-255, catalyst?: bool }]',
    '',
    'Existing elements you can reference: ' + existing + '.',
    '',
    'Pick traits with physical intuition. Output JSON only.',
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
