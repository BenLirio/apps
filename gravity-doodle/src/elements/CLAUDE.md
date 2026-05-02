# elements/

The element registry and built-in element specs.

## Files

- `registry.js` — the `registerElement()` function that installs an
  element and re-uploads every GPU lookup texture. Custom (AI) elements
  flow through this. Also exports `kindCode` (string → numeric kind).
- `builtins.js` — the 28 built-in element specs, with a docblock listing
  every supported trait.

## Adding a built-in element

1. Add its id constant in `../constants.js` (append; never renumber).
2. Add its spec in `builtins.js` (`r[FOO_ID] = { ... }`).
3. Add the keyToId mapping at the bottom of `initBuiltIns()`.
4. If it should appear in the palette, add it to `ORDERED_BUILTIN_IDS`
   in `../ui/palette.js`.

## Adding a new TRAIT (across all elements)

This is the cross-cutting change to know about — it touches four files:

1. Document the trait in the comment block at the top of `builtins.js`.
2. Pack it into the right traits-row in `../gl/uploads.js`. (Find a
   spare byte; rows 0-5 already have a layout — see the comments above
   each function.)
3. Read it from the matching trait row in the shader that uses it
   (`../gl/shaders/*.js`).
4. Tell the AI about it in the SYSTEM_PROMPT in `../ai/generate.js`.
5. Apply / clamp it in `../ai/finalize.js` so AI specs without it get
   reasonable defaults.

## Trait reference: what's already there

Movement: `kind`, `density`, `flow`, `viscosity`, `stickiness`, `buoyancy`,
`lifeMin`, `lifeMax`, `airflowFactor`.
Heat: `emitTemp`, `ignitionPoint`, `flammability`, `conductivity`,
`meltingPoint`+`meltsTo`, `boilingPoint`+`boilsTo`,
`freezingPoint`+`freezesTo`.
Material: `corrosivity`, `hardness`.
Charge: `conducts`, `chargeEmit`, `ignitesAtCharge`.
Pressure: `emitsAirflow.{vx,vy}`, `pressureBlast`, `pressureBlastTo`.
Per-cell timer: `raInit`, `raDelta`, `raDiesAt`, `raTransformsTo`.
Cellular: `born`, `survive`, `cellularTick`, `growChance`, `surviveChance`,
`birthFrom`, `growBias`.
Reactions: `reactions: [{ other, becomes, chance, selfConsume?, minTemp?,
maxTemp?, catalyst? }]`.
