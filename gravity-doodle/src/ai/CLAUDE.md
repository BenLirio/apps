# ai/

The "invent an element" pipeline. Calls the AI proxy, then validates
and clamps the response into a spec the engine can register.

## Files

- `generate.js` — `generateElement(name, desc)`. Fires the network call
  to the AI endpoint and returns the parsed JSON. The SYSTEM_PROMPT in
  this file is the single most important text in the AI flow; it
  teaches the model the engine's trait schema. **Whenever you add a new
  trait to the engine, also document it in SYSTEM_PROMPT.**
- `hints.js` — pure heuristics derived from the element's NAME. Three
  layers: `kindOverrideFromName` (corrects mis-classified kinds),
  `namePropertyHints` (suggests density / viscosity / etc), and
  `traitDefaultsForName` (fills in heat / phase / etc traits when the
  AI omits them). Also color helpers (`canonicalPaletteFromName`,
  `fillFallbackColors`, `hslToHex`) and `isHex`.
- `finalize.js` — `finalizeSpec` merges AI output with hints and clamps
  every value into engine bounds. `applyTraits` is shared between the
  happy path and the fallback path. `fallbackSpec` is invoked when the
  AI errors out; it builds a sane spec from the name alone.
  `slugify(name)` produces the registry key.

## Order of precedence inside finalizeSpec

1. **Name-based override** (e.g. name says "fire" → kind must be 'gas').
2. **AI-provided trait** if the kind wasn't overridden.
3. **Name-based hint** (`namePropertyHints`).
4. **Built-in default for the kind** (`traitDefaultsForName`).

The `preferHint` flag flips priority 2 and 3 when the kind was
overridden — because if the AI produced "fire as a powder", its powder
flow value is not trustworthy for a gas.

## Adding a new AI-tunable trait

1. Document in SYSTEM_PROMPT (`generate.js`). Schema bullet.
2. Read it in `applyTraits` with `raw255` / `raw01` / `rawSigned` and
   the right defaults.
3. Add a default hook in `traitDefaultsForName` if it has a sensible
   per-element-class default.
