# shaders/

One fragment shader per file, exported as a JS template-literal string.
The `${SH_HASH}` interpolation injects the shared hash function from
`common.js`.

## Pass roster (in order — `sim/passes.js runFrame()` drives them)

1. `sim.js` — Margolus 2×2 block CA. Density-aware sinking, sticky
   flow, gas rise. Runs four times per frame (one per phase 0..3).
2. `explosion.js` — `FS_PRIME` then `FS_BLAST`. Primes explosive cells
   that have a non-explosive neighbor, then detonates them in a 5-cell
   radius.
3. `react.js` — pairwise reactions with temp gates and catalyst flag,
   plus corrosion (folded in: any neighbor with `corrosivity > self.hardness` eats self).
4. `heat.js` — temperature diffusion + emitTemp pull + ambient decay.
5. `transform.js` — ignition (temp/charge → fire) + phase change
   (melt/boil/freeze).
6. `cellular.js` — Conway-style growth with optional anisotropy.
7. `register.js` — per-cell `ra` timer; transforms or kills on threshold.
8. `charge.js` — propagates electrical charge through conductors.
9. `pressure.js` — coarse-grid pressure + airflow + buoyancy.
10. `pressure-blast.js` — pop cells whose pressure exceeds threshold.
11. `render.js` — palette lookup + hot-glow + charge halo, writes to
    the default framebuffer (the canvas).

`paint.js` and `clear.js` are not part of the per-frame pipeline —
they're triggered by user input and reset, respectively.

## Idioms

- `precision highp float; precision highp int;` is required because
  we use `usampler2D` everywhere.
- Read state with `texelFetch(uState, px, 0)` for unfiltered integer
  sampling. NEVER use `texture()` on integer textures — silently zero.
- Trait rows are read by their fixed `[row, col]` indices declared in
  `src/traits.js`. Adding a trait there is the front door.
- `${SH_HASH}` provides `hash3(uvec3) → uint` and `rand01(uvec3) →
  float`. Seed with `(x, y, frame)` for spatially independent noise.

## Common gotchas

- Indexed `for` loops with non-constant bounds DO compile in WebGL2,
  but some drivers prefer small bounds. Keep `BLAST_R`-style constants
  tight.
- Don't write `gl_FragCoord` directly to a `uvec4` — cast to `ivec2`
  first.
- `uvec4(0u)` is four zeros; `uvec4(0)` is a type error.
