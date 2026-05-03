# Phantom Putt

A daily mini-golf hole drawn in pen on graph paper. Tilt your phone to roll the ball; each motion-session counts as a stroke. Share a Wordle-style emoji-grid + named verdict. Same hole worldwide, rotating by UTC day.

## Files

- `index.html` — DOM, share meta, splash + result overlays, ES module entry
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **hand-drawn pen on graph paper** (cream paper, pale-blue grid, navy ink, hand-script title). Architects Daughter + Special Elite from Google Fonts.
- `app.js` — entry point: splash → game → result flow, daily best (localStorage), `window.share`
- `loop.js` — game state + physics (rAF loop, friction, wall reflection), hole catalogue (15 hand-designed layouts, daily-rotated), canvas rendering (graph paper, wobbly pen walls, ink ball, flag)
- `controls.js` — `TiltControls` class: `DeviceOrientationEvent` + iOS permission gate, neutral-pose calibration, desktop fallback (arrow keys + pointer-drag)
- `verdict.js` — pure functions: `verdictFor(strokes, par)` → named verdict, `gridEmoji(distances)` → Wordle-style cells, `shareText({...})` → clipboard payload
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.{jpg,png}` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

Header / splash: `app.js` reads `todaysHole()` from `loop.js` (UTC-day-indexed pick from `HOLES`). On Start, `Course` is constructed (canvas + layout + sunk callback), `TiltControls` is attached. Each frame: controls write `gravity {x, y}`, `Course._step()` integrates ball physics, checks wall + hole. Stroke count auto-increments on every transition from `atRest` → moving (no button press). On sink, `Course` calls `onSunk({strokes, distances})` which `app.js` feeds to `verdictFor` + `gridEmoji` to populate the result card.

## Quirks

- **Stroke counting is auto, not button-driven** — every motion-session from rest counts as one stroke. `WAKE_THRESHOLD` and `REST_FRAMES` in `loop.js` tune the threshold; raising them under-counts, lowering them double-counts on tiny wobbles.
- **Neutral pose is calibrated on the first orientation event after Start.** However the player happens to be holding the phone IS flat — there is no preset "phone vertical" assumption. Calling `controls.recalibrate()` mid-game would re-zero from current pose.
- **Hole rotation uses UTC day, not local day.** Everyone worldwide gets the same hole between two midnight-UTC ticks. Display "#N" uses `LAUNCH_DAY` constant (deploy day = #1).
- **Walls are wobbly on purpose** — the per-segment seeded jitter in `drawWall` is what sells the hand-drawn aesthetic. Don't replace with straight `lineTo` calls.
- **`SUNK_VELOCITY_MAX` matters** — too low and a fast putt rolls right over the cup; too high and a tap-into-the-cup feels arbitrary. Currently 2.4 logical-px/frame.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- Hole catalogue lives in `loop.js`; adding a hole is appending to `HOLES` — keep par realistic for the layout (3–5 typical).
