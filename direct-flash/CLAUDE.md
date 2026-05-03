# Direct Flash

Tilt your phone like you're taking a photo, hit FLASH, and develop a procedural 2008-digicam paparazzi card of whatever the tilt "caught" — ceiling shot, shoes, club portrait, wall accident, DJ booth, selfie miss, drink in hand. The "photo" is fully procedural (no real camera), composed from layered shapes with hot-flash washout, chromatic aberration, and grain.

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Three panels (`panel-calibrate`, `panel-view`, `panel-card`) toggled via `[hidden]`; flash overlay fixed-position over everything.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **late-2000s digicam paparazzi**. Magenta (#ff2bd6) + teal (#18e0d0) + amber date-stamp + paper cream for the developed card; Antonio (display), Share Tech Mono (chrome), VT323 (date stamp).
- `app.js` — entry point: imports loop, wires `window.share`, shows the desktop hint on no-coarse-pointer devices, calls `startCamera()`.
- `controls.js` — input layer. Owns `DeviceOrientation` permission flow + pose-zero calibration + recalibrate, and a desktop fallback (pointer-drag on the viewfinder + arrow keys). Emits a single calibrated `{pitch, roll, mode}` vector via `onTilt()`. Also owns `pickScene(tilt) → SCENES[k]` (scene bucketing: tilt UP→ceiling, DOWN→shoes, hard-left→wall, hard-right→booth, slight-up+roll→selfie, slight-down+roll→drink, near-neutral→club).
- `loop.js` — state machine (`cal → preview → flashing → card`) + the procedural scene renderer used by both the live viewfinder and the developed card. One `requestAnimationFrame` loop drives preview redraw with `dt` capped at 0.05s for tab-switch resilience. `renderCard(shot)` composes the paper-style card (photo + scene name + EXIF caption + orange seven-seg date stamp + brand line). Tiny WebAudio shutter+whine on flash (no asset).
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

`controls.requestPermissionAndCalibrate()` snapshots pose-zero (or falls back to drag/keys) and starts emitting tilt → `loop` repaints `#preview` and updates the scene-name + tilt readout each frame. On FLASH, `loop` snapshots a `shot` (sceneId, sceneName, caption, tilt, seed, takenAt), triggers the white-overlay animation + WebAudio click, then calls `renderCard(shot)` which paints the 900×1125 paper card. `window.share` and SAVE both read `getLastShot()` from `loop.js`. `SCENES` is the single source of truth for scene identity (id, name, caption) — owned by `controls.js`, consumed by `loop.js` for both bucketing and card text.

## Quirks

- **Pose-zero is mandatory** per the device-orientation KB page — we never feed raw `beta`/`gamma` into rendering. The calibrate panel gates the rest of the app on first load. iOS gets `DeviceOrientationEvent.requestPermission()` inside the click handler; non-iOS just binds the listener.
- **Desktop fallback ships first-class.** Pointer-drag on `#viewfinder` maps drag-Y to pitch and drag-X to roll over `±55°`; arrow keys nudge `±6°` per press. Spacebar is FLASH. The desktop hint and "best on mobile" line are revealed only on `(hover: none) and (pointer: coarse)` *false* devices.
- **Scene bucketing is wide and deterministic** (first-match-wins) so the readout doesn't flicker between two adjacent scenes when the sensor is noisy. Buckets favor "find a scene" over "fine grade" — the live preview labels the current scene as you move.
- **The card photo is rendered into an offscreen canvas first** so the chromatic-edge / grain layers land only inside the photo area, not on the cream paper background. Per-shot `seed` (Mulberry32) drives variation, so two flashes from the same tilt produce different prints.
- **Photo aspect = 0.92 (not 1.25)** in `renderCard` because the card also reserves ~330px below for the scene name, EXIF caption, and brand line. Don't bump it back to 4:5 without recomputing the text-block start.
- **No image proxy, no LLM, no network calls** beyond the standard feedback widget POST.

## Editing rules

- Soft cap 400 lines per JS file. `loop.js` is the closest to that ceiling — any new scene should be its own `drawScene-*()` helper, not piled into one.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
