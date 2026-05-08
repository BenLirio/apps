# Same Pixel

A 32×32 shared wall. 2-second tap cooldown, server-enforced. The board never resets. Live co-presence with strangers, mediated by pixel conflict — share artifact is "I held 23,17 for 3 minutes 12 seconds before someone painted over me with saffron."

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Canvas is 32×32 native; CSS scales it to fill the frame (`image-rendering: pixelated`). The aim/paint UI is a single 3×3 controlpad: arrow buttons in the cross arms, the paint commit button at center, a small × cancel chip in the corner.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **risograph zine print, cursed pastels, hand-stamped chrome (Special Elite + VT323)**. Owns palette CSS vars `--c0..--c7` (must match `loop.js` PALETTE array index-for-index). Owns the `.controlpad` 3×3 grid layout for the dpad-with-commit-at-center.
- `app.js` — entry point: imports `net.js` + `loop.js`, manages session state (myColor, myPixels, longestHold, nemesis counts), wires palette / chips / controlpad / steward modal, exposes `window.share`. `N = 32` and `COOLDOWN_MS = 2000` here mirror the server's authoritative values.
- `net.js` — WebSocket protocol: `pixel_join` / `pixel_tap` / `pixel_update` / `pixel_snapshot` / `pixel_cooldown_ack`. Server (`infrastructure/aws-multiplayer/message.js`) is authoritative for cooldown and pixel state. Knows `TOTAL = 1024`.
- `loop.js` — board mirror (`Uint8Array(1024)`), canvas render via `putImageData`, pan/pinch/double-tap zoom, target-pick (sets crosshair + emits to app.js). Exports `setTarget(x,y)` for the nudge dpad to fine-tune the active target by ±1 cell. **`N = 32` here is the canonical grid size** — keep `app.js`, `net.js`, `index.html` `<canvas width/height>`, and the server (`PIXEL_N` in `infrastructure/aws-multiplayer/message.js`) in lockstep when changing it.
- `feedback.js` — DO NOT EDIT. Byte-copied.
- `og.jpg` — share-preview riso mosaic.

## Data flow

1. App boots → `net.connect()` opens WebSocket → server responds `pixel_snapshot { board, you, members, cooldownRemainingMs }`.
2. `loop.setBoard(decoded)` mirrors the 1024-byte board into a Uint8Array; render loop ImageData-blits it to the canvas at 32×32, then CSS scales the canvas for pan/zoom.
3. User taps a cell on the canvas → `loop` sets `target` and shows the crosshair + emits `onTarget()` → commit button enables (when cooldown clear).
4. User clicks commit → `net.tap(x, y, colorIdx)` → server validates cooldown (60s, conditional DDB update on connection's `lastTapAt`), writes one byte, broadcasts `pixel_update { x, y, colorIdx, by }` to every member of the shared SAMEPIXEL room.
5. Local stats (`myPixels`, `nemesisCounts`, `longestHoldMs`) update on every received `pixel_update` whose target overwrote one of ours.

After 5 minutes a silent `setTimeout` opens the steward-notice modal with surviving count, longest hold, nemesis color, and a one-line verdict.

## Quirks

- **The cooldown is server-side, not client-side**. The client just reflects what the server tells it via `pixel_cooldown_ack` and the `cooldown` error reply. Don't move it client-side; cross-device-same-IP exploit immediately. Currently 2s — short enough to feel responsive solo, long enough that a single client still takes ~34 minutes to flip the entire 1024-cell board solo (32×32 / 0.5 taps-per-sec).
- **The 8 colors in `style.css :root --c0..--c7` must stay in lockstep with `PALETTE` in `loop.js`.** They are the canonical encoding of `colorIdx`.
- **Grid size is dual-sourced**. `loop.js` `N` is the canonical client value; the server hard-codes `PIXEL_N = 32` in two spots inside `infrastructure/aws-multiplayer/message.js` (`pixel_join` and `pixel_tap` branches). Any change to N requires editing both files **and** wiping the existing SAMEPIXEL room item from `ef-game-rooms` (otherwise the server keeps serving the old-sized board on `pixel_join`). Then redeploy the message Lambda.
- **No per-pixel ownership tracking on the server**. Each `pixel_update` carries `by: connectionId`. Each client maintains its own `myPixels` map by listening to broadcasts. Refreshing the page **resets your local stats** — that's intentional. The steward notice is a *session* artifact.
- **The board is 1024 bytes, stored as a single `B` (binary) attribute on a single DDB item with `roomCode = 'SAMEPIXEL'`**. 1KB ≪ 400KB DDB item limit. Read-modify-write per tap is fine at small QPS.
- **The relay extension is shared infra**. The Lambda actions `pixel_join` / `pixel_tap` and the `role: 'pixel'` disconnect branch live in `infrastructure/aws-multiplayer/{message,disconnect}.js`. Any change to the protocol requires re-deploying both Lambdas.
- **Controlpad layout is a 3×3 CSS grid**. Up/left/right/down occupy the cross arms; the paint commit button sits at center (`grid-column: 2; grid-row: 2`). The paint button's own bg/shadow/text-size are larger than the dpad arrows so it reads as primary verb. The cancel × is positioned absolutely in the top-right corner of the controlpad.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- If the cooldown duration changes, update the constant in BOTH `infrastructure/aws-multiplayer/message.js` (`COOLDOWN_MS`) and `app.js` (`COOLDOWN_MS`). They should stay equal — the client value is only a UI prediction; the server is authoritative. After editing the server file, redeploy via the snippet in `skills/implement-deploy/references/aws-multiplayer.md`.
- If the grid size changes, see the "Grid size is dual-sourced" quirk above — DDB wipe + Lambda redeploy are both required.
