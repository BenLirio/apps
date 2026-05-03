# Console Pilot

Tilt-as-yoke nebula corridor flight. Run ends with a Flight Recorder card and a callsign the ship christens you — the share artifact.

## Files

- `index.html` — DOM (preflight / calibrate / flight / recorder panels) + share-preview meta + ES module entry.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **cockpit avionics CRT** — phosphor green on black, amber alerts, VT323 monospace, scanline overlay. Owns colors, fonts, borders, animation.
- `app.js` — entry point. Screen-state machine (`preflight → calibrate → flight → recorder`), canvas wiring, `window.share`.
- `loop.js` — pseudo-3D corridor: depth-projected debris/beacons/rings, ship-as-reticle, requestAnimationFrame loop, run stats accumulator. dt is capped at 0.05s.
- `controls.js` — DeviceOrientationEvent permission gate + pose-zero calibration; pointer/keyboard fallback on desktop or denied permission. Single-step metaphor: tilt → reticle position.
- `callsign.js` — deterministic callsign generator. Reads run stats (maxG, closestPass, nearMisses, smoothness=stddev(input), beaconsHit/Total, hit) and picks the highest-scoring descriptor + a rank from completion %. Same stats → same name; the runtime signature only tiebreaks blurbs/handles.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.{png,jpg}` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

1. Engage → `controls.requestOrientation()` returns granted/denied.
2. Granted → 1.4s calibration screen captures pose-zero from current grip; denied → skip straight to flight (pointer mode).
3. Flight: each frame `controls.tick(dt)` returns `{x,y}` in `[-1,1]`; `loop.setInput(x,y)` feeds the ship; loop accumulates `stats` (maxG, closestPass, sectorIndex, beaconsHit, smoothness inputs).
4. Run end (60s timeup or hit): `loop.onEnd(stats) → callsign.generateCallsign(stats) → fillRecorder()`.
5. `window.share` builds a tweet-shaped log with the callsign + stats and uses `navigator.share` if available, else clipboard.

## Quirks

- Tilt sensitivity is hand-tuned (`gamma/28`, `beta/22`) — full deflection at ~28°/22° from neutral. Don't increase: bigger numbers feel laggy on phones with restrained beta sensors.
- "Closest pass distance" is reported in fake-metres (`raw * 8`). The world-units are abstract; the multiplier exists so the number on the recorder card reads as a real cockpit log.
- The ship's perspective scaling uses `FOCAL/NEAR_Z * 0.18` so the reticle actually moves around the centre of the canvas — without the multiplier the apparent travel was tiny and the tilt felt dead.
- `closestPass = Infinity` (no debris ever crossed near plane) is replaced with `'—'` on the card; otherwise the stat would feel broken.
- Run is locked to 60 seconds. Don't make it longer — 60 is in the budget for "session under 2 minutes" with calibration + recorder review.
- Ships at `aspect-ratio: 3/4` portrait on mobile, `4/3` on >600px. The pseudo-3D math doesn't care about aspect; canvas just gets a different layout box.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- Tilt-control rules are load-bearing for "feels physical" — see `knowledge-base/pages/concepts/device-orientation-controls.md` before changing pose-zero / sensitivity / fallback logic.
