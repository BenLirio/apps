# Closer to 1.000

Hold a button for as close to 1.000 seconds as you can. You get **three holds**, each revealed individually with duration / delta / tier (BULLSEYE → DEAD-ON → SHARP → CLOSE → LOOSE → WIDE → OFF THE CURVE). The **live scoreboard is hidden until after the third hold**. On the final screen, the arithmetic mean of your three durations is pinned on a horizontal 0.5–1.5s track and a tier-comparison table shows how everyone clusters.

History:
- Renamed from `one-second-confessional` on 2026-05-04 after a feature_request reshaped the app from a confessional-flavored fortune to a competitive distribution game. Old slug redirects via `/apps/one-second-confessional/` → `/apps/closer-to-one/`.
- Reshape on 2026-05-05 (intermediate version): per-session POST instead of per-hold; the synthetic-Laplace seed was wiped from `ef-hold-bins` so the curve starts empty and accumulates real session-averages only.
- Reshape on 2026-05-05 (this version): the SVG histogram **curve viz was removed entirely** and replaced with (a) a slim horizontal score track that pins your average between 0.5s and 1.5s with a dashed bullseye marker at 1.000s, and (b) a tier-comparison table listing how many session-averages fell into each tier with the player's own tier highlighted. The curve was removed because it (1) looked broken at sparse data — a near-flat line with one tiny spike — and (2) was the source of a layout-overflow bug ("double the width of my screen"). The tier table handles sparse data honestly (zeros are zeros, no visual misdirection).

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Alpine `x-data` drives the four screens (intro / hold / result / final). The pin on the score track is a single absolutely-positioned div; the tier table is rendered with `<template x-for>`.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **arcade scoreboard** — black void, blood-red bullseye + pin, ivory typewriter accents (Special Elite), monospace digit readout (VT323). The horizontal score track + tier table replaced the older SVG curve viz; styles for `.curve-*` are intentionally gone.
- `app.js` — entry point: imports `journey.js` (factory + window assignment) and wires `window.share`.
- `mechanic.js` — pure logic with **no network calls**. Owns: percentile math from a histogram (`beatPctFromBins`), tier-comparison rollup (`tierDistributionFromBins`), tier mapping (deterministic on |delta|), `pinPctFor` (0–100% along the visible track), `averageMsOf`, and `encodeShare` / `decodeShare`. Stays pure so it can be tested without mocking `fetch`.
- `journey.js` — Alpine factory `closerToOne()`. Owns the screen state machine, pointer-event handlers, replay-from-fragment on init, and the **single `POST /hold` of the session-average** when the player advances from the third result to the final screen. The `DISTRIBUTION_BASE` URL + `SLUG` constants live at the top of this file. Computes `tierDistribution` from the live bins and exposes `tierMaxCount` for scaling the tier-table bars.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image. **Stale from older app variants** — regenerate via `implement-deploy` next time the app touches that flow. Functional but doesn't match the current scoreboard / track-and-tier framing.

## Data flow

`journey.js` captures press/release timestamps via `performance.now()` on the hold button. On release of each of the three holds:

1. `recordHold(ms)` runs `computeResult(ms, [], 0)` (no histogram needed) and shows the result screen with duration / delta / tier. **No network call.** The scoreboard stays hidden.
2. The player taps "next hold" (or "reveal the scoreboard" on hold 3).
3. On hold 3 → final transition (`advanceFromResult`):
   - Compute `averageMs = averageMsOf(holds)`.
   - Write the share fragment (`#h=ms,ms,ms`).
   - Switch to the final screen (track + tier table render against an empty/loading shape until network resolves).
   - `POST /hold` with `{slug, durationMs: averageMs}` — one submission per session.
   - `GET /hold/{slug}` to fetch the up-to-date histogram (now including our own bin).
   - Recompute `tierDistribution` and `averageResult` from the fresh bins.

If POST or GET fails the app degrades gracefully: duration / delta / tier still render in the per-hold cards, the average pin still places at the right `pinPct`, the tier table renders zeros, and `beatPct` shows `—%`. If GET fails but POST landed, the local view patches in the POST's bin so the pin at least sits in a non-empty tier table.

Replay flow (someone opens a `#h=…` share link): `init()` decodes the fragment, jumps to the final screen, fetches bins, and computes the same average pin against the **current** distribution (so a week-old shared link reflects today's tier breakdown, not yesterday's).

## Distribution backend

