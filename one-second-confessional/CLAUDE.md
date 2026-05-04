# 1-Second Confessional

Hold a button for as close to 1.000s as you can. The button reads your duration to 3 decimals and stamps you with a hand-written confession deterministically pinned to your bin (~5ms wide). Three holds per session, three confessions, URL-fragment encoded share.

## Files

- `index.html` — DOM + share-preview meta + ES module entry. Alpine `x-data` drives the four screens (intro / hold / result / final).
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **arcade fortune-machine** — black void, blood-red oracle button, ivory typewriter (Special Elite) confessions, monospace (VT323) digit readout. Mock-instrument register.
- `app.js` — entry point: imports `journey.js` (factory + window assignment) and wires `window.share`.
- `mechanic.js` — pure logic: 200-line confession bank, `computeResult(durationMs, dateInt)`, daily-rotation seed, `encodeShare`/`decodeShare` for the URL fragment.
- `journey.js` — Alpine factory `oneSecondConfessional()`. Owns the screen state machine, pointer-event handlers (`pointerdown` / `pointerup` / `pointercancel`), and replay-from-fragment on init.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `og.jpg` — share-preview image. Regenerate via `implement-deploy` only if visual identity or core hook changes.

## Data flow

`journey.js` captures press/release timestamps via `performance.now()` on the oracle button (`pointerdown` → start, `pointerup` → elapsed). Each elapsed-ms is fed to `computeResult(elapsedMs, dateInt)` which returns `{durationStr, binRangeStr, tier, confession, isOutOfRange}`. After three holds, `encodeShare` writes the URL fragment as `#h=ms,ms,ms&d=YYYYMMDD` and the final screen renders the three result cards. On load, `init()` calls `decodeShare(window.location.hash)` and jumps straight to the final screen if a valid fragment is present, replaying with the encoded date so the receiver sees the same three confessions.

## Quirks

- **No timer is rendered during the press.** Showing a live timer mid-hold would let users cheat by watching it tick — the comedy is that you can't. The duration is revealed only on release. Don't add a press-progress bar.
- **Bins are 5ms wide across 0.500–1.500s** (200 bins, one confession per bin). Outside that range gets a single "you broke the contract" line — don't add per-millisecond out-of-range variants.
- **Per-day rotation:** the bin → confession map is rotated by a `dayShift` derived from today's UTC date, so the same bin returns a different line on different days. Shared URLs include the original date (`d=YYYYMMDD`) so receivers replay deterministically.
- **`pointercancel` is treated as a release**, not a discarded hold. A user who committed to a press and got interrupted is still owed a confession; the alternative (silent drop) feels broken.
- **Confession voice rule:** every line is something the BUTTON declares about you, not a psychic interpretation. Lines must be flattering or cursed-but-never-shaming — read each back as if it were about your favorite hobby. Do not introduce shaming, judgemental, or moralizing lines on edits.
- **The full bank is 200 entries** so the bin → confession map is 1:1 within any single day. Don't reduce the bank size below 200 without re-checking that 3 holds in one session can't all collide on the same line.

## Editing rules

- Soft cap 400 lines per JS file. Split along the next natural seam if you cross it.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
