# The Eavesdropper

Drop into a fictional cafe, listen to five passing conversations, and receive a hand-typed letter from whichever stranger you lingered on. The seat coordinates × dwell-time vector across overheard fragments are the deterministic seed; the AI proxy fills in the letter prose.

## Files

- `index.html` — DOM (three screens: seat picker, listening, letter) + share-preview meta + ES module entry
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **cozy cafe — warm cream paper, deep espresso ink, dim amber lamp glow** (Lora serif + Special Elite typewriter + Courier Prime monospace)
- `app.js` — entry point: imports journey, wires `window.share` / `window.restart`, renders the seat picker
- `cafe.js` — pure data: `TABLES` (5 tables + bar with curated fragments + names + closing details), `SEATS` (6 seat positions with proximity weights), `FLOOR_GRID` (7×6 floor-plan glyphs), `NAME_BANK` (per-table signature names + descriptors)
- `mechanic.js` — listening loop. Owns `scheduleFragments(seatId)` (deterministic per-seat 90s timeline), `startSession({onFragment, onTick, onDone})` (rAF-driven dwell-time tracker), `deriveLetterSignature` (seed = hash(seatId + quantized dwell vector))
- `journey.js` — copy strings + screen flow (seat → listen → loading → letter). Owns DOM rendering for each screen, the "currently listening to:" live label, the attention-bar live meter, share/restart handlers
- `ai.js` — single AI call per journey. `generateLetter()` calls `config.ai.endpoint`. Falls back to per-leader deterministic letters in `FALLBACK_LETTERS` on any failure.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.{png,jpg}` — share-preview hero (cozy cafe illustration). Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

1. User taps a seat tile on the floor grid → `journey.js` calls `scheduleFragments(seatId)` from `mechanic.js`. The schedule is fully deterministic per seat.
2. `startSession()` ticks every rAF: as fragments surface (one every 5.5s, max 4 visible), the user's "focus" defaults to the most recent fragment but is *locked* to a specific table for 7s when they tap "lean in." Dwell-ms accumulates per-table.
3. The live `nowTarget` label and per-table attention bar both render from the same `dwell.snapshot()` so the user can predict that lingering changes the leader.
4. At 90s, `onDone` fires with the leader-table id and final dwell percentages. `deriveLetterSignature` produces a stable signer name + reproducibility seed. `generateLetter` POSTs the seed + seat + lingered-on fragments to `config.ai.endpoint` (mini, max_tokens 320). The model's prose lands in a typewriter-styled letter card; on failure we render the per-leader fallback letter.
5. Share button copies a blurb + page URL via `navigator.share` or clipboard.

## Quirks

- **Live causality label is load-bearing.** "currently listening to: Table 4 (leaning in…)" + the per-table attention bar are explicitly the cure for the opaque-input-mechanic causality cluster (see `concepts/design-voice.md`). Both are wired to the same dwell snapshot — do not let them drift out of sync.
- **Lean-in lock = 7s or until next fragment surfaces.** Long enough to feel deliberate; short enough that idle taps don't dominate the dwell vector. Don't extend it indefinitely or "tap once and walk away" becomes the only strategy.
- **Per-seat fragment schedule is deterministic** so the dwell vector is the only user-controlled axis; this is what makes "different seat → different letter" honest. Don't reroll the schedule per session.
- **Fallback letters are voice-matched per table-leader.** On AI failure, the user must still get something signed by a real-feeling person. Edit them in pairs (real letter + matching fallback) if the leader's voice ever changes.
- **`max_tokens: 320`** is calibrated to ~140-word three-paragraph letters with some headroom. If letters start truncating, raise to 400 — but the proxy ceiling is 800.
- **Letter is the artifact** — no image generation per journey. The OG hero image is generated *once* at deploy time and pinned in the app dir; runtime image calls would only burn budget.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- The KB pitfall most relevant to this app is the **opaque-input-mechanic causality** family (`design-voice.md`) — keep the live "currently listening to" label visible at all times during the listen screen. Do not hide it behind a "compact" mode or a tap-to-reveal.
