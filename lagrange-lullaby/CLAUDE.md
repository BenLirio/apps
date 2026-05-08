# Lagrange Lullaby

A daily-seeded binary star system spins on canvas. The user taps once to release a moon at zero velocity; real Newtonian gravity decides whether it ends the 60-second sim as **stable orbit / resonance hugger / captured wanderer / doomed comet**. Same binary for everyone, every day — share artifact is the named tier.

## Files

- `index.html` — DOM, head meta, ES-module entry. Header HUD + canvas + verdict card + tier-legend footer.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **observatory telemetry** (dark space, JetBrains Mono / Space Grotesk, amber+cyan accents, units-as-captions, code-comment headers).
- `app.js` — entry: imports `startLoop`, wires `window.share` (Web Share → clipboard fallback).
- `loop.js` — physics + render + state machine. Velocity-Verlet integration of the moon under two-body gravity; binary stars rotate at fixed Keplerian ω derived from daily-seeded mass ratio + separation. Renders trail, glows, α/β star labels.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.{png,jpg}` — share-preview image. Regenerate via `implement-deploy` only if the visual identity or core hook changes.

## Data flow

Daily UTC date → `hash32` → `mulberry32` RNG → `{ m1, m2, r, omega, phase0 }`. Star positions are pure functions of the rotating axis angle; the moon is integrated against time-dependent star positions (no back-reaction — moon mass is treated as zero). Stats accumulate live during sim (mean / variance of distance from COM, mean dist to each star, min approaches, max excursion). On end (collision / escape / t≥60), `classify()` reads stats → tier; verdict card shows tier name + description + telemetry block.

## Quirks

- `DT=0.005` with `SUBSTEPS=3` per real frame → ~realtime at 60fps. Smaller dt was needed for stability near the stars; larger dt threw the moon off the canvas.
- Canvas spans ±2 physics units (`scale = cssW / 4`). `ESCAPE_RADIUS=4` is well off-canvas, so escape only triggers after the moon is visibly gone.
- Star sizes are scaled by `sqrt(mass)` for visual mass legibility; collision radius stays at `STAR_RADIUS=0.07` regardless of mass.
- Tier `RESONANCE_HUGGER` is detected by `min(meanD1, meanD2) / max(...) < 0.45` — the moon spent the run hugging one star. `STABLE_ORBIT` requires `std/mean < 0.18` of distance-from-COM. Otherwise survival = `CAPTURED_WANDERER`.
- Moon is released at zero velocity by design — the rationale ("snap to grid") was rejected in favor of free placement; chaotic sensitivity is the point, the daily-seeded same-binary-for-everyone keeps results comparable.
- Pointerdown handler `preventDefault`s and `touchstart`/`gesturestart`/`contextmenu` are killed on the canvas to suppress iOS magnifier / zoom / select-all.
- Daily seed is **UTC**, not local — so everyone on Earth sees the same binary today.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam (e.g. `physics.js` if classification logic grows) if you cross it.
- After any structural edit (file added / responsibility moved), regenerate this CLAUDE.md.
- Do not change `DT` / `SUBSTEPS` together casually — the real-time pacing depends on their product.
