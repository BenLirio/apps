# Closer to 1.000

Hold a button for as close to 1.000 seconds as you can. Each hold pins on a **live histogram** of every hold ever submitted to this app and reports your percentile (% of attempts you beat by being closer to 1.000) plus a tier label (BULLSEYE → DEAD-ON → SHARP → CLOSE → LOOSE → WIDE → OFF THE CURVE). Three holds per session, share your three with a URL-fragment-encoded link.

Renamed from `one-second-confessional` on 2026-05-04 after a feature_request reshaped the app from a confessional-flavored fortune to a competitive distribution game. The old slug redirects via `/apps/one-second-confessional/` → `/apps/closer-to-one/` so existing share links still resolve.

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Alpine `x-data` drives the four screens (intro / hold / result / final). Pins on the curve are HTML overlay divs (NOT SVG `<g>` elements — see Quirks). The result/final screens both render a `.curve-tally` line under the histogram showing "N holds recorded" so users see the live denominator.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **arcade scoreboard** — black void, blood-red bullseye + pins, ivory typewriter accents (Special Elite), monospace digit readout (VT323). Competitive register: the curve is the field, the pin is your score, the dashed vertical at 1.000s is the bullseye.
- `app.js` — entry point: imports `journey.js` (factory + window assignment) and wires `window.share`.
- `mechanic.js` — pure logic with **no network calls**. Owns: percentile math from a histogram (`beatPctFromBins`), curve-path SVG generator from a histogram (`curvePathFromBins`), tier mapping (deterministic on |delta|), pin-x mapping, and `encodeShare` / `decodeShare` for the URL fragment. Stays pure so it can be tested without mocking `fetch`.
- `journey.js` — Alpine factory `closerToOne()`. Owns the screen state machine, pointer-event handlers (`pointerdown` / `pointerup` / `pointercancel`), the live histogram fetch on `init()`, the `POST /hold` submission per release, and replay-from-fragment on init. The `DISTRIBUTION_BASE` URL + `SLUG` constants live at the top of this file.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image. **Stale from the previous "1-Second Confessional" framing** — regenerate via `implement-deploy` next time the app touches that flow. Functional but visually doesn't match the new scoreboard direction.

## Data flow

`journey.js` captures press/release timestamps via `performance.now()` on the hold button (`pointerdown` → start, `pointerup` → elapsed). On release:

1. **Optimistic render**: each elapsed-ms is fed to `computeResult(ms, this.bins, this.total)` using whatever bins are currently in memory; the result screen shows immediately with duration / delta / tier.
2. **POST /hold**: `submitHold(ms)` POSTs `{slug, durationMs}` to the shared `ef-distribution` Lambda. The response includes the new bin count for that ms range.
3. **Re-render**: the local bin map is patched with the new count and every result in `this.results` is recomputed against the updated histogram so percentiles stay coherent across all three holds. The SVG curve path is regenerated.

If the network fetch fails on `init()` or POST, the app degrades gracefully: duration / delta / tier still render, and `beatPct` shows `—%` instead of crashing. The first session may have an empty curve and no percentile until the first GET succeeds.

After three holds, `encodeShare` writes the URL fragment as `#h=ms,ms,ms` and the final screen renders the curve with all three pins overlaid + a stack of three result cards + a best-of-three headline. On load, `init()` calls `decodeShare(window.location.hash)` and jumps straight to the final screen if a valid fragment is present, recomputing each result's percentile against the **current** bins (so a shared link that's a week old will reflect today's distribution, not yesterday's).

## Distribution backend

The histogram lives in DynamoDB table `ef-hold-bins` (PK `slug`, SK `bin`) and is read/written via the `ef-distribution` Lambda at `https://7uhtm126ve.execute-api.us-east-1.amazonaws.com/hold`. Bin width is 5ms; the Lambda atomically `ADD`s `:1` to the (slug, bin) item per submission so concurrent writes don't conflict. See `infrastructure/distribution/` in the entertainment-factory repo for setup.sh + proxy.js.

The bins were seeded on 2026-05-04 with 1,500 synthetic samples drawn from a Laplace(1000, 120) distribution so the curve has shape on day one before any real player has submitted a hold. **The percentile is computed off the same bins as the visible curve**, so the number a player reads matches the visual area to the right of their pin — this stays true as the seed gets diluted by real plays. There's no separate "real" vs "seeded" tracking; bin counts just keep accumulating. Honesty is preserved by the live "N holds recorded" tally and by the model being shaped from real submissions over time.

## Quirks

- **Alpine's `<script>` tag MUST come AFTER `app.js`** in `index.html`. Alpine 3 starts immediately when its script runs (readyState is `'interactive'` during `defer` execution), and `x-data="closerToOne()"` will throw "is not defined" if our module hasn't run yet. Defer scripts execute in document order, so putting Alpine last guarantees the factory is on `window` before Alpine walks the DOM.
- **No timer is rendered during the press.** Showing a live timer mid-hold would let users cheat by watching it tick — the comedy + game both depend on the inability to see a clock. The duration is revealed only on release. Don't add a press-progress bar.
- **Pins are HTML divs, not SVG `<g>` elements.** Alpine's `<template x-for>` inside `<svg>` triggers HTML parser issues (the `<template>` element gets handled in HTML namespace and the contents may not render as SVG). Pins are positioned by `left: ${pinX/10}%` over an absolutely-positioned curve board. Don't migrate them back into the SVG.
- **`pinX` is 0–1000 (matching the SVG viewBox width).** To convert to a CSS percentage on the overlay, divide by 10. Out-of-range holds (<500ms or ≥1500ms) clamp to 0 / 1000 so the pin still renders at the edge.
- **`pointercancel` is treated as a release**, not a discarded hold. A user who committed to a press and got interrupted is still owed a result; the alternative (silent drop) feels broken.
- **`beatPct` caps at 99.** A perfect 1.000s hold reads "beat 99%" even when 100% would technically be true under the histogram. This leaves headroom in the scoreboard so no result ever claims to have beaten "100% of attempts."
- **`beatPct` can be `null`** when the histogram fetch hasn't finished or fails. The template renders `—%` in that case. Don't assume it's always a number.
- **Tier thresholds are in `TIERS` (mechanic.js)** and are independent of the live distribution — they map raw |delta| to a competitive label. Don't drift them; they're calibrated so each tier covers a meaningful chunk of plausible human button-press timing (BULLSEYE: ≤5ms, DEAD-ON: ≤15ms, SHARP: ≤40ms, CLOSE: ≤80ms, LOOSE: ≤150ms, WIDE: ≤300ms, OFF: anything farther).
- **Share fragments are backwards compatible** with the older `1-Second Confessional` format that included `&d=YYYYMMDD`. `decodeShare` ignores extra params, so an old share link still replays — just rendered in the new scoreboard framing instead of as confessions. Old URL shares degrade gracefully, they don't 404.
- **Old slug (`one-second-confessional`) redirects to the new slug** via a tiny `index.html` stub at the old path doing a meta-refresh. Don't delete the old dir; the share-graph (iMessage / Twitter / etc) caches links.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved between files, distribution endpoint changed), regenerate this CLAUDE.md.
- `mechanic.js` must stay network-free. All fetches live in `journey.js` so logic can be reasoned about without mocks.
- If the `TIERS` cutoffs change, double-check the tier feels meaningful at the boundaries (BULLSEYE shouldn't fire on a hold that's clearly off, etc).
- Don't seed the histogram a second time. Bins accumulate; re-seeding skews the curve back toward the synthetic shape and erases real-play signal.
