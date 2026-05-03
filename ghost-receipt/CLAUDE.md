# Ghost Receipt

Tell the cashier what kind of night it was; an AI-driven, mock-bureaucratic 12-line receipt prints, line by line, themed to your description, ending in a NIGHT OUT TOTAL stamped by the Former Self Tavern.

## Files

- `index.html` — DOM + share-preview meta + ES module entry + favicon wiring. Three top-level UI states: `#promptForm` (initial), `#cashierLoading` (during AI call), `#counter` + `#shareRow` (receipt revealed).
- `base.css` — DO NOT EDIT. Byte-copied from `infrastructure/styles/base.css`.
- `style.css` — aesthetic: **thermal-receipt monospace + dim bar-counter**. Owns colors, fonts (VT323 + Special Elite), paper texture, perforated edges, stamp typography, totals layout, the slight rotation drift, the wobble-on-closed animation, the `.order-pad` (prompt form) and `.cashier-loading` styles.
- `app.js` — entry point: imports `journey.js`, assigns `window.share` and `window.newReceipt`, kicks off `startJourney()`.
- `mechanic.js` — pure logic: seeded RNG (mulberry32 over an FNV-1a hash), the five line-item banks (CHARGES / ITEMS / REGRETS / GHOSTS / MISC ≈ 90 entries), price formatting / tokens, the captionable-ending totals math (`computeTotals`), and `buildReceiptFromSeed(seed)` — the deterministic banks-only fallback used when AI fails AND the legacy `#seed=N` hydration path. No DOM, no network.
- `ai.js` — network side: `generateReceipt(userText)` calls the OpenAI proxy (`gpt-5.4-mini`, `response_format: 'json_object'`) and assembles a render-ready receipt; `saveReceiptToStore` / `loadReceiptFromStore` wrap the case-store short-URL service; URL-state helpers (`?c=<id>` for new, `#seed=N` reader for legacy). All network failures fall through silently to the deterministic banks path.
- `journey.js` — DOM wiring + screen flow. Owns the prompt-form submit handler, the cashier-itemizing loading state, the tap loop (one line per tap), the totals stamp, share + reset CTAs, and the four-copy locations.
- `feedback.js` — DO NOT EDIT. Byte-copied from `infrastructure/feedback/widget/`.
- `favicon.jpg` — tiny crumpled receipt with a red dollar-sign stamp. Image-proxy `pro` 1:1.
- `og.jpg` — share-preview hero. Image-proxy `pro` 16:9. Regenerate only if visual identity or core hook changes.

## Data flow

1. **Boot** (`journey.startJourney → bootFromUrl`): if `?c=<id>` → `loadReceiptFromStore` → fast-fill; else if `#seed=N` (legacy link) → `buildReceiptFromSeed` → fast-fill; else show `#promptForm`.
2. **Submit**: user describes the night (≥4 chars). `generateReceipt(text)` calls the AI proxy with a system prompt that pins voice (mock-bureaucratic, dry, deadpan, indie-sleaze 1:47 AM) and a strict JSON schema (`{lines[12], extras[3], fine, stamp, stamp_meta}`). `assembleReceipt` normalizes lines/prices, pads/clamps to 12 + 3, applies the `computeTotals` discipline (subtotal floor at $42, captionable .47/.69/.88/.13/.22/.07 ending), and sprinkles the misprint flicker.
3. **Persist**: `saveReceiptToStore(receipt)` POSTs the compact form (≤8000 chars) to case-store, returning an 8-char `id`. URL becomes `?c=<id>`. Share copies that URL.
4. **Tap loop**: receipt object is fully precomputed; tap loop only *reveals* one of the 12 lines per tap. After tap 12, totals + extras + stamp print and share row appears.
5. **Receipt object shape**: `{ seed, source: "ai"|"banks", userPrompt, stampMeta, lines: [{text, price, priceStr, contributes, misprint}] x12, extras: [{text, amount, amountStr}] x3, subtotal, total, totalStr, fine, stamp }`. `price` is a number (cents) OR a literal string token (`"—"`, `"$∞"`, `"see attached"`, `"cheap"`, `"gone"`).
6. **Compact form** (case-store): `{v,s,src,p,sm,l:[{t,p,m}],e:[{t,a}],st,to,f,sf}` — strip derived fields (`priceStr`, `amountStr`, `totalStr`, `contributes`); the renderer recomputes them via `expandReceipt`.

## Quirks

- **AI is the primary path; banks are the fallback.** If the AI call fails (network, rate-limit, malformed JSON), `generateReceipt` silently builds a banks-only receipt seeded by the user's text. The user always gets an artifact.
- **Captionable-ending discipline lives in `computeTotals`, not in the AI.** Even when AI provides priced lines, we recompute the final total to land on `.47 / .69 / .88 / .13 / .22 / .07`. Round-numbered totals feel rigged; this rule is non-negotiable.
- **Subtotal floor at $42.00** if the priced lines came in suspiciously light. Without this floor, totals can read as a joke-killer.
- **Misprint flicker on ~1 in 9 lines** (`misprint` flag) — leans into thermal-receipt grunge. Driven by the same seed so reloads of a `?c=` link flicker identically.
- **`?c=<id>` is the new share URL**; legacy `#seed=N` is read-only for back-compat. We never write to the hash anymore. Old links still hydrate via `buildReceiptFromSeed`.
- **Tap target is forgiving** — both the receipt and the dark counter background register taps. Don't narrow this.
- **Post-close, taps wobble the receipt.** Resist the urge to allow a 13th line — the close is the artifact.
- **AI prompt voice rule**: dry, deadpan, mock-bureaucratic, indie-sleaze 1:47 AM. Never cute, never zoomer slang, never corporate snark. The system prompt enforces this; if the model ever drifts, sharpen the system prompt rather than scrubbing output downstream.

## Editing rules

- Soft cap 400 lines per JS file. `mechanic.js` (banks) is the largest — split into `banks.js` + `mechanic.js` if you grow the line bank past ~150 entries.
- After any structural edit (file added / removed / responsibility moved), regenerate this CLAUDE.md.
- The tone is **dry, deadpan, indie-sleaze 1:47 AM, mock-bureaucratic**. Never zoomer slang, never corporate snark, never "cute." When adding bank entries, read them aloud — if they sound like a TikTok caption, cut them.
