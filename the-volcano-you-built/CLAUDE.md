# The Volcano You Built

A 60-second tap simulation: drop heat on a flat island, watch ridges and cones emerge from your tap pattern, then receive a satellite portrait + derived geographic name (e.g. "Mt. Hard-Bake Tri-Cone NE-SW"). The reveal artifact (named landform + telemetry overlay + animating steam vents) is the share unit.

## Files

- `index.html` — DOM (3 stages: pre / play / result), share-preview meta, ES module entry.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **instrument-credibility / mission-control telemetry** (black bg, JetBrains Mono, amber + magma accents, code-comment headers `// MISSION`, scanline overlay, units-as-captions). Owns colors, fonts, borders, animation.
- `app.js` — entry: per-session seed, stage transitions (pre → play → result), wires `window.share`, calls `startLoop({onUI, onEnd})` then `reveal(els)`.
- `loop.js` — 60×60 grid heat-propagation simulation. Owns the `requestAnimationFrame` loop, tap input handler, ignition spread, passive cooling, elevation accretion, and the live-render path. `dt` capped at 0.05s. Exports `state` (heat / elev / ignited / taps / peakHeat) for the reveal module to read.
- `reveal.js` — pure analysis of `state.elev` → cones (local maxima, greedy collapse), ridge axis (PCA over cone positions), bearing (E-W / NE-SW / N-S / NW-SE), quadrant. Deterministic name derivation from a hash of tap geography. Renders the satellite portrait with hillshade + crater glow + animated steam vents.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.{png,jpg}` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

`app.js → startLoop()` mutates `state.{heat, elev, ignited, taps, peakHeat}` in `loop.js` for 60s. On end, `app.js → reveal(els)` reads `state` from `loop.js`, derives geography, names the volcano, and paints the satellite canvas. `window.__volcano = {name, blurb, lat, lon, elev, vents, seed}` is stashed for `share()`.

## Quirks

- **Authorship gate.** This is `mechanic=observe`-adjacent (the user watches a 60s sim) but every cell of elevation is causally a function of the user's taps — the verdict is *derived from tap geography*, not selected from a small bucket. Don't refactor this into a "pick a starter biome" prepick; the moment-by-moment tap → cone → name chain is the entire authorship case.
- **Shared `state` between `loop.js` and `reveal.js`.** `reveal.js` imports `state` directly. If the loop ever moves to a multiplayer / replay mode, copy the snapshot first; right now it works because the loop is fully done before reveal runs.
- **PCA bearing assumes ≥2 cones.** Single-cone case falls back to compass quadrant of the cone's centroid.
- **Steam-vent animation persists** — `startSteamLoop` keeps requesting frames after the satellite is drawn. Intentional (matches share-card spec). Cancel only if we add a "freeze frame" mode.
- **Touch-action: none on the canvas.** Required because every gesture is a tap-as-input. The play stage is opt-in (user clicks BEGIN), so the unscrollable-zone trap from ai-pitfalls Pitfall 10 doesn't apply here.

## Editing rules

- Soft cap 400 lines per JS file. `loop.js` and `reveal.js` are the candidates to split if they grow.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
