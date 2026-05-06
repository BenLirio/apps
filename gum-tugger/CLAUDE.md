# Gum Tugger

A photoreal-ish strand of pink chewing gum stretches from the top of the screen to your finger and snaps when you stretch too hard. Three pulls per session → a fake dental archetype + a URL-fragment ghost replay of your friend's three lengths.

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Stage element wraps the canvas; result card + share row sit below for after-snap reveal.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **clinical-pastel** — bubblegum pink against clipboard-cream backdrop, Special Elite typewriter for stamps and Source Serif 4 for body. Owns colors, fonts, borders, animations.
- `app.js` — entry point. Decodes URL-fragment ghost, wires pull-ended callbacks → state machine of three pulls, renders verdict card, owns `window.share` and `window.restart`.
- `loop.js` — `requestAnimationFrame` physics + lifecycle. Spring chain (N=36 nodes), structural springs only, gravity, damping; tip is spring-coupled to the pointer. Snap-detect: max-segment strain past `SNAP_STRAIN_THRESHOLD` sustained for `SNAP_STRAIN_SUSTAIN_MS` triggers break. Owns the rAF tick; calls into `render.js` to paint each frame. Bakes a grain texture once per resize.
- `render.js` — pure rendering. Multi-pass ribbon (shadow / pink core / inner highlight / specular hairline / translucent thinning at midpoint / occasional string-bridge near snap / recoil on break). Backdrop gradient, dental clamp, ghost-strand phantoms. No simulation state — `loop.js` passes in everything.
- `ghost.js` — share-fragment codec (3 lengths × 1mm precision packed into 7 base32 chars, with `g1` prefix; ~10 chars total fragment) + 16-entry deterministic dental-archetype bank. Hash of integer-mm lengths picks the bucket — same lengths always pick the same archetype.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.png|jpg` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

`loop.js` exposes `startLoop({ onSnap, onRelease, onTickReadout, onFirstTouch, ghost })`. Every pull (snap or release) calls back with `{ length: cm, snapped: bool }`. `app.js` collects three of those into `state.pulls`, then on the third one fires `showVerdict()` which calls `verdictFor(lengths)` from `ghost.js` and unhides the result card. Share encodes the three lengths into a fragment via `encodeRun({ lengths })`. On load, if a fragment is present, `decodeRun()` produces a `{ lengths }` ghost which `loop.js` renders as three faded vertical phantom strands on the left margin of the canvas.

## Quirks

- Lengths are virtual: `PX_PER_CM = 18` in `loop.js`. Feel-tuned for "I pulled 17 cm" to read as substantial, not anatomically correct. If you change this constant, the ghost replay scaling stays consistent because both record and replay go through `pxToCm`.
- The strand's rest length per segment is small (`Math.max(2.5, Math.min(8, cssH * 0.012))`) — this is what makes the gum *stretch* a long way before snapping. Don't bump it without retuning `SNAP_STRAIN_THRESHOLD`.
- Snap detection requires sustained strain (90ms by default) to avoid spurious snaps from a single noisy frame on phones.
- Share button is the only filled (pink) button — primary verb. "Three new pulls" is outlined. This is the mode-toggle vs primary-action rule from `shareability-design.md`.
- Verdict bank has 16 entries — small enough to feel curated, large enough that two friends are unlikely to roll the same one.

## Editing rules

- Soft cap 400 lines per JS file. `loop.js` is intentionally near the cap (canvas physics + render is the differentiator). Split along the next natural seam (e.g. `physics.js` vs `render.js`) before adding new effects.
- The aesthetic is "dental clinic" not "neon arcade." If feedback asks for chrome / glow / chunky drop shadow, push back — the visual identity is what makes the share card feel intentional, per the configure-to-reveal rule in `shareability-design.md`.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
