# gl/

WebGL2 context, lookup-texture uploaders, ping-pong grid sizing, and
the shader source modules under `shaders/`.

## Files

- `context.js` — `initGL()` compiles every program (in the `PROGRAMS`
  map), creates the lookup textures (`state.lookups.*`), and uploads
  seed data. There is no graceful-degrade path: if a shader fails to
  compile, init throws and the user gets the error overlay.
- `uploads.js` — packs the JS element registry into the lookup textures
  the shaders read. The traits texture is driven by `src/traits.js`;
  the others (elementData/palette/reactions/cellular/registers) have
  their layouts documented above each function.
- `grid.js` — `PingPong` helper class + `resizeCanvas()`. Each per-frame
  texture pair (`state.state`, `state.temp`, `state.charge`, `state.air`)
  is a `PingPong` instance with `.read()`, `.write()`, `.swap()`,
  `.clear(...rgba)`.
- `shaders/` — one fragment shader per file, exported as a JS string.
  See `shaders/CLAUDE.md`.

## Lookup textures (each 256 wide; col = element id)

| name           | rows | contents                                                                          |
|----------------|------|-----------------------------------------------------------------------------------|
| `elementData`  | 1    | (kindCode, density, paramA, paramB) — paramA = flow/viscosity/buoyancy; paramB low7 = stickiness, hi = isExplosive |
| `palette`      | 4    | RGBA color variants                                                              |
| `reactions`    | 6    | 3 slots × 2 rows (payload + conditions)                                          |
| `traits`       | 6    | layout owned by `src/traits.js TRAITS`                                            |
| `cellular`     | 2    | (born, survive, growChance, surviveChance) + (extras, birthFromIds×3)            |
| `registers`    | 2    | (raInit, raDelta+128, raDiesAt, raTransformsToId)                                |

## Adding a new GPU pass

1. Add `shaders/<name>.js` exporting `FS_<NAME>`.
2. Add `<key>: FS_<NAME>` to the `PROGRAMS` map in `context.js`.
3. Append a `runPass({ prog: '<key>', ... })` call in
   `../sim/passes.js runFrame()` at the right point in the order.

## Common pitfalls

- **Uniform names must match exactly.** A typo silently produces a
  `-1` location and `gl.uniform1i(-1, ...)` is a no-op.
- **`runPass` swaps automatically.** Don't manually swap; just declare
  which ping-pong to write to.
- **All trait offsets are bytes.** When you add a new trait, pick a
  free byte in `src/traits.js`; never overlap an existing slot.
