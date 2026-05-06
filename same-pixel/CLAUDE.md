# Same Pixel

A 200×200 shared wall. One tap a minute, server-enforced. The board never resets. Live co-presence with strangers, mediated by pixel conflict — share artifact is "I held 142,87 for 3 minutes 12 seconds before someone painted over me with saffron."

## Files

- `index.html` — DOM + share-preview meta + ES module entry
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **risograph zine print, cursed pastels, hand-stamped chrome (Special Elite + VT323)**. Owns palette CSS vars `--c0..--c7` (must match `loop.js` PALETTE array index-for-index).
- `app.js` — entry point: imports `net.js` + `loop.js`, manages session state (myColor, myPixels, longestHold, nemesis counts), wires palette / chips / commit / nudge dpad / steward modal, exposes `window.share`.
- `net.js` — WebSocket protocol: `pixel_join` / `pixel_tap` / `pixel_update` / `pixel_snapshot` / `pixel_cooldown_ack`. Server (`infrastructure/aws-multiplayer/message.js`) is authoritative for cooldown and pixel state.
- `loop.js` — board mirror (Uint8Array(40000)), canvas render via `putImageData`, pan/pinch/double-tap zoom, target-pick (sets crosshair + emits to app.js). Exports `setTarget(x,y)` for the nudge dpad to fine-tune the active target by ±1 cell.
- `feedback.js` — DO NOT EDIT. Byte-copied.
- `og.jpg` — share-preview riso mosaic.

## Data flow

1. App boots → `net.connect()` opens WebSocket → server responds `pixel_snapshot { board, you, members, cooldownRemainingMs }`.
2. `loop.setBoard(decoded)` mirrors the 40000-byte board into a Uint8Array; render loop ImageData-blits it to the canvas at 200×200, then CSS scales the canvas for pan/zoom.
3. User taps a cell on the canvas → `loop` sets `target` and shows the crosshair + emits `onTarget()` → commit button enables (when cooldown clear).
4. User clicks commit → `net.tap(x, y, colorIdx)` → server validates cooldown (60s, conditional DDB update on connection's `lastTapAt`), writes one byte, broadcasts `pixel_update { x, y, colorIdx, by }` to every member of the shared SAMEPIXEL room.
5. Local stats (`myPixels`, `nemesisCounts`, `longestHoldMs`) update on every received `pixel_update` whose target overwrote one of ours.

After 5 minutes a silent `setTimeout` opens the steward-notice modal with surviving count, longest hold, nemesis color, and a one-line verdict.

## Quirks

- **The cooldown is server-side, not client-side**. The client just reflects what the server tells it via `pixel_cooldown_ack` and the `cooldown` error reply. Don't move it client-side; cross-device-same-IP exploit immediately.
- **The 8 colors in `style.css :root --c0..--c7` must stay in lockstep with `PALETTE` in `loop.js`.** They are the canonical encoding of `colorIdx`.
- **No per-pixel ownership tracking on the server**. Each `pixel_update` carries `by: connectionId`. Each client maintains its own `myPixels` map by listening to broadcasts. This means refreshing the page **resets your local stats** — that's intentional. The steward notice is a *session* artifact; if you want lifetime stats, that's a different (DDB-heavy) feature.
- **The board is 40000 bytes, stored as a single `B` (binary) attribute on a single DDB item with `roomCode = 'SAMEPIXEL'`**. 40KB ≪ 400KB DDB item limit. Read-modify-write per tap is fine at small QPS; if write contention shows up later, switch to per-pixel items keyed `(roomCode, pixelIdx)`.
- **The relay extension is shared infra**. The Lambda actions `pixel_join` / `pixel_tap` and the `role: 'pixel'` disconnect branch live in `infrastructure/aws-multiplayer/{message,disconnect}.js`. Any change to the protocol requires re-deploying both Lambdas.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- If the cooldown duration changes, update the constant in BOTH `infrastructure/aws-multiplayer/message.js` (`COOLDOWN_MS`) and `app.js` (`COOLDOWN_MS`). They should stay equal — the client value is only a UI prediction; the server is authoritative.
