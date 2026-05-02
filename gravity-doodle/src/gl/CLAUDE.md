# gl/

WebGL2 context, lookup-texture uploaders, ping-pong grid sizing, and
the shader source modules under `shaders/`.

## Files

- `context.js` — `initGL()` boots every program, creates lookup textures,
  uploads seed data. Also exports `compileShader`, `linkProgram`,
  `createUI8Texture`, `createU8Texture2D`, `makeFbo`, `clearStateTo`,
  and the small binders `bindStateA / bindElementData / bindTraits`
  used by every sim pass.
- `uploads.js` — packs the JS element registry into the lookup textures
  the shaders read. **Texture layouts are documented above each
  function — read them before changing field positions.** They are
  referenced by byte offset inside fragment shaders.
- `grid.js` — `resizeCanvas()` recomputes COLS / ROWS / AIR_COLS /
  AIR_ROWS and reallocates ping-pong textures. Runs at startup and on
  window resize.
- `shaders/` — one fragment shader per file, exported as a JS string.
  See `shaders/CLAUDE.md`.

## Lookup textures (each 256 wide; col = element id)

| name              | rows | what's in it                                                                                              |
|-------------------|------|-----------------------------------------------------------------------------------------------------------|
| `elementDataTex`  | 1    | (kindCode, density, paramA, paramB)  — paramA = flow/visc/buoy; paramB low7=stickiness, hi=isExplosive    |
| `paletteTex`      | 4    | RGBA color variants                                                                                        |
| `reactionsTex`    | 6    | 3 reaction slots × 2 rows (payload + conditions)                                                          |
| `traitsTex`       | 6    | (heat, material, phase-temps, phase-targets, charge/airflow-factor, airflow-emit/pressure-blast)          |
| `cellularDataTex` | 2    | (bornMaskLo, surviveMaskLo, growChance, surviveChance) + (extras, birthFromIds×3)                          |
| `registersTex`    | 2    | (raInit, raDelta_offset, raDiesAt, raTransformsToId) row 0; rb reserved row 1                              |

The `state*` / `temp*` / `charge*` / `air*` ping-pong textures are the
mutable fields. State is full-res; the air (pressure/wind) texture is
1/4 res.

## Adding a new shader

1. Add `shaders/<name>.js` exporting `FS_<NAME>` (string).
2. Import it in `context.js` and `tryProg('progXxx', FS_XXX, 'progXxx')`
   inside `initGL()`.
3. Add a step function in `../sim/passes.js` that binds inputs, draws
   the quad, and ping-pongs the relevant texture pair.
4. Call your step from the right place in `../sim/loop.js`.

## Common pitfalls

- **Don't forget to ping-pong.** Every shader writes to `*FboB`, then
  the JS swaps `*TexA`/`*TexB`. If a shader's output is missing, you
  probably forgot the swap.
- **Uniform names must match exactly.** A typo silently produces a
  -1 location and `gl.uniform1i(-1, ...)` is a no-op.
- **All trait offsets are bytes.** When you add a new trait, find or
  add a free byte in one of the trait rows; never overlap.
