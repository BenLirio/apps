# Synapse Sync

Two-phone independent-agreement duel administered by the (fictional) **Bureau of Synaptic Concordance**. Both operators see the SAME feeling at the SAME time and independently compose a 4-emoji response from a 60-symbol palette; the round score is the size of the set intersection between the two compositions (0..4 matched). 5 trials total, no roles. Final concordance score (0..20) plots on a live cross-duo histogram; pairs receive a stamped pair-verdict ("A FUNCTIONALLY-LINKED LOBE PAIR").

This was renamed from `telephone-brain` on 2026-05-05 in response to a feature_request asking to flip the asymmetric sender→receiver mechanic into symmetric simultaneous play. The old slug redirects via a sibling stub directory.

## Files

- `index.html` — DOM, screens (landing/waiting/play/reveal/final/disconnected), share-preview meta + ES module entry. Bureau letterhead + form chrome.
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **mock-bureaucratic typewriter — cream foolscap, red-ink agency stamps, IBM Plex Mono + Special Elite, dossier rule lines**. Owns colors, fonts, borders, animation.
- `app.js` — entry point: wires DOM, screens, share, rematch, histogram fetch+post, percentile→verdict band. Renders prompt, palette, lock-status, side-by-side reveal.
- `loop.js` — `SyncGame` class: round flow (5 rounds, no roles), my+peer composition state, lock state, set-overlap scoring, history. Uses `pickPrompt(roomCode, round)` for deterministic per-round prompt and `palette()` (= `getPaletteForPrompt(promptIndex)`) for the round's symbol kit.
- `net.js` — `SyncNet` class: WebSocket relay protocol (create_room / join_room / game_update). 4-letter no-confusables room codes. Two `state.kind` values: `lock` and `rematch`.
- `content.js` — the deck of 100+ absurdly specific feelings, eight 24-emoji **themed palettes** (`THEMES`), the per-feeling theme-index lookup `FEELING_THEMES`, `getPaletteForPrompt(promptIndex)` / `getThemeName(promptIndex)`, `pickPrompt`, `overlapScore` (the set-intersection scorer; takes the round's palette so peer wire-format strings tokenise correctly), `compositionToSet(comp, palette)` (multi-codepoint-safe palette tokenizer), and `VERDICTS` percentile bands.
- `histogram.js` — calls `config.distribution.endpoint` (the shared per-slug histogram store) under SLUG `synapse-sync`. Sends `score*500` ms (score 0..20 → 0..10000 ms, each integer in its own 5ms bin); reads bins back, normalizes to per-score counts, computes mid-rank percentile. Falls back to a hand-tuned simulated distribution if the proxy is empty/unreachable.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image (carried over from telephone-brain; bureau-letterhead aesthetic still fits). Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

- Both clients run identical deterministic logic on `roomCode + round` to derive the prompt feeling for the round (`pickPrompt`). Same prompt, same time, no leader.
- Round flow: each client locally builds a 4-emoji composition, taps LOCK, sends `{ kind: "lock", round, emojis }` to the peer through the relay. Once a client holds both `composition` (its own) and `peerComposition` (received from peer), it computes `overlapScore` (set-intersection size) and advances to the reveal screen via `onRoundComplete`.
- Score authority: pure-function scoring runs identically on both clients with identical inputs (the two compositions), so both clients always converge to the same per-round overlap and same total. No "authoritative" coordinator.
- Histogram: on game complete, `fetchDistribution()` GETs all-duo bins, `recordScore(score)` POSTs our score, `percentileOf` computes mid-rank percentile, `verdictForPercentile` maps to a tier band.

## Quirks

- Distribution endpoint accepts ms in `[0, 10000]` with 5ms bin width. We map score 0..20 to ms `score * 500` so each integer score lands in its own bin. Don't change the encoding without coordinating with the proxy bin layout.
- The 60-emoji palette and 100+-feeling deck are hand-tuned so each prompt has 3+ plausible compositions on which two independent players can plausibly converge; resist trimming without re-tuning.
- The palettes include multi-codepoint graphemes (😵‍💫, 👁️, 🛣️, etc.). Use `compositionToSet(comp, palette)` from `content.js` to tokenise wire-format strings — never split emoji strings on JS string indexing or characters will fragment.
- Palettes vary per prompt: each prompt's `FEELING_THEMES[promptIndex]` selects one of eight themed 24-emoji palettes (8 universal emotional emojis + 16 theme-specific). Both clients derive the palette identically from the prompt index, so no extra wire chatter is needed. The first 8 entries in every palette are the SAME universals, giving partner-agnostic backup symbols regardless of theme. When you call scoring/tokenisation across rounds, always pass the round's palette (`game.palette()` or `getPaletteForPrompt(game.promptIndex(round))`) — the palette is ambiguous otherwise.
- After `nextRound()`, call `rebuildPaletteForRound()` (or rely on `renderPlay()` to do it) before the user can tap symbols, so the click handlers point at the new round's palette, not last round's.
- Bureau voice extends through ALL copy locations (loading, error, empty, result micro-copy), not just the final verdict. Don't dilute it back into neutral assistant tone.
- Rematch handshake follows the KB pattern (symmetric, both sides set `pending=true`, host kicks off via `nextRound`).
- Old `telephone-brain` slug points here via `/apps/telephone-brain/index.html` (refresh-redirect stub) so older share links still resolve.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
