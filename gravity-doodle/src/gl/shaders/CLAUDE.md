# shaders/

One fragment shader per file, exported as a JS template-literal string.
The interpolation `${SH_HASH}` injects the shared hash function from
`common.js`.

## Pass roster (run order)

1. `sim.js` — Margolus 2×2 block CA. Density-aware sinking, sticky-aware
   flow, gas rise. Runs four times per frame (one per phase 0..3).
2. `contact.js` + `blast.js` — explosive priming and detonation.
3. `react.js` — pairwise reactions with temp gates and catalyst flag.
4. `corrosion.js` — neighbors with corrosivity > self.hardness eat self.
5. `heat.js` — temperature diffusion + emitTemp pull + ambient decay.
6. `ignition.js` — ignites cells by temperature OR by charge magnitude.
7. `phase.js` — melt / boil / freeze transitions.
8. `cellular.js` — Conway-style growth, optional anisotropy.
9. `register.js` — per-cell ra timer; transforms or kills at threshold.
10. `charge.js` — propagates electrical charge through conductors.
11. `pressure.js` — coarse-grid pressure + airflow + buoyancy.
12. `pressure-blast.js` — pop cells when pressure exceeds threshold.
13. `render.js` — palette lookup + hot-glow + charge halo (writes to
    the default framebuffer, i.e. the canvas).

## Shader idioms

- `precision highp float; precision highp int;` is required at the top
  of every fragment shader because we use `usampler2D`.
- Read state with `texelFetch(uState, px, 0)` for unfiltered integer
  sampling. NEVER use `texture()` on integer textures — it'll silently
  return zero.
- Trait rows are read by their fixed row index. See the table in
  `../CLAUDE.md` and the comments in `../uploads.js`.
- `${SH_HASH}` provides `hash3(uvec3) → uint` and `rand01(uvec3) →
  float`. Seed with `(x, y, frame)` for spatially independent noise.

## Common gotchas

- Indexed `for` loops with non-constant bounds DO compile in WebGL2 but
  some drivers are happier when the bound is small. Keep BLAST_R-style
  constants tight.
- Don't write `gl_FragCoord` directly to a uvec4 — cast to ivec2 first.
- `uvec4(0u)` is 4 zeros; `uvec4(0)` is a type error.
