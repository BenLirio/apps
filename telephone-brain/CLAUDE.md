# Telephone Brain

Two-phone semantic-transmission duel administered by the (fictional) **Bureau of Synapse Telegraphy**. One operator gets a feeling tile, encodes it as 4 emojis from a 60-symbol palette, sends to the other phone; receiver picks from 8 shuffled multiple-choice tiles. 10 transmissions total, alternating sender/receiver. Final score plots on a live cross-duo histogram and pairs receive a stamped pair-verdict ("A FUNCTIONALLY-LINKED LOBE PAIR").

## Files

- `index.html` — DOM, screens (landing/waiting/play/reveal/final/disconnected), share-preview meta + ES module entry. Bureau letterhead + form chrome.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **mock-bureaucratic typewriter — cream foolscap, red-ink agency stamps, IBM Plex Mono + Special Elite, dossier rule lines**. Owns colors, fonts, borders, animation.
- `app.js` — entry point: wires DOM, screens, share, rematch, histogram fetch+post, percentile→verdict band.
- `loop.js` — `TelephoneGame` class: round flow (10 rounds, role alternation), composition state, score, history. Uses `pickTruth(roomCode, round)` for deterministic per-arena tiles.
- `net.js` — `TelephoneNet` class: WebSocket relay protocol (create_room / join_room / game_update). 4-letter no-confusables room codes.
- `content.js` — the deck of 100 absurdly specific feelings, the 60-emoji palette, the deterministic `pickRoundTiles` 8-multiple-choice shuffler, and `VERDICTS` percentile bands.
- `histogram.js` — calls `config.distribution.endpoint` (the shared per-slug histogram store). Sends `score*1000` ms; reads bins back, normalizes to per-score counts, computes mid-rank percentile. Falls back to a hand-tuned simulated distribution if the proxy is empty/unreachable.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

- Both clients run the SAME deterministic logic over `roomCode + round` to derive (a) the truth tile index for the round, and (b) the 8-tile shuffle. Sender sees the truth feeling; receiver sees only the cipher emojis but their 8-tile choice grid is the same shuffle as sender's mental model would predict.
- Network state objects are tagged with `kind`: `"transmission"` (sender→receiver, has `emojis`), `"guess"` (receiver→sender, has `choice` + `correct`), `"rematch"` (either→either).
- Score increments on receiver's local guess; sender increments on receiving the peer's `guess` state. Both clients converge to the same score because both read `correct` off the same deterministic truth-index check.
- Histogram: on game complete, `fetchDistribution()` GETs all-duo bins, `recordScore(score)` POSTs our score, `percentileOf` computes mid-rank percentile, `verdictForPercentile` maps to a tier band.

## Quirks

- Distribution endpoint accepts ms in `[0, 10000]` with 5ms bin width. We map score 0..10 to ms `score * 1000` so each integer score lands in its own bin (5000ms ≠ 5005ms). Don't change the encoding without coordinating with the proxy bin layout.
- Both clients track `score` independently from the same deterministic source — we deliberately do NOT have an "authoritative" score. If a peer ever drops a `guess` state, the sender's score will be wrong, but the relay is the system the KB multiplayer rule allows for low-stakes contested claims.
- The 60-emoji palette and 100-feeling deck are hand-tuned so each tile has 3+ plausible 4-emoji compositions; resist trimming the palette below 60 or pruning the deck without re-tuning.
- Bureau voice extends through ALL copy locations (loading, error, empty, result micro-copy), not just the final verdict. Don't dilute it back into neutral assistant tone.
- `pickRoundTiles` salts with `round` so the shuffle is unique per round even though the deck is shared.
- Rematch handshake follows the KB pattern (symmetric, both sides set `pending=true`, host kicks off via `nextRound`).

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