The histogram lives in DynamoDB table `ef-hold-bins` (PK `slug`, SK `bin`) and is read/written via the `ef-distribution` Lambda at `https://7uhtm126ve.execute-api.us-east-1.amazonaws.com/hold`. Bin width is 5ms; the Lambda atomically `ADD`s `:1` to the (slug, bin) item per submission so concurrent writes don't conflict. See `infrastructure/distribution/` in the entertainment-factory repo for setup.sh + proxy.js.

**One submission per session** — the average of the player's three holds — so each bin count corresponds to one player's session-average, not to one button-press. The tier table answers "where do my peers' averages cluster?" rather than "what is the distribution of all button-presses ever?". Cleaner comparison, less noise.

The seed was wiped on 2026-05-05 in response to user feedback that the synthetic data felt fake. The scoreboard now starts empty and accumulates real session-averages over time. **Do not re-seed.** If a future need arises (e.g. a viral spike followed by a quiet stretch), prefer letting the scoreboard be honestly thin rather than re-introducing synthetic shape.

## Quirks

- **Alpine's `<script>` tag MUST come AFTER `app.js`** in `index.html`. Alpine 3 starts immediately when its script runs (readyState is `'interactive'` during `defer` execution), and `x-data="closerToOne()"` will throw "is not defined" if our module hasn't run yet. Defer scripts execute in document order, so putting Alpine last guarantees the factory is on `window` before Alpine walks the DOM.
- **No timer is rendered during the press.** Showing a live timer mid-hold would let users cheat by watching it tick — the comedy + game both depend on the inability to see a clock. The duration is revealed only on release. Don't add a press-progress bar.
- **No track / tier table is rendered on the result screen.** The first three result screens deliberately show only duration / delta / tier — the scoreboard is the climax of the final screen, not a per-hold accompaniment. Don't put it back; revealing the percentile mid-session lets the player calibrate their next hold (boring) and wastes the dramatic moment.
- **Pin position is `pinPct` (0–100%) on the track.** Out-of-range averages (<500ms or ≥1500ms) clamp to 0 / 100 so the pin still renders at the edge.
- **`beatPct` caps at 99.** A perfect 1.000s average reads "beat 99%" even when 100% would technically be true under the histogram. This leaves headroom in the scoreboard so no result ever claims to have beaten "100% of attempts."
- **`beatPct` can be `null`** when the histogram fetch hasn't finished or fails. The template renders `—%` in that case. Don't assume it's always a number.
- **Tier thresholds are in `TIERS` (mechanic.js)** and are independent of the live distribution — they map raw |delta| to a competitive label. Don't drift them; they're calibrated so each tier covers a meaningful chunk of plausible human button-press timing (BULLSEYE: ≤5ms, DEAD-ON: ≤15ms, SHARP: ≤40ms, CLOSE: ≤80ms, LOOSE: ≤150ms, WIDE: ≤300ms, OFF: anything farther).
- **Tier table always renders all seven rows**, even at total=0, so the layout doesn't jump when the fetch resolves. `tierMaxCount` is clamped to ≥1 so empty bars compute as 0% width without NaN.
- **Don't add the SVG curve back.** It looked broken at sparse data and caused mobile layout overflow. The tier table tells the same comparison story (where do people cluster?) without the visual misdirection at low N. If you need a denser visualization later, build it on top of `tierDistribution` — don't reach for SVG paths.
- **Share fragments stay `h=ms,ms,ms` for all three durations**, not the average alone. Replay viewers see the same per-hold breakdown the original player did, plus the average pin. Backwards compatible with the older confessional-era format that included `&d=YYYYMMDD`; `decodeShare` ignores extra params.
- **Old slug (`one-second-confessional`) redirects to the new slug** via a tiny `index.html` stub at the old path doing a meta-refresh. Don't delete the old dir; the share-graph (iMessage / Twitter / etc) caches links.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved between files, distribution endpoint changed, reveal-timing changed), regenerate this CLAUDE.md.
- `mechanic.js` must stay network-free. All fetches live in `journey.js` so logic can be reasoned about without mocks.
- If the `TIERS` cutoffs change, double-check the tier feels meaningful at the boundaries (BULLSEYE shouldn't fire on a hold that's clearly off, etc).
- Don't re-seed the histogram. The 2026-05-05 wipe was deliberate — real session-averages only.
- Don't reach for SVG histogram visualizations at low data volumes. The tier table is the right primitive when N is small or the data is naturally bucketed.
