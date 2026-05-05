# Closer to 1.000

Hold a button for as close to 1.000 seconds as you can. Each hold pins on a calibrated distribution curve and reports your percentile (% of attempts you beat by being closer to 1.000) plus a tier label (BULLSEYE → DEAD-ON → SHARP → CLOSE → LOOSE → WIDE → OFF THE CURVE). Three holds per session, share your three with a URL-fragment-encoded link.

Slug is `one-second-confessional` for historical / URL-stability reasons; the current display name is "Closer to 1.000".

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Alpine `x-data` drives the four screens (intro / hold / result / final). Pins on the curve are HTML overlay divs (NOT SVG `<g>` elements — see Quirks).
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **arcade scoreboard** — black void, blood-red bullseye + pins, ivory typewriter accents (Special Elite), monospace digit readout (VT323). Competitive register: the curve is the field, the pin is your score, the dashed vertical at 1.000s is the bullseye.
- `app.js` — entry point: imports `journey.js` (factory + window assignment) and wires `window.share`.
- `mechanic.js` — pure logic: distribution model + percentile math (`computeResult`), `bestOf`, the pre-baked SVG path string for the density curve (`CURVE_PATH`), pin-x mapping, and `encodeShare` / `decodeShare` for the URL fragment.
- `journey.js` — Alpine factory `closerToOne()`. Owns the screen state machine, pointer-event handlers (`pointerdown` / `pointerup` / `pointercancel`), and replay-from-fragment on init.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image. **Stale from the previous "1-Second Confessional" framing** — regenerate via `implement-deploy` next time the app touches that flow. Functional but visually doesn't match the new scoreboard direction.

## Data flow

`journey.js` captures press/release timestamps via `performance.now()` on the hold button (`pointerdown` → start, `pointerup` → elapsed). Each elapsed-ms is fed to `computeResult(elapsedMs)` which returns `{durationMs, durationStr, deltaMs, deltaStr, beatPct, tierKey, tierLabel, pinX, isOutOfRange}`. The `result` screen renders the duration + delta + percentile + tier badge + a curve SVG with a single pin at `pinX/10 %` from the left. After three holds, `encodeShare` writes the URL fragment as `#h=ms,ms,ms` and the final screen renders the curve with all three pins overlaid + a stack of three result cards + a best-of-three headline. On load, `init()` calls `decodeShare(window.location.hash)` and jumps straight to the final screen if a valid fragment is present.

## The distribution model

The curve and the percentile both come from a Laplace distribution centered at 1000ms with scale parameter SCALE=120ms (in `mechanic.js`). Survival function: `P(|delta| > x) = exp(-x / SCALE)` — that's the `beatPctFor` formula, scaled to 0–99. The visible SVG path is `densityAtMs` plotted at 5ms steps across [500ms, 1500ms]. Single source of truth: the visible curve is *the same model* as the percentile number, so the area under the curve to the right of your pin equals (approximately) the % you beat.

This model is **synthetic, not aggregated from real users**. The curve is hand-tuned to roughly match observed human button-press timing without a visible reference (mode at the target, ~120ms Laplace scale → median |delta| ≈ 83ms). v1 ships against this synthetic baseline so the percentile is meaningful from day one without needing to bootstrap a player base. Honesty: the curve is drawn on screen so it's visibly a model, not a fake live leaderboard. If/when the app gets traction, the model can be replaced by real aggregation (per-day distribution from a Lambda + key-value store) without changing the player-facing copy.

## Quirks

- **Alpine's `<script>` tag MUST come AFTER `app.js`** in `index.html`. Alpine 3 starts immediately when its script runs (readyState is `'interactive'` during `defer` execution), and `x-data="closerToOne()"` will throw "is not defined" if our module hasn't run yet. Defer scripts execute in document order, so putting Alpine last guarantees the factory is on `window` before Alpine walks the DOM.
- **No timer is rendered during the press.** Showing a live timer mid-hold would let users cheat by watching it tick — the comedy + game both depend on the inability to see a clock. The duration is revealed only on release. Don't add a press-progress bar.
- **Pins are HTML divs, not SVG `<g>` elements.** Alpine's `<template x-for>` inside `<svg>` triggers HTML parser issues (the `<template>` element gets handled in HTML namespace and the contents may not render as SVG). Pins are positioned by `left: ${pinX/10}%` over an absolutely-positioned curve board. Don't migrate them back into the SVG.
- **`pinX` is 0–1000 (matching the SVG viewBox width).** To convert to a CSS percentage on the overlay, divide by 10. Out-of-range holds (<500ms or ≥1500ms) clamp to 0 / 1000 so the pin still renders at the edge.
- **`pointercancel` is treated as a release**, not a discarded hold. A user who committed to a press and got interrupted is still owed a result; the alternative (silent drop) feels broken.
- **`beatPct` caps at 99.** A perfect 1.000s hold reads "beat 99%" even though `exp(0)=1`. This leaves headroom in the scoreboard so no result ever claims to have beaten "100% of attempts" (which is a measure-zero event under a continuous model anyway).
- **Tier thresholds are in `TIERS` (mechanic.js).** Don't drift them — they're set so each tier covers a roughly meaningful chunk of the distribution (BULLSEYE: top ~96%, DEAD-ON: top ~88%, SHARP: top ~72%, CLOSE: top ~51%, LOOSE: top ~29%, WIDE: top ~8%, OFF: bottom ~8%).
- **Share fragments are backwards compatible** with the older `1-Second Confessional` format that included `&d=YYYYMMDD`. `decodeShare` ignores extra params, so an old share link still replays — just rendered in the new scoreboard framing instead of as confessions. Old URL shares degrade gracefully, they don't 404.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved between files, or the distribution model swapped from synthetic to aggregated), regenerate this CLAUDE.md.
- If `SCALE` or the `TIERS` cutoffs change, double-check that the visual curve and the percentile readout still tell the same story (they share `SCALE` for that reason).
