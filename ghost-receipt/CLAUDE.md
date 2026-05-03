# Ghost Receipt

Tap a curling thermal-paper receipt; absurd itemized line items print one by one until twelve taps stamp a "NIGHT OUT TOTAL" — a screenshottable mock-bureaucratic ledger of a night that got away from you.

## Files

- `index.html` — DOM + share-preview meta + ES module entry + favicon wiring
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **thermal-receipt monospace + dim bar-counter**. Owns colors, fonts (VT323 + Special Elite), paper texture, perforated edges, stamp typography, totals layout, the slight rotation drift, the wobble-on-closed animation.
- `app.js` — entry point: imports `journey.js`, assigns `window.share` and `window.newReceipt`, kicks off `startJourney()`.
- `mechanic.js` — pure logic: seeded RNG (mulberry32 over an FNV-1a hash), the five line-item banks (CHARGES / ITEMS / REGRETS / GHOSTS / MISC ≈ 90 entries), the bank rotation, `buildReceipt(seed)` that returns the entire deterministic receipt object (lines + extras + total + fine print + stamp), URL-fragment helpers (`readSeedFromHash` / `writeSeedToHash`).
- `journey.js` — DOM wiring + tap loop. Handles tap on the receipt OR the counter background, prints one line per tap, fires the totals stamp after the 12th, hooks `share()` (Web Share → clipboard fallback) and `newReceipt()` (clear seed, reload). Owns the four-copy locations.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `favicon.jpg` — tiny crumpled receipt with a red dollar-sign stamp. Image-proxy `pro` 1:1.
- `og.jpg` — share-preview hero. Image-proxy `pro` 16:9. Regenerate only if visual identity or core hook changes.

## Data flow

1. `app.js` → `startJourney()` reads the URL hash (`#seed=N`). If absent, generates a fresh 32-bit seed and writes it back into the hash so the user's URL is shareable from tap one.
2. `buildReceipt(seed)` precomputes every line, every extra, the total, and the stamp/footer text — fully deterministic. The tap loop only *reveals* the precomputed lines one at a time.
3. Receipt object shape: `{ seed, stampMeta, lines: [{text, price, priceStr, contributes, misprint}] x12, extras: [{text, amount, amountStr}] x3, subtotal, total, totalStr, fine, stamp }`. `price` is a number (cents) OR a literal string token (`"—"`, `"$∞"`, `"see attached"`, `"cheap"`, `"gone"`).
4. Shared link path: arriving with `#seed=...` skips the tap loop and renders the entire receipt instantly (recipient wants the artifact, not the game).

## Quirks

- **Bank rotation is hand-tuned, not random per tap.** The 12 banks-by-position list opens with a CHARGES line so it reads like a receipt and closes with a REGRETS line so the totals stamp lands hard. Don't shuffle this.
- **Final total ends in a captionable two-digit ending** (`.47 / .69 / .88 / .13 / .22 / .07`) — round-numbered totals feel rigged, captionable endings feel like reality. The math floors then re-adds the ending, so it is *not* an exact arithmetic sum of the visible lines. That's intentional.
- **Subtotal floor at $42.00** if the random pick happened to land mostly on unpriced regrets (`—` lines). Without the floor, totals can come in absurdly low and undermine the joke.
- **Misprint flicker on ~1 in 9 lines** (`misprint` flag) — leans into thermal-receipt grunge. Driven by the seeded RNG so it's reproducible from a shared link.
- **Tap target is forgiving** — both the receipt itself AND the dark counter background register taps. Don't narrow this; the design intent is "anywhere on the slip or the negative space around it."
- **Post-close, taps wobble the receipt and do nothing else.** Resist the urge to allow a 13th line; the close is the artifact.
- **The seed is in the URL hash from tap one**, not just on share. Refresh preserves the receipt; "a different night" button explicitly clears the hash and reloads.

## Editing rules

- Soft cap 400 lines per JS file. `mechanic.js` (banks) is the largest — split into `banks.js` + `mechanic.js` if you grow the line bank past ~150 entries.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- The tone is **dry, deadpan, indie-sleaze 1:47 AM, mock-bureaucratic**. Never zoomer slang, never corporate snark, never "cute." When adding bank entries, read them aloud — if they sound like a TikTok caption, cut them.
