# Cartograph Duel

Two friends join via room code and race to draw the outline of a country from
memory. Closest to the real shape (geometric IoU) wins the round. Best of 3
takes the match.

## Files

- `index.html` — DOM (7 screens: hero=mode-chooser, create, join, waiting, round, round-result, match-result), share-preview meta, ES module entry.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **cartographer's notebook** (cream paper, IM Fell English serif, ink-blue + vermilion, dashed dividers). Each `.screen` fills the viewport (`min-height: 100svh` via `.app` + `flex: 1`) so phases feel like distinct pages, with a 240ms fade-in transition. `.screen-cta` is a flex column with gap so the hero can stack two equally-weighted CTAs (create vs join).
- `app.js` — entry point. Hero is the mode chooser ("Open a new room" / "Answer a summons"). Wires the create-form screen, the join-form screen, `?room=` deep link (skips hero, lands on join with banner pre-filled), back links, and `window.share`. Hands off to `loop.init()` once both peers are paired.
- `loop.js` — game state machine + drawing canvas. Owns the post-pair screens (waiting, round, round-result, match-result). Round flow: pick country → draw → submit → score both → reveal → next round / match result. 60s round timer. `show()` toggles `[hidden]` on the canonical `SCREEN_IDS` list and scrolls to top.
- `net.js` — WebSocket protocol. Connects to `wss://l67yfgkb1j.execute-api.us-east-1.amazonaws.com/prod`. Exposes `createRoom / joinRoom / sendUpdate / on`.
- `countries.js` — 12 hand-simplified country outlines as normalized `[x, y]` polygons + deterministic `pickCountry(roomCode, roundIndex)` so both peers see the same prompt.
- `scoring.js` — `scoreDrawing(stroke, w, h, refPoly)` rasterizes both shapes to a 240×240 offscreen canvas and computes `IoU^0.65 * 100`. `renderOverlay()` paints the side-by-side reveal cards.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image (cartographer's notebook quill-pens-as-dueling-swords). Regenerate via `implement-deploy` only if the visual identity or core hook changes.

## Data flow

- `app.js` shows the hero on first load. Hero presents two equal-weighted CTAs ("Open a new room" / "Answer a summons") — that single decision IS the hero. From there the user lands on either `screen-create` or `screen-join`, each with its own focused form (name only on create; name + room code on join). On `?room=ABCD` the hero is skipped entirely and the user lands on `screen-join` with the challenge banner shown and the code pre-filled.
- Create-form submits → `net.createRoom(name)`. On `room_created` the user moves to the waiting screen with QR + join link. On `player_joined` (host) or `joined_room` (guest) → `loop.init({ role, playerName, opponentName, roomCode })`.
- `loop.js` runs the round state machine. On each round: `pickCountry(roomCode, round)` → both players see the same name. Each player draws on their own canvas (no real-time stroke sync — drawing is private). On submit, `loop.js` calls `scoring.scoreDrawing(...)` locally AND sends `{ kind: 'round_submit', round, stroke, canvasW, canvasH }` over the relay so the opponent can score the same stroke.
- Both peers compute scores from identical inputs (deterministic IoU on the same reference polygon), so they agree without server arbitration.
- Rematch is the symmetric handshake from `multiplayer.md`: peer A sends `{ kind: 'rematch' }`; peer B echoes; host kicks off via `{ kind: 'rematch_start' }`.

## Quirks

- **One decision per screen.** Hero = "create or join?" (no other content, no rules block — the tagline carries the format). Create screen = "what's your name?" Join screen = "name + code". Setup mixed all three concerns originally and got user-feedback-flagged as "one large overwhelming page". Don't add a second concern back to any of these screens — split into a new screen instead.
- **Errors are scoped per form.** `#create-error` lives in the create card; `#join-error` lives in the join card. `app.js` routes `net.on('error')` based on `role` so the message lands on the form the user just submitted from.
- **Drawing is private until submit.** This is the *one* multiplayer call mechanic-wise — KB warns explicitly against real-time stroke sync (latency). Per-canvas private + simultaneous submit is the canonical "simultaneous reveal" pattern.
- **Scoring lifts the IoU curve with `^0.65`** so a recognisable freehand outline reads as ~50–70% rather than a brutal 20–30%. Tuned by eye on Italy + UK + Australia. If players consistently feel cheated by scores, lower the exponent (e.g. 0.55) for more lift, but do not show raw IoU — it's mathematically defensible and emotionally crushing.
- **Reference polygons are intentionally lo-fi.** ~30 vertices each, hand-traced. Adding more detail makes them harder to match from memory and slower to score. Keep the silhouette readable, drop tiny features.
- **Country prompt is `pickCountry(roomCode, roundIndex)` deterministically.** Both peers compute the same country without an extra round-trip; the host doesn't have to tell the guest what's next.
- **Room code is 4 chars from no-confusables alphabet** (per multiplayer.md "Room-code session-friction kit"). Don't expand to 6 — short codes are easier to read across a table.
- **Canvas uses `touch-action: none` and the primary action button (`Submit`) sits **below** the canvas in the DOM.** Acceptable here because the drawing surface is bounded (square, ~520px max) and the submit button is always visible without scrolling on a 375x667px viewport — see `pitfall 10` in `ai-pitfalls.md`. If the canvas ever grows past the viewport, add an Edit-Mode toggle.

## Editing rules

- Soft cap 400 lines per JS file. `loop.js` is at ~340 — split off `controls.js` (canvas drawing + pointer events) if it crosses 400.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- Do not add real-time stroke broadcasting between peers. The whole design relies on `simultaneous-submit` to dodge the latency problem flagged in `aws-multiplayer.md` and `multiplayer.md`.
- Treat each `<section class="screen">` as its own page — full viewport, one job. If a screen starts cramming together two distinct concerns (e.g. mode + form, marketing + form, create-form + join-form), split it. Add new screens to the `SCREEN_IDS` list in `loop.js`.
